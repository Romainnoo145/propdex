---
phase: 92-viewport-layout-navigation
plan: 02
subsystem: ui
tags: [framer-motion, toggle-pill, search-pill, glass-material, layoutId, animation]

requires:
  - phase: 92-viewport-layout-navigation
    provides: SideRailNav at left edge (80px wide), Aura design tokens
provides:
  - Glass search pill at left-[112px] top-6 with pill shape and 320px width
  - Toggle pill at top-center with 3 sections (Base Layer, View Level, Intelligence Layer)
  - Framer Motion layoutId sliding amber indicator per section
  - framer-motion dependency installed
affects: [93-parcel-detail-panel, 94-bottom-sheet, 95-filter-chips]

tech-stack:
  added: [framer-motion]
  patterns: [ToggleButton with motion.div layoutId, section-scoped animation, spring transition]

key-files:
  created: []
  modified:
    - frontend/src/components/search/AddressSearch.tsx
    - frontend/src/components/map/LayerToggle.tsx
    - frontend/package.json

key-decisions:
  - "Separate layoutId per section (base/view/intel) so indicator slides within section only"
  - "Wijk button acts as visual placeholder, triggers gemeente toggle if not already active"
  - "Toggle pill at top-8 (not top-4) to give breathing room below search pill"
  - "Bestemmingsplan always visible in pill (not conditionally shown when parcels active)"

patterns-established:
  - "ToggleButton pattern: relative button with motion.div layoutId behind text for sliding indicator"
  - "Section dividers: border-r border-white/20 for subtle glass-internal separation"
  - "Active glow: shadow-[0_0_12px_rgba(249,168,38,0.3)] for intelligence layer toggles"

requirements-completed: [NAV-03, NAV-04]

duration: 4min
completed: 2026-03-10
---

# Phase 92 Plan 02: Search Pill + Toggle Pill Summary

**Search pill at top-left and 3-section toggle pill at top-center with Framer Motion layoutId sliding amber indicators**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T10:11:52Z
- **Completed:** 2026-03-10T10:16:04Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Installed framer-motion dependency for panel/toggle animations across Aura frontend
- Search pill repositioned to top-6 with 320px width and smooth expand transition
- Toggle pill restructured into 3 logical sections with Framer Motion layoutId sliding amber indicator
- All existing toggle functionality preserved unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Install framer-motion + search pill glass styling and position** - `fa2d2c4` (feat)
2. **Task 2: Toggle pill with 3 sections + Framer Motion layoutId + legend reposition** - `153ecb8` (feat)

## Files Created/Modified
- `frontend/package.json` - Added framer-motion dependency
- `frontend/src/components/search/AddressSearch.tsx` - Updated position to top-6, added 320px width and transition
- `frontend/src/components/map/LayerToggle.tsx` - Restructured into 3-section pill with ToggleButton + motion.div layoutId

## Decisions Made
- Separate layoutId per section (base/view/intel) prevents indicator from sliding across section boundaries
- Wijk button is a visual placeholder that triggers gemeente toggle if not already active (wijk is sub-level of gemeente)
- Bestemmingsplan always visible in the pill (removed conditional rendering tied to showParcels) for consistent layout
- Toggle pill positioned at top-8 to create visual separation from search pill at top-6

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused hasScoreData lint error**
- **Found during:** Task 2
- **Issue:** hasScoreData prop was destructured but unused after legend extraction to map.tsx
- **Fix:** Prefixed with underscore: `hasScoreData: _hasScoreData`
- **Files modified:** frontend/src/components/map/LayerToggle.tsx
- **Verification:** npm run check passes with 0 errors
- **Committed in:** 153ecb8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial lint fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- framer-motion available for all subsequent phases (panel animations, bottom sheet, detail layers)
- Toggle pill ready for intelligence layer expansion in future phases
- Search pill and toggle pill are independent floating elements ready for responsive adjustments

---
*Phase: 92-viewport-layout-navigation*
*Completed: 2026-03-10*
