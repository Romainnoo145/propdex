---
id: S05
parent: M001
milestone: M001
provides:
  - "GET /api/jurisprudence/trend/{gemeente_naam} endpoint with monthly klimaat score buckets"
  - "Summary stats: total_rulings, avg_doorlooptijd, succes_pct, months_with_data"
  - CSS-only TrendTimeline bar chart component
  - StatisticsBar aggregated metrics component
  - useTrendData React Query hook
  - TrendResponse/MonthBucket/TrendSummary TypeScript types
requires: []
affects: []
key_files: []
key_decisions:
  - "Rolling 12-month window via string comparison on VARCHAR datum_uitspraak"
  - "Weighted doorlooptijd average (not simple mean) for accurate cross-month aggregation"
  - "Empty data returns zeros with empty months array (not 404)"
  - "CSS-only bars with flexbox and inline height style (no chart library)"
  - "Color thresholds: green >= 70, amber 40-69, red < 40 klimaat score"
  - "Minimum 3 months for trend display, otherwise degradation message"
patterns_established:
  - "Monthly bucketing pattern: to_char(to_date(varchar_col, 'YYYY-MM-DD'), 'YYYY-MM') for GROUP BY"
  - "CSS bar chart: flexbox items-end with percentage height and min-h-[2px]"
  - "Trend data hook: 10-min stale time for slow-changing aggregate data"
observability_surfaces: []
drill_down_paths: []
duration: 5min
verification_result: passed
completed_at: 2026-03-09
blocker_discovered: false
---
# S05: Trend Statistics

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

# Phase 86 Plan 02: Frontend Trend Chart Summary

**CSS-only 12-month trend timeline and statistics bar integrated into JurisprudenceSection with graceful degradation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T03:32:38Z
- **Completed:** 2026-03-09T03:37:11Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- TrendTimeline renders color-coded vertical bars proportional to monthly ruling counts
- StatisticsBar shows totaal uitspraken, gemiddelde doorlooptijd, and succespercentage
- Graceful degradation when fewer than 3 months have data
- Zero chart library dependencies -- pure CSS/Tailwind visualization

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TrendResponse type, fetchTrendData function, and useTrendData hook** - `636327c` (feat)
2. **Task 2: Create TrendTimeline + StatisticsBar components and integrate into JurisprudenceSection** - `82f9536` (feat)

## Files Created/Modified
- `frontend/src/components/projects/TrendTimeline.tsx` - CSS-only 12-month bar chart with color-coded klimaat scores
- `frontend/src/components/projects/StatisticsBar.tsx` - Aggregated statistics row (totaal, doorlooptijd, succespercentage)
- `frontend/src/lib/api.ts` - MonthBucket, TrendSummary, TrendResponse types + fetchTrendData function
- `frontend/src/hooks/useJurisprudence.ts` - useTrendData hook with 10-min stale time
- `frontend/src/components/projects/JurisprudenceSection.tsx` - Integrated trend components between klimaat card and feed

## Decisions Made
- CSS-only bars using flexbox items-end with inline height percentage (no chart library)
- Color thresholds aligned with existing klimaat score ranges: green >= 70, amber 40-69, red < 40
- Minimum 3 months data threshold before showing chart (prevents misleading visuals)
- Skeleton loader during trend fetch, silent error handling (trend is supplementary data)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- v13.0 Juridisch Klimaat Intelligence milestone complete
- All TREND requirements (TREND-01, TREND-02, TREND-03) delivered

---
*Phase: 86-trend-statistics*
*Completed: 2026-03-09*
