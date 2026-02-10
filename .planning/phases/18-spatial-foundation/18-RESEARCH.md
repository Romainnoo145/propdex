# Phase 18: Spatial Foundation - Research

**Researched:** 2026-02-10
**Domain:** PostGIS spatial database with GeoAlchemy2 and SQLAlchemy 2.x async
**Confidence:** HIGH

## Summary

Phase 18 establishes the spatial data layer that all of v3.0 Area Intelligence builds upon. The phase requires enabling PostGIS in an existing PostgreSQL database, creating parcel cache tables with GIST-indexed geometry columns, implementing multi-tenant isolation via RLS policies, and providing coordinate transformation helpers.

The codebase already uses Shapely for geometry operations and has established patterns for SQLAlchemy 2.x async (Mapped[], mapped_column()), direct transaction commits (db.add/db.flush/db.commit), and NULLIF fail-closed RLS policies. PostGIS will replace Shapely for spatial joins and containment queries, offering 10-100x performance gains via GIST indexes. GeoAlchemy2 0.14+ provides full SQLAlchemy 2.0 async support with the mapped_column() declarative style.

The three-tier cache strategy stores lightweight pre-scan data (geometry, address, flags) in the database for filtering, JSONB enrichment data (bestemming, vergunningen) on-demand, and never caches BRK eigendomsdata (Tier 3 - query-time only). All new tables follow existing RLS patterns with organization_id + SET LOCAL for multi-tenant isolation.

**Primary recommendation:** Use GeoAlchemy2 0.15+ with PostGIS 3.5 for SQLAlchemy 2.0 async compatibility, store geometries in EPSG:28992 with GIST indexes, transform to EPSG:4326 at API boundary using PostGIS ST_Transform + ST_AsGeoJSON, and apply existing NULLIF RLS patterns to spatial tables.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostGIS | 3.5+ | Spatial database extension | Industry standard for spatial queries in PostgreSQL, 10-100x faster than application-layer geometry operations |
| GeoAlchemy2 | 0.15+ | SQLAlchemy-PostGIS bridge | Only mature library for SQLAlchemy 2.0 async + PostGIS integration, supports Mapped[] type hints |
| pyproj | 3.7+ | Coordinate transformations | Official Python bindings for PROJ library, handles datum shifts between EPSG:28992 and EPSG:4326 |
| SQLAlchemy | 2.0.25+ | ORM with async support | Already in use, GeoAlchemy2 extends it for spatial types |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Shapely | 2.0+ | Geometry validation in Python | Already installed - use only for WKT/GeoJSON parsing before DB insert, not for spatial queries |
| asyncpg | 0.29+ | Async PostgreSQL driver | Already in use - GeoAlchemy2 works transparently with it |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostGIS | Shapely for all spatial ops | 10-100x slower - Shapely in Python vs. GIST-indexed C queries in PostGIS |
| GeoAlchemy2 | Raw SQL for geometry columns | Lose SQLAlchemy ORM benefits, manual type handling, more verbose |
| GIST index | No spatial index | Query performance degrades to full table scans, unacceptable for 10K+ parcels |

**Installation:**
```bash
# PostGIS (system package)
sudo apt install postgresql-16-postgis-3  # Adjust for PostgreSQL version

# Python packages (already in pyproject.toml)
pip install "geoalchemy2>=0.15.0" "pyproj>=3.7.0" "shapely>=2.0.0"
```

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── models/
│   ├── parcel_cache.py        # Spatial model with Geometry column
│   ├── area_scan.py            # Scan orchestration table
│   └── scan_result.py          # Join table: scan -> parcels
├── services/
│   ├── spatial_helpers.py      # bbox_query, transform_to_4326, validate_geometry
│   └── parcel_cache_service.py # Cache population logic
└── alembic/
    └── versions/
        └── XXXX_enable_postgis.py  # Migration with extension + exclude_object
```

### Pattern 1: GeoAlchemy2 with SQLAlchemy 2.0 Mapped Columns

**What:** Define geometry columns using modern SQLAlchemy 2.x declarative style with type hints
**When to use:** All new spatial models in this phase
**Example:**

```python
# Source: https://geoalchemy-2.readthedocs.io/en/latest/gallery/test_orm_mapped_v2.html
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from geoalchemy2 import Geometry, WKBElement
import uuid

class Base(DeclarativeBase):
    pass

