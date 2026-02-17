---
phase: 29-silver-map-theme-layout-shells
plan: 02
subsystem: ui
tags: [layout, design-system, dark-theme, glassmorphism, routes]

# Dependency graph
requires:
  - phase: 29-01
    provides: MapShell and ResultsShell layout components

provides:
  - All authenticated routes migrated to correct layout shells
  - Floating map cards using dark glassmorphism (bg-grey-900/90)
  - AppLayout.tsx as backward-compatible re-export of MapShell

affects:
  - Any future route that imports AppLayout (gets MapShell via re-export)
  - Phase 30+ ResultsShell refinements (projecten, instellingen, rapport routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Route-level shell adoption: map -> MapShell, data routes -> ResultsShell
    - Dark glassmorphism for floating map cards: bg-grey-900/90 backdrop-blur-md border border-white/10
    - Amber accent design tokens replacing emerald/purple legacy colors
    - AppLayout.tsx backward-compatible re-export pattern

key-files:
  created: []
  modified:
    - frontend/src/routes/_authenticated/map.tsx
    - frontend/src/routes/_authenticated/instellingen.tsx
    - frontend/src/routes/_authenticated/dashboard.tsx
    - frontend/src/routes/_authenticated/projecten.tsx
    - frontend/src/App.tsx
    - frontend/src/components/layout/AppLayout.tsx

key-decisions:
  - "AppLayout.tsx reduced to re-export of MapShell for backward compatibility — can be deleted in a future cleanup phase"
  - "Floating map cards use bg-grey-900/90 backdrop-blur-md (semi-transparent dark glass) to layer over the map canvas without blocking it"
  - "ResultsShell wraps instellingen and dashboard placeholder cards — inner flex centering preserved inside ResultsShell content area"
  - "projecten.tsx outer wrapper divs removed; ResultsShell provides equivalent h-full overflow-y-auto bg-grey-950 and max-w-5xl mx-auto px-6 py-8"

# Metrics
duration: ~2.5min
completed: 2026-02-18
---

# Phase 29 Plan 02: Route Shell Migration + Dark Theme Cards Summary

**All authenticated routes migrated to MapShell/ResultsShell; floating map cards converted from white (bg-white/95) to dark glassmorphism (bg-grey-900/90) with amber-accent design tokens replacing emerald/purple legacy colors**

## Performance

- **Duration:** ~2.5 min
- **Started:** 2026-02-17T21:31:42Z
- **Completed:** 2026-02-17T21:34:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- map.tsx: AppLayout replaced with MapShell; all three floating card elements (gemeente header, zone loading, zone info) converted from white to dark glassmorphism
- instellingen.tsx: AppLayout replaced with ResultsShell; outer centering wrapper preserved inside ResultsShell
- dashboard.tsx: AppLayout replaced with ResultsShell; same pattern as instellingen
- projecten.tsx: Light-theme bg-stone-50 wrapper replaced with ResultsShell; heading/subtitle converted to grey-100/grey-400 dark theme colors
- App.tsx: AppLayout replaced with MapShell (standalone legacy entry point)
- AppLayout.tsx: Full implementation stripped down to single-line backward-compatible re-export of MapShell

## Task Commits

Each task was committed atomically:

1. **Task 1: Adopt MapShell in map route and update dark theme cards** - `506e984` (feat)
2. **Task 2: Adopt ResultsShell in non-map routes and update AppLayout** - `b810664` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/src/routes/_authenticated/map.tsx` - MapShell adoption + all floating cards dark glassmorphism
- `frontend/src/routes/_authenticated/instellingen.tsx` - ResultsShell adoption
- `frontend/src/routes/_authenticated/dashboard.tsx` - ResultsShell adoption
- `frontend/src/routes/_authenticated/projecten.tsx` - ResultsShell adoption + dark heading colors
- `frontend/src/App.tsx` - MapShell adoption (legacy entry point)
- `frontend/src/components/layout/AppLayout.tsx` - Reduced to backward-compatible re-export

## Decisions Made

- AppLayout.tsx preserved as re-export rather than deleted — ensures zero import breakage at no cost (1 line file)
- Floating map cards use `bg-grey-900/90 backdrop-blur-md` (semi-transparent dark glass over map canvas) — distinct from ResultsShell's solid `bg-grey-950` (data content areas per DS-04)
- Inner `flex h-full items-center justify-center` wrapper kept inside instellingen/dashboard ResultsShell — ResultsShell provides outer structure, inner flex centering is component-level concern
- projecten.tsx `max-w-4xl px-8 py-10` removed in favor of ResultsShell's `max-w-5xl px-6 py-8` — slight layout adjustment acceptable for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All authenticated routes now use correct layout shells (DS-04 complete)
- Visual hierarchy established: glassmorphism chrome (SideRailNav, InspectorPanel) vs solid data (ResultsShell) vs semi-transparent dark glass (floating map cards)
- AppLayout.tsx can be deleted in a future cleanup phase with no functional impact
- Phase 30+ can focus on content refinement (rapport route, ProjectList dark theme) within established shell structure

## Self-Check: PASSED

All artifacts verified:
- `frontend/src/routes/_authenticated/map.tsx` - FOUND, contains MapShell, no bg-white
- `frontend/src/routes/_authenticated/instellingen.tsx` - FOUND, contains ResultsShell
- `frontend/src/routes/_authenticated/dashboard.tsx` - FOUND, contains ResultsShell
- `frontend/src/routes/_authenticated/projecten.tsx` - FOUND, contains ResultsShell, no bg-stone-50
- `frontend/src/App.tsx` - FOUND, contains MapShell
- `frontend/src/components/layout/AppLayout.tsx` - FOUND, re-exports MapShell
- Commit `506e984` (Task 1) - FOUND
- Commit `b810664` (Task 2) - FOUND
- `npm run check` - 0 errors

---
*Phase: 29-silver-map-theme-layout-shells*
*Completed: 2026-02-18*
