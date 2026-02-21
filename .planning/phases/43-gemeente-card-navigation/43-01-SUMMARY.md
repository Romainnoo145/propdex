---
phase: 43-gemeente-card-navigation
plan: 01
subsystem: ui
tags: [react, geojson, svg, tailwind, typescript]

# Dependency graph
requires:
  - phase: 42-theme-consistency
    provides: CSS variable tokens (grey-*, amber-accent, error) used throughout new components
  - phase: 26-monitoring
    provides: ProjectResponse type with gemeente_code, children, is_monitored, unread_count
provides:
  - geoJsonToSvgPath pure function in geo-utils.ts (handles Polygon + MultiPolygon, aspect-ratio-preserving)
  - GemeenteCard component (SVG silhouette + name + conditional unread badge)
  - GemeenteCardGrid component (1/2/3 column responsive grid)
  - GemeenteCardGridSkeleton component (pulse-animated loading placeholder)
affects:
  - 43-02 (integration into ProjectList.tsx — all building blocks ready)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - geoJsonToSvgPath: pure utility function in geo-utils.ts, no external library, ~80 lines of arithmetic
    - Stateless card component: receives pre-computed svgData and totalUnread as props (parent fetches GeoJSON)
    - aspect-[5/3] for SVG card area (standardized card proportions for Dutch gemeente boundaries)

key-files:
  created:
    - frontend/src/components/projects/GemeenteCard.tsx
    - frontend/src/components/projects/GemeenteCardGrid.tsx
  modified:
    - frontend/src/lib/geo-utils.ts

key-decisions:
  - "GemeenteCard is stateless: receives pre-computed svgData and totalUnread as props to avoid redundant GeoJSON fetches per card"
  - "geoJsonToSvgPath uses Math.min(drawW/lonRange, drawH/latRange) for uniform scale — prevents aspect ratio distortion for irregular gemeente shapes"
  - "Y-axis inversion via maxLat - lat (not lat - minLat) — SVG origin top-left vs geographic north-up"
  - "GeoJSON.Position[][] type used for ring collection to satisfy TypeScript without unsafe any casts"

patterns-established:
  - "Pattern: Pure projection function in geo-utils.ts — extend this file for future GeoJSON utilities"
  - "Pattern: Stateless card component receiving pre-computed SVG data — parent owns fetch/memoization"
  - "Pattern: GemeenteCardGridSkeleton mirrors exact card layout (aspect-[5/3] + text area) for smooth loading transition"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 43 Plan 01: GeoJSON-to-SVG Projection and GemeenteCard Components Summary

**Pure GeoJSON-to-SVG projection utility (geoJsonToSvgPath) plus stateless GemeenteCard and GemeenteCardGrid components ready for integration into Projecten page**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T17:27:05Z
- **Completed:** 2026-02-21T17:29:10Z
- **Tasks:** 2
- **Files modified:** 3 (1 extended, 2 created)

## Accomplishments

- Extended `geo-utils.ts` with `geoJsonToSvgPath`: handles both Polygon and MultiPolygon geometries, aspect-ratio-preserving uniform scale, Y-axis inversion for correct SVG orientation
- Created `GemeenteCard.tsx`: renders inline SVG silhouette from pre-computed path data, gemeente name with truncation, conditional unread badge matching existing ProjectList.tsx pattern
- Created `GemeenteCardGrid.tsx`: responsive 1/2/3 column grid wrapper plus pulse-animated `GemeenteCardGridSkeleton` loading placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Add geoJsonToSvgPath and GemeenteCard component** - `83de928` (feat)
2. **Task 2: Build GemeenteCardGrid responsive wrapper component** - `71cf026` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `frontend/src/lib/geo-utils.ts` - Extended with `geoJsonToSvgPath` export (Polygon + MultiPolygon, aspect-ratio-preserving SVG projection)
- `frontend/src/components/projects/GemeenteCard.tsx` - Visual gemeente card with SVG silhouette, name, unread badge
- `frontend/src/components/projects/GemeenteCardGrid.tsx` - Responsive grid wrapper (`GemeenteCardGrid`) and loading skeleton (`GemeenteCardGridSkeleton`)

## Decisions Made

- `GemeenteCard` is stateless — receives `svgData` and `totalUnread` as props. The parent (plan 43-02) will fetch GeoJSON once and pass pre-computed data per card, avoiding redundant WFS requests.
- `geoJsonToSvgPath` uses `Math.min(drawW / lonRange, drawH / latRange)` for uniform scale — prevents distortion for irregular shapes (narrow coastal municipalities, island MultiPolygons).
- Y-axis inversion: `y = offsetY + (maxLat - lat) * scale` so northernmost point maps to SVG top.
- `GeoJSON.Position[][]` type for ring collection avoids unsafe `any` casts while remaining compatible with the `@types/geojson` definitions already in use.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — `npm run check` passes with 0 errors. The 2 new `aspect-[5/3]` warnings match the pre-existing pattern of `min-h-[44px]` warnings across the codebase (133 total pre-existing warnings, all non-blocking).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three building blocks ready for plan 43-02 integration
- `geoJsonToSvgPath` handles both Polygon and MultiPolygon (verified via grep and TypeScript type-check)
- `GemeenteCard` props interface matches `ProjectResponse` type exactly
- `GemeenteCardGrid` responsive breakpoints match plan requirements (1/2/3 columns)
- Plan 43-02 needs to: wire `fetchGemeenteGeoJSON` in `ProjectList.tsx`, replace `monitoringProjects.map(...)` accordion block with card grid, pass pre-computed `svgData` and `totalUnread` to each card

---
*Phase: 43-gemeente-card-navigation*
*Completed: 2026-02-22*
