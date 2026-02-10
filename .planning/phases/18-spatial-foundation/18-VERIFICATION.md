---
phase: 18-spatial-foundation
verified: 2026-02-10T20:15:00Z
status: passed
score: 5/5 observable truths verified
re_verification: false
---

# Phase 18: Spatial Foundation Verification Report

**Phase Goal:** PostGIS spatial database is operational with parcel cache, scan tracking, and multi-tenant isolation -- the data layer everything else builds on

**Verified:** 2026-02-10T20:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                     | Status     | Evidence                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| 1   | PostGIS extension enabled and spatial functions execute successfully                                     | ✓ VERIFIED | PostGIS 3.5 active, ST_Contains/ST_Intersects/ST_DWithin/ST_AsGeoJSON all execute successfully  |
| 2   | Parcel geometries in EPSG:28992 can be queried by bbox and returned as EPSG:4326 GeoJSON                 | ✓ VERIFIED | GIST index on geometry, ST_Transform works, spatial_helpers provides bbox + GeoJSON functions   |
| 3   | Area scan records track status/progress, scan results link to individual cached parcels                  | ✓ VERIFIED | area_scans + scan_results tables with FK integrity, status/progress columns present             |
| 4   | Dubbele bestemming stored as JSONB array preserving multiple overlapping zonings                         | ✓ VERIFIED | bestemmingen column is JSONB array, test verifies roundtrip with multiple values                |
| 5   | All new tables enforce multi-tenant isolation via RLS policies matching existing NULLIF fail-closed pattern | ✓ VERIFIED | tenant_isolation_* policies on parcel_cache/area_scans/scan_results with NULLIF fail-closed     |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                   | Expected                                                                  | Status     | Details                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| backend/app/models/parcel_cache.py         | ParcelCache model with Geometry column, GIST index, three-tier cache      | ✓ VERIFIED | 91 lines, MULTIPOLYGON(28992), bestemmingen JSONB array, enrichment_data JSONB, no BRK fields               |
| backend/app/models/area_scan.py            | AreaScan model with status, progress, gemeente_code, bbox                 | ✓ VERIFIED | 70 lines, status/progress_pct/current_phase/parcels_total/parcels_processed columns present                 |
| backend/app/models/scan_result.py          | ScanResult join model linking scans to parcels                            | ✓ VERIFIED | 50+ lines, FK to area_scans.id and parcel_cache.id, unique constraint on (scan_id, parcel_id)               |
| backend/app/services/spatial_helpers.py    | Spatial query helpers for bbox, transform, validate, GeoJSON             | ✓ VERIFIED | 297 lines, 8 functions (5 async DB, 3 Python pyproj), two-stage GIST filtering, coordinate transformation   |
| backend/alembic/env.py                     | include_object function excluding PostGIS system tables                   | ✓ VERIFIED | include_object function excludes spatial_ref_sys/geometry_columns/geography_columns, used in 2 configure calls |
| backend/alembic/versions/8c18fdc1b07c_*.py | Migration enabling PostGIS and creating parcel_cache table                | ✓ VERIFIED | 3957 bytes, CREATE EXTENSION postgis, parcel_cache table, GIST index via raw SQL                            |
| backend/alembic/versions/fa6f15c17340_*.py | Migration creating area_scans and scan_results tables                     | ✓ VERIFIED | 4894 bytes, both tables with indexes and FK constraints                                                      |
| backend/alembic/versions/2f812ea42f2e_*.py | Migration enabling RLS on spatial tables                                  | ✓ VERIFIED | 1950 bytes, RLS policies with NULLIF fail-closed pattern on 3 tables                                         |
| backend/tests/integration/test_spatial_multi_tenant.py | Integration tests for RLS, spatial functions, multi-tenant isolation | ✓ VERIFIED | 14409 bytes, 12 tests passing (3 RLS policy checks, 3 isolation tests, 6 spatial function tests)            |
| backend/tests/conftest.py                  | PostGIS extension creation in test database                               | ✓ VERIFIED | Contains "CREATE EXTENSION IF NOT EXISTS postgis" for test database                                          |

### Key Link Verification