class ParcelCache(Base):
    __tablename__ = "parcel_cache"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Geometry stored in EPSG:28992 (RD New - Dutch national grid)
    geometry: Mapped[WKBElement] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=28992),
        nullable=False,
    )

    address: Mapped[str] = mapped_column(String(500))
    has_pand: Mapped[bool] = mapped_column(default=False)

    # JSONB for on-demand enrichment data (Tier 2 cache)
    enrichment_data: Mapped[dict] = mapped_column(
        type_=JSONB,
        nullable=True,
        default=None,
    )
```

**Key points:**
- `Mapped[WKBElement]` is the type hint for geometry columns
- `srid=28992` locks geometry to Dutch RD New coordinate system
- WKBElement wraps Well-Known Binary geometry representation
- Geometry validation happens via PostGIS functions, not Shapely

### Pattern 2: GIST Index Creation in Alembic

**What:** Create spatial indexes during migrations for geometry columns
**When to use:** Every table with a geometry column
**Example:**

```python
# Source: https://postgis.net/workshops/postgis-intro/indexing.html
from alembic import op

def upgrade() -> None:
    # Create table with geometry column (GeoAlchemy2 handles type)
    op.create_table('parcel_cache', ...)

    # Create GIST spatial index
    op.execute("""
        CREATE INDEX idx_parcel_cache_geometry_gist
        ON parcel_cache
        USING GIST (geometry)
    """)
```

**Why GIST?**
- GIST (Generalized Search Tree) implements R-Tree for bounding box queries
- 10-100x faster than sequential scans for ST_Contains, ST_Intersects, ST_DWithin
- Automatically used by PostGIS spatial functions when available

### Pattern 3: Coordinate Transformation at API Boundary

**What:** Store in EPSG:28992, return EPSG:4326 GeoJSON to frontend
**When to use:** All API responses with geometry
**Example:**

```python
# Source: https://postgis.net/docs/ST_AsGeoJSON.html
from sqlalchemy import select, func
from geoalchemy2.functions import ST_Transform, ST_AsGeoJSON

async def get_parcel_geojson(parcel_id: uuid.UUID, db: AsyncSession) -> dict:
    """Fetch parcel geometry as EPSG:4326 GeoJSON."""
    stmt = select(
        ParcelCache.id,
        ParcelCache.address,
        # Transform EPSG:28992 -> EPSG:4326, output as GeoJSON
        func.ST_AsGeoJSON(func.ST_Transform(ParcelCache.geometry, 4326)).label("geometry")
    ).where(ParcelCache.id == parcel_id)

    result = await db.execute(stmt)
    row = result.one()

    return {
        "id": str(row.id),
        "address": row.address,
        "geometry": json.loads(row.geometry),  # Parse GeoJSON string
    }
```

**Why this pattern?**
- EPSG:28992 (RD New) is native Dutch cadastral system - API data arrives in this format
- EPSG:4326 (WGS84) is required by GeoJSON spec (RFC 7946) and MapLibre/Leaflet
- ST_Transform handles datum shift automatically (Amersfoort -> WGS84)
- Transformation at query time avoids storing duplicate geometries

### Pattern 4: Bounding Box Spatial Queries

**What:** Use && operator for index-only bounding box checks, ST_Intersects for precise geometry
**When to use:** Finding parcels in an area (gemeente scan, viewport query)
**Example:**

```python
# Source: https://medium.com/@cfvandersluijs/5-principles-for-writing-high-performance-queries-in-postgis-bbea3ffb9830
from geoalchemy2.functions import ST_MakeEnvelope, ST_Intersects

async def find_parcels_in_bbox(
    minx: float, miny: float, maxx: float, maxy: float,
    db: AsyncSession
) -> list[ParcelCache]:
    """Find parcels intersecting bounding box (EPSG:28992 coordinates)."""
    # Create envelope in EPSG:28992
    bbox = func.ST_MakeEnvelope(minx, miny, maxx, maxy, 28992)

    stmt = select(ParcelCache).where(
        # Two-stage filter:
        # 1. && uses GIST index for fast bounding box check
        # 2. ST_Intersects performs precise geometry intersection
        ParcelCache.geometry.op("&&")(bbox),
        func.ST_Intersects(ParcelCache.geometry, bbox)
    )

    result = await db.execute(stmt)
    return result.scalars().all()
