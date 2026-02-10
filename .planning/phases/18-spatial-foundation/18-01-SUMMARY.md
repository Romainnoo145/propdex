---
phase: 18-spatial-foundation
plan: 01
subsystem: spatial-core
tags: [postgis, geoalchemy2, spatial-indexing, cache-foundation]
dependency_graph:
  requires: []
  provides:
    - postgis-extension
    - parcel-cache-table
    - gist-spatial-index
    - three-tier-cache-schema
  affects:
    - alembic-autogenerate
    - database-container
tech_stack:
  added:
    - geoalchemy2>=0.15.0
    - PostGIS 3.5 extension
    - postgis/postgis:16-3.5 Docker image
  patterns:
    - GIST spatial indexing
    - Three-tier cache architecture
    - PostGIS system table exclusion in migrations
key_files:
  created:
    - backend/app/models/parcel_cache.py
    - backend/alembic/versions/8c18fdc1b07c_enable_postgis_and_create_parcel_cache.py
  modified:
    - backend/pyproject.toml
    - backend/alembic/env.py
    - backend/app/models/__init__.py
decisions:
  - decision: "Use postgis/postgis:16-3.5 Docker image instead of postgres:16-alpine"
    rationale: "Alpine's PostGIS packages are compiled for PostgreSQL 18, incompatible with PostgreSQL 16. Official PostGIS image provides pre-compiled PostGIS 3.5 for PostgreSQL 16."
    impact: "Infrastructure change - Docker container replacement required. Data preserved via volume mount."
  - decision: "Create GIST index via raw SQL in migration instead of SQLAlchemy declarative"
    rationale: "Alembic doesn't auto-detect GIST indexes on geometry columns. Explicit SQL ensures index creation."
    impact: "Future migrations won't see this index in autogenerate, but that's expected for spatial indexes."
  - decision: "Store bestemmingen as JSONB array for dubbele bestemming support"
    rationale: "Multiple overlapping zonings are common in Netherlands. JSONB array preserves all zonings without complex joins."
    impact: "Query performance optimized for reads. NULL = not fetched, [] = no zonings found."
metrics:
  duration_minutes: 6.58
  tasks_completed: 2
  commits: 2
  files_created: 2
  files_modified: 3
  lines_added: 195
completed_date: 2026-02-10
---

# Phase 18 Plan 01: PostGIS Foundation and ParcelCache Model Summary

**One-liner:** Enabled PostGIS 3.5 with GIST spatial indexing and created ParcelCache model with three-tier cache schema (geometry+flags / JSONB enrichment / no BRK storage).

## Overview

This plan established the absolute foundation for v3.0 Area Intelligence by enabling PostGIS spatial extension and creating the parcel_cache table with proper spatial indexing. All future spatial queries, parcel visualizations, and area scans depend on this infrastructure.

## What Was Built

### Core Infrastructure
- **PostGIS 3.5 Extension**: Enabled in propdex database with full spatial function support (ST_AsGeoJSON, ST_Transform, ST_Intersects, ST_Contains, etc.)
- **Docker Container Migration**: Replaced postgres:16-alpine with postgis/postgis:16-3.5 to provide PostGIS binaries compiled for PostgreSQL 16
- **GeoAlchemy2 Integration**: Added geoalchemy2>=0.15.0 dependency with SQLAlchemy 2.x Mapped[] syntax support

### ParcelCache Model
- **Geometry Column**: MULTIPOLYGON geometry in EPSG:28992 (RD New - Dutch national grid) for native coordinate system performance
- **GIST Spatial Index**: idx_parcel_cache_geometry_gist for fast bounding box intersection queries
- **Three-Tier Cache Schema**:
  - **Tier 1**: Lightweight pre-scan data (geometry, flags, address, gemeente_code, area_m2, has_pand, bestemmingen JSONB array)
  - **Tier 2**: On-demand enrichment (enrichment_data JSONB, enriched_at timestamp)
  - **Tier 3**: BRK eigendomsdata NEVER stored (legitimate interest compliance - always query fresh)
- **Multi-Tenant Isolation**: RLS with fail-closed tenant_isolation_parcel_cache policy
- **Composite Indexes**: organization_id + gemeente_code, organization_id + parcel_id for fast filtering
- **Dubbele Bestemming Support**: bestemmingen stored as JSONB array to preserve multiple overlapping zonings

### Alembic Configuration
- **PostGIS System Table Exclusion**: Added include_object function to env.py to exclude spatial_ref_sys, geometry_columns, geography_columns from autogenerate
- **Manual Migration**: Created migration enabling PostGIS and creating parcel_cache table with explicit GIST index creation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Docker container missing PostGIS extension**
- **Found during:** Task 2 - Applying migration
- **Issue:** postgres:16-alpine base image doesn't include PostGIS. Attempted to install PostGIS via Alpine packages (apk add postgis), but Alpine's PostGIS packages are compiled for PostgreSQL 18 and incompatible with PostgreSQL 16. Error: "PostGIS built for PostgreSQL 18.0 cannot be loaded in PostgreSQL 16.11"
- **Fix:**
  1. Stopped and removed klarifai-discover-db container
  2. Created new container using postgis/postgis:16-3.5 image
  3. Preserved data via existing Docker volume mount (f164def103fbeb2a3b16f3fd52dec7486909d59d23884c512fe7861ed2c28791)
  4. Applied migration successfully
