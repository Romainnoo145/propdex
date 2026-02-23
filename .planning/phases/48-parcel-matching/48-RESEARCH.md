# Phase 48: Parcel Matching - Research

**Researched:** 2026-02-23
**Domain:** Geocoding, spatial point-in-polygon matching, Alembic migration, ARQ job wiring
**Confidence:** HIGH

## Summary

Phase 48 connects the clean addresses extracted by Phase 47 to the spatial parcels stored in ParcelCache. The flow is: (1) take `address_components` from `ChangeRecord.metadata_json`, build a geocoding query string, call the PDOK Locatieserver `/free` endpoint to get RD coordinates, then perform a PostGIS `ST_Contains` spatial lookup against `ParcelCache.geometry` to find the matching parcel UUID. (2) Persist the matched `parcel_cache.id` as `matched_parcel_id` on the ChangeRecord row via a new nullable column + Alembic migration. (3) After each wijk scan completes, run a retro-matcher job that queries unmatched ChangeRecords for the same gemeente and re-attempts matching against newly-cached parcels.

The PDOK Locatieserver `/free` endpoint already exists in `PDOKLocatieserver` client code (the `suggest`, `lookup`, and `reverse` methods). Phase 48 adds a new forward geocoding method that uses the `/free` endpoint with `fl=id,centroide_rd` to get RD coordinates directly in one HTTP call, avoiding the two-step suggest+lookup round-trip used for user-facing autocomplete. The centroide_rd field returns `"POINT(x y)"` in RD (EPSG:28992) — the same CRS used for all ParcelCache geometries — so no coordinate transformation is needed before the spatial query.

The existing spatial infrastructure (`ST_Contains`, GIST index on `parcel_cache.geometry`) already supports point-in-polygon queries. The pattern is already demonstrated in `spatial_helpers.py` using `func.ST_Intersects`. The retro-matching job follows the exact same structure as `daily_change_monitor_job` in `change_monitor.py`: create own engine/session, query unmatched records filtered by gemeente, attempt matching, commit per batch. No new infrastructure is needed beyond the Alembic column migration.

**Primary recommendation:** Use PDOK Locatieserver `/free` endpoint with `fl=centroide_rd` to geocode in a single call, then use `func.ST_Contains(ParcelCache.geometry, func.ST_SetSRID(func.ST_MakePoint(x, y), 28992))` for the parcel spatial lookup. Add `matched_parcel_id` as a nullable UUID FK column via Alembic. Wire the matcher into `change_detector.py` during ChangeRecord creation. Wire the retro-matcher into `area_scan_job` at Phase 6 (after scan completes).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| geoalchemy2 | already installed | PostGIS spatial functions (ST_Contains, ST_MakePoint, ST_SetSRID) | Already in use for parcel geometry |
| SQLAlchemy 2.x | already installed | `func.ST_Contains(...)` SQL expression | All ORM queries use this |
| httpx | already installed | Async HTTP client for PDOK geocoding | Already used by PDOKLocatieserver |
| alembic | already installed | Database migration for `matched_parcel_id` column | Established migration pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pyproj | already installed | Python-side coordinate transformation | Only needed if PDOK returns WGS84 and transform to 28992 is needed; prefer centroide_rd to avoid |
| re (stdlib) | stdlib | Parse `"POINT(x y)"` WKT from centroide_rd field | Minimal parsing, no external dep needed |
| asyncio.Semaphore | stdlib | Throttle concurrent geocoding requests | Use when batch-matching multiple changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `/free` endpoint with `fl=centroide_rd` | suggest + lookup (2 calls) | Two-call round-trip costs 2x latency; `/free` returns centroide_rd directly in 1 call |
| PostGIS ST_Contains | postcode-only matching (existing) | Postcode matching is imprecise (multiple parcels per postcode); ST_Contains gives exact parcel identification |
| ST_Contains | ST_Intersects | ST_Contains is stricter (point must be fully inside polygon); ST_Intersects also catches boundary cases; both work with GIST index |
| Alembic nullable FK to parcel_cache | Store parcel_id as string | FK to parcel_cache.id enforces referential integrity; nullable so existing unmatched rows stay valid |