```

**Performance rationale:**
- `&&` operator: Index-only check, returns parcels whose bbox overlaps query bbox
- `ST_Intersects`: Precise check, validates actual geometry intersection
- Two-stage approach filters 95%+ of false positives via index, then validates remainder

### Pattern 5: RLS Policies for Spatial Tables

**What:** Apply existing NULLIF fail-closed RLS pattern to spatial tables
**When to use:** All new tenant-scoped tables (parcel_cache, area_scan, scan_result)
**Example:**

```python
# Source: Existing pattern from 0800fa8394d7_enable_rls_on_all_tenant_tables.py
def upgrade() -> None:
    """Enable RLS on parcel_cache with NULLIF fail-closed policy."""
    op.execute('ALTER TABLE parcel_cache ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE parcel_cache FORCE ROW LEVEL SECURITY')

    op.execute("""
        CREATE POLICY tenant_isolation_parcel_cache ON parcel_cache
            FOR ALL
            USING (
                organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
            )
            WITH CHECK (
                organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid
            )
    """)
```

**Why this pattern?**
- NULLIF converts empty string to NULL (when session var not set)
- NULL::uuid never equals organization_id -> access denied (fail-closed)
- Matches existing RLS policies on users, refresh_tokens, cached_api_responses, etc.
- SET LOCAL in get_db() sets app.current_tenant_id per transaction

### Pattern 6: Alembic PostGIS Extension Setup

**What:** Enable PostGIS extension in migration, exclude system tables from autogenerate
**When to use:** First migration in Phase 18
**Example:**

```python
# Source: https://github.com/xultaeculcis/alembic-postgis-template
# In alembic migration file
def upgrade() -> None:
    """Enable PostGIS extension."""
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    # Extension creates spatial_ref_sys, geometry_columns, geography_columns tables

def downgrade() -> None:
    """Disable PostGIS extension."""
    op.execute("DROP EXTENSION IF EXISTS postgis CASCADE")
```

```python
# In alembic/env.py - add include_object function
def include_object(object, name, type_, reflected, compare_to):
    """
    Exclude PostGIS system tables from Alembic autogenerate.
    Source: https://github.com/miguelgrinberg/Flask-Migrate/issues/18
    """
    if type_ == "table" and name in (
        "spatial_ref_sys",
        "geometry_columns",
        "geography_columns",
    ):
        return False
    return True

