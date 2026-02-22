---
phase: 44-wijk-cards-and-drill-down
plan: 02
subsystem: ui
tags: [react, tanstack-query, typescript, navigation, tailwind]

# Dependency graph
requires:
  - phase: 44-01
    provides: WijkCard, WijkCardGrid, useWijkGeoJSON for wijk card rendering
  - phase: 43-gemeente-card-navigation
    provides: GemeenteCard/GemeenteCardGrid pattern, useProjectScans hook
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderCard render prop: WijkCardGrid delegates card rendering to parent, enabling per-card hook calls without violating React rules of hooks"
    - "WijkCardWithNav sub-component: separate React component per wijk card, calls useProjectScans at top level (not inside .map() callback)"
    - "Conditional view switching: selectedGemeenteId state drives gemeente grid vs WijkCardGrid render — no router navigation needed for drill-down"

key-files:
  created: []
  modified:
    - frontend/src/components/projects/WijkCardGrid.tsx
    - frontend/src/components/projects/ProjectList.tsx

key-decisions:
  - "renderCard render prop pattern over onWijkClick callback: enables WijkCardWithNav sub-component to call useProjectScans per wijk card without hooks-in-loop violation"
  - "WijkCardWithNav is a named sub-component (not inline JSX): valid React hook usage at component top level — hooks forbidden inside .map() callbacks"
  - "selectedGemeenteId state replaces expandedGemeenteId: view-switching not accordion — same grid becomes wijk grid, no inline expansion"

patterns-established:
  - "Drill-down view switching: single state variable controls which layer renders (gemeente grid vs wijk grid) — parent IIFE finds gemeente, passes filtered wijkChildren to WijkCardGrid"
  - "Navigation-aware card sub-component: WijkCardWithNav fetches scans at component mount, navigates on click with toast fallback when no completed scan"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 44 Plan 02: Wijk Drill-Down Navigation Summary

**Complete gemeente->wijk->resultaten drill-down: WijkCardGrid refactored to renderCard prop, WijkCardWithNav sub-component navigates to /resultaten?scan_id with Dutch toast fallback, expandedGemeenteId accordion fully replaced by selectedGemeenteId view switching**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T08:19:36Z
- **Completed:** 2026-02-22T08:21:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `WijkCardGrid` refactored from `onWijkClick` callback to `renderCard` render prop — enables parent to provide navigation-aware card components that call hooks per-card without violating React's rules of hooks
- `WijkCardWithNav` sub-component added to `ProjectList.tsx` — calls `useProjectScans` at top level, looks up latest completed scan on click, navigates to `/resultaten?scan_id=<id>`, shows toast `'Nog geen scan beschikbaar voor deze wijk'` when no completed scan exists
- `expandedGemeenteId` accordion inline wijk list fully removed — replaced by `selectedGemeenteId` view switching: gemeente card click shows full WijkCardGrid, back button returns to gemeente grid

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor WijkCardGrid to renderCard render prop** - `81f7766` (refactor)
2. **Task 2: Integrate drill-down navigation in ProjectList** - `38c1c35` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/components/projects/WijkCardGrid.tsx` - Replaced `onWijkClick` prop and `WijkCard` import with `renderCard: (wijk, svgData, unreadCount) => ReactNode` render prop
- `frontend/src/components/projects/ProjectList.tsx` - Replaced `expandedGemeenteId` with `selectedGemeenteId`, added WijkCardGrid/WijkCard imports, added `WijkCardWithNav` sub-component, replaced inline wijk accordion with conditional view switching

## Decisions Made

- `renderCard` render prop pattern: The parent needs to call `useProjectScans` once per wijk card for navigation. Calling hooks inside `.map()` is invalid React. The renderCard prop lets WijkCardGrid handle GeoJSON fetching and SVG computation while the parent wraps each card in its own React component that calls hooks at component top level.
- `WijkCardWithNav` as named sub-component (not anonymous inline function): React requires hooks to be called in the same order every render. An anonymous IIFE or inline component could be optimized away or re-identified differently. A named sub-component is the idiomatic React pattern.
- `selectedGemeenteId` view switching (not router navigation): Switching gemeente/wijk view is a UI state change within the same page, not a page navigation. Using local state preserves all other ProjectList state (regular projects expanded state, etc.) without URL changes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full drill-down flow complete: gemeente cards -> wijk cards (same responsive grid) -> /resultaten filtered by scan
- Phase 44 (Wijk Cards and Drill-Down) is fully complete — both plans executed
- TypeScript passes with 0 errors; ESLint shows 0 errors (133 pre-existing warnings in other files unrelated to this plan)
- No blockers or concerns

## Self-Check: PASSED

- WijkCardGrid.tsx: FOUND
- ProjectList.tsx: FOUND
- 44-02-SUMMARY.md: FOUND
- Commit 81f7766 (Task 1): FOUND
- Commit 38c1c35 (Task 2): FOUND

---
*Phase: 44-wijk-cards-and-drill-down*
*Completed: 2026-02-22*
