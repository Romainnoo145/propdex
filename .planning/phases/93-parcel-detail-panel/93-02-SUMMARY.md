---
phase: 93-parcel-detail-panel
plan: 02
subsystem: ui
tags: [framer-motion, glass-panel, bento-grid, parcel-detail, animation]

requires:
  - phase: 93-parcel-detail-panel
    provides: "Aerial crop API endpoint + useAerialCrop hook (plan 01)"
  - phase: 92-viewport-layout
    provides: "Aura layout with SideRailNav, flex siblings, glass primitives"
provides:
  - "LEFT-side floating parcel detail panel with Framer Motion spring animation"
  - "180px satellite hero with Deep Obsidian score badge"
  - "4-category bento overview grid (potentie/risico/markt/juridisch)"
  - "AnimatePresence-wrapped panel in map.tsx"
  - "Rightward map re-center when panel opens"
affects: [93-03]

tech-stack:
  added: []
  patterns:
    - "Framer Motion spring slide-in for panel enter/exit (stiffness 300, damping 30)"
    - "AnimatePresence wrapper in map.tsx for panel lifecycle"
    - "Derived state pattern for view reset on parcel change"
    - "Deep Obsidian circle score badge on satellite hero"

key-files:
  created: []
  modified:
    - frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx
    - frontend/src/components/map/panels/parcel/ParcelHero.tsx
    - frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx
    - frontend/src/components/map/panels/ParcelDetailPanel.tsx
    - frontend/src/routes/_authenticated/map.tsx

key-decisions:
  - "Panel positioned LEFT at left-[112px] (80px rail + 32px gap), slides from left"
  - "Map re-center shifts rightward (+210px) since panel covers left side"
  - "Address header moved from BentoOverview into ParcelDetailPanel for persistence across views"
  - "Score badge is Deep Obsidian circle (h-12 w-12) with Amber text, not pill badge"

patterns-established:
  - "Framer Motion spring animation for panel enter/exit (type spring, stiffness 300, damping 30)"
  - "prefers-reduced-motion check at module level to skip slide animation"
  - "Cross-fade via motion.div key={parcel_id} with opacity transition"

requirements-completed: [PRC-01, PRC-02, PRC-03, PRC-04]

duration: 2min
completed: 2026-03-10
---

# Phase 93 Plan 02: Parcel Detail Panel Summary

**LEFT-side floating glass panel with Framer Motion spring animations, 180px satellite hero, Deep Obsidian score badge, and 4-category bento grid**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T13:32:28Z
- **Completed:** 2026-03-10T13:34:36Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Rewrote ParcelPanelShell to LEFT-side position (left-[112px]) with Framer Motion spring slide-in animation
- Updated ParcelHero to 180px height with Deep Obsidian circle score badge (bg-aura-obsidian, text-aura-amber)
- Moved address header from BentoOverview into ParcelDetailPanel for persistence across overview/detail views
- Wrapped panel in AnimatePresence in map.tsx for proper enter/exit lifecycle
- Changed map re-center from leftward (-190px) to rightward (+210px) to accommodate left panel

## Task Commits

Each task was committed atomically:

1. **Task 1: ParcelPanelShell + ParcelHero + ParcelBentoOverview** - `d4eb364` (feat)
2. **Task 2: ParcelDetailPanel composition + map.tsx integration** - `774822a` (feat)

## Files Created/Modified
- `frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx` - LEFT-side glass panel with Framer Motion spring animation
- `frontend/src/components/map/panels/parcel/ParcelHero.tsx` - 180px satellite hero with Deep Obsidian score badge
- `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx` - 2x2 bento grid without address bar (moved up)
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx` - Composition with cross-fade, address header, view state machine
- `frontend/src/routes/_authenticated/map.tsx` - AnimatePresence wrapper, rightward map re-center

## Decisions Made
- Panel at left-[112px] (80px SideRailNav + 32px gap) with 420px width and rounded-[32px]
- Map re-center uses +210px (half of 420px panel) rightward shift
- Address header lives in ParcelDetailPanel (not BentoOverview) so it persists in detail views
- Score badge is Deep Obsidian circle (not colored pill) -- matches CONTEXT.md spec exactly
- Glass material uses inline bg-white/60 backdrop-blur-[24px] instead of GlassPanel primitive for precise control
- prefers-reduced-motion detected at module level, skips slide animation but keeps opacity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in SideRailNav.tsx (undefined values cast to Record<string, string>) -- out of scope, not related to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Panel shell, hero, bento overview, and AnimatePresence integration all ready
- Plan 03 builds detail layers (potentie/risico/markt/juridisch) inside the panel
- Layer components already imported and routed via view state machine

---
*Phase: 93-parcel-detail-panel*
*Completed: 2026-03-10*
