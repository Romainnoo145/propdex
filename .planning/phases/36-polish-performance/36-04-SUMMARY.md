---
phase: 36-polish-performance
plan: "04"
subsystem: ui
tags: [storybook, tanstack-router, react-query, industrial-amber, layout-shells]

# Dependency graph
requires:
  - phase: 36-polish-performance
    provides: research identifying 6 layout components needing Storybook documentation
  - phase: 27-design-system
    provides: Storybook infrastructure (main.ts viteFinal alias, dark preview background)
  - phase: 28-persistent-mapview
    provides: SideRailNav, InspectorPanel components
  - phase: 29-layout-shells
    provides: MapShell, ResultsShell components
  - phase: 30-resultaten-route
    provides: ResultsShell fullWidth prop
  - phase: 34-mobile-responsiveness
    provides: BottomTabNav component
provides:
  - Storybook Layout/ section with 6 stories covering all layout shell components
  - SideRailNav stories with AuthContext + QueryClientProvider + RouterProvider decorator pattern
  - BottomTabNav stories with RouterProvider decorator and active state variants
  - MapShell stories with floating controls composition pattern
  - ResultsShell stories documenting Default vs fullWidth layout modes
  - InspectorPanel stories with mock ScanResultItem for open/closed/parcel states
  - ReportSidebar stories with QueryClientProvider + AuthContext providers for empty state
