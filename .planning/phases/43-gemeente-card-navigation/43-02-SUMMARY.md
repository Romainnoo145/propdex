---
phase: 43-gemeente-card-navigation
plan: 02
subsystem: ui
tags: [react, geojson, svg, tailwind, typescript, cbs-wfs]

# Dependency graph
requires:
  - phase: 43-01
    provides: geoJsonToSvgPath, GemeenteCard, GemeenteCardGrid, GemeenteCardGridSkeleton
  - phase: 42-theme-consistency
    provides: CSS variable tokens (grey-*, amber-accent, error) used throughout
  - phase: 26-monitoring
    provides: ProjectResponse type with gemeente_code, children, is_monitored, unread_count
provides:
  - Integrated gemeente card grid on Projecten page (ProjectList.tsx)
  - CBS WFS GeoJSON fetched once via fetchGemeenteGeoJSON (module-level cache)
  - SVG silhouettes computed inline per card using geoJsonToSvgPath
  - Wijk drill-down preserved as expandable inline list below grid
affects:
  - 44-gemeente-card-navigation (will replace inline wijk list with route-based navigation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useEffect with monitoringProjects.length dependency — fetch CBS WFS once, avoid re-fetch on unrelated state changes"
    - "Inline SVG computation in render loop — geoJsonToSvgPath is pure arithmetic, no memoization needed at current scale"
    - "IIFE pattern for expanded wijk panel: {expandedGemeenteId && (() => { ... })()} — avoids extracting a separate component for temporary Phase 43 behavior"

key-files:
  created: []
  modified:
    - frontend/src/components/projects/ProjectList.tsx

key-decisions:
  - "Card click toggles expandedGemeenteId to show wijk list below grid — preserves WijkScanList + ChangeTimeline functionality without Phase 44 routing scope"
  - "GeoJSON fetched at ProjectList level (not per-card) via fetchGemeenteGeoJSON which has module-level cache — single WFS request per session"
  - "MapPinIcon removed from ProjectList.tsx (was used only in old accordion header) — GemeenteCard has its own inline placeholder icon"

patterns-established:
  - "Pattern: GemeenteCardGridSkeleton shown while gemeenteGeojson === null — smooth loading transition, no layout shift"
  - "Pattern: feature lookup by statcode from CBS WFS FeatureCollection matches gemeente_code on ProjectResponse"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 43 Plan 02: GemeenteCard Grid Integration into ProjectList Summary

**CBS WFS gemeente boundaries rendered as SVG silhouette cards in a responsive 3/2/1 grid on the Projecten page, replacing the accordion list for monitored gemeenten**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T17:31:46Z
- **Completed:** 2026-02-21T17:34:10Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Modified `ProjectList.tsx` to fetch CBS WFS GeoJSON once when monitoring projects exist
- Replaced monitoring projects accordion block with `GemeenteCardGrid` + `GemeenteCard` components
- Shows `GemeenteCardGridSkeleton` (pulse-animated) while GeoJSON is loading
- Card click toggles an inline wijk list below the grid (preserves WijkScanList + ChangeTimeline)
- Regular (non-monitoring) projects accordion is completely unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate GeoJSON fetch and replace monitoring projects accordion with card grid** - `8857b6d` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `frontend/src/components/projects/ProjectList.tsx` - Replaced monitoring accordion block with GemeenteCardGrid; added CBS WFS fetch via useEffect; preserved wijk drill-down as expandable inline panel; removed unused MapPinIcon

## Decisions Made

- Card click toggles `expandedGemeenteId` to show wijk list inline below the grid. This preserves the existing `WijkScanList` and `ChangeTimeline` functionality without scope-creeping into Phase 44 routing.
- `fetchGemeenteGeoJSON` is called at the `ProjectList` level (not inside each card), leveraging the module-level cache in `GemeenteBoundariesLayer.tsx` to ensure at most one WFS request per session.
- `geoJsonToSvgPath` called inline in the render loop — it is a pure arithmetic function and the GeoJSON is loaded once, so memoization is not needed at this scale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused MapPinIcon from ProjectList.tsx**
- **Found during:** Task 1 (ESLint check after implementation)
- **Issue:** `MapPinIcon` was only used in the old accordion header. After replacing the accordion with the card grid, the function was defined but never used — causing an ESLint error (`@typescript-eslint/no-unused-vars`)
- **Fix:** Removed the `MapPinIcon` function from `ProjectList.tsx`. The `GemeenteCard` component has its own inline `MapPinIcon` placeholder already.
- **Files modified:** `frontend/src/components/projects/ProjectList.tsx`
- **Verification:** `eslint ProjectList.tsx` reports 0 errors after removal
- **Committed in:** `8857b6d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - unused variable cleanup)
**Impact on plan:** Necessary fix to pass ESLint. No scope creep.

## Issues Encountered

None — TypeScript passed with 0 errors. ESLint had 1 error (unused `MapPinIcon`, auto-fixed). Pre-existing `min-h-[44px]` Tailwind arbitrary-value warnings are non-blocking (133+ across codebase).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 43 complete: monitoring gemeenten now display as visual SVG silhouette cards with unread badges
- Phase 44 can replace the inline wijk list expansion with route-based navigation (`/projecten/:gemeenteId/wijken`)
- All building blocks are in place: `GemeenteCard`, `GemeenteCardGrid`, `geoJsonToSvgPath`, CBS WFS fetch with module cache

---
*Phase: 43-gemeente-card-navigation*
*Completed: 2026-02-22*