- **Files affected:** None (infrastructure change only)
- **Rationale:** PostGIS extension is critical for spatial functionality. Official PostGIS Docker image provides pre-compiled binaries for PostgreSQL 16, eliminating version mismatch issues.
- **Impact:** Docker container image change required in production deployment. Data preserved, no data loss. All existing migrations re-applied successfully.

## Verification Results

All must-have truths verified:

1. **PostGIS Functions**: ✅ ST_AsGeoJSON, ST_Transform, ST_Contains execute successfully
   ```sql
   SELECT ST_AsGeoJSON(ST_Transform(ST_SetSRID(ST_Point(155000, 463000), 28992), 4326));
   -- Returns: {"type":"Point","coordinates":[5.387203508,52.155172301]}
   ```

2. **GeoAlchemy2 Integration**: ✅ Geometry column works with SQLAlchemy 2.x Mapped[] syntax
   ```python
   from app.models import ParcelCache
   print(ParcelCache.__tablename__)  # Returns: parcel_cache
   ```

3. **Alembic Autogenerate Clean**: ✅ PostGIS system tables excluded
   - spatial_ref_sys, geometry_columns, geography_columns not detected by autogenerate
   - include_object function working in both offline and online migration modes

4. **Parcel Cache Table**: ✅ Created with all columns and indexes
   ```
   geometry: geometry(MultiPolygon,28992) NOT NULL
   GIST index: idx_parcel_cache_geometry_gist
   JSONB columns: bestemmingen, enrichment_data
   RLS policy: tenant_isolation_parcel_cache (forced)
   ```

5. **Three-Tier Schema**: ✅ Enforced at model level
   - Tier 1: geometry + flags + bestemmingen JSONB array ✅
   - Tier 2: enrichment_data JSONB + enriched_at ✅
   - Tier 3: No BRK fields (owner_name, owner_address) ✅

6. **Dubbele Bestemming Support**: ✅ JSONB array column
   - NULL = not yet fetched
   - [] = no bestemmingen found
   - [{"type": "Wonen", "naam": "Wonen - 1"}, ...] = multiple zonings

## Testing Notes

### Spatial Query Performance
- GIST index verified via EXPLAIN: `EXPLAIN SELECT * FROM parcel_cache WHERE geometry && ST_MakeEnvelope(150000, 460000, 160000, 470000, 28992);` shows "Index Scan using idx_parcel_cache_geometry_gist"
- Coordinate transformation works: RD New (EPSG:28992) → WGS84 (EPSG:4326) in ~1ms

### Multi-Tenant Isolation
- RLS policy active and forced (even for table owner)
- Fail-closed: Empty tenant_id string converts to NULL, denying access

## Technical Debt

None identified. Clean implementation following existing patterns.

## Next Steps

1. **Phase 18 Plan 02**: Implement spatial query utilities (bounding box helpers, RD New coordinate conversion, ST_Intersects wrappers)
2. **Phase 18 Plan 03**: Add BAG/Kadaster API client for fetching parcel geometry
3. **Phase 18 Plan 04**: Create area scan endpoint for populating parcel_cache via spatial queries

## Files Modified

### Created
- `backend/app/models/parcel_cache.py` (98 lines) - ParcelCache model with Geometry column, GIST index, three-tier cache
- `backend/alembic/versions/8c18fdc1b07c_enable_postgis_and_create_parcel_cache.py` (77 lines) - PostGIS migration

### Modified
- `backend/pyproject.toml` - Added geoalchemy2>=0.15.0
- `backend/alembic/env.py` - Added include_object function, configured both migration modes
- `backend/app/models/__init__.py` - Imported and exported ParcelCache

## Commits

| Task | Commit  | Message                                                                 |
| ---- | ------- | ----------------------------------------------------------------------- |
| 1    | acb572c | chore(18-01): add GeoAlchemy2 and configure Alembic to exclude PostGIS  |
| 2    | 65bb948 | feat(18-01): create ParcelCache model with PostGIS spatial support      |

## Self-Check: PASSED

✅ All created files exist:
- backend/app/models/parcel_cache.py
- backend/alembic/versions/8c18fdc1b07c_enable_postgis_and_create_parcel_cache.py

✅ All modified files exist:
- backend/pyproject.toml
- backend/alembic/env.py
- backend/app/models/__init__.py

✅ All commits exist:
- acb572c: chore(18-01): add GeoAlchemy2 and configure Alembic to exclude PostGIS system tables
- 65bb948: feat(18-01): create ParcelCache model with PostGIS spatial support

✅ Database verification:
- PostGIS version 3.5 enabled
- parcel_cache table exists with 13 columns
- idx_parcel_cache_geometry_gist index exists (GIST)
- tenant_isolation_parcel_cache RLS policy active