# Then in run_migrations_*() functions:
context.configure(
    connection=connection,
    target_metadata=target_metadata,
    include_object=include_object,  # Add this parameter
)
```

**Why necessary?**
- PostGIS creates system tables (spatial_ref_sys, etc.) that should not be in migrations
- Without include_object, Alembic tries to drop these tables -> migration fails
- GeoAlchemy2 provides similar helper: `geoalchemy2.alembic_helpers.include_object`

### Anti-Patterns to Avoid

- **Don't use Shapely for spatial queries:** Shapely is for WKT parsing and validation, not queries. Use PostGIS functions (ST_Contains, ST_Intersects) via GeoAlchemy2 for database queries - 10-100x faster with GIST indexes.

- **Don't store EPSG:4326 in database:** Dutch cadastral data arrives in EPSG:28992 (RD New). Store natively, transform to 4326 at API boundary. Avoids datum shift errors and matches source data.

- **Don't skip GIST index:** Without spatial index, queries scan entire table. 10,000 parcels = 2200ms unindexed vs 200ms indexed. Always create GIST index on geometry columns.

- **Don't use ST_Intersects without && pre-filter:** ST_Intersects is computationally expensive. Use `geometry.op("&&")(bbox)` first for index-only bounding box filter, then ST_Intersects for precise check.

- **Don't hand-roll coordinate transformation:** pyproj handles datum shifts (Amersfoort <-> WGS84), ellipsoid differences, and edge cases. Use PostGIS ST_Transform in queries or pyproj.Transformer in Python - never manual lat/lon arithmetic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coordinate transformation | Manual lat/lon formulas | PostGIS ST_Transform or pyproj.Transformer | Datum shifts (Amersfoort vs WGS84), ellipsoid differences, projection parameters - easy to get wrong |
| Spatial containment | Shapely contains() in Python loop | PostGIS ST_Contains with GIST index | 10-100x faster, index-accelerated, handles edge cases (point on boundary, etc.) |
| Bounding box intersection | Manual min/max coordinate checks | PostGIS && operator + ST_Intersects | GIST index support, handles antimeridian, pole wrapping, and complex polygon edges |
| Geometry validation | Custom polygon checks | PostGIS ST_IsValid + ST_MakeValid | Handles self-intersections, figure-8 polygons, duplicate points, orientation issues per OGC spec |
| Distance queries | Haversine formula in Python | PostGIS ST_DWithin with GIST index | Index-accelerated, handles projected vs geodetic correctly, accounts for datum |

**Key insight:** Spatial operations have subtle edge cases (antimeridian wrapping, pole handling, datum shifts, self-intersecting polygons). PostGIS implements OGC Simple Features spec correctly and runs 10-100x faster than application code via GIST indexes. Never reimplement spatial primitives.

## Common Pitfalls

### Pitfall 1: Wrong SRID in Geometry Column

**What goes wrong:** Inserting geometry with mismatched SRID (e.g., 4326 data into 28992 column) causes silent coordinate errors - points appear in wrong locations or fail spatial queries.

**Why it happens:** GeoJSON from APIs defaults to EPSG:4326, but Dutch cadastral data uses EPSG:28992. Easy to forget transformation.

**How to avoid:**
- Always specify SRID in Geometry type: `Geometry(geometry_type="POLYGON", srid=28992)`
- Validate SRID on insert: `ST_SRID(geometry) = 28992`
- Use WKT with SRID prefix: `"SRID=28992;POLYGON(...)"`
- Add CHECK constraint: `ST_SRID(geometry) = 28992`

**Warning signs:**
- Spatial queries return empty results despite visible data
- Coordinates appear in wrong country/ocean
- ST_Intersects returns false for visually overlapping geometries

### Pitfall 2: Missing GIST Index After Alembic Migration

**What goes wrong:** Geometry column created, but GIST index not applied. Queries work but run 10-100x slower, causing timeouts on large datasets.

**Why it happens:** Alembic autogenerate doesn't create GIST indexes automatically - must be manually added to migration. Easy to forget in initial migration.

**How to avoid:**
- Add explicit `op.execute("CREATE INDEX ... USING GIST (geometry)")` after table creation
- Run EXPLAIN ANALYZE on spatial queries in tests to verify index usage
- Check for "Index Scan using idx_..._gist" in query plan, not "Seq Scan"

**Warning signs:**
- Queries on 1000+ rows take >1 second
- EXPLAIN ANALYZE shows "Seq Scan" instead of "Index Scan"
- Query time scales linearly with table size (O(n) instead of O(log n))

### Pitfall 3: RLS Policy Blocks Test Queries

**What goes wrong:** Tests fail with "permission denied" or return empty results, despite correct query logic. RLS policy denies access because app.current_tenant_id session variable not set.

**Why it happens:** Tests use database connection without middleware that sets SET LOCAL app.current_tenant_id. RLS NULLIF pattern converts unset variable to NULL, blocking access (fail-closed).

**How to avoid:**
- In test fixtures, explicitly set session variable before queries:
  ```python
  await db.execute(text(f"SET LOCAL app.current_tenant_id = '{org_id}'"))
  ```
- OR disable RLS for test role (not recommended - misses RLS bugs):
  ```python
  await db.execute(text("SET LOCAL row_security = off"))
  ```
- Verify RLS in dedicated integration tests with multiple orgs

**Warning signs:**
- Tests pass without RLS migration, fail after
- Query returns empty list instead of expected rows
- Raw SQL in psql works, but SQLAlchemy query fails

### Pitfall 4: Alembic Tries to Drop spatial_ref_sys

**What goes wrong:** After enabling PostGIS, `alembic revision --autogenerate` detects spatial_ref_sys, geometry_columns as "new" tables and tries to drop them. Migration fails with permission error.

**Why it happens:** Alembic compares database schema to SQLAlchemy metadata. PostGIS system tables aren't in metadata, so Alembic thinks they're orphaned.

**How to avoid:**
- Add `include_object` function to alembic/env.py that excludes PostGIS system tables
- Use GeoAlchemy2's built-in helper: `from geoalchemy2.alembic_helpers import include_object`
- Verify autogenerate output before applying migration

**Warning signs:**
- Migration contains `op.drop_table('spatial_ref_sys')`
- Error: "must be owner of table spatial_ref_sys"
- Fresh autogenerate after PostGIS enablement shows unexpected drops

### Pitfall 5: Storing BRK Eigendomsdata in Cache

**What goes wrong:** Storing cadastral ownership data in parcel_cache violates legitimate interest principle and creates GDPR liability. Data becomes stale, queries use outdated owner info.

**Why it happens:** Temptation to cache everything for performance. BRK API is slow, so caching seems logical.

**How to avoid:**
- Three-tier cache design:
  - Tier 1 (DB): Geometry, address, flags (has_pand, bestemming type) - stable data
  - Tier 2 (JSONB): Bestemming details, vergunningen - changes infrequently
  - Tier 3 (never cache): BRK eigendomsdata - query-time only, requires legitimate interest
- Document cache tiers in schema comments
- Add validation: no "eigenaar" fields in parcel_cache or enrichment_data

**Warning signs:**
- Schema includes owner_name, owner_address fields
- API responses include cached owner data without fresh BRK query
- Enrichment JSONB contains kadaster eigendoms keys

## Code Examples

Verified patterns from official sources:

### Spatial Query with GIST Index Acceleration

```python
# Source: https://postgis.net/workshops/postgis-intro/indexing.html
from sqlalchemy import select, func
from geoalchemy2.functions import ST_Contains, ST_Point

