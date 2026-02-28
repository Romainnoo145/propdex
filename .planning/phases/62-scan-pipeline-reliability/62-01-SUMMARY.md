---
phase: 62-scan-pipeline-reliability
plan: 01
subsystem: api
tags: [bag-wfs, retry, area-scan, alembic, coverage-tracking, sqlalchemy]

# Dependency graph
requires: []
provides:
  - BAG WFS per-page retry with exponential backoff (3 retries, 1s/2s/4s) via retry_with_backoff extension
  - area_scan_job abort-on-persistent-BAG-failure with structured error_detail JSONB
  - coverage_ratio and address_resolution_ratio computed and stored on AreaScan post-scan
  - completed_with_warnings scan status when coverage or address thresholds breached
  - Alembic migration 5a8a4c23d4e6 adding three new nullable columns to area_scans
affects:
  - 62-02 (wijk scan tooling uses AreaScan model + coverage fields)
  - 63 (Venlo data quality depends on scan pipeline reliability)
  - All area scan consumers that read scan status

# Tech tracking
tech-stack:
  added: []
  patterns:
    - retry_with_backoff now has retry_on_errors=True mode for 5xx/network errors (not just 429)
    - BAG WFS per-page retry using inner closure with default-arg param binding (fixes B023)
    - area_scan_job abort pattern: set status=failed, error_detail JSONB, flush/commit, return
    - coverage_ratio/address_resolution_ratio computed from scored_parcels post-Phase-5
    - completed_with_warnings status when coverage <10% or address resolution <50%

key-files:
  created:
    - backend/alembic/versions/5a8a4c23d4e6_add_coverage_ratio_address_resolution_.py
    - backend/tests/unit/test_bag_wfs_retry.py
  modified:
    - backend/app/models/area_scan.py
    - backend/app/government_apis/base.py
    - backend/app/government_apis/bag_wfs.py
    - backend/app/jobs/area_scan.py

key-decisions:
  - "retry_with_backoff extended with retry_on_errors=True — default=False preserves all existing 429-only callers unchanged"
  - "BAG WFS failure aborts scan (status=failed) rather than continuing with empty data — prevents garbage scores from propagating"
  - "coverage_ratio threshold set at 0.10 (warn if <10% of parcels have buildings) — conservative sentinel for BAG data quality"
  - "address_resolution_ratio threshold set at 0.50 (warn if <50% of building-parcels have addresses)"
  - "B023 ruff lint error fixed by binding params as default arg in _fetch_page closure"

patterns-established:
  - "Abort-on-failure pattern: set scan.status=failed, assign scan.error_detail JSONB with stage/error/error_type/bbox, flush+commit, return early"
  - "Coverage validation runs after Phase 5 (addresses) on scored_parcels list — accesses parcel.has_pand and parcel.address"

requirements-completed:
  - SCAN-01
  - SCAN-02

# Metrics
duration: 25min
completed: 2026-02-28
---

# Phase 62 Plan 01: Scan Pipeline Reliability — BAG Retry + Coverage Tracking Summary

**BAG WFS per-page retry (3x with exponential backoff) + scan abort on persistent failure + coverage_ratio/address_resolution_ratio tracking on AreaScan with completed_with_warnings status**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-02-28T19:15:00Z
- **Completed:** 2026-02-28T19:40:00Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Extended `retry_with_backoff` in base.py with `retry_on_errors=True` for 5xx and network error retry (default=False preserves backward compat)
- BAG WFS `get_panden_in_bbox` now uses `retry_with_backoff(retry_on_errors=True)` per page — eliminates silent garbage data from transient API failures
- area_scan_job now aborts with `status=failed` + structured `error_detail` JSONB when BAG WFS fails after retries — eliminates silent continuation with empty data
- Post-scan coverage validation: `coverage_ratio` and `address_resolution_ratio` stored on every completed scan; `completed_with_warnings` status set when thresholds breached
- 9 new unit tests covering retry behavior, exponential backoff delays, and BAG WFS retry integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Alembic migration + AreaScan model fields** - `7f3b3f9` (feat)
2. **Task 2: BAG WFS retry + abort + coverage validation** - `1c3247c` (feat)
3. **Task 3: Unit tests for BAG retry and coverage validation** - `ddc73a5` (test)