**Installation:** No new packages required. All dependencies already in pyproject.toml.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── government_apis/
│   └── pdok_locatieserver.py        # Add geocode_address() method
├── services/
│   └── bekendmaking_matcher.py      # Add match_parcel_for_change() function
├── models/
│   └── change_record.py             # Add matched_parcel_id Mapped column
├── services/
│   └── change_detector.py           # Wire geocode+match after address extraction
└── jobs/
    ├── area_scan.py                  # Wire retro-match call at Phase 6
    └── retro_matcher.py              # New: batch retro-matching job function
alembic/versions/
└── <hash>_add_matched_parcel_id_to_change_records.py
tests/unit/
├── test_pdok_locatieserver.py        # Add test for geocode_address()
└── test_bekendmaking_matcher.py      # New: test match_parcel_for_change()
```

### Pattern 1: PDOK Free Endpoint Geocoding
**What:** Single HTTP call to `/free` returning `centroide_rd` WKT POINT in EPSG:28992
**When to use:** When `address_components` is present in `ChangeRecord.metadata_json`
**Example:**
```python
# In PDOKLocatieserver (government_apis/pdok_locatieserver.py)
async def geocode_address(
    self,
    street: str,
    huisnummer: int,
    client: httpx.AsyncClient,
    postcode: str | None = None,
    city: str | None = None,
) -> tuple[float, float] | None:
    """Geocode a Dutch address to RD coordinates via PDOK Locatieserver /free.

    Returns (x, y) in EPSG:28992 (RD New) or None if no result.
    """
    # Build query: "Straatnaam 42, 1234AB Stad" or "Straatnaam 42 Stad"
    parts = [f"{street} {huisnummer}"]
    if postcode:
        parts.append(postcode)
    if city:
        parts.append(city)
    query = ", ".join(parts)

    url = f"{self.BASE_URL}/free"
    params = {
        "q": query,
        "fq": "type:adres",
        "fl": "id,centroide_rd",
        "rows": 1,
    }

    try:
        response = await client.get(url, params=params)
        data = handle_api_response(response, source="pdok")
        docs = data.get("response", {}).get("docs", [])
        if not docs:
            return None
        centroide_rd = docs[0].get("centroide_rd")
        if not centroide_rd:
            return None
        # Parse "POINT(121348.243 487347.752)"
        return _parse_rd_point(centroide_rd)
    except Exception as e:
        logger.debug(f"PDOK geocode failed for '{query}': {e}")
        return None


def _parse_rd_point(wkt: str) -> tuple[float, float] | None:
    """Parse WKT POINT string to (x, y) tuple."""
    import re
    m = re.match(r"POINT\(([0-9.]+)\s+([0-9.]+)\)", wkt)
    if m:
        return float(m.group(1)), float(m.group(2))
    return None
```

### Pattern 2: PostGIS Point-in-Polygon Lookup
**What:** `ST_Contains(parcel_geometry, point)` to find which parcel contains the geocoded point
**When to use:** After successfully geocoding an address to RD coordinates
**Example:**
```python
# In bekendmaking_matcher.py
from sqlalchemy import func, select
from app.models.parcel_cache import ParcelCache

