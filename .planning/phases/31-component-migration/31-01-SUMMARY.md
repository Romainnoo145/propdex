---
phase: 31-component-migration
plan: 01
subsystem: ui
tags: [react, tailwind, design-system, industrial-amber, glassmorphism-migration]

# Dependency graph
requires:
  - phase: 27-design-system-foundation
    provides: Industrial Amber tokens (bg-grey-900, bg-grey-950, border-grey-800, text-grey-100/400/600) and primitives (Button, Select)
provides:
  - Modal with solid bg-grey-900 surface and bg-grey-950/60 backdrop replacing glassmorphism
  - Drawer with solid bg-grey-900 panel and bg-grey-950/40 backdrop replacing glassmorphism
  - SideRailNav with solid bg-grey-900 nav rail and grey-800 borders/dividers
  - ReportSidebar with solid bg-grey-900 surface using Select primitive and lucide-react icons
affects: [32-component-migration, 33-component-migration, 34-component-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DS-04 rule applied: Navigation chrome + data panels = solid bg-grey-900; floating map cards keep backdrop-blur"
    - "Select primitive replaces raw select elements for consistent design token application"
    - "lucide-react ChevronRight/X replace inline SVG icon functions in ReportSidebar"
    - "Active nav state: bg-grey-800 text-grey-100 (neutral, not amber) for persistent nav indicators per Pitfall 7"

key-files:
  created: []
  modified:
    - frontend/src/components/ui/Modal.tsx
    - frontend/src/components/ui/Drawer.tsx
    - frontend/src/components/layout/SideRailNav.tsx
    - frontend/src/components/layout/ReportSidebar.tsx

key-decisions:
  - "Active nav items use bg-grey-800 text-grey-100 (neutral) not amber-accent — persistent nav indicators should not use accent color per DS-04 Pitfall 7"
  - "Tooltip style updated to include border-grey-800 for crisper edge definition on solid dark bg-grey-950 background"
  - "ReportSidebar close button migrated from custom button+SVG to Button ghost variant with X lucide-react icon"
  - "Both raw select elements in ReportSidebar replaced with Select primitive — inherits grey-800 border and grey-950 bg automatically"

patterns-established:
  - "Backdrop: bg-grey-950/N (60 for modals, 40 for drawers) — no backdrop-blur"
  - "Panel surface: bg-grey-900 — solid, no transparency"
  - "Borders: border-grey-800 throughout (nav, panels, dialogs, tooltips)"
  - "Text hierarchy: text-grey-100 (primary), text-grey-400 (secondary), text-grey-600 (muted)"
  - "Interactive states: hover:bg-grey-850 hover:text-grey-100 / active: bg-grey-800 text-grey-100"
  - "Dividers: bg-grey-800 (replaces bg-white/10)"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 31 Plan 01: UI Component Glassmorphism Migration Summary

**Modal, Drawer, SideRailNav, and ReportSidebar migrated from glassmorphism (bg-black/N backdrop-blur) to Industrial Amber solid design tokens (bg-grey-900, border-grey-800, text-grey-100/400/600)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-17T22:54:53Z
- **Completed:** 2026-02-17T22:57:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Modal and Drawer now use solid bg-grey-900 panels with bg-grey-950/60 and bg-grey-950/40 backdrops — FocusLock and dialog accessibility fully preserved
- SideRailNav renders with solid bg-grey-900 nav rail, grey-800 borders/dividers, grey-400/100 text tokens, and tooltip upgrade (border added)
- ReportSidebar migrated from glassmorphism to bg-grey-900, inline SVG icons replaced with ChevronRight/X from lucide-react, raw select elements replaced with Select primitive
- Zero glassmorphism classes (bg-black/N, backdrop-blur, border-white/N) remain in any of the four files

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate Modal and Drawer to Industrial Amber tokens** - `99dac30` (feat)
2. **Task 2: Migrate SideRailNav and ReportSidebar to Industrial Amber tokens** - `d1356ab` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `frontend/src/components/ui/Modal.tsx` - Backdrop bg-grey-950/60, panel bg-grey-900 rounded-lg border-grey-800; FocusLock preserved
- `frontend/src/components/ui/Drawer.tsx` - Backdrop bg-grey-950/40, panel bg-grey-900, drag handle bg-grey-700; FocusLock preserved
- `frontend/src/components/layout/SideRailNav.tsx` - Nav bg-grey-900, active bg-grey-800/text-grey-100, inactive text-grey-400/hover-grey-850, tooltips border-grey-800
- `frontend/src/components/layout/ReportSidebar.tsx` - Aside bg-grey-900, Button+X close button, Select primitive for dropdowns, ChevronRight icon, all text/border tokens updated

## Decisions Made
- Active nav items use neutral bg-grey-800 text-grey-100 (not amber-accent) — persistent nav indicators should not draw attention with accent color (DS-04 Pitfall 7)
- Tooltip border (border-grey-800) added to SideRailNav tooltips for crisper edge definition against dark bg-grey-950 background
- Both raw `<select>` elements in ReportSidebar replaced with `<Select>` primitive from `@/components/primitives` — inherits consistent styling automatically
- ReportSidebar close button migrated to `<Button variant="ghost" size="sm">` with `<X size={20} />` from lucide-react

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Four highest-visibility components now use Industrial Amber tokens
- Consumer components (ParcelDetailModal, PropertyDetailDrawer) automatically inherit updated Modal/Drawer surface styling
- Pattern established for remaining component migrations in Phase 31 Plans 02+
- `npm run check` passes with 0 errors (69 pre-existing warnings unchanged)

## Self-Check: PASSED

Files verified to exist:
- `frontend/src/components/ui/Modal.tsx` — FOUND
- `frontend/src/components/ui/Drawer.tsx` — FOUND
- `frontend/src/components/layout/SideRailNav.tsx` — FOUND
- `frontend/src/components/layout/ReportSidebar.tsx` — FOUND

Commits verified:
- `99dac30` — FOUND (feat(31-01): migrate Modal and Drawer to Industrial Amber tokens)
- `d1356ab` — FOUND (feat(31-01): migrate SideRailNav and ReportSidebar to Industrial Amber tokens)

---
*Phase: 31-component-migration*
*Completed: 2026-02-18*