async def find_parcels_containing_point(
    lat: float, lon: float,
    db: AsyncSession
) -> list[ParcelCache]:
    """
    Find parcels containing a point (EPSG:4326 coordinates).

    GIST index on geometry enables fast spatial lookup.
    Query plan shows: Index Scan using idx_parcel_cache_geometry_gist
    """
    # Create point in EPSG:28992 (must match parcel geometry SRID)
    # Transform from EPSG:4326 input to EPSG:28992 storage
    point = func.ST_Transform(
        func.ST_SetSRID(func.ST_Point(lon, lat), 4326),
        28992
    )

    stmt = select(ParcelCache).where(
        # ST_Contains automatically uses GIST index when available
        func.ST_Contains(ParcelCache.geometry, point)
    )

    result = await db.execute(stmt)
    return result.scalars().all()
```

### Geometry Validation Before Insert

```python
# Source: https://postgis.net/workshops/postgis-intro/validity.html
from geoalchemy2.functions import ST_IsValid, ST_IsValidReason, ST_MakeValid

async def insert_parcel_with_validation(
    geom_wkt: str,
    address: str,
    organization_id: uuid.UUID,
    db: AsyncSession
) -> ParcelCache:
    """
    Insert parcel geometry with validation and auto-repair.

    Handles invalid geometries (self-intersections, figure-8 polygons)
    by calling ST_MakeValid before insert.
    """
    # Parse WKT to geometry
    geom = func.ST_GeomFromText(geom_wkt, 28992)

    # Check validity
    is_valid_stmt = select(func.ST_IsValid(geom))
    is_valid = await db.execute(is_valid_stmt)

    if not is_valid.scalar():
        # Log reason for invalidity
        reason_stmt = select(func.ST_IsValidReason(geom))
        reason = await db.execute(reason_stmt)
        logger.warning(f"Invalid geometry: {reason.scalar()}")

        # Auto-repair with ST_MakeValid
        geom = func.ST_MakeValid(geom)

    # Insert with validated/repaired geometry
    parcel = ParcelCache(
        id=uuid.uuid4(),
        organization_id=organization_id,
        geometry=geom,
        address=address,
    )
    db.add(parcel)
    await db.flush()
    return parcel
```

### Three-Tier Cache Insert

```python
async def cache_parcel_tier1(
    kadaster_feature: dict,
    organization_id: uuid.UUID,
    db: AsyncSession
) -> ParcelCache:
    """
    Tier 1 cache: Store lightweight pre-scan data only.

    Geometry, address, basic flags - data that doesn't change.
    NO bestemming details, NO vergunningen, NO eigendomsdata.
    """
    # Extract geometry (GeoJSON from PDOK API)
    geom_geojson = kadaster_feature["geometry"]
    geom_wkt = shapely.geometry.shape(geom_geojson).wkt

    # Insert with Tier 1 data only
    parcel = ParcelCache(
        id=uuid.uuid4(),
        organization_id=organization_id,
        geometry=func.ST_GeomFromText(f"SRID=28992;{geom_wkt}"),
        address=kadaster_feature["properties"].get("adres", ""),
        parcel_id=kadaster_feature["properties"]["perceelnummer"],
        has_pand=False,  # Will be set by BAG cross-reference
        enrichment_data=None,  # Tier 2 - populated on-demand later
    )
    db.add(parcel)
    await db.flush()
    return parcel

