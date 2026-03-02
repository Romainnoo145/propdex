---
phase: 66-results-table-noise-reduction
plan: 01
subsystem: ui
tags: [react, fastapi, sqlalchemy, tanstack-table, results-table, filtering]

# Dependency graph
requires:
  - phase: 65-report-polish
    provides: stable results table and scan backend as base
provides:
  - Server-side min_score + exclude_null_scores filter with nulls_last sort
  - total_unfiltered count field on ScanResultsResponse schema
  - Top kansen toggle switch with Dutch labels and hidden count display
  - Auto-disable logic when filter yields 0 rows
  - "N van M percelen" count format
affects: [67-wkb-asbest-classifier, results-table, scan-results-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "nulls_last() wraps all SQLAlchemy sort expressions for consistent null placement"
    - "Unfiltered count computed before score threshold filter for toggle hidden-count display"
    - "SCORE_CUTOFF=40 constant matches QUALIFICATION_THRESHOLD — inject via tableFilters spread"
    - "Toggle state as React useState only — not URL-persisted, not localStorage"

key-files:
  created: []
  modified:
    - backend/app/scans/service.py
    - backend/app/scans/schemas.py
    - backend/app/scans/router.py
    - frontend/src/lib/types/scan.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/results/ResultsLayout.tsx
    - frontend/src/components/results/ResultsFilterPanel.tsx
    - frontend/src/components/results/ResultsTable.tsx

key-decisions:
  - "SCORE_CUTOFF=40 matches QUALIFICATION_THRESHOLD from parcel_scoring.py — keeps frontend/backend in sync"
  - "Unfiltered count computed before score filters so toggle shows correct hidden-parcel count"
  - "Toggle is React state only (not URL state) — resets to ON on mount as intended"
  - "nulls_last() applied to all sort fields, not just score — consistent behavior across all columns"

patterns-established:
  - "3-tuple return from list_scan_results: (rows, filtered_total, unfiltered_total)"
  - "Score threshold filter is applied AFTER unfiltered count query in service layer"

requirements-completed: [RES-01, RES-02]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 66 Plan 01: Score Threshold Filter and Top Kansen Toggle Summary

**Server-side min_score/exclude_null_scores filter with nulls_last sort, total_unfiltered API field, and "Top kansen" toggle switch showing "N van M percelen" count and auto-disabling on empty results**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T04:04:06Z
- **Completed:** 2026-03-02T04:07:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Backend `list_scan_results` now accepts `min_score` and `exclude_null_scores` params; returns 3-tuple with `unfiltered_total` for accurate hidden-count display
- `nulls_last()` wraps all sort expressions so null-score parcels consistently appear at the bottom regardless of ASC/DESC direction
- Frontend toggle "Top kansen" defaults to ON (score >= 40, no null scores), shows "(N verborgen)" count and auto-disables with Dutch toast when filter would yield 0 rows
- Auto-fixed pre-existing bug: `pand_status` filter was not being serialized in `fetchScanResults` API call

## Task Commits

Each task was committed atomically:

1. **Task 1: Add server-side score threshold filter with nulls_last sort and unfiltered count** - `81a439a` (feat)
2. **Task 2: Add toggle switch with count display and auto-disable in frontend** - `9cba435` (feat)

## Files Created/Modified

- `backend/app/scans/service.py` - Added min_score/exclude_null_scores params, unfiltered count, nulls_last sort, 3-tuple return
- `backend/app/scans/schemas.py` - Added total_unfiltered field to ScanResultsResponse
- `backend/app/scans/router.py` - Added min_score/exclude_null_scores query params, 3-tuple destructuring, total_unfiltered in response
- `frontend/src/lib/types/scan.ts` - Added min_score/exclude_null_scores to ScanResultsFilters, total_unfiltered to ScanResultsResponse
- `frontend/src/lib/api.ts` - Serialize min_score, exclude_null_scores, and pand_status in fetchScanResults
- `frontend/src/components/results/ResultsLayout.tsx` - showOnlyTop state, SCORE_CUTOFF=40, tableFilters injection, onTotalUnfilteredChange propagation
- `frontend/src/components/results/ResultsFilterPanel.tsx` - Toggle switch with Dutch labels, count display, auto-disable useEffect
- `frontend/src/components/results/ResultsTable.tsx` - onTotalUnfilteredChange callback, propagates total_unfiltered from API

## Decisions Made

- SCORE_CUTOFF=40 chosen to match QUALIFICATION_THRESHOLD from parcel_scoring.py — keeps threshold synchronized
- Unfiltered count computed BEFORE applying score filters in service so toggle can accurately show how many are hidden
- Toggle state is React useState only (not URL params) — resets to ON on page load, intentional for default "clean view"
- nulls_last() applied to all sort fields (not just score) for consistent behavior when other columns have nulls

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] pand_status filter not serialized in API call**
- **Found during:** Task 2 (frontend API integration)
- **Issue:** `fetchScanResults` in api.ts was not serializing `pand_status` into URL params despite it being a valid filter, causing the status dropdown filter to silently do nothing
- **Fix:** Added `if (filters.pand_status) params.set('pand_status', filters.pand_status)` alongside the new filter params
- **Files modified:** frontend/src/lib/api.ts
- **Verification:** TypeScript check passes, params correctly serialized
- **Committed in:** 9cba435 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Pre-existing silent bug where status filter dropdown had no effect. Fixed inline with Task 2. No scope creep.

## Issues Encountered

None - plan executed without blocking issues.

## Next Phase Readiness

- Phase 66 Plan 01 complete — results table now shows only scored/qualifying parcels by default
- Toggle is wired and working with correct Dutch labels and auto-disable logic
- Map remains unaffected (tile endpoint unchanged, no score filtering on tiles)
- Ready for any additional plans in Phase 66 or next phase

---
*Phase: 66-results-table-noise-reduction*
*Completed: 2026-03-02*
