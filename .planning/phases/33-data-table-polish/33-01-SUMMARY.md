---
phase: 33-data-table-polish
plan: 01
subsystem: ui
tags: [tanstack-router, tanstack-table, url-search-params, multi-sort, react]

# Dependency graph
requires:
  - phase: 32-feedback-primitives
    provides: feedback primitives (Skeleton, EmptyState, ErrorState) used by ResultsTable/ResultsFilterPanel
provides:
  - Filter state encoded in URL search params (DT-04)
  - Sort state encoded in URL search params (DT-04)
  - Multi-sort via Shift+click with priority badges (DT-01)
  - Page state encoded in URL search params
affects: [33-02, 33-03, 33-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - navigate with functional (prev) => ({...prev, ...newFields}) to preserve scan_id across URL updates
    - URL-derived state as single source of truth — no useState for filter/sort/page in parent
    - Updater<T> generic type for handleSortingChange/handlePaginationChange compatibility with TanStack Table

key-files:
  created: []
  modified:
    - frontend/src/routes/_authenticated/resultaten.tsx
    - frontend/src/components/results/ResultsFilterPanel.tsx
    - frontend/src/components/results/ResultsTable.tsx

key-decisions:
  - "Only primary sort (newSorting[0]) sent to backend API — secondary multi-sort columns are visual-only indicators"
  - "Used primarySort variable destructuring instead of newSorting[0] inline to satisfy TypeScript strictNullChecks"
  - "localMinArea syncs from URL via useEffect on filters.min_area_m2 — handles external clear-all without losing debounce behavior"
  - "navigate uses void operator to discard Promise return — avoids floating promise lint warning"

patterns-established:
  - "URL-nav callbacks: navigate with (prev) => ({...prev, ...changes}) always spreads prev to preserve unrelated params (especially scan_id)"
  - "Multi-sort priority badge: amber-accent number badge shown only when sorting.length > 1 and column isSorted"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 33 Plan 01: URL Search Params + Multi-Sort Summary

**Filter, sort, and page state migrated to TanStack Router URL params with Shift+click multi-sort priority badges in ResultsTable**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-18T04:03:16Z
- **Completed:** 2026-02-18T04:06:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Filter state (bestemming_type, pand_status, min_area_m2, max_area_m2, score_category) persists in URL and survives navigation
- Sort state (sort_by, sort_order) and page number encoded in URL, shareable via link
- Multi-sort enabled with Shift+click — sort priority numbers shown next to column headers
- scan_id never erased when filters/sort/page change (functional `prev` form in navigate)
- lucide-react icons replace inline SVG arrows for sort direction indicators

## Task Commits

1. **Task 1: Migrate filter + sort + page state to URL search params** - `85ab339` (feat)
2. **Task 2: Enable multi-sort with Shift+click in ResultsTable** - `6c2aec3` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/routes/_authenticated/resultaten.tsx` - Extended validateSearch with 8 new params; replaced useState with URL-derived filters; added handleFilterChange/handleSortChange/handlePageChange navigate callbacks
- `frontend/src/components/results/ResultsFilterPanel.tsx` - Updated onChange prop to Partial<ScanResultsFilters>; added useEffect to sync localMinArea from URL changes; updated handleClearFilters to pass undefined for all filter fields
- `frontend/src/components/results/ResultsTable.tsx` - Added onSortChange/onPageChange/currentPage props; enableMultiSort + isMultiSortEvent (Shift+click); lucide-react sort icons; multi-sort priority badges; removed pagination reset useEffect (URL parent handles it)

## Decisions Made

- Only primary sort sent to backend API — TanStack Table multi-sort with 2-3 columns is visual indication only (server is paginated, can't client-side resort full dataset)
- Used `primarySort` variable destructuring before conditional to satisfy TypeScript strictNullChecks (array element access returns T | undefined even after `.length > 0` guard)
- `localMinArea` syncs from `filters.min_area_m2` via dedicated useEffect — ensures clear-all from URL resets the text input without breaking 500ms debounce
- `void navigate(...)` pattern to avoid floating-promise ESLint warning

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TypeScript strictNullChecks: `newSorting[0].id` flagged as "possibly undefined" even inside `.length > 0` guard. Fixed by extracting to `const primarySort = newSorting[0]` then narrowing with `if (primarySort && onSortChange)`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- URL-based filter/sort/page state ready for Plan 02 (column visibility and density controls)
- DT-04 (persistent filter state) and DT-01 (multi-sort) requirements complete
- ResultsTable prop interface extended with onSortChange/onPageChange/currentPage — Plan 02 can add more props following same pattern

## Self-Check: PASSED

- FOUND: frontend/src/routes/_authenticated/resultaten.tsx
- FOUND: frontend/src/components/results/ResultsFilterPanel.tsx
- FOUND: frontend/src/components/results/ResultsTable.tsx
- FOUND: .planning/phases/33-data-table-polish/33-01-SUMMARY.md
- FOUND commit: 85ab339 (Task 1 — URL search params migration)
- FOUND commit: 6c2aec3 (Task 2 — multi-sort with Shift+click)

---
*Phase: 33-data-table-polish*
*Completed: 2026-02-18*
