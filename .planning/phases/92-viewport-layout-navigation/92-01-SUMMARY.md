---
phase: 92-viewport-layout-navigation
plan: 01
subsystem: ui
tags: [tailwind, glass-morphism, navigation, layout, maplibre]

requires:
  - phase: 91-aura-design-system
    provides: Aura CSS tokens, glass classes, shadow-glass, aura-float, aura-hover-glow
provides:
  - Full-viewport layout with map as primary canvas
  - Floating glass SideRailNav (80px, rounded-[40px], backdrop-blur-xl)
  - ResultsShell left padding for non-map route clearance
affects: [92-02-search-filter-dock, 93-parcel-detail-panel, 94-wijk-bento-sheet]

tech-stack:
  added: []
  patterns:
    - "Floating fixed nav outside main flow (renders after <main> in DOM)"
    - "ResultsShell handles its own left offset (md:pl-[112px]) rather than parent layout"
    - "Propdex P monogram as logo placeholder (bg-aura-obsidian circle)"

key-files:
  created: []
  modified:
    - frontend/src/routes/_authenticated.tsx
    - frontend/src/components/layout/SideRailNav.tsx
    - frontend/src/components/layout/ResultsShell.tsx

key-decisions:
  - "SideRailNav renders after <main> in DOM order so it floats on top without z-index conflicts"
  - "ResultsShell owns its left padding (112px) rather than _authenticated layout handling conditional padding"
  - "WorkspaceSwitcher replaced with Propdex P monogram (40x40 obsidian circle)"
  - "Active nav state uses bg-aura-amber/20 text-aura-amber for warm highlight"

patterns-established:
  - "Floating panels: fixed positioning with 16px edge margins, pointer-events-auto"
  - "Glass tooltips: border-white/40 bg-aura-glass-white/60 backdrop-blur-md"
  - "Nav hover: scale-105 + aura-hover-glow for icon micro-interactions"

requirements-completed: [NAV-01, NAV-02]

duration: 3min
completed: 2026-03-10
---

# Phase 92 Plan 01: Viewport Layout + SideRailNav Summary

**Full-viewport map canvas with floating glass SideRailNav (80px rounded-[40px] blur rail) and ResultsShell left offset for non-map routes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T22:18:01Z
- **Completed:** 2026-03-09T22:20:37Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Map fills 100% viewport (h-screen w-screen overflow-hidden) with no flex layout constraining it
- SideRailNav converted from in-flow sidebar to floating glass panel with Aura styling
- P monogram replaces WorkspaceSwitcher, amber active states, scale hover micro-interactions
- Non-map routes (projecten, instellingen, rapporten, resultaten) clear the floating rail via 112px left padding

## Task Commits

Each task was committed atomically:

1. **Task 1: Viewport-locked layout + floating SideRailNav** - `99be7cd` (feat)
2. **Task 2: Non-map route content offset** - `da34fc0` (feat)

## Files Created/Modified
- `frontend/src/routes/_authenticated.tsx` - Viewport-locked layout, SideRailNav moved outside main flow
- `frontend/src/components/layout/SideRailNav.tsx` - Floating glass rail with monogram, amber active states, glass tooltips
- `frontend/src/components/layout/ResultsShell.tsx` - Added md:pl-[112px] for floating rail clearance

## Decisions Made
- SideRailNav renders after `<main>` in DOM order so it naturally floats on top
- ResultsShell handles its own left padding rather than conditional padding in _authenticated layout
- WorkspaceSwitcher replaced with simple P monogram (no longer imported)
- Active nav state uses bg-aura-amber/20 text-aura-amber instead of bg-neutral-200

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Viewport layout complete, ready for 92-02 (search bar + filter chip dock)
- SideRailNav glass surface is one of the 3 blur-budget surfaces (per Aura design spec)
- Map fills full viewport, providing the canvas for all floating UI elements in phases 93-97

---
*Phase: 92-viewport-layout-navigation*
*Completed: 2026-03-10*