affects: [storybook-documentation, layout-shells, design-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - createMemoryHistory + RouterContext for isolated Storybook router stories
    - QueryClient with retry:false staleTime:Infinity for no-network Storybook hooks
    - AuthContext.Provider with mockAuthValue for auth-dependent component stories
    - layout: fullscreen parameter for all fixed/absolute positioning layout components
    - MapWrapper render function pattern for absolute-positioned panels in Storybook

key-files:
  created:
    - frontend/src/stories/layout/SideRailNav.stories.tsx
    - frontend/src/stories/layout/BottomTabNav.stories.tsx
    - frontend/src/stories/layout/MapShell.stories.tsx
    - frontend/src/stories/layout/ResultsShell.stories.tsx
    - frontend/src/stories/layout/InspectorPanel.stories.tsx
    - frontend/src/stories/layout/ReportSidebar.stories.tsx
  modified: []

key-decisions:
  - "RouterContext must be provided to createRouter — routeTree requires auth: { isAuthenticated, user } context per createRootRouteWithContext<RouterContext>()"
  - "SideRailNav requires QueryClientProvider (useUnreadCounts) + AuthContext (useAuth) + RouterProvider — all three stacked as story decorators"
  - "InspectorPanel has no router/auth deps — pure props component, use render() pattern with MapWrapper for absolute positioning context"
  - "ReportSidebar uses QueryClient with retry:false staleTime:Infinity so hooks return undefined data without network errors (shows empty state)"
  - "BottomTabNav has no required props — zero-arg component, router-only dependency via useMatchRoute()"

patterns-established:
  - "Storybook router story: createMemoryHistory + createRouter with RouterContext + RouterProvider defaultComponent wrapping Story"
  - "Storybook auth story: AuthContext.Provider with mockAuthValue literal containing all AuthContextValue fields"
  - "No-network QueryClient: retry:false, staleTime:Infinity prevents background fetches in Storybook environment"

# Metrics
duration: 21min
completed: 2026-02-18
---

# Phase 36 Plan 04: Layout Shell Storybook Documentation Summary

**6 layout shell stories (SideRailNav, BottomTabNav, MapShell, ResultsShell, InspectorPanel, ReportSidebar) with RouterProvider + AuthContext + QueryClient decorator patterns**

## Performance

- **Duration:** 21 min
- **Started:** 2026-02-18T22:00:59Z
- **Completed:** 2026-02-18T22:21:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created 6 story files in `frontend/src/stories/layout/` covering all layout shell components
- Established decorator patterns for router-dependent components (SideRailNav, BottomTabNav) using `createMemoryHistory` + `RouterContext`
- Provided auth + query mocks for components that use `useAuth` and TanStack Query hooks (SideRailNav, ReportSidebar)
- Pure layout components (MapShell, ResultsShell, InspectorPanel) documented without provider boilerplate

## Task Commits

Each task was committed atomically:

1. **Task 1: Create router-dependent layout stories (SideRailNav, BottomTabNav)** - `84b1983` (feat)
2. **Task 2: Create layout shell stories (MapShell, ResultsShell, InspectorPanel, ReportSidebar)** - `1f03ba5` (feat)

**Plan metadata:** `[docs commit hash]` (docs: complete plan)

## Files Created/Modified

- `frontend/src/stories/layout/SideRailNav.stories.tsx` — 5 stories: MapActive, ResultatenActive, ProjectenActive, InstellingenActive, RapportenOpen with QueryClient + AuthContext + RouterProvider decorators
- `frontend/src/stories/layout/BottomTabNav.stories.tsx` — 3 stories: MapActive, ResultatenActive, ProjectenActive with RouterProvider decorator
- `frontend/src/stories/layout/MapShell.stories.tsx` — 2 stories: Default + WithFloatingControls (pure CSS layout, no providers needed)
- `frontend/src/stories/layout/ResultsShell.stories.tsx` — 3 stories: Default, FullWidth, WithScrollContent documenting both layout modes
- `frontend/src/stories/layout/InspectorPanel.stories.tsx` — 4 stories: Closed, OpenEmpty, OpenWithParcel, OpenMinimalParcel with mock ScanResultItem
- `frontend/src/stories/layout/ReportSidebar.stories.tsx` — 2 stories: Closed + Open with QueryClient + AuthContext providers

## Decisions Made

- **RouterContext required in createRouter:** The routeTree uses `createRootRouteWithContext<RouterContext>()`, so `context: { auth: { isAuthenticated, user } }` must be passed to `createRouter` — omitting it causes TypeScript error TS2345.
- **SideRailNav needs 3 provider layers:** QueryClientProvider (for `useUnreadCounts`) + AuthContext.Provider (for `useAuth` + `logout`) + RouterProvider (for `useMatchRoute` + Link navigation) — stacked in that order.
- **BottomTabNav is zero-prop:** No required props, only `useMatchRoute()` dependency — RouterProvider alone is sufficient.
- **InspectorPanel is pure props:** No router/auth/query dependencies — uses `render()` pattern with a `MapWrapper` div providing relative positioning context.
- **ReportSidebar QueryClient approach:** Using `retry:false, staleTime:Infinity` prevents network requests and gracefully shows empty state ("Geen opgeslagen rapporten") without errors.

## Deviations from Plan

None — plan executed exactly as written. The only discovery was that `createRouter` requires `context: { auth: ... }` (TypeScript error caught immediately on first check), which was fixed inline before committing.

## Issues Encountered

- **RouterContext missing from createRouter:** First draft of SideRailNav and BottomTabNav stories omitted the required `context` property. TypeScript check caught this with TS2345. Fixed by adding `context: { auth: { isAuthenticated: true, user: mockAuthValue.user } }` to both `makeRouter` calls before committing.

## User Setup Required

None — no external service configuration required. Stories run in Storybook without a backend.

## Next Phase Readiness

- All 6 layout shell stories are in `Layout/` Storybook section
- SC-04 (Storybook documentation goal) is now satisfied: primitives (Phase 27) + layout shells (Phase 36 Plan 04) fully documented
- Phase 36 complete — polish/performance milestone ready for review

---
*Phase: 36-polish-performance*
*Completed: 2026-02-18*

## Self-Check: PASSED

- FOUND: frontend/src/stories/layout/SideRailNav.stories.tsx
- FOUND: frontend/src/stories/layout/BottomTabNav.stories.tsx
- FOUND: frontend/src/stories/layout/MapShell.stories.tsx
- FOUND: frontend/src/stories/layout/ResultsShell.stories.tsx
- FOUND: frontend/src/stories/layout/InspectorPanel.stories.tsx
- FOUND: frontend/src/stories/layout/ReportSidebar.stories.tsx
- FOUND commit: 84b1983
- FOUND commit: 1f03ba5
