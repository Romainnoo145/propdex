---
id: T01
parent: S12
milestone: M001
provides:
  - Portfolio mode toggle (Werkruimte / Portfolio pill) on Projecten page
  - PortfolioView orchestrator with 4-level drill-down navigation via URL params
  - usePortfolio hook (GET /api/portfolio, queryKey ['portfolio'])
  - portfolio_* URL search params on projecten route
requires: []
affects: []
key_files: []
key_decisions: []
patterns_established: []
observability_surfaces: []
drill_down_paths: []
duration: 6min
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---
# T01: Plan 01

**# Phase 111 Plan 1: Portfolio Mode Toggle + Provincie/Gemeente/Wijk Drill-Down Summary**

## What Happened

# Phase 111 Plan 1: Portfolio Mode Toggle + Provincie/Gemeente/Wijk Drill-Down Summary

**Portfolio drill-down navigation with URL-param-driven province/gemeente/wijk levels, Framer Motion toggle, and SVG silhouette province/gemeente cards**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-16T03:36:57Z
- **Completed:** 2026-03-16T03:42:48Z
- **Tasks:** 7
- **Files modified:** 10

## Accomplishments

- Full 4-level portfolio drill-down (province grid → gemeente → wijk → placeholder parcel list) driven by URL search params
- usePortfolio hook with automatic invalidation when favorites are toggled (portfolio + favorites queries)
- 12 province SVG cards with active/inactive states, gemeente cards with dual-path SVG background, wijk cards with amber count badges

## Task Commits

1. **Task 1: Extend schema, usePortfolio hook, expose allGemeenteCards** - `46230fa` (feat)
2. **Task 2: PortfolioModeToggle** - `423d828` (feat)
3. **Task 3: PortfolioBreadcrumb** - `41c8d8c` (feat)
4. **Task 4: PortfolioProvincieView** - `83012b5` (feat)
5. **Task 5: PortfolioGemeenteView** - `c9ada63` (feat)
6. **Task 6: PortfolioWijkView** - `7b8af12` (feat)
7. **Task 7: PortfolioView orchestrator + ProjectenPage wiring** - `84fd4d3` (feat)

## Files Created/Modified

- `frontend/src/components/projects/PortfolioModeToggle.tsx` - Pill toggle (Werkruimte/Portfolio) with Framer Motion animated active pill
- `frontend/src/components/projects/PortfolioBreadcrumb.tsx` - Clickable breadcrumb for 4-level drill-down navigation
- `frontend/src/components/projects/PortfolioProvincieView.tsx` - 12 province card grid with SVG silhouettes, active/inactive states
- `frontend/src/components/projects/PortfolioGemeenteView.tsx` - Gemeente cards filtered by province with dual-path SVG
- `frontend/src/components/projects/PortfolioWijkView.tsx` - Wijk cards with amber parcel count badges
- `frontend/src/components/projects/PortfolioView.tsx` - Top-level drill-down orchestrator, derives province counts from allGemeenteCards
- `frontend/src/routes/_authenticated/projecten.tsx` - Added portfolio_mode/provincie/gemeente/wijk URL search params
- `frontend/src/hooks/useFavorites.ts` - Added usePortfolio hook, fixed portfolio invalidation on toggle
- `frontend/src/components/projects/useProjectenWorkspace.ts` - Exposed allGemeenteCards in return object
- `frontend/src/components/projects/ProjectenPage.tsx` - Mode toggle + portfolio/workspace branch rendering

## Decisions Made

- portfolio_* URL params use a separate namespace from workspace params (gemeente_id/wijk_id) to prevent navigation collisions when switching modes
- Province-level favorite counts derived from allGemeenteCards.provinceCode — avoids duplicate API calls
- Wijk level uses wijk_naam as drill-down key (wijk_code does not exist in the codebase per Phase 109-01 decision)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Portfolio navigation structure complete — plan 2 can add FavoritedParcelCard at Level 4 (wijk → parcel list)
- usePortfolio hook ready for plan 2 parcel grid consumption
- All portfolio_* URL params wired and navigable via browser back button (TanStack Router history)

---
*Phase: 111-portfolio-navigation*
*Completed: 2026-03-16*