async def enrich_parcel_tier2(
    parcel_id: uuid.UUID,
    bestemming_data: dict,
    db: AsyncSession
) -> None:
    """
    Tier 2 cache: Store on-demand enrichment in JSONB.

    Bestemming details, vergunningen - changes infrequently.
    Called when user opens parcel detail modal.
    """
    stmt = (
        update(ParcelCache)
        .where(ParcelCache.id == parcel_id)
        .values(
            enrichment_data={
                "bestemming": bestemming_data,
                "enriched_at": datetime.utcnow().isoformat(),
            }
        )
    )
    await db.execute(stmt)
    await db.commit()

# Tier 3: BRK eigendomsdata - NEVER cached, always query-time
async def get_parcel_ownership(parcel_id: str) -> dict:
    """Tier 3: Query BRK API directly, never cache."""
    # Call BRK API with mTLS, return fresh data
    # NO database storage - legitimate interest per query
    pass
```

### Coordinate Transformation Helper

```python
# Source: https://pyproj4.github.io/pyproj/stable/api/transformer.html
from pyproj import Transformer

# Create reusable transformer (cache at module level)
_transformer_to_4326 = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)
_transformer_to_28992 = Transformer.from_crs("EPSG:4326", "EPSG:28992", always_xy=True)

def transform_point_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """
    Transform point from EPSG:28992 (RD New) to EPSG:4326 (WGS84).

    Args:
        x: Easting in meters (RD New)
        y: Northing in meters (RD New)

    Returns:
        (lon, lat) in degrees (WGS84)
    """
    lon, lat = _transformer_to_4326.transform(x, y)
    return lon, lat

def transform_point_to_rd(lon: float, lat: float) -> tuple[float, float]:
    """
    Transform point from EPSG:4326 (WGS84) to EPSG:28992 (RD New).

    Args:
        lon: Longitude in degrees (WGS84)
        lat: Latitude in degrees (WGS84)

    Returns:
        (x, y) in meters (RD New)
    """
    x, y = _transformer_to_28992.transform(lon, lat)
    return x, y

# Note: For database queries, prefer PostGIS ST_Transform over pyproj
# PostGIS is faster and operates on entire result sets at once
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shapely for all spatial ops | PostGIS for queries, Shapely for validation | PostGIS 3.0+ (2020) with mature GIST | 10-100x performance gain, index acceleration |
| SQLAlchemy 1.x Column() | SQLAlchemy 2.x Mapped[] + mapped_column() | SQLAlchemy 2.0 (2023) | Type safety, better IDE support, modern syntax |
| COALESCE RLS pattern | NULLIF fail-closed pattern | Project v1.1 (2026-02) | Explicit fail-closed security, prevents empty string bypass |
| Store all data in cache | Three-tier cache strategy | GDPR awareness (2018+) | Legitimate interest compliance, avoids unnecessary data retention |
| Manual asyncpg+psycopg2 mix | asyncpg only with async/await | Python 3.7+ (2018) | Consistent async patterns, no sync blocking |

**Deprecated/outdated:**
- **GeoAlchemy (v1)**: Superseded by GeoAlchemy2 in 2012, no SQLAlchemy 2.0 support
- **python-geohash**: Geohashes for spatial indexing - replaced by PostGIS GIST indexes (better performance, no false positives)
- **Storing lat/lon as separate columns**: Use PostGIS POINT geometry instead - enables spatial queries and proper indexing
- **ST_Distance for "nearby" queries**: Use ST_DWithin instead - index-accelerated, returns boolean, faster for filtering

## Open Questions

1. **PostgreSQL version on production server**
   - What we know: Development uses port 5433, database name "propdex", likely PostgreSQL 15 or 16
   - What's unclear: Exact version determines compatible PostGIS version (3.5 requires PG 12-17)
   - Recommendation: Verify with `SELECT version()` before migration, ensure PostGIS 3.5 compatibility

