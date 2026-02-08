---
phase: 13-map-foundation-layout
plan: 02
subsystem: ui
tags: [maplibre-gl, react, pdok, geolocation, navigation-controls]

# Dependency graph
requires:
  - phase: 13-01
    provides: Frontend scaffold with MapLibre dependencies and PDOK constants
provides:
  - MapView component with imperative state management
  - PDOK aerial+topo tile sources configured
  - NavigationControl and GeolocateControl
  - AppLayout full-page wrapper for map interface
  - Memory cleanup via map.remove()
affects: [13-03, 13-04, 14-*, 15-*, 16-*, 17-*]

# Tech tracking
tech-stack:
  added: []
  patterns: [Imperative map state with useRef, Memory cleanup in useEffect, Full-page layout with overflow-hidden]

key-files:
  created:
    - frontend/src/components/map/MapView.tsx
    - frontend/src/components/layout/AppLayout.tsx
  modified:
    - frontend/src/App.tsx

key-decisions:
  - "useRef for map instance: Prevents re-render loops (NOT useState)"
  - "map.remove() in cleanup: Prevents MapLibre Worker memory leaks"
  - "Dual source setup: pdok-aerial (visible) + pdok-topo (hidden) for future layer toggle"
  - "ESLint disable with justification: externalMapRef and onMapReady are stable refs/callbacks"

patterns-established:
  - "Map state pattern: useRef for MapLibre instance, not useState"
  - "Memory cleanup: Always call map.remove() in useEffect cleanup"
  - "Full-page layout: AppLayout with h-screen overflow-hidden for viewport sizing"

# Metrics
duration: 2min
completed: 2026-02-08
---

# Phase 13 Plan 02: Map Foundation & Layout Summary

**Full-viewport MapLibre map with PDOK aerial imagery, imperative ref-based state management, navigation controls, and memory cleanup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-08T10:32:54Z
- **Completed:** 2026-02-08T10:34:52Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- MapView component renders full-page MapLibre map with PDOK aerial satellite imagery
- NavigationControl (zoom + compass + rotation) and GeolocateControl functional
- Map instance stored in useRef to prevent re-render loops
- Memory cleanup via map.remove() prevents WebGL context leaks
- AppLayout provides full-viewport structure for future floating UI elements

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MapView component with imperative state and memory cleanup** - `c8aabe6` (feat)
2. **Task 2: Create AppLayout and wire map into App** - `2de2e0e` (feat)

## Files Created/Modified

**Created:**
- `frontend/src/components/map/MapView.tsx` - MapLibre map with PDOK aerial+topo sources, useRef state, NavigationControl, GeolocateControl, map.remove() cleanup
- `frontend/src/components/layout/AppLayout.tsx` - Full-page layout wrapper with h-screen overflow-hidden

**Modified:**
- `frontend/src/App.tsx` - Wire MapView into AppLayout with mapRef

## Decisions Made

**useRef vs useState for map instance:**
- Decision: Use `useRef<maplibregl.Map | null>` for map instance
- Rationale: useState causes re-render loops when map state changes. MapLibre map is imperative — ref is the correct pattern.

**Memory cleanup requirement:**
- Decision: Call `map.remove()` in useEffect cleanup function
- Rationale: Prevents MapLibre Worker class memory leaks and releases WebGL context on unmount

**Dual PDOK source configuration:**
- Decision: Configure both pdok-aerial and pdok-topo sources at initialization (aerial visible, topo hidden)
- Rationale: Enables future layer toggle without runtime style mutation. Clean separation of concerns.

**ESLint exhaustive-deps handling:**
- Decision: Add eslint-disable-next-line with justification comment for useEffect dependencies
- Rationale: externalMapRef and onMapReady are intentionally stable refs/callbacks from parent. Empty deps array is correct for mount-once initialization.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with no TypeScript errors or runtime issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for next phase:**
- Full-viewport MapLibre map renders at http://localhost:9300
- PDOK aerial satellite imagery loads successfully
- Map controls (zoom, rotation, compass, geolocation) visible and functional
- Map fills entire viewport with no scrollbars or gaps
- AppLayout structure ready for floating UI elements (search bar, sidebar, panels)
- Memory cleanup pattern established for future map-dependent components

**No blockers or concerns.**

All success criteria met:
- [x] MapView component exists with imperative state management (useRef)
- [x] PDOK aerial and topo tile sources configured (aerial visible by default)
- [x] Memory cleanup via map.remove() in useEffect cleanup
- [x] NavigationControl and GeolocateControl added
- [x] AppLayout wraps the full-page map
- [x] pnpm run check passes
- [x] Map renders and is interactive at http://localhost:9300

## Self-Check: PASSED

All created files verified:
- frontend/src/components/map/MapView.tsx
- frontend/src/components/layout/AppLayout.tsx

All modified files verified:
- frontend/src/App.tsx

All commits verified:
- c8aabe6 (Task 1)
- 2de2e0e (Task 2)

---
*Phase: 13-map-foundation-layout*
*Completed: 2026-02-08*
