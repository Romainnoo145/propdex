---
id: T01
parent: S05
milestone: M001
provides:
  - "GET /api/jurisprudence/trend/{gemeente_naam} endpoint with monthly klimaat score buckets"
  - "Summary stats: total_rulings, avg_doorlooptijd, succes_pct, months_with_data"
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 2min
verification_result: passed
completed_at: 2026-03-09
blocker_discovered: false
---
# T01: 86-trend-statistics 01

**# Phase 86 Plan 01: Trend Endpoint Summary**

## What Happened

# Phase 86 Plan 01: Trend Endpoint Summary

**Rolling 12-month trend endpoint with monthly klimaat score buckets, outcome counts, and weighted doorlooptijd summary**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T03:28:02Z
- **Completed:** 2026-03-09T03:30:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- GET /trend/{gemeente_naam} endpoint with monthly aggregation via PostgreSQL to_char/to_date
- Per-month klimaat_score (100 - 100*afgewezen/total), outcome counts, and avg_doorlooptijd
- Aggregated summary with total_rulings, weighted avg_doorlooptijd, succes_pct, months_with_data
- Empty data returns graceful zero response (not 404)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /trend/{gemeente_naam} endpoint** - `8b2bb21` (feat)

## Files Created/Modified
- `backend/app/api/endpoints/jurisprudence.py` - Added trend endpoint with monthly bucketing query and summary stats (108 lines)

## Decisions Made
- Rolling 12-month window uses string comparison (`datum_uitspraak >= "2025-03-09"`) matching the existing `_periode_to_date()` pattern for VARCHAR date columns
- Weighted average doorlooptijd across months (weight = month total) for accurate aggregation rather than simple mean of averages
- Empty data returns `{"months": [], "summary": {"total_rulings": 0, ...}}` -- absence of trend data is valid state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Trend endpoint ready for frontend consumption in 86-02
- Response shape documented in plan for frontend integration

## Self-Check: PASSED

- [x] `backend/app/api/endpoints/jurisprudence.py` exists
- [x] Commit `8b2bb21` exists in git history

---
*Phase: 86-trend-statistics*
*Completed: 2026-03-09*
