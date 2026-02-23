---
phase: 48-parcel-matching
plan: 03
subsystem: api
tags: [python, sqlalchemy, pdok, asyncio, bekendmakingen, parcel-matching, retro-match]

# Dependency graph
requires:
  - phase: 48-01
    provides: geocode_address() and find_parcel_at_point() primitives used in retro-match loop
  - phase: 48-02
    provides: matched_parcel_id column on ChangeRecord + _try_match_parcel in change_monitor
provides:
  - retro_match_changes_for_gemeente() in bekendmaking_matcher.py — re-checks unmatched ChangeRecords after wijk scan
  - Automatic post-scan retro-matching wired into area_scan_job Phase 6
  - 7 unit tests for retro_match_changes_for_gemeente
affects:
  - 48-04 (if any future plan extends matching)
  - Area scan results — retroactively matched bekendmakingen appear in parcel detail views

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sequential async processing for shared-session writes (not asyncio.gather)
    - asyncio.Semaphore for HTTP throttling even in sequential loop (future-proofing)
    - Best-effort try/except wrapping for non-critical post-scan steps
    - Safety cap (LIMIT 200) on retro-match candidates

key-files:
  created:
    - backend/tests/unit/test_retro_matcher.py
  modified:
    - backend/app/services/bekendmaking_matcher.py
    - backend/app/jobs/area_scan.py

key-decisions:
  - "Sequential processing (not asyncio.gather) for retro-match loop — shared AsyncSession write conflicts make concurrent gather unsafe"
  - "asyncio.Semaphore(5) kept even in sequential loop — throttles HTTP I/O, allows event loop interleaving with DB writes"
  - "LIMIT 200 safety cap on retro-match candidates — prevents runaway queries on first scan of active gemeente"
  - "Retro-match failure is non-fatal to scan — wrapped in try/except, scan already marked completed before retro-match runs"
  - "Caller (area_scan_job) handles commit after retro-match — function only flushes, separating responsibility"
  - "huisnummer int() conversion in try/except inside try_match_one — house numbers may be strings or contain letters (e.g. '42a')"

patterns-established:
  - "Post-scan best-effort enrichment: wrap in try/except, commit only when matched_count > 0, log warning on failure"
  - "Candidate filtering in Python not SQL — join query fetches all unmatched, Python filters those with required address_components fields"

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 48 Plan 03: Retro-Match Post-Scan Integration Summary

**Post-scan retro-matcher that re-geocodes unmatched bekendmakingen and links them to ParcelCache after a wijk scan adds new parcels to the database**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T02:52:09Z
- **Completed:** 2026-02-23T02:55:11Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Implemented `retro_match_changes_for_gemeente()` — queries up to 200 unmatched ChangeRecords for a gemeente, filters to those with address_components, geocodes each via PDOK, and matches to ParcelCache via ST_Contains
- Wired retro-match call into `area_scan_job` Phase 6 after scan completes — best-effort, failure does not fail the scan
- 7 unit tests covering all code paths: no_unmatched, no_address_components, successful_match, geocode_fails, no_parcel_found, respects_limit, invalid_huisnummer_skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement retro_match_changes_for_gemeente() with tests** - `0df7f2c` (feat)
2. **Task 2: Wire retro-match into area_scan_job Phase 6** - `930664a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/services/bekendmaking_matcher.py` - Added `retro_match_changes_for_gemeente()` function, `RETRO_MATCH_CONCURRENCY` constant, and new imports (asyncio, logging, httpx, PDOKLocatieserver, Project)
- `backend/app/jobs/area_scan.py` - Added import of `retro_match_changes_for_gemeente`, wired call after scan completion in Phase 6 block
- `backend/tests/unit/test_retro_matcher.py` - 7 unit tests for retro_match_changes_for_gemeente via mocking

## Decisions Made
- Sequential processing (not asyncio.gather) for the retro-match candidate loop — shared AsyncSession write conflicts make concurrent writes to the same session unsafe
- asyncio.Semaphore(5) kept even in sequential loop — throttles HTTP I/O at PDOK and allows event loop to interleave with DB writes
- LIMIT 200 safety cap on candidates — prevents runaway queries on first scan of an active gemeente with many unmatched records
- Retro-match failure is non-fatal — scan already marked `completed` before retro-match runs; wrapped in try/except with warning log
- Caller (area_scan_job) handles commit — `retro_match_changes_for_gemeente` only flushes, keeping transaction responsibility at the job level
- huisnummer int() conversion inside try/except — house numbers in SRU data may be strings or contain letters (e.g. "42a"), plan's implementation used this already via change_monitor

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Added invalid huisnummer guard inside try_match_one**
- **Found during:** Task 1 (implementation review)
- **Issue:** Plan code snippet shows direct `int(components["huisnummer"])` in try_match_one but without exception handling — would raise ValueError/TypeError on "42a" style house numbers
- **Fix:** Wrapped `int(components["huisnummer"])` in try/except (ValueError, TypeError), returns False on bad huisnummer (graceful skip)
- **Files modified:** backend/app/services/bekendmaking_matcher.py
- **Verification:** test_retro_match_invalid_huisnummer_skipped passes
- **Committed in:** 0df7f2c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing error handling for edge case)
**Impact on plan:** Essential correctness fix. No scope creep.

## Issues Encountered
None — plan executed smoothly.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 48 complete (all 3 plans done): geocode_address() + find_parcel_at_point() + change_monitor wiring + retro-match post-scan
- matched_parcel_id is now populated via three paths: (1) initial detection in change_monitor, (2) retro-match after scan, (3) future on-demand
- Ready for Phase 49 (ChangeReadState) or Phase 50 (FLOW: fly-to-parcel using matched_parcel_id)

## Self-Check: PASSED

All files confirmed on disk:
- `backend/app/services/bekendmaking_matcher.py` — FOUND
- `backend/app/jobs/area_scan.py` — FOUND
- `backend/tests/unit/test_retro_matcher.py` — FOUND
- `.planning/phases/48-parcel-matching/48-03-SUMMARY.md` — FOUND

All commits confirmed in git log:
- `0df7f2c` — feat(48-03): implement retro_match_changes_for_gemeente() with 7 unit tests
- `930664a` — feat(48-03): wire retro-match into area_scan_job Phase 6

---
*Phase: 48-parcel-matching*
*Completed: 2026-02-23*