## Files Created/Modified
- `backend/alembic/versions/5a8a4c23d4e6_add_coverage_ratio_address_resolution_.py` - Migration adding coverage_ratio (float), address_resolution_ratio (float), error_detail (JSONB) to area_scans; status widened to String(30)
- `backend/app/models/area_scan.py` - Three new nullable fields + status String(30) + status docstring update
- `backend/app/government_apis/base.py` - retry_with_backoff extended with retry_on_errors=True for 5xx/network failures
- `backend/app/government_apis/bag_wfs.py` - get_panden_in_bbox uses retry_with_backoff per page (3 retries, retry_on_errors=True)
- `backend/app/jobs/area_scan.py` - BAG failure abort + coverage ratio validation + completed_with_warnings status
- `backend/tests/unit/test_bag_wfs_retry.py` - 9 tests for retry_with_backoff extension and BAG WFS integration

## Decisions Made
- `retry_with_backoff` default `retry_on_errors=False` preserves all existing callers unchanged — only BAG WFS opts into error retry
- BAG WFS failure aborts scan rather than continuing with empty data — the root cause of garbage scores is eliminated
- Coverage thresholds: <10% has_pand warning (building coverage), <50% address resolution warning
- `completed_with_warnings` is a proper scan status (not just a log) — operators can filter scans by this status
- Autogenerate migration cleaned manually to exclude PostGIS tiger tables (Alembic saw them as removals)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed B023 ruff lint error in BAG WFS closure**
- **Found during:** Task 2 (BAG WFS retry implementation)
- **Issue:** Inner `_fetch_page` closure referenced `params` which ruff flagged as B023 (loop variable not bound)
- **Fix:** Added `_params: dict = params` default argument to bind `params` at closure creation time
- **Files modified:** `backend/app/government_apis/bag_wfs.py`
- **Verification:** `ruff check` passes with no errors
- **Committed in:** `1c3247c` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed F401/I001 ruff errors in test file**
- **Found during:** Task 3 (test file creation)
- **Issue:** Unused `call` import and unsorted import block
- **Fix:** Removed `call`, sorted imports to stdlib > third-party > local order
- **Files modified:** `backend/tests/unit/test_bag_wfs_retry.py`
- **Verification:** `ruff check` passes with no errors
- **Committed in:** `ddc73a5` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs — lint errors found during execution)
**Impact on plan:** Both auto-fixes required for code quality compliance. No scope creep.

## Issues Encountered
- Alembic autogenerate captured PostGIS tiger schema tables as "removed" (they are in a different schema that alembic is watching). Migration was manually rewritten to only include the 3 column additions and status column width change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scan pipeline is now reliable: BAG WFS failures retry and abort instead of silently producing garbage data
- AreaScan now tracks coverage quality metrics for operator observability
- Ready for Phase 62 Plan 02: wijk scan tooling (run_gemeente_wijk_scans.py)
- Venlo data collection (Phase 63) can proceed with confidence that scan data quality is validated

## Self-Check: PASSED

- backend/app/models/area_scan.py: FOUND
- backend/alembic/versions/5a8a4c23d4e6_add_coverage_ratio_address_resolution_.py: FOUND
- backend/app/government_apis/base.py: FOUND
- backend/app/government_apis/bag_wfs.py: FOUND
- backend/app/jobs/area_scan.py: FOUND
- backend/tests/unit/test_bag_wfs_retry.py: FOUND
- .planning/phases/62-scan-pipeline-reliability/62-01-SUMMARY.md: FOUND
- Commit 7f3b3f9: FOUND
- Commit 1c3247c: FOUND
- Commit ddc73a5: FOUND

---
*Phase: 62-scan-pipeline-reliability*
*Completed: 2026-02-28*
