---
phase: 112-pipeline-stages
plan: 02
subsystem: ui
tags: [react, tanstack-router, portfolio, pipeline, filtering, url-params]

# Dependency graph
requires:
  - phase: 112-01
    provides: PipelineStagePill, STAGE_STYLES, FavoritedParcelCard, portfolio drill-down views
provides:
  - PipelineStageFilter pill bar component (5 stages + Alle fases)
  - portfolio_stage URL param in projecten search schema
  - Client-side filtering of favorites by stage across all drill-down levels
  - Wijk/gemeente/province counts reflecting filtered state, zero-count items hidden
affects: [portfolio, projecten, favorites]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - URL-param-driven filter state (portfolio_stage in TanStack Router search schema)
    - Client-side memo filtering from favorites cache (no extra API call)
    - Computed display data from filteredFavorites for all drill-down levels

key-files:
  created:
    - frontend/src/components/projects/PipelineStageFilter.tsx
  modified:
    - frontend/src/routes/_authenticated/projecten.tsx
    - frontend/src/components/projects/PortfolioView.tsx

key-decisions:
  - "PipelineStageFilter uses useNavigate with functional search updater to preserve all existing URL params when toggling stage"
  - "filteredFavorites memo is the single source of truth for all filtered counts — no duplicate filter logic per level"
  - "Zero-count wijk/gemeente cards hidden when filter active (not shown with 0 badge)"
  - "Province-level count recomputed from filteredFavorites when filter active, uses portfolio API otherwise"

patterns-established:
  - "URL-persisted client filter: z.enum in search schema + useNavigate functional updater + useMemo derived state"

requirements-completed: [PIPE-04]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 112 Plan 02: Pipeline Stage Filter Summary

**Cross-wijk portfolio stage filter using URL params and client-side favorites cache — pill bar with Alle fases + 5 stages, filtering all four drill-down levels with zero-count items hidden**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T07:35:08Z
- **Completed:** 2026-03-16T07:37:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PipelineStageFilter component renders horizontal pill bar with "Alle fases" + 5 stage pills, active state uses bg-aura-obsidian
- portfolio_stage added to TanStack Router search schema with z.enum validation (shareable URL, browser back works)
- All four drill-down levels (province, gemeente, wijk, parcel) filter from filteredFavorites cache — no extra API calls
- Zero-count wijk/gemeente cards hidden when stage filter active

## Task Commits

Each task was committed atomically:

1. **Task 1: Search schema update + PipelineStageFilter component** - `d0a2b65` (feat)
2. **Task 2: Wire stage filter into PortfolioView with client-side filtering** - `f378324` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/components/projects/PipelineStageFilter.tsx` - Pill bar filter component (Alle fases + 5 stages, STAGE_STYLES import, useNavigate URL updates)
- `frontend/src/routes/_authenticated/projecten.tsx` - Added portfolio_stage z.enum to search schema
- `frontend/src/components/projects/PortfolioView.tsx` - filteredFavorites memo, filteredWijkenForGemeente, filteredGemeenteCards, filtered province counts, PipelineStageFilter render, portfolio_stage preserved in all navigation handlers

## Decisions Made
- Used functional search updater `(prev) => ({ ...prev, portfolio_stage: stage })` in PipelineStageFilter to preserve all other URL params when toggling filter
- Single filteredFavorites memo as source of truth for all level-specific filtering (avoids duplicate filter logic)
- Province-level withFavorites/countMap switches between API data (no filter) and filteredFavorites (filter active) in the same memo

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 112-02 complete: pipeline stage filter fully wired across portfolio view
- Both Phase 112 plans complete — phase ready for close
- URL param `portfolio_stage` available for future features (e.g., sorting, analytics)

---
*Phase: 112-pipeline-stages*
*Completed: 2026-03-16*