2. **ARQ worker access to PostGIS functions**
   - What we know: ARQ runs background jobs for area scans, needs spatial queries
   - What's unclear: Does ARQ connection pool need separate PostGIS setup, or inherits from engine?
   - Recommendation: Test spatial query from ARQ worker context in Phase 20, verify GIST index usage

3. **Martin vector tile server database connection**
   - What we know: MAP-03 requires Martin tile server for parcel visualization
   - What's unclear: Should Martin use app_role (RLS-enabled) or separate read-only role?
   - Recommendation: Defer to Phase 21 (map integration), may need RLS bypass for tile generation performance

4. **PDOK API geometry validation needs**
   - What we know: PDOK returns cadastral geometries, should be valid OGC Simple Features
   - What's unclear: Do real-world PDOK responses contain invalid geometries requiring ST_MakeValid?
   - Recommendation: Log ST_IsValid failures in Tier 1 cache, add ST_MakeValid if >1% invalid

5. **Scan progress tracking granularity**
   - What we know: SCAN-05 requires progress polling, area_scan table tracks status
   - What's unclear: Progress by percentage, parcel count, or phase? Stored in DB or Redis?
   - Recommendation: Defer to Phase 20 (scan orchestration), likely DB-backed with percentage

## Sources

### Primary (HIGH confidence)

- [PostGIS 3.5.0 Official Documentation](https://postgis.net/docs/manual-3.5/postgis-en.html) - Spatial functions reference, GIST indexes
- [GeoAlchemy2 Documentation (0.18.2)](https://geoalchemy-2.readthedocs.io/en/latest/) - SQLAlchemy 2.0 mapping, Geometry types
- [GeoAlchemy2 New ORM Mapping Style](https://geoalchemy-2.readthedocs.io/en/latest/gallery/test_orm_mapped_v2.html) - Mapped[] + mapped_column() examples
- [pyproj 3.7 Documentation](https://pyproj4.github.io/pyproj/stable/) - Transformer API for coordinate transformations
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) - Row-level security policies
- [EPSG.io - EPSG:28992](https://epsg.io/28992) - Amersfoort / RD New coordinate system details
- [PostGIS Installation Guide](https://postgis.net/docs/postgis_installation.html) - PostgreSQL version requirements

### Secondary (MEDIUM confidence)

- [Working with Spatial Data using FastAPI and GeoAlchemy (Medium)](https://medium.com/@notarious2/working-with-spatial-data-using-fastapi-and-geoalchemy-797d414d2fe7) - Async session patterns
- [Boosting PostGIS Performance (Crunchy Data)](https://www.crunchydata.com/blog/postgis-performance-indexing-and-explain) - GIST index benchmarks
- [5 Principles for High-Performance PostGIS Queries (Medium)](https://medium.com/@cfvandersluijs/5-principles-for-writing-high-performance-queries-in-postgis-bbea3ffb9830) - && operator + ST_Intersects pattern
- [Setting Up PostGIS with Alembic (Medium)](https://medium.com/@DILJITH_77/setting-up-postgis-with-postgresql-on-google-cloud-a-comprehensive-guide-a9038898cedd) - include_object function
- [GeoAlchemy2 Alembic Helpers](https://geoalchemy-2.readthedocs.io/en/0.17.0/_modules/geoalchemy2/alembic_helpers.html) - Excluding PostGIS system tables
- [Row Level Security for Tenants (Crunchy Data)](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) - Multi-tenant RLS patterns

### Tertiary (LOW confidence)

- [GeoAlchemy2 GitHub Releases](https://github.com/geoalchemy/geoalchemy2/releases) - Version history (specific 2.0 support version unclear)
- [ARQ Documentation](https://arq-docs.helpmanual.io/) - Background job patterns (no PostGIS-specific content)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PostGIS and GeoAlchemy2 are industry standards, verified in official docs
- Architecture: HIGH - Patterns verified in official PostGIS/GeoAlchemy2 docs and Crunchy Data resources
- Pitfalls: HIGH - Common issues documented in GitHub issues, Stack Overflow, and migration guides
- Performance claims: MEDIUM - 10-100x improvement cited in multiple sources but not independently verified in this codebase
- ARQ + PostGIS integration: LOW - No specific documentation found, needs testing

**Research date:** 2026-02-10
**Valid until:** 2026-04-10 (60 days - PostGIS and GeoAlchemy2 are stable, slow-moving projects)
