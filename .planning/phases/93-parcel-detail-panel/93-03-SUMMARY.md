---
phase: 93-parcel-detail-panel
plan: 03
subsystem: ui
tags: [framer-motion, animate-presence, slide-up, parcel-detail, progressive-disclosure, layers]

requires:
  - phase: 93-parcel-detail-panel
    provides: "LEFT-side floating panel with bento overview, hero, address header (plan 02)"
provides:
  - "AnimatePresence slide-up transitions between overview and 4 detail layers"
  - "prefers-reduced-motion fallback for all panel transitions"
  - "Green/amber pill badge colors for kansen vs aandachtspunten"
  - "Complete progressive disclosure: bento pods -> detail layers -> back to overview"
affects: [94-wijk-bottom-sheet]

tech-stack:
  added: []
  patterns:
    - "AnimatePresence mode=wait for overview-to-detail layer switch"
    - "Spring slide-up (stiffness 400, damping 30) for detail layer enter"
    - "Module-level prefers-reduced-motion detection with opacity-only fallback"

key-files:
  created: []
  modified:
    - frontend/src/components/map/panels/ParcelDetailPanel.tsx
    - frontend/src/components/map/panels/parcel/layers/MarktLayer.tsx

key-decisions:
  - "Green PillBadge for kansen (opportunities), amber for aandachtspunten (concerns)"
  - "AnimatePresence mode=wait ensures exit completes before enter starts"
  - "Overview exits upward (-20px + fade), detail enters from below (40px + spring)"
  - "prefers-reduced-motion falls back to opacity-only transitions (no transform)"

patterns-established:
  - "AnimatePresence mode=wait pattern for view switching within floating panels"
  - "Module-level reduced-motion detection avoids per-render matchMedia calls"

requirements-completed: [PRC-05, PRC-06, PRC-07]

duration: 2min
completed: 2026-03-10
---

# Phase 93 Plan 03: Click-Through Detail Layers Summary

**Framer Motion AnimatePresence slide-up transitions for 4 category detail layers with spring animation and reduced-motion fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T13:36:50Z
- **Completed:** 2026-03-10T13:38:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added AnimatePresence mode="wait" to wrap overview/detail layer transitions in ParcelDetailPanel
- Detail layers slide up with spring animation (stiffness 400, damping 30), overview exits with subtle upward fade
- Fixed kansen/aandachtspunten pill badge colors: green for opportunities, amber for concerns
- prefers-reduced-motion detected at module level, skips transform animations

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix pill badge colors in MarktLayer** - `904b488` (feat)
2. **Task 2: AnimatePresence slide-up transitions + reduced-motion** - `1393ce9` (feat)

## Files Created/Modified
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx` - AnimatePresence wrapper, spring transitions, reduced-motion detection
- `frontend/src/components/map/panels/parcel/layers/MarktLayer.tsx` - Green pills for kansen, amber for aandachtspunten

## Decisions Made
- Green PillBadge for opportunities (kansen), amber for concerns (aandachtspunten) -- matches plan spec
- Module-level prefers-reduced-motion check avoids per-render window.matchMedia calls
- AnimatePresence mode="wait" ensures clean exit-then-enter sequencing
- Overview exits with y:-20 + fade, detail enters with y:40 + spring -- asymmetric for directional feel

## Deviations from Plan

None - plan executed exactly as written. Layer components were already complete from previous execution; only pill badge colors needed correction to match spec.

## Issues Encountered

Pre-existing TypeScript errors in SideRailNav.tsx (undefined values cast to Record<string, string>) -- out of scope, documented in 93-02-SUMMARY.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 93 (Parcel Detail Panel) is now COMPLETE: all 3 plans executed
- Panel has full progressive disclosure: hero + bento overview + 4 detail layers + rapport button
- Ready for Phase 94 (Wijk Bottom Sheet) which uses similar AnimatePresence patterns

---
*Phase: 93-parcel-detail-panel*
*Completed: 2026-03-10*
