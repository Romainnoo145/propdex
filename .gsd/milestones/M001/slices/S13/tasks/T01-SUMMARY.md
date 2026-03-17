---
id: T01
parent: S13
milestone: M001
provides:
  - parcel_code VARCHAR(50) nullable column in parcel_cache (PDOK display string)
  - parcel_cache_id UUID nullable FK in parcel_favorites pointing to parcel_cache.id
  - Scan-time derivation of parcel_code from PDOK WFS feature properties
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 12min
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---
# T01: 111.1-parcel-identity-unification 01

**# Phase 111.1 Plan 01: Parcel Identity Unification — Schema + Scan-time Population Summary**

## What Happened

# Phase 111.1 Plan 01: Parcel Identity Unification — Schema + Scan-time Population Summary

**parcel_code column added to parcel_cache, parcel_cache_id FK added to parcel_favorites, both populated by new Alembic migration and at scan-time from PDOK WFS properties**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-16T05:12:00Z
- **Completed:** 2026-03-16T05:24:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Alembic migration `i9d0e1f2g3h4` adds `parcel_code` to `parcel_cache` and `parcel_cache_id` FK to `parcel_favorites` with composite indexes
- SQLAlchemy models updated to match new schema columns
- `_upsert_parcel_cache` in `area_scan.py` derives and stores `parcel_code` from PDOK WFS feature properties at scan time (UPDATE + INSERT branches)
- Fixed pre-existing Alembic chain cycle (duplicate `a1b2c3d4e5f6` revision caused cycle detection failure)

## Task Commits

Each task was committed atomically:

1. **Task 1: Alembic migration + model updates for parcel_code and parcel_cache_id FK** - `cf455f2` (feat)
2. **Task 2: Populate parcel_code at scan time in _upsert_parcel_cache** - `bcbcbe9` (feat)

## Files Created/Modified
- `backend/alembic/versions/i9d0e1f2g3h4_add_parcel_code_and_fk_columns.py` - New migration: parcel_code + parcel_cache_id FK
- `backend/app/models/parcel_cache.py` - Added parcel_code Mapped field + composite index
- `backend/app/models/parcel_favorite.py` - Added parcel_cache_id FK Mapped field
- `backend/app/jobs/area_scan.py` - Derive parcel_code_display at scan time, populate in UPDATE + INSERT
- `backend/alembic/versions/g7b8c9d0e1f2_add_score_weights_to_organizations.py` - Rebased down_revision to 4c5d6e7f8a9b (chain fix)

## Decisions Made
- `parcel_code` uses space-separated format ("Venlo I 6658") matching PDOK display convention, not dash-separated like `parcel_id` ("HTT02-A-1234")
- No `UniqueConstraint` on `(organization_id, parcel_code)` yet — deferred until backfill plan confirms no duplicate/null issues
- `parcel_cache_id` FK uses `SET NULL` on delete so favorites survive parcel_cache flushes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Alembic revision cycle blocking migration**
- **Found during:** Task 1 (migration creation and execution)
- **Issue:** Duplicate `a1b2c3d4e5f6` revision ID in two files caused "Cycle is detected in revisions" error; `alembic upgrade head` and `alembic current` both failed
- **Fix:** Deleted `a1b2c3d4e5f6_add_score_weights_to_organizations.py` (duplicate); rebased `g7b8c9d0e1f2_add_score_weights_to_organizations.py` down_revision from `f6a7b8c9d0e1` to `4c5d6e7f8a9b` (actual DB head); stamped DB at `h8c9d0e1f2g3` since `score_weights` and `parcel_favorites` already existed
- **Files modified:** `backend/alembic/versions/a1b2c3d4e5f6_add_score_weights_to_organizations.py` (deleted), `backend/alembic/versions/g7b8c9d0e1f2_add_score_weights_to_organizations.py` (down_revision updated)
- **Verification:** `alembic heads` returns single `h8c9d0e1f2g3 (head)`, `alembic upgrade head` succeeds
- **Committed in:** `cf455f2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix — Alembic chain was broken before this plan started. No scope creep.

## Issues Encountered
- Pre-existing ruff I001 import sort warning in `area_scan.py` (2 errors present before and after changes) — out of scope, not caused by this plan

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `parcel_code` column is live in DB, new scans will populate it automatically
- Backfill plan (111.1-02) can now UPDATE existing parcel_cache rows with parcel_code derived from parcel_id
- Favorites-join plan (111.1-03) can use parcel_code to link favorites to parcel_cache geometry/enrichment

---
*Phase: 111.1-parcel-identity-unification*
*Completed: 2026-03-16*