async def find_parcel_at_point(
    x: float,
    y: float,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> uuid.UUID | None:
    """Find the ParcelCache.id whose geometry contains the RD point (x, y).

    Uses PostGIS ST_Contains with GIST index for fast lookup.
    Both geometry and point are in EPSG:28992 (RD New) — no transform needed.
    """
    point = func.ST_SetSRID(func.ST_MakePoint(x, y), 28992)
    stmt = (
        select(ParcelCache.id)
        .where(
            ParcelCache.organization_id == organization_id,
            func.ST_Contains(ParcelCache.geometry, point),
        )
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
```

### Pattern 3: Alembic Column Migration
**What:** Add nullable `matched_parcel_id` UUID FK column to `change_records`
**When to use:** Standard pattern — matches all prior Phase column additions
**Example:**
```python
# alembic/versions/<hash>_add_matched_parcel_id_to_change_records.py
def upgrade() -> None:
    op.add_column(
        "change_records",
        sa.Column(
            "matched_parcel_id",
            sa.Uuid(),
            sa.ForeignKey("parcel_cache.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_change_records_matched_parcel_id",
        "change_records",
        ["matched_parcel_id"],
    )

def downgrade() -> None:
    op.drop_index("ix_change_records_matched_parcel_id", table_name="change_records")
    op.drop_column("change_records", "matched_parcel_id")
```

### Pattern 4: Retro-Match Job Structure
**What:** Job that queries unmatched ChangeRecords for a gemeente after scan completes
**When to use:** Triggered from `area_scan_job` Phase 6 (after `status = completed`) or as standalone ARQ function
**Example:**
```python
# jobs/retro_matcher.py (or inline in area_scan_job Phase 6)
async def retro_match_changes_for_gemeente(
    gemeente_code: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
    client: httpx.AsyncClient,
) -> int:
    """Re-attempt parcel matching for unmatched ChangeRecords in a gemeente.

    Queries ChangeRecords where:
    - matched_parcel_id IS NULL
    - address_components present in metadata_json
    - gemeente_naam matches any project with this gemeente_code

    Returns count of newly matched records.
    """
    from app.models.project import Project
    from sqlalchemy import cast
    from sqlalchemy.dialects.postgresql import JSONB

    # Find unmatched changes for projects in this gemeente
    stmt = (
        select(ChangeRecord)
        .join(Project, ChangeRecord.project_id == Project.id)
        .where(
            ChangeRecord.organization_id == organization_id,
            ChangeRecord.matched_parcel_id.is_(None),
            Project.gemeente_code == gemeente_code,
            # Only attempt matching if address_components present
            ChangeRecord.metadata_json["address_components"].isnot(None),
        )
        .limit(200)  # Safety cap
    )
    result = await session.execute(stmt)
    unmatched = result.scalars().all()

    matched_count = 0
    locatieserver = PDOKLocatieserver()

    for change in unmatched:
        components = change.metadata_json.get("address_components", {})
        if not components:
            continue
        coords = await locatieserver.geocode_address(
            street=components["street"],
            huisnummer=components["huisnummer"],
            client=client,
            postcode=components.get("postcode"),
            city=components.get("city"),
        )
        if coords is None:
            continue
        parcel_id = await find_parcel_at_point(coords[0], coords[1], organization_id, session)
        if parcel_id:
            change.matched_parcel_id = parcel_id
            session.add(change)
            matched_count += 1

    if matched_count > 0:
        await session.flush()
        await session.commit()

    return matched_count
```

### Pattern 5: Wire Geocoding into change_detector.py
**What:** After `address_data` is extracted in `detect_permit_changes`, attempt geocoding + spatial match inline before creating the ChangeRecord
**When to use:** For new records (at creation time, not retroactively)
**Example:**
```python
# In change_detector.py detect_permit_changes(), after address_data extraction:
matched_parcel_id = None
if address_data and address_data.get("street") and address_data.get("huisnummer"):
    coords = await locatieserver.geocode_address(
        street=address_data["street"],
        huisnummer=address_data["huisnummer"],
        client=client,
        postcode=address_data.get("postcode"),
        city=address_data.get("city"),
    )
    if coords:
        matched_parcel_id = await find_parcel_at_point(
            coords[0], coords[1], org_id, session
        )

change_record = ChangeRecord(
    ...
    matched_parcel_id=matched_parcel_id,
)
```

### Anti-Patterns to Avoid
- **Calling suggest + lookup (2 calls) for background geocoding:** The `/free` endpoint returns `centroide_rd` directly in one call. suggest+lookup is a user-facing autocomplete pattern; batch geocoding should use `/free`.
- **Transforming coordinates unnecessarily:** PDOK `/free` with `fl=centroide_rd` returns EPSG:28992 directly. ParcelCache geometry is EPSG:28992. No transform needed. Avoid adding pyproj transform call that would be a no-op.
- **Using `async with db.begin()`:** Established project pattern is direct `db.add()/db.flush()/db.commit()`. Never use `async with db.begin()` (causes "transaction already begun" with middleware).
- **Storing parcel_id string instead of FK UUID:** Use `matched_parcel_id` as a proper UUID FK to `parcel_cache.id` with `ondelete="SET NULL"`. This maintains referential integrity when parcels are deleted.
- **Geocoding inside the retro-match query without a semaphore:** Multiple concurrent geocoding calls to PDOK will trigger rate limiting. Use `asyncio.Semaphore` as in `_batch_resolve_addresses()`.
- **Using `datetime.now(timezone.utc)`:** Project uses naive UTC via `datetime.utcnow()`. The `TIMESTAMP WITHOUT TIME ZONE` column type requires naive datetimes.
- **Matching against postcode-only without spatial lookup:** Phase 48 explicitly requires spatial matching (not just postcode), because a postcode may contain many parcels.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WKT point parsing | Custom parser for "POINT(x y)" | Simple `re.match(r"POINT\(([0-9.]+)\s+([0-9.]+)\)", wkt)` | It's 2 lines; no library needed |
| Spatial point-in-polygon | Custom spatial logic | `func.ST_Contains(ParcelCache.geometry, func.ST_SetSRID(func.ST_MakePoint(x, y), 28992))` | PostGIS with GIST index is battle-tested and already deployed |
| Coordinate transform RD→WGS84 | Custom math | `pyproj.Transformer` (already in `spatial_helpers.py`) | Only needed if PDOK returns WGS84; avoid by requesting `centroide_rd` |
| Geocoding API client | Custom HTTP layer | Extend `PDOKLocatieserver` with `geocode_address()` | The client class, `handle_api_response`, and error hierarchy already exist |

**Key insight:** All spatial infrastructure is already deployed (PostGIS, GIST index, geoalchemy2 functions). Phase 48 only needs to wire existing pieces together, not build new spatial infrastructure.

## Common Pitfalls

### Pitfall 1: Geocoding Fails for Street-Only Addresses (No Postcode)
**What goes wrong:** `address_extractor.py` sometimes returns `{"street": "Kerkstraat", "huisnummer": 1, "postcode": None, "city": None}` — no postcode or city. Without postcode/city, the PDOK query "Kerkstraat 1" is ambiguous and may return results for any Dutch municipality.
**Why it happens:** Phase 47's bare-street fallback strategy extracts street+number but no postcode when the title doesn't contain one.
**How to avoid:** When `address_components` has no postcode AND no city, augment the query with `gemeente_naam` from the ChangeRecord (which is always present). Query: `f"{street} {huisnummer}, {gemeente_naam}"`.
**Warning signs:** `matched_parcel_id` being populated for wrong-gemeente parcels in tests.

### Pitfall 2: Point on Parcel Boundary Returns No Match
**What goes wrong:** A geocoded point lands exactly on the boundary between two parcels and `ST_Contains` returns nothing (boundary points are not "contained" by either polygon under strict DE-9IM definition).
**Why it happens:** `ST_Contains` is strict — boundary points are excluded. `ST_Intersects` or `ST_Within` handles this differently.
**How to avoid:** Use `ST_Contains(geometry, point) OR ST_Equals(geometry, point)` — or simply use `func.ST_Intersects(ParcelCache.geometry, point)` which handles boundary cases and is equally fast with the GIST index. In practice, centroid-based geocoding rarely lands exactly on a boundary, so `ST_Contains` is fine for 99%+ of cases. `ST_Intersects` is the safer choice.
**Warning signs:** Address geocodes successfully but `find_parcel_at_point` returns None for known in-parcel addresses.

### Pitfall 3: JSONB Address Components Not Indexed
**What goes wrong:** Retro-match query filtering on `ChangeRecord.metadata_json["address_components"].isnot(None)` does a full table scan because JSONB path queries don't use standard B-tree indexes.
**Why it happens:** SQLAlchemy's `column["key"].isnot(None)` generates a JSONB path operator query which requires a GIN index to be fast.
**How to avoid:** The retro-match query limits to 200 rows and filters primarily on `organization_id` + `gemeente_code` join (both indexed). The JSONB filter is applied after those indexed filters reduce the result set significantly. Do NOT add a GIN index just for this — unnecessary complexity.
**Warning signs:** Retro-match job is slow when a gemeente has thousands of change records.

### Pitfall 4: `project_id` on ChangeRecord Does Not Directly Identify gemeente_code
**What goes wrong:** To find unmatched changes for a gemeente during retro-match, the query needs to join ChangeRecord → Project to get gemeente_code. ChangeRecord doesn't store gemeente_code, only gemeente_naam.
**Why it happens:** ChangeRecord was designed around gemeente_naam (a human-readable name); the code mapping lives on Project.
**How to avoid:** Retro-match query joins `ChangeRecord.project_id == Project.id` and filters on `Project.gemeente_code`. This join is indexed (Project has `ix_projects_parent_id`, ChangeRecord has `ix_change_records_project_id`).
**Warning signs:** Retro-match triggers for wrong gemeente changes.

### Pitfall 5: Unique Constraint Prevents project_id FK from Change Monitor
**What goes wrong:** When `detect_permit_changes` creates a ChangeRecord, `project_id=None` is set as a placeholder. The caller (`change_monitor.py`) then sets the real project_id. If geocoding/matching happens inside `detect_permit_changes` before `project_id` is set, `find_parcel_at_point` needs `organization_id` — but that's not available in `detect_permit_changes` either (it doesn't receive org_id).
**Why it happens:** `detect_permit_changes` is stateless — it creates ChangeRecord shells without project/org context, which `daily_change_monitor_job` fills in.
**How to avoid:** Two options:
  1. Pass `organization_id` to `detect_permit_changes` and do geocoding inline (requires signature change).
  2. Do geocoding AFTER creating the ChangeRecord, inside `change_monitor.py` where `organization_id` is available. This is cleaner.
  **Recommended: Option 2 — geocode and match inside `change_monitor.py` after `session.flush()` confirms the record exists, before `session.commit()`.**

### Pitfall 6: Concurrent Geocoding Without Rate Limit Protection
**What goes wrong:** Retro-match fires immediately after scan completion. If 50 unmatched changes all geocode concurrently, PDOK may rate-limit the requests.
**Why it happens:** `asyncio.gather()` without a semaphore fires all requests simultaneously.
**How to avoid:** Use `asyncio.Semaphore(10)` (same as `REVERSE_GEOCODE_CONCURRENCY = 10` in area_scan.py). PDOK Locatieserver is a free public service — be a good citizen.
**Warning signs:** Seeing 429 responses from PDOK in logs during retro-match.

## Code Examples

Verified patterns from existing codebase:

### Existing ST_Contains Pattern (spatial_helpers.py)
```python
# Source: backend/app/services/spatial_helpers.py
# Two-stage filter: && pre-filter (GIST index) + ST_Intersects (precise)
stmt = (
    select(ParcelCache)
    .where(ParcelCache.geometry.op("&&")(bbox))  # Stage 1: GIST index scan
    .where(func.ST_Intersects(ParcelCache.geometry, bbox))  # Stage 2: precise check
    .limit(limit)
)
```

For point-in-polygon, the equivalent is:
```python
point = func.ST_SetSRID(func.ST_MakePoint(x, y), 28992)
stmt = (
    select(ParcelCache.id)
    .where(
        ParcelCache.organization_id == organization_id,
        ParcelCache.geometry.op("&&")(point),   # GIST pre-filter
        func.ST_Contains(ParcelCache.geometry, point),  # Precise check
    )
    .limit(1)
)
```

### Existing Reverse Geocode Pattern (area_scan.py)
```python
# Source: backend/app/jobs/area_scan.py
# Already uses PDOKLocatieserver.reverse() with RD coordinates
address = await locatieserver.reverse(centroid[0], centroid[1], client)
```

### Existing Alembic Column Add Pattern (c3d4e5f6a7b8)
```python
# Source: backend/alembic/versions/c3d4e5f6a7b8_add_postcode_to_change_records.py
def upgrade() -> None:
    op.add_column(
        "change_records",
        sa.Column("postcode", sa.String(7), nullable=True),
    )
    op.create_index(
        "ix_change_records_postcode",
        "change_records",
        ["postcode"],
    )
```

### Existing address_components in metadata_json (change_detector.py)
```python
# Source: backend/app/services/change_detector.py lines 196-204
# address_components are already stored in metadata_json by Phase 47
metadata = dict(record)
if address_data:
    metadata["address_components"] = {
        "street": address_data["street"],
        "huisnummer": address_data["huisnummer"],
        "huisnummer_toevoeging": address_data["huisnummer_toevoeging"],
        "postcode": address_data["postcode"],
        "city": address_data["city"],
    }
```

### Existing Job Pattern with Own Engine (change_monitor.py)
```python
# Source: backend/app/jobs/change_monitor.py
# Background jobs create their own engine/session — do NOT reuse app.state.db
engine = create_async_engine(settings.DATABASE_URL, pool_size=5, ...)
session_factory = async_sessionmaker(engine, class_=AsyncSession, ...)
async with session_factory() as session:
    ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Postcode-only matching (Phase 43) | ST_Contains spatial matching (Phase 48) | Phase 48 | Exact parcel identification instead of 1-to-many postcode matches |
| No parcel FK on ChangeRecord | `matched_parcel_id` UUID FK | Phase 48 | Enables direct navigation to parcel from bekendmaking |
| suggest + lookup (2-call geocoding) | `/free` with `fl=centroide_rd` (1 call) | Phase 48 | Half the API calls for batch geocoding |

**Deprecated/outdated:**
- Postcode-matching (`find_matching_parcels` in bekendmaking_matcher.py) still used for backward compat in `include_matches=true` responses, but Phase 48 makes direct `matched_parcel_id` the primary navigation path.

## Open Questions

1. **Where exactly should geocoding happen in `change_monitor.py`?**
   - What we know: `detect_permit_changes` returns ChangeRecord shells without project_id or org_id. `change_monitor.py` sets those before committing. Geocoding needs org_id for `find_parcel_at_point`.
   - What's unclear: Should geocoding happen (a) inside `detect_permit_changes` with org_id passed as new param, or (b) inside `change_monitor.py` after building the ChangeRecord but before committing?
   - Recommendation: Option (b) — do geocoding inside `change_monitor.py` in the per-change loop, after setting `organization_id` and before `session.flush()`. This keeps `detect_permit_changes` stateless and avoids signature breakage.

2. **Should retro-match be a standalone ARQ job or inline in area_scan_job Phase 6?**
   - What we know: `area_scan_job` already creates its own engine/session and runs 6 phases. Adding retro-match at the end would extend Phase 6 (currently finalizing). Standalone ARQ job would be cleaner but needs scheduling.
   - What's unclear: Whether scan-triggered retro-match warrants a separate ARQ function or should be an async function called at end of scan.
   - Recommendation: Implement as an `async def retro_match_changes_for_gemeente(...)` function called from inside `area_scan_job`'s Phase 6 block. No separate ARQ job registration needed. This is simpler and keeps the trigger co-located with the scan completion event.

3. **PDOK rate limiting behavior**
   - What we know: PDOK Locatieserver is free/public, no documented rate limit. Existing code uses it for reverse geocoding without throttling in small batches.
   - What's unclear: Whether sustained batch geocoding (50+ calls per gemeente per scan) triggers any throttling.
   - Recommendation: Use `asyncio.Semaphore(5)` (conservative — half of the existing REVERSE_GEOCODE_CONCURRENCY=10) for retro-match geocoding. Increase if needed.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/app/government_apis/pdok_locatieserver.py` — existing PDOKLocatieserver client with suggest, lookup, reverse methods
- Codebase inspection: `backend/app/services/spatial_helpers.py` — ST_Intersects, ST_Contains, GIST-indexed spatial query patterns
- Codebase inspection: `backend/app/services/bekendmaking_matcher.py` — existing postcode-based matching functions
- Codebase inspection: `backend/app/models/change_record.py` — current model schema, confirmed no `matched_parcel_id` column
- Codebase inspection: `backend/app/services/change_detector.py` — confirmed `address_components` stored in `metadata_json` at lines 196-204
- Codebase inspection: `backend/app/jobs/area_scan.py` + `change_monitor.py` — background job patterns with own engine/session
- Codebase inspection: `backend/alembic/versions/c3d4e5f6a7b8_*` — add_column + create_index migration pattern
- Live API call to `api.pdok.nl/bzk/locatieserver/search/v3_1/free` — confirmed `centroide_rd: "POINT(122048 486329)"` response format

### Secondary (MEDIUM confidence)
- PDOK GitHub wiki (https://github.com/PDOK/locatieserver/wiki/API-Locatieserver) — confirmed `centroide_rd` field available via `fl` parameter in suggest/free endpoint
- Python PDOK geocoding gist (https://gist.github.com/Lytrix/948616b492f2da3b7fe758977b459879) — confirmed WKT parsing pattern `re.search(r'(\d+.*\d+) (\d+.*\d+)', wkt)`

### Tertiary (LOW confidence)
- None needed — all critical claims verified from codebase and live API.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use in codebase
- Architecture: HIGH — all patterns verified from existing production code
- PDOK `/free` endpoint + `centroide_rd`: HIGH — verified via live API call
- Pitfalls: HIGH — most pitfalls derived from reading actual code flows, not speculation

**Research date:** 2026-02-23
**Valid until:** 2026-04-23 (stable APIs — PDOK Locatieserver and PostGIS change rarely)
