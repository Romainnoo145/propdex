---
id: S12
parent: M001
milestone: M001
provides:
  - Portfolio mode toggle (Werkruimte / Portfolio pill) on Projecten page
  - PortfolioView orchestrator with 4-level drill-down navigation via URL params
  - usePortfolio hook (GET /api/portfolio, queryKey ['portfolio'])
  - portfolio_* URL search params on projecten route
requires: []
affects: []
key_files: []
key_decisions:
  - "portfolio_* URL params use separate namespace from workspace params (gemeente_id/wijk_id) to avoid navigation collisions"
  - "favoriteCountByProvince derived from allGemeenteCards.provinceCode — no extra API call needed"
  - "PortfolioWijkView uses wijk_naam as drill-down key since no wijk_code exists in codebase"
  - "Level 4 (parcel list at wijk) is a placeholder in plan 1 — FavoritedParcelCard delivered in plan 2"
patterns_established:
  - "Portfolio drill-down: each level sets a deeper portfolio_* param; breadcrumb clears deeper params on click"
  - "Mode toggle clears opposite mode's URL params to prevent ghost navigation state"
observability_surfaces: []
drill_down_paths: []
duration: 6min
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---
# S12: Portfolio Navigation

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

# Phase 111 Plan 2: FavoritedParcelCard + PipelineStagePill + Wijk Parcel Grid Summary

**One-liner:** Wijk drill-down now shows a responsive grid of FavoritedParcelCard components with colored PipelineStagePill and map navigation toast.

## What Was Built

Three tasks delivered the full parcel-level view at the deepest portfolio drill-down level:

1. **PipelineStagePill** — 23-line pill component mapping 5 pipeline stages to distinct Aura-compatible color tokens (sage-mint, amber, blue, purple, neutral).

2. **FavoritedParcelCard** — 47-line card showing Kadaster parcel_id in mono font, gemeente/wijk labels, pipeline stage pill, nl-NL formatted creation date, and a ghost button.

3. **PortfolioView wijk level** — Replaced placeholder with filtered favorites grid. Filters by `gemeente_code` + `wijk_naam` (null wijk maps to "Onbekende wijk"). Ghost button navigates to `/map?gemeente_code=...` and fires a Sonner toast: "Zoek het perceel via het adres-zoekvenster". Count header and empty state both handled.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- frontend/src/components/projects/PipelineStagePill.tsx — FOUND
- frontend/src/components/projects/FavoritedParcelCard.tsx — FOUND
- frontend/src/components/projects/PortfolioView.tsx — FOUND (modified)

Commits exist:
- ca149bf — feat(111-02): create PipelineStagePill component
- 297c9e3 — feat(111-02): create FavoritedParcelCard component
- fd48e3d — feat(111-02): wire FavoritedParcelCard grid into PortfolioView wijk level