| From                              | To                                 | Via                                                       | Status   | Details                                                                                     |
| --------------------------------- | ---------------------------------- | --------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| parcel_cache.py                   | base.py                            | inherits Base, TenantMixin, TimestampMixin                | ✓ WIRED  | class ParcelCache(Base, TenantMixin, TimestampMixin) found                                  |
| app/models/__init__.py            | parcel_cache.py                    | import and __all__ export                                 | ✓ WIRED  | from app.models.parcel_cache import ParcelCache in __init__, model importable              |
| scan_result.py                    | area_scan.py                       | FK scan_id references area_scans.id                       | ✓ WIRED  | ForeignKey("area_scans.id", ondelete="CASCADE") present, DB constraint active              |
| scan_result.py                    | parcel_cache.py                    | FK parcel_id references parcel_cache.id                   | ✓ WIRED  | ForeignKey("parcel_cache.id", ondelete="CASCADE") present, DB constraint active            |
| app/models/__init__.py            | area_scan.py                       | import and __all__ export                                 | ✓ WIRED  | from app.models.area_scan import AreaScan in __init__, model importable                    |
| app/models/__init__.py            | scan_result.py                     | import and __all__ export                                 | ✓ WIRED  | from app.models.scan_result import ScanResult in __init__, model importable                |
| spatial_helpers.py                | parcel_cache.py                    | imports ParcelCache for spatial queries                   | ✓ WIRED  | from app.models.parcel_cache import ParcelCache, used in find_parcels_in_bbox              |
| spatial_helpers.py                | geoalchemy2.functions              | uses ST_Transform, ST_AsGeoJSON, ST_Intersects, ST_MakeValid | ✓ WIRED  | func.ST_* pattern used throughout, PostGIS functions execute successfully                  |
| test_spatial_multi_tenant.py      | parcel_cache.py                    | imports ParcelCache for insert and query tests            | ✓ WIRED  | from app.models.parcel_cache import ParcelCache, used in 12 tests                          |
| test_spatial_multi_tenant.py      | spatial_helpers.py                 | imports spatial helpers for integration verification      | ✓ WIRED  | Tests verify bbox queries, coordinate transformation, geometry validation work end-to-end  |

### Requirements Coverage

| Requirement | Description                                                                                     | Status      | Supporting Evidence                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| DATA-01     | PostGIS extension enabled with spatial query helpers (ST_Contains, ST_Intersects, ST_DWithin)  | ✓ SATISFIED | PostGIS 3.5 enabled, all spatial functions execute successfully, spatial_helpers.py provides wrappers |
| DATA-02     | Parcel cache table stores geometry (EPSG:28992) with GIST index for spatial joins              | ✓ SATISFIED | parcel_cache.geometry is MULTIPOLYGON(28992), idx_parcel_cache_geometry_gist is GIST index        |
| DATA-03     | Three-tier caching: Tier 1 (geometry+flags), Tier 2 (JSONB enrichment), Tier 3 (never-stored BRK) | ✓ SATISFIED | Model has Tier 1 columns (geometry, bestemmingen JSONB array, flags), Tier 2 (enrichment_data JSONB), no BRK fields |
| DATA-05     | Dubbele bestemming stored as JSONB array (parcels can have multiple overlapping zonings)       | ✓ SATISFIED | bestemmingen column is JSONB array, test verifies roundtrip with multiple zoning objects           |
| DATA-06     | All new tables have RLS policies matching existing multi-tenant patterns                       | ✓ SATISFIED | tenant_isolation_* policies on parcel_cache/area_scans/scan_results with NULLIF fail-closed        |
| API-05      | Coordinate transformation at API boundary (EPSG:28992 storage, EPSG:4326 for GeoJSON responses) | ✓ SATISFIED | spatial_helpers provides transform_* functions (pyproj), get_parcel_as_geojson uses ST_Transform  |

### Anti-Patterns Found

None. All code is substantive, no TODOs/FIXMEs/placeholders found, no stub implementations detected.

### Human Verification Required

None. All verification was performed programmatically via database queries, test execution, and code inspection.

---

## Detailed Verification Evidence

### 1. PostGIS Extension and Spatial Functions

**Database verification:**
```
PostGIS Version: 3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1
```

**Spatial function tests:**
- ST_AsGeoJSON + ST_Transform: `{"type":"Point","coordinates":[5.387203508,52.155172301]}` ✓
- ST_Contains: Returns true for point in envelope ✓
- ST_DWithin: Returns true for points within 200m ✓
- ST_Intersects: Used in find_parcels_in_bbox with GIST index acceleration ✓

**Alembic autogenerate exclusion:**
- include_object function exists in env.py ✓
- Configured in 2 context.configure calls (offline + online modes) ✓
- Excludes spatial_ref_sys, geometry_columns, geography_columns ✓

### 2. Parcel Cache Table and Spatial Indexing

**Table structure verification:**
```
geometry: geometry(MultiPolygon,28992) NOT NULL
GIST index: idx_parcel_cache_geometry_gist (type: gist)
bestemmingen: jsonb (for dubbele bestemming array)
enrichment_data: jsonb (Tier 2 cache)
No BRK fields: owner_name, owner_address absent ✓
```

**Composite indexes for multi-tenant queries:**
- ix_parcel_cache_org_gemeente (organization_id, gemeente_code) ✓
- ix_parcel_cache_org_parcel (organization_id, parcel_id) ✓
- uq_parcel_cache_org_parcel (unique constraint) ✓

**Foreign key constraints:**
- organization_id -> organizations.id ON DELETE CASCADE ✓

