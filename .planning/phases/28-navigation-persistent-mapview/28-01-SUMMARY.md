---
phase: 28-navigation-persistent-mapview
plan: 01
subsystem: ui
tags: [react, maplibre-gl, tanstack-router, react-context, persistent-layout]

# Dependency graph
requires:
  - phase: 27-design-system-foundation
    provides: Design tokens and UI primitives established
provides:
  - MapContext React Context exposing mapRef/mapReady to all authenticated child routes
  - Persistent MapView in _authenticated.tsx layout — never unmounts on route change
  - CSS display-toggle pattern for map visibility without destroying DOM node
  - ResultsLayout refactored as left-edge overlay panel (no longer wraps MapView)
affects:
  - All future map-related features (can access mapRef via useMapContext)
  - Phase 28 plans 02+ (SideRailNav update, InspectorPanel)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Hoist expensive component to pathless layout route parent (persistent across nav)
    - CSS display:none toggle instead of conditional rendering for map persistence
    - Ref-backed stable transformRequest with useEffect sync to avoid stale closure
    - React Context (MapContext) for sharing mapRef/mapReady with child routes
    - Left-edge overlay panel using CSS transform translate-x for slide-in animation

key-files:
  created:
    - frontend/src/lib/MapContext.tsx
  modified:
    - frontend/src/routes/_authenticated.tsx
    - frontend/src/routes/_authenticated/map.tsx
    - frontend/src/components/results/ResultsLayout.tsx

key-decisions:
  - "CSS display:none toggle (not conditional rendering) to keep MapLibre instance alive across route changes"
  - "React Context (not Zustand) for mapRef sharing — no new state library needed"
  - "useEffect to sync accessToken ref instead of mutating during render (ESLint react-hooks/refs compliance)"
  - "ResultsLayout converted from react-resizable-panels split-view to CSS transform left-edge overlay"
  - "map.resize() called after 50ms delay post display:block to allow layout recalculation (Pitfall 1)"

patterns-established:
  - "Persistent expensive component: hoist to _authenticated.tsx, CSS display toggle, share via context"
  - "Stable transformRequest pattern: useCallback with empty deps + ref-backed token sync via useEffect"

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 28 Plan 01: Persistent MapView + MapContext Summary

**MapLibre GL JS hoisted to `_authenticated.tsx` parent layout with CSS display toggling and React Context, so the map never unmounts during navigation between /map, /projecten, and /dashboard**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-17T20:36:52Z
- **Completed:** 2026-02-17T20:43:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- MapView moved from child route to persistent parent layout — MapLibre instance created once and never destroyed
- MapContext created: exposes mapRef and mapReady to all authenticated child routes via useMapContext()
- CSS display toggling pattern correctly implemented — map DOM node stays alive, map.resize() called on show
- ResultsLayout refactored from PanelGroup split-view to left-edge CSS-transform overlay panel
- transformRequest moved to layout with ref-backed accessToken to handle token refresh correctly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MapContext and hoist MapView into authenticated layout** - `2f23d19` (feat)
2. **Task 2: Refactor map.tsx to consume MapContext and ResultsLayout to overlay panel** - `2aedb83` (feat)

## Files Created/Modified
- `frontend/src/lib/MapContext.tsx` - React Context with mapRef/mapReady and useMapContext hook
- `frontend/src/routes/_authenticated.tsx` - Layout now owns MapView with CSS display toggle, wraps Outlet in MapContext.Provider
- `frontend/src/routes/_authenticated/map.tsx` - Replaced mapRef/mapReady/transformRequest ownership with useMapContext(); removed MapView rendering
- `frontend/src/components/results/ResultsLayout.tsx` - Removed PanelGroup/children; now a left-edge overlay panel with transition-transform slide-in

## Decisions Made
- CSS display:none toggle chosen over conditional rendering (the only approach that keeps MapLibre alive)
- React Context chosen over Zustand (not installed, single map instance makes Context sufficient)
- accessToken ref sync via useEffect instead of render mutation (ESLint react-hooks/refs compliance)
- ResultsLayout made into overlay panel — cleaner architecture now that MapView is persistent in parent

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint error: accessing ref.current during render**
- **Found during:** Task 1 (Create MapContext and hoist MapView)
- **Issue:** `accessTokenRef.current = accessToken` during render triggered react-hooks/refs ESLint error
- **Fix:** Moved ref sync into `useEffect(() => { accessTokenRef.current = accessToken }, [accessToken])`
- **Files modified:** `frontend/src/routes/_authenticated.tsx`
- **Verification:** `npm run check` passes with 0 errors after fix
- **Committed in:** `2aedb83` (Task 2 commit, fix applied before committing Task 1 changes)

**2. [Rule 1 - Bug] TypeScript TS7030: Not all code paths return a value**
- **Found during:** Task 1 after initial implementation
- **Issue:** useEffect callback for resize returned early implicitly in else branch: `if (condition) { return cleanup }` — TS strict mode requires consistent return types
- **Fix:** Inverted condition to early-return pattern: `if (!condition) return; const timer = ...; return () => clearTimeout(timer)`
- **Files modified:** `frontend/src/routes/_authenticated.tsx`
- **Verification:** `npx tsc --noEmit` passes cleanly after fix
- **Committed in:** `2aedb83`

---

**Total deviations:** 2 auto-fixed (2 bugs — both ESLint/TypeScript compliance issues)
**Impact on plan:** Both fixes required for correctness and code quality. No scope creep.

## Issues Encountered
- None beyond the two auto-fixed issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MapContext is ready for any future map-accessing child route
- All floating map UI (AddressSearch, LayerToggle, scan controls) continue to work as absolute-positioned overlays
- ResultsLayout overlay panel ready for use
- Phase 28-02 (SideRailNav update) can proceed — mapRef is now accessible via useMapContext() anywhere under _authenticated

---

## Self-Check: PASSED

All created/modified files exist:
- FOUND: `frontend/src/lib/MapContext.tsx`
- FOUND: `frontend/src/routes/_authenticated.tsx`
- FOUND: `frontend/src/routes/_authenticated/map.tsx`
- FOUND: `frontend/src/components/results/ResultsLayout.tsx`

All commits exist:
- FOUND: `2f23d19` feat(28-01): create MapContext and hoist MapView into authenticated layout
- FOUND: `2aedb83` feat(28-01): refactor map.tsx to consume MapContext and ResultsLayout to overlay panel

TypeScript: PASSED (0 errors)
ESLint: PASSED (0 errors, 66 pre-existing warnings)

---
*Phase: 28-navigation-persistent-mapview*
*Completed: 2026-02-17*
