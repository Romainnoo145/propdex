---
phase: 39-map-parcel-visualization
plan: 02
subsystem: ui
tags: [react, maplibre, layer-toggle, parcel-score, map]

# Dependency graph
requires:
  - phase: 39-map-parcel-visualization
    provides: ParcelScoreLayer with setParcelScoreVisibility export (39-01)

provides:
  - Perceel Score toggle button in LayerToggle visible when activeScanId is set
  - onScoreToggle callback wired from map.tsx to setParcelScoreVisibility

affects: [39-map-parcel-visualization, map-layer-controls]

# Tech tracking
tech-stack:
  added: []
  patterns: [showScoreToggle pattern mirrors showWijkenToggle -- conditional visibility with reset-on-activate effect]

key-files:
  created: []
  modified:
    - frontend/src/components/map/LayerToggle.tsx
    - frontend/src/routes/_authenticated/map.tsx

key-decisions:
  - "showScoreToggle={!!activeScanId} -- toggle appears on scan start or URL restoration, disappears when scan cleared"
  - "showScore defaults to true -- consistent with score layer being added visible on scan completion"
  - "Reset effect pattern (prevShowScoreToggleRef) resets toggle to visible when scan becomes active, same pattern as Wijken"

patterns-established:
  - "Optional toggle prop pattern: showXToggle + onXToggle props, conditional rendering, reset effect with useRef"

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 39 Plan 02: Score Toggle Summary

**Perceel Score toggle button added to LayerToggle, wired to setParcelScoreVisibility via useCallback in map.tsx, gated on activeScanId**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T16:01:26Z
- **Completed:** 2026-02-19T16:03:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `showScoreToggle` and `onScoreToggle` optional props to `LayerToggleProps`
- Added `showScore` state (default true), `handleScoreToggle` handler, and `prevShowScoreToggleRef` reset effect
- Rendered "Perceel Score" button after Wijken toggle with amber/inactive styling matching all other overlay toggles
- Added `handleScoreToggle` useCallback in map.tsx calling `setParcelScoreVisibility`
- Imported `setParcelScoreVisibility` alongside `addParcelScoreLayer` from `ParcelScoreLayer.tsx`
- Passed `showScoreToggle={!!activeScanId}` and `onScoreToggle={handleScoreToggle}` to `<LayerToggle>`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Perceel Score toggle to LayerToggle.tsx** - `3f2b465` (feat)
2. **Task 2: Wire score toggle to map.tsx** - `d70e071` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `frontend/src/components/map/LayerToggle.tsx` - Extended with showScoreToggle/onScoreToggle props, showScore state, handleScoreToggle, reset effect, and Perceel Score button JSX
- `frontend/src/routes/_authenticated/map.tsx` - Added handleScoreToggle callback, imported setParcelScoreVisibility, passed props to LayerToggle

## Decisions Made
- `showScoreToggle={!!activeScanId}` -- button visible when any scan is active (started, polling, or restored from URL via scan_id param)
- `showScore` defaults to true -- score layer is added visible when scan completes, toggle state matches layer state on activation
- Reset effect resets toggle to true (visible) when scan becomes active, prevents stale "off" state if user toggled off during a previous scan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Score toggle is fully functional: appears on scan activation, hides parcel fill+outline layers when toggled off, resets to visible on new scan
- Remaining 39-03 work: wijk highlight layer, scan area highlight restoration, or other map-parcel tasks per ROADMAP
- All pre-existing lint warnings (arbitrary Tailwind values, react-hooks/exhaustive-deps) unchanged from prior phases -- 0 new errors

---
*Phase: 39-map-parcel-visualization*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: frontend/src/components/map/LayerToggle.tsx
- FOUND: frontend/src/routes/_authenticated/map.tsx
- FOUND commit: 3f2b465 (feat(39-02): add Perceel Score toggle button to LayerToggle)
- FOUND commit: d70e071 (feat(39-02): wire score toggle to map.tsx via setParcelScoreVisibility)
- FOUND: "Perceel Score" button in LayerToggle.tsx line 208
- FOUND: setParcelScoreVisibility imported in map.tsx line 37
- FOUND: showScoreToggle={!!activeScanId} and onScoreToggle passed to LayerToggle
