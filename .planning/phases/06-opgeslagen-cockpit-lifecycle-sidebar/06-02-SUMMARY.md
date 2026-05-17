---
phase: 06-opgeslagen-cockpit-lifecycle-sidebar
plan: 02
subsystem: ui
tags: [react, tanstack-router, lifecycle, sidebar, layout]

# Dependency graph
requires:
  - "06-01 (LifecycleSideRailNav component)"
provides:
  - "frontend/src/routes/_authenticated.tsx: route-prefix-aware sidebar swap (isOpgeslagenRoute + conditional render)"
affects:
  - 06-03 (active phase drives sidebar highlight — now rendered in layout)
  - 06-04 (nested /opgeslagen/* routes auto-covered by fuzzy: true)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-prefix sidebar swap: matchRoute({ to: '/opgeslagen', fuzzy: true }) covers list view AND all nested /opgeslagen/* routes via single boolean"
    - "Conditional sidebar render: ternary in JSX — zero new components, zero layout shift (both sidebars are w-[130px])"

key-files:
  created: []
  modified:
    - frontend/src/routes/_authenticated.tsx

key-decisions:
  - "activePhaseKey='1-onderzoek' hardcoded for v1 — Plan 04 will derive from route params when nested perceel routes land"
  - "fuzzy: true on matchRoute ensures /opgeslagen AND all future /opgeslagen/* sub-routes swap to LifecycleSideRailNav without requiring Plan 04 changes to this file"
  - "SideRailNav import retained — still used for all non-opgeslagen routes"

requirements-completed:
  - UX-02

# Metrics
duration: 2min
completed: 2026-05-17
---

# Phase 06 Plan 02: Layout Sidebar Swap Summary

**Route-prefix-aware sidebar swap in _authenticated.tsx: LifecycleSideRailNav renders on /opgeslagen (and all /opgeslagen/* sub-routes); SideRailNav renders on every other route — 3 lines of net change**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-17T21:17:05Z
- **Completed:** 2026-05-17T21:19:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `import LifecycleSideRailNav` alongside existing `SideRailNav` import in `_authenticated.tsx`
- Added `isOpgeslagenRoute` boolean derived from `matchRoute({ to: '/opgeslagen', fuzzy: true })` — single boolean covers both `/opgeslagen` list view and any future nested routes
- Replaced static `<SideRailNav />` mount with conditional: `{isOpgeslagenRoute ? <LifecycleSideRailNav activePhaseKey="1-onderzoek" /> : <SideRailNav />}`
- File grew from 163 to 164 lines — well within the < 175 acceptance criterion
- Zero new TypeScript errors (pre-existing 91-error baseline unchanged)

## Task Commits

1. **Task 1: Route-prefix sidebar swap in authenticated layout** - `062e6bb1` (feat)

## Files Created/Modified
- `frontend/src/routes/_authenticated.tsx` — +3 lines: LifecycleSideRailNav import + isOpgeslagenRoute const + conditional sidebar render

## Decisions Made
- `activePhaseKey="1-onderzoek"` hardcoded for v1 per plan spec — Plan 04 will replace with route-param-derived value when `/opgeslagen/perceel/$parcelId/$phase` route lands
- `fuzzy: true` ensures Plan 04's nested routes are covered automatically without any further changes to `_authenticated.tsx`
- Both `SideRailNav` and `LifecycleSideRailNav` are `w-[130px]`, so `ml-[130px]` content offset is identical — no layout shift on route switch

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
- File exists: frontend/src/routes/_authenticated.tsx — FOUND
- Commit exists: 062e6bb1 — FOUND (git log confirmed)
- grep checks: all 6 acceptance criteria patterns match
- Line count: 164 (< 175 limit)
- npm run check: 91 errors all pre-existing; zero errors in _authenticated.tsx

---
*Phase: 06-opgeslagen-cockpit-lifecycle-sidebar*
*Completed: 2026-05-17*
