---
phase: 18-spatial-foundation
plan: 02
subsystem: database
tags: [sqlalchemy, alembic, postgresql, area-scans, scan-results]

# Dependency graph
requires:
  - phase: 18-01
    provides: PostGIS extension and ParcelCache model with geometry support
provides:
  - AreaScan model for tracking area intelligence scan jobs
  - ScanResult model linking scans to individual cached parcels
  - area_scans and scan_results tables with FK integrity
affects: [18-03, 18-04, 20-scanner-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Join table pattern for scan-to-parcel relationships
    - Status tracking with progress percentage and phase names
    - Immutable result records (no updated_at on ScanResult)

key-files:
  created:
    - backend/app/models/area_scan.py
    - backend/app/models/scan_result.py
    - backend/alembic/versions/fa6f15c17340_create_area_scans_and_scan_results_.py
  modified:
    - backend/app/models/__init__.py

key-decisions:
  - "Use join table (ScanResult) instead of JSONB array for scan results to maintain FK integrity"
  - "Store bounding box as 4 floats (minx, miny, maxx, maxy) for EPSG:28992 coordinates"
  - "Remove updated_at from ScanResult (results are immutable once created)"
  - "Use composite indexes on (organization_id, status) and (organization_id, gemeente_code) for tenant-scoped queries"

patterns-established:
  - "Status flow: pending -> running -> (completed | failed)"
  - "Progress phases: fetching_parcels -> cross_referencing_bag -> querying_bestemmingen"
  - "Unique constraint on (scan_id, parcel_id) prevents duplicate scan results"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 18 Plan 02: Area Scan Tracking Models Summary

**AreaScan and ScanResult models with FK integrity linking scans to individual cached parcels, supporting status tracking and progress monitoring for batch scan operations.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-10T11:59:06Z
- **Completed:** 2026-02-10T12:01:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- AreaScan model tracks scan status, progress, gemeente, and bounding box for area intelligence operations
- ScanResult join model links scans to individual ParcelCache entries with score and flags
- Database tables created via Alembic migration with proper indexes and constraints
- Unique constraint prevents duplicate scan-parcel pairs for data integrity

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AreaScan and ScanResult models** - `db2c138` (feat)
2. **Task 2: Create and apply Alembic migration** - `f04dddc` (feat)

## Files Created/Modified

- `backend/app/models/area_scan.py` - AreaScan model with status, progress, gemeente_code, bbox, timing, and error tracking
- `backend/app/models/scan_result.py` - ScanResult join model with FK to area_scans and parcel_cache, includes score and flags
- `backend/app/models/__init__.py` - Added AreaScan and ScanResult imports and exports
- `backend/alembic/versions/fa6f15c17340_create_area_scans_and_scan_results_.py` - Migration creating both tables with indexes and constraints

## Decisions Made

1. **Join table over JSONB:** Used ScanResult as a proper join table with FK constraints instead of storing scan results in a JSONB array, enabling referential integrity and efficient querying
2. **Bounding box storage:** Stored bbox as 4 separate float columns (minx, miny, maxx, maxy) for EPSG:28992 coordinates rather than a single PostGIS BOX2D type for simpler application-level access
3. **Immutable results:** ScanResult does not include updated_at timestamp since results are immutable once created during a scan
4. **Composite indexes:** Added (organization_id, status) and (organization_id, gemeente_code) indexes for efficient tenant-scoped queries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed incorrect GIST index drop from migration**
- **Found during:** Task 2 (Migration review)
- **Issue:** Alembic autogenerate incorrectly detected that idx_parcel_cache_geometry_gist should be dropped, which would break spatial queries
- **Fix:** Removed `op.drop_index(op.f('idx_parcel_cache_geometry_gist'), table_name='parcel_cache', postgresql_using='gist')` from upgrade() and `op.create_index(op.f('idx_parcel_cache_geometry_gist'), ...)` from downgrade()
- **Files modified:** backend/alembic/versions/fa6f15c17340_create_area_scans_and_scan_results_.py
- **Verification:** Migration applied successfully without affecting parcel_cache geometry index
- **Committed in:** f04dddc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix prevented migration from breaking existing spatial functionality. No scope creep.

## Issues Encountered

None - Alembic autogenerate correctly detected new tables, indexes, and constraints. The GIST index false-positive is a known Alembic behavior with PostGIS geometry columns and was handled via deviation Rule 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AreaScan and ScanResult models ready for use in scanner pipeline (Phase 20)
- Database schema supports batch processing with status tracking, progress monitoring, and result linking
- FK constraints ensure data integrity between scans, results, and cached parcels
- Multi-tenant isolation enforced via organization_id on all tables
- Ready for Phase 18-03 (Spatial Index Optimization) and 18-04 (Spatial Query Utilities)

## Self-Check: PASSED

All claimed files exist:
- ✓ backend/app/models/area_scan.py
- ✓ backend/app/models/scan_result.py
- ✓ backend/app/models/__init__.py
- ✓ backend/alembic/versions/fa6f15c17340_create_area_scans_and_scan_results_.py

All claimed commits exist:
- ✓ db2c138 (Task 1)
- ✓ f04dddc (Task 2)

---
*Phase: 18-spatial-foundation*
*Completed: 2026-02-10*
