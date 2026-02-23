---
phase: 48-parcel-matching
plan: 02
subsystem: api
tags: [postgresql, sqlalchemy, alembic, postgis, geocoding, pdok]

# Dependency graph
requires:
  - phase: 48-01
    provides: geocode_address() + find_parcel_at_point() implemented and tested
provides:
  - matched_parcel_id nullable UUID FK column on change_records table (migration d4e5f6a7b8c9)
  - ChangeRecord model with matched_parcel_id mapped column
  - ChangeRecordResponse API schema includes matched_parcel_id field
  - daily_change_monitor_job geocodes and spatially matches new ChangeRecords at creation
  - initial_change_fetch geocodes and matches 30-day lookback changes
  - _try_match_parcel() shared helper in change_monitor.py
affects: [48-03, frontend parcel fly-to, map marker placement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - _try_match_parcel() helper extracted to avoid duplicating geocode+match logic across two pipeline functions
    - Module-level PDOKLocatieserver instance (same pattern as area_scan.py)
    - huisnummer int() conversion with try/except before geocoding call

key-files:
  created:
    - backend/alembic/versions/d4e5f6a7b8c9_add_matched_parcel_id_to_change_records.py
  modified:
    - backend/app/models/change_record.py
    - backend/app/schemas/monitoring.py
    - backend/app/monitoring/router.py
    - backend/app/jobs/change_monitor.py

key-decisions:
  - "matched_parcel_id uses ondelete=SET NULL so parcel deletion doesn't cascade to change records"
  - "_try_match_parcel wraps huisnummer int() in try/except to handle non-integer house numbers gracefully"
  - "daily_change_monitor_job calls _try_match_parcel BEFORE ChangeRecord constructor so matched_parcel_id is set at creation time"
  - "initial_change_fetch calls _try_match_parcel BEFORE session.begin_nested() to avoid geocoding inside nested transaction"
  - "Local uuid import inside initial_change_fetch removed — top-level uuid import now used throughout"

# Metrics
duration: 8min
completed: 2026-02-23
---

# Phase 48 Plan 02: Parcel Matching — Persist + Wire Summary

**matched_parcel_id FK column on ChangeRecord with geocoding wired into both daily_change_monitor_job and initial_change_fetch using shared _try_match_parcel() helper**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-23T13:43:50Z
- **Completed:** 2026-02-23T13:51:42Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Alembic migration d4e5f6a7b8c9: nullable UUID FK to parcel_cache.id with SET NULL, indexed
- ChangeRecord model updated with matched_parcel_id mapped column
- ChangeRecordResponse schema updated with matched_parcel_id field; both router builders include it
- _try_match_parcel() helper handles address_components extraction, geocoding, spatial lookup, and error cases (missing data, non-integer huisnummer)
- Both pipeline paths (daily job + initial fetch) geocode and match before persisting

## Task Commits

Each task was committed atomically:

1. **Task 1: Alembic migration + ChangeRecord model + API schema update** - `31fdc53` (feat)
2. **Task 2: Wire geocoding + matching into change_monitor.py** - `c6a515f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/alembic/versions/d4e5f6a7b8c9_add_matched_parcel_id_to_change_records.py` - Migration adding matched_parcel_id column with FK to parcel_cache.id
- `backend/app/models/change_record.py` - Added matched_parcel_id Mapped column after postcode
- `backend/app/schemas/monitoring.py` - Added matched_parcel_id: str | None = None to ChangeRecordResponse
- `backend/app/monitoring/router.py` - Both ChangeRecordResponse builders include matched_parcel_id
- `backend/app/jobs/change_monitor.py` - Added imports, module-level locatieserver, _try_match_parcel helper, wired into both pipeline functions

## Decisions Made
- `matched_parcel_id` uses `ondelete=SET NULL` so deleting a parcel doesn't cascade to delete change records
- `_try_match_parcel` wraps `huisnummer` in `int()` with try/except — some parsed house numbers may be strings or contain letters
- Geocode call happens outside `session.begin_nested()` in both pipeline functions — HTTP I/O should not block a nested transaction
- Removed the local `import uuid as _uuid` inside `initial_change_fetch` since `uuid` is now imported at module level

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- matched_parcel_id is persisted on ChangeRecord and surfaced in API responses
- Phase 48 Plan 03 (frontend fly-to + map marker) can now read matched_parcel_id from the API
- Existing test suite passes (390 passing; 15 pre-existing failures in zoning/RCE/DSO/SRU tests unrelated to this plan)

---
*Phase: 48-parcel-matching*
*Completed: 2026-02-23*