### 3. Area Scan and Scan Results Tables

**area_scans table:**
- Status tracking: status (pending/running/completed/failed) ✓
- Progress tracking: progress_pct, current_phase, parcels_total, parcels_processed ✓
- Gemeente scoping: gemeente_code, gemeente_naam ✓
- Bounding box: bbox_minx, bbox_miny, bbox_maxx, bbox_maxy (EPSG:28992) ✓
- Timing: started_at, completed_at ✓
- Error tracking: error_message ✓
- ARQ integration: job_id ✓

**scan_results table:**
- FK to area_scans.id ON DELETE CASCADE ✓
- FK to parcel_cache.id ON DELETE CASCADE ✓
- Unique constraint on (scan_id, parcel_id) prevents duplicates ✓
- Score and flags columns for per-parcel scan data ✓
- Immutable (no updated_at column) ✓

### 4. Spatial Query Helpers

**find_parcels_in_bbox:**
- Two-stage filtering: && operator (GIST pre-filter) + ST_Intersects (precise) ✓
- 10,000 parcel default limit ✓
- Accepts EPSG:28992 coordinates ✓

**get_parcel_as_geojson:**
- Queries all Tier 1 fields (geometry, parcel_id, address, gemeente_code, area_m2, has_pand, bestemmingen) ✓
- Uses ST_Transform to convert EPSG:28992 -> EPSG:4326 ✓
- Returns GeoJSON Feature with properties + geometry ✓

**validate_and_fix_geometry:**
- Uses ST_IsValid to check validity ✓
- Logs invalidity reason via ST_IsValidReason ✓
- Auto-repairs with ST_MakeValid ✓
- Returns WKT of validated/repaired geometry ✓

**Python-side coordinate transformers:**
- Module-level Transformer singletons (thread-safe, reusable) ✓
- Bidirectional: RD New <-> WGS84 ✓
- Roundtrip precision < 1 meter (tested: 155000, 463000 -> WGS84 -> RD = 0.0m error) ✓
- bbox transformation helpers for API boundary ✓

### 5. Multi-Tenant Isolation via RLS

**RLS policies active on all spatial tables:**
```
parcel_cache: rowsecurity = t, tenant_isolation_parcel_cache
area_scans: rowsecurity = t, tenant_isolation_area_scans
scan_results: rowsecurity = t, tenant_isolation_scan_results
```

**RLS policy pattern:**
```sql
USING (organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid)
WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::uuid)
```

**Fail-closed verification:**
- Empty string tenant ID -> NULLIF converts to NULL -> access denied ✓
- Matches existing pattern from tenant tables (reports, projects, organizations) ✓

### 6. Test Coverage

**12 tests passing in test_spatial_multi_tenant.py:**

**TestRLSPoliciesExist (3 tests):**
- test_parcel_cache_rls_policy_exists ✓
- test_area_scans_rls_policy_exists ✓
- test_scan_results_rls_policy_exists ✓

**TestMultiTenantDataIsolation (3 tests):**
- test_parcels_isolated_by_organization ✓
- test_scans_isolated_by_organization ✓
- test_scan_results_isolated_by_organization ✓

**TestSpatialFunctions (6 tests):**
- test_insert_and_query_geometry ✓
- test_bbox_query_finds_parcel ✓
- test_bbox_query_misses_distant_parcel ✓
- test_coordinate_transformation ✓
- test_dubbele_bestemming_stored_as_array ✓
- test_geometry_validation ✓

**Test execution time:** 15.38s for 12 tests

### 7. Model Wiring

**All models importable from app.models:**
```python
from app.models import ParcelCache, AreaScan, ScanResult
# Returns: parcel_cache area_scans scan_results
```

**All spatial helpers importable:**
```python
from app.services.spatial_helpers import (
    find_parcels_in_bbox,
    get_parcel_as_geojson,
    validate_and_fix_geometry,
    transform_point_to_wgs84,
)
# Imports successfully
```

### 8. Three-Tier Cache Schema Enforcement

**Tier 1: Lightweight pre-scan data (always populated)**
- geometry: MULTIPOLYGON(28992) ✓
- parcel_id: VARCHAR(50) ✓
- address: VARCHAR(500) ✓
- gemeente_code: VARCHAR(10) ✓
- area_m2: FLOAT ✓
- has_pand: BOOLEAN ✓
- bestemmingen: JSONB (array for dubbele bestemming) ✓

**Tier 2: On-demand enrichment (populated when user opens detail)**
- enrichment_data: JSONB ✓
- enriched_at: TIMESTAMP ✓

**Tier 3: BRK eigendomsdata - NEVER stored**
- No owner_name column ✓
- No owner_address column ✓
- No kadaster eigendoms fields ✓
- Comment in model: "BRK data is always queried fresh at request time (legitimate interest)" ✓

---

_Verified: 2026-02-10T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
