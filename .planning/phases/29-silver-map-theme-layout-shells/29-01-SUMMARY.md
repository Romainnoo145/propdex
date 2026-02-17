---
phase: 29-silver-map-theme-layout-shells
plan: 01
subsystem: ui
tags: [maplibre, raster, tailwind, layout, design-system]

# Dependency graph
requires:
  - phase: 28-nav-persistent-mapview
    provides: MapView component with carto-light-layer raster source

provides:
  - Silver/desaturated raster paint properties baked into MapView carto-light-layer
  - MapShell layout component for full-viewport map UI context
  - ResultsShell layout component for scrollable solid-bg data pages

affects:
  - 29-02 (route migration: adopts MapShell and ResultsShell)
  - Any future map-adjacent feature that uses MapView

# Tech tracking
tech-stack:
  added: []
  patterns:
    - MapLibre raster paint properties baked at style initialization (not runtime setPaintProperty)
    - Layout shells as thin Tailwind wrappers enforcing DS-04 visual distinction

key-files:
  created:
    - frontend/src/components/layout/MapShell.tsx
    - frontend/src/components/layout/ResultsShell.tsx
  modified:
    - frontend/src/components/map/MapView.tsx

key-decisions:
  - "Silver map: raster-saturation -0.85, brightness-min 0.08, brightness-max 0.92, contrast -0.05 for desaturated CartoDB Positron"
  - "Paint properties baked into initial style definition — not setPaintProperty() to avoid state management complexity"
  - "MapShell uses div (not main) — AppLayout.tsx uses main; differentiated to avoid duplicate landmark semantics"

patterns-established:
  - "MapShell pattern: relative w-full h-full overflow-hidden for full-viewport floating UI context"
  - "ResultsShell pattern: scrollable w-full h-full overflow-y-auto bg-grey-950 with max-w-5xl content area"

# Metrics
duration: 1min
completed: 2026-02-18
---

# Phase 29 Plan 01: Silver Map Theme + Layout Shells Summary

**Silver raster paint applied to CartoDB Positron tiles (raster-saturation -0.85) with MapShell and ResultsShell layout components formalizing DS-04 visual distinction**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-18T00:28:24Z
- **Completed:** 2026-02-18T00:29:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- CartoDB Positron base layer desaturated to silver/monochrome via baked-in raster paint properties (saturation -0.85, brightness floor 0.08, brightness cap 0.92, contrast -0.05)
- MapShell component created as full-viewport overflow-hidden positioning context for /map route floating controls
- ResultsShell component created as scrollable solid bg-grey-950 content wrapper for /projecten, /instellingen, /rapport routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply silver raster paint properties to map base layer** - `8b22bff` (feat)
2. **Task 2: Create MapShell and ResultsShell layout components** - `5ee5802` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/components/map/MapView.tsx` - Added paint object to carto-light-layer with four raster properties
- `frontend/src/components/layout/MapShell.tsx` - New: full-viewport layout shell for /map route
- `frontend/src/components/layout/ResultsShell.tsx` - New: scrollable bg-grey-950 shell for data routes

## Decisions Made

- Baked paint properties into MapLibre initial style definition rather than using `map.setPaintProperty()` at runtime — simpler, no timing issues, no risk of losing properties after style reloads
- `MapShell` uses `<div>` (not `<main>`) because `AppLayout.tsx` already uses `<main>` — avoids duplicate landmark elements before migration in Plan 02
- Silver values chosen: saturation -0.85 gives strong desaturation while preserving enough contrast for road/building differentiation; brightness floor 0.08 prevents full-black in dark areas

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MapView now renders silver-toned tiles, ready for data overlay contrast (DS-03)
- MapShell and ResultsShell ready for adoption by route files in Plan 02 (_authenticated.tsx migration)
- AppLayout.tsx preserved — no import breakage, `npm run check` confirms 0 errors

## Self-Check: PASSED

All artifacts verified:
- `frontend/src/components/map/MapView.tsx` - FOUND
- `frontend/src/components/layout/MapShell.tsx` - FOUND
- `frontend/src/components/layout/ResultsShell.tsx` - FOUND
- `.planning/phases/29-silver-map-theme-layout-shells/29-01-SUMMARY.md` - FOUND
- Commit `8b22bff` (Task 1) - FOUND
- Commit `5ee5802` (Task 2) - FOUND

---
*Phase: 29-silver-map-theme-layout-shells*
*Completed: 2026-02-18*
