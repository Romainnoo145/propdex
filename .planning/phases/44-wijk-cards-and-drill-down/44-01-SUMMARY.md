---
phase: 44-wijk-cards-and-drill-down
plan: 01
subsystem: ui
tags: [react, tanstack-query, geojson, svg, tailwind, typescript]

# Dependency graph
requires:
  - phase: 43-gemeente-card-navigation
    provides: GemeenteCard/GemeenteCardGrid pattern, geoJsonToSvgPath, fetchWijken in api.ts
provides:
  - useWijkGeoJSON hook (TanStack Query, 30-min staleTime, wraps fetchWijken)
  - WijkCard stateless component (SVG silhouette, wijk name, unread badge)
  - WijkCardGrid data-fetching container (breadcrumb, skeleton, responsive grid)
affects:
  - 44-02 (ProjectList integration of WijkCardGrid)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stateless card pattern: parent pre-computes svgData, passes to card — no per-card GeoJSON fetch"
    - "statnaam matching: CBS WFS features matched by f.properties.statnaam === wijk.wijk_naam (not statcode)"
    - "gemeenteCode pass-through: hook passes code directly to fetchWijken, backend normalises GM prefix"

key-files:
  created:
    - frontend/src/hooks/useWijkGeoJSON.ts
    - frontend/src/components/projects/WijkCard.tsx
    - frontend/src/components/projects/WijkCardGrid.tsx
  modified: []

key-decisions:
  - "WijkCard mirrors GemeenteCard exactly but omits gemeente_code subtitle — wijk cards have no meaningful code to display"
  - "WijkCardGrid reuses GemeenteCardGrid wrapper and GemeenteCardGridSkeleton — no new grid CSS needed"
  - "Feature matching by statnaam not statcode per Research Pitfall 1 — statcode is not reliable across CBS years"

patterns-established:
  - "Wijk card pattern: stateless WijkCard + data-fetching WijkCardGrid — mirrors gemeente layer exactly"

# Metrics
duration: 1min
completed: 2026-02-22
---

# Phase 44 Plan 01: Wijk Cards and Components Summary

**Stateless WijkCard with SVG silhouette, WijkCardGrid container with breadcrumb/skeleton, and useWijkGeoJSON hook with 30-min staleTime — mirroring the GemeenteCard pattern for wijk drill-down**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T08:15:45Z
- **Completed:** 2026-02-22T08:16:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `useWijkGeoJSON` hook wraps `fetchWijken` with 30-min staleTime, enabled guard on `accessToken && gemeenteCode`, query key `['wijk-geojson', gemeenteCode]`
- `WijkCard` stateless component: renders SVG boundary silhouette when svgData provided (amber fill/stroke), grid placeholder icon when null, wijk name heading, conditional unread badge
- `WijkCardGrid` data-fetching container: fetches wijk GeoJSON via `useWijkGeoJSON`, breadcrumb back button, skeleton while loading, renders wijk cards in responsive grid matched by `statnaam`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useWijkGeoJSON hook and WijkCard component** - `cdbbd82` (feat)
2. **Task 2: Create WijkCardGrid data-fetching container** - `1f52625` (feat)

## Files Created/Modified

- `frontend/src/hooks/useWijkGeoJSON.ts` - TanStack Query hook wrapping fetchWijken, 30-min staleTime
- `frontend/src/components/projects/WijkCard.tsx` - Stateless wijk card with SVG silhouette, name, unread badge
- `frontend/src/components/projects/WijkCardGrid.tsx` - Container with breadcrumb, loading skeleton, responsive grid

## Decisions Made

- WijkCard omits gemeente_code subtitle present in GemeenteCard — wijk projects don't have a meaningful code to display as secondary text
- WijkCardGrid reuses GemeenteCardGrid grid wrapper and GemeenteCardGridSkeleton — avoids duplicating responsive grid CSS
- Feature matching uses `statnaam` property (not `statcode`) per Research Pitfall 1 — CBS WFS data has `statnaam` matching `wijk_naam` in ProjectResponse

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three files compile with 0 TypeScript errors
- WijkCard, WijkCardGrid, and useWijkGeoJSON ready for integration into ProjectList.tsx in Plan 02
- No blockers or concerns

---
*Phase: 44-wijk-cards-and-drill-down*
*Completed: 2026-02-22*
