---
phase: 93-parcel-detail-panel
plan: 02
subsystem: ui
tags: [react, glass-panel, bento-grid, maplibre, animation]

requires:
  - phase: 91-design-system-foundation
    provides: GlassPanel, BentoPod, PillBadge primitives and Aura CSS tokens
  - phase: 92-viewport-layout-navigation
    provides: SideRailNav, MapShell, search bar, filter dock
provides:
  - Floating ParcelDetailPanel with satellite hero and score badge
  - 4-category bento grid (Potentie, Risico, Markt, Juridisch)
  - Map re-center on panel open
  - Cross-fade animation on parcel change
affects: [93-03 detail layers, 94-wijk-bottom-sheet]

tech-stack:
  added: []
  patterns: [floating-panel-with-glass-blur, map-viewport-shift, keyed-content-crossfade]

key-files:
  created:
    - frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx
    - frontend/src/components/map/panels/parcel/ParcelHero.tsx
    - frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx
    - frontend/src/components/map/panels/ParcelDetailPanel.tsx
  modified:
    - frontend/src/routes/_authenticated/map.tsx
    - frontend/src/styles/index.css

key-decisions:
  - "Score badge uses inline span with shadow-lg instead of PillBadge for readability over satellite imagery"
  - "Address bar placed between hero and bento grid (not inside hero overlay)"
  - "Map re-center uses screen-space projection shift (190px) instead of bbox calculation"
  - "Bestemming folded into Juridisch pod per CONTEXT.md -- no separate status bar"

patterns-established:
  - "Floating panel pattern: fixed top-4 right-4 bottom-4 w-[380px] with GlassPanel blur='active'"
  - "Cross-fade via React key on content wrapper with animate-fade-in CSS class"
  - "Map viewport shift: project parcel center, subtract half panel width, unproject, easeTo"

requirements-completed: [PRC-01, PRC-02, PRC-03, PRC-04]

duration: 8min
completed: 2026-03-10
---

# Phase 93 Plan 02: Parcel Detail Panel Summary

**Floating Aura glass panel with satellite hero, score badge, address bar, and 4-category bento grid replacing old ParcelDetailModal in map context**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T23:39:02Z
- **Completed:** 2026-03-09T23:47:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Floating glass panel slides in from right with satellite hero image and score badge overlay
- 4 interactive category pods (Potentie, Risico, Markt, Juridisch) in 2x2 bento grid
- Map re-centers to keep parcel visible alongside panel (viewport shift by 190px)
- Panel closes via X button, Escape key; cross-fades on parcel change
- "Genereer Rapport" / "Bekijk Rapport" footer button using existing hooks

## Task Commits

Each task was committed atomically:

1. **Task 1: ParcelPanelShell + ParcelHero + ParcelBentoOverview** - `edff438` (feat)
2. **Task 2: ParcelDetailPanel + map.tsx integration + map re-center** - `0e0326a` (feat)

## Files Created/Modified
- `frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx` - Glass panel shell with fly-in animation, escape handler, sticky footer
- `frontend/src/components/map/panels/parcel/ParcelHero.tsx` - Satellite crop hero with score badge overlay and gradient fallback
- `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx` - 2x2 bento grid with Potentie/Risico/Markt/Juridisch pods
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx` - Composed panel with view state management and report generation
- `frontend/src/routes/_authenticated/map.tsx` - Replaced ParcelDetailModal with ParcelDetailPanel, added re-center effect
- `frontend/src/styles/index.css` - Added animate-fade-in keyframe for cross-fade animation

## Decisions Made
- Score badge uses inline span with shadow-lg instead of PillBadge -- better readability over satellite imagery backgrounds
- Address bar sits between hero and bento grid as a simple text div, not overlaid on hero
- Map re-center uses screen-space projection: project parcel center to pixel coordinates, subtract 190px (half panel width), unproject back to lngLat, then easeTo with 500ms duration
- Bestemming data folded into Juridisch pod showing primary bestemming name (per CONTEXT.md decision, no separate bar)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed 'score' overlay layer ID to 'potential'**
- **Found during:** Task 2 (map.tsx integration)
- **Issue:** `layerState.activeParcelOverlay === 'score'` caused TS2367 -- ParcelOverlayLayerId type uses 'potential' not 'score'
- **Fix:** Changed comparison to `=== 'potential'`
- **Files modified:** frontend/src/routes/_authenticated/map.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 0e0326a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Pre-existing type mismatch in map.tsx was blocking compilation. Fix is minimal and correct.

## Issues Encountered
- `git stash` during pre-existing error investigation lost unstaged map.tsx and index.css changes; re-applied cleanly
- TanStack Router requires explicit search params for `/rapporten` route -- used `{ project_id: undefined, q: undefined }`

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Panel overview complete with clickable pods (pods set view state but detail layers show placeholder)
- Plan 03 will implement actual detail layers (potentie, risico, markt, juridisch) replacing placeholder text
- Pre-existing lint error in LayerToggle.tsx (`hasScoreData` unused) is out of scope -- not caused by this plan

---
*Phase: 93-parcel-detail-panel*
*Completed: 2026-03-10*
