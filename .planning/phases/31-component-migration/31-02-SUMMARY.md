---
phase: 31-component-migration
plan: 02
subsystem: ui
tags: [tailwind, design-system, glassmorphism-migration, industrial-amber, react, tanstack-table]

# Dependency graph
requires:
  - phase: 31-01
    provides: "Modal, Drawer, SideRailNav, ReportSidebar migrated to Industrial Amber tokens"
provides:
  - "ResultsLayout solid bg-grey-900 panel (left overlay on /resultaten)"
  - "ResultsFilterPanel using Select primitive and teal-accent focus ring"
  - "ResultsTable with grey tokens for header, rows, selection ring (amber-accent/30), pagination, skeletons"
  - "ParcelDetailModal internal content using bg-grey-850 data cells with grey-800 borders and Badge teal chips"
affects: [31-03, results-components, design-system-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Select primitive from @/components/primitives replaces raw <select> with glassmorphism in filter panels"
    - "Badge variant='teal' replaces inline chip styles for bestemming tags"
    - "Selected table rows: bg-grey-850 ring-amber-accent/30 (amber accent for data-layer selection, not navigation)"
    - "Score circle gradient kept semantic green (score indicator, not glassmorphism) with border-green-400/20"
    - "Loading skeletons: bg-grey-800 animate-pulse (was bg-white/5)"

key-files:
  created: []
  modified:
    - frontend/src/components/results/ResultsLayout.tsx
    - frontend/src/components/results/ResultsTable.tsx
    - frontend/src/components/results/ResultsFilterPanel.tsx
    - frontend/src/components/results/ParcelDetailModal.tsx

key-decisions:
  - "Amber-accent used for selected table row ring (ring-amber-accent/30) — data-layer selection uses accent, consistent with design token intent"
  - "Score circle gradient (green-500/20 to emerald-500/20) kept semantic — it conveys quality signal, not glassmorphism aesthetic; border softened from /30 to /20"
  - "Badge variant='teal' for bestemming chips — matches teal-accent semantic (zoning/land use context) and avoids raw blue glassmorphism"
  - "Min-area number input uses inline grey tokens (bg-grey-950 border-grey-800 focus:ring-teal-accent) — Input primitive has fixed height 8, plain input more flexible for narrow w-20 usage"

patterns-established:
  - "Data table selection: bg-grey-850 ring-1 ring-amber-accent/30 (not ring-white/30)"
  - "Table sticky header: bg-grey-900 solid (not bg-black/60 backdrop-blur-sm)"
  - "Filter panel background: bg-grey-850 (lighter than main panel bg-grey-900, creates visual separation)"
  - "Pagination buttons: bg-grey-850 hover:bg-grey-800 (standard secondary button pattern)"

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 31 Plan 02: Results Component Migration Summary

**Four results/ components (ResultsLayout, ResultsTable, ResultsFilterPanel, ParcelDetailModal) migrated from glassmorphism to Industrial Amber solid tokens, with Select and Badge primitives replacing raw styled elements**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-18T09:00:46Z
- **Completed:** 2026-02-18T09:04:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ResultsLayout left overlay panel: `bg-black/40 backdrop-blur-xl` → `bg-grey-900` solid; header and close button use grey token hierarchy
- ResultsFilterPanel: three raw `<select>` elements → `<Select>` primitive from `@/components/primitives`; `focus:ring-emerald-500/50` removed (teal-accent inherited from primitive); filter panel background `bg-white/5` → `bg-grey-850`
- ResultsTable: sticky thead backdrop-blur removed; selected row ring changed to `ring-amber-accent/30`; all text, border, bg, pagination, and skeleton classes migrated to grey tokens
- ParcelDetailModal: data cell cards `bg-white/5 border-white/10` → `bg-grey-850 border-grey-800`; bestemming chips → `<Badge variant="teal">`; score bar progress track `bg-white/10` → `bg-grey-800`

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate ResultsLayout and ResultsFilterPanel** - `923a9d3` (feat)
2. **Task 2: Migrate ResultsTable and ParcelDetailModal** - `2678f07` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `frontend/src/components/results/ResultsLayout.tsx` - Left overlay panel, solid bg-grey-900, grey-800 borders, grey text hierarchy
- `frontend/src/components/results/ResultsFilterPanel.tsx` - Select primitive for all dropdowns, bg-grey-850 panel, teal-accent focus via primitive
- `frontend/src/components/results/ResultsTable.tsx` - Sticky header solid, amber-accent selection ring, grey tokens throughout, skeleton bg-grey-800
- `frontend/src/components/results/ParcelDetailModal.tsx` - bg-grey-850 data cells, Badge teal chips, grey text hierarchy, score circle kept semantic green

## Decisions Made
- **Amber-accent for selected row ring:** `ring-amber-accent/30` replaces `ring-white/30` — data-layer selection uses the accent color; distinct from navigation (which uses neutral bg-grey-800)
- **Score gradient kept semantic green:** The circular score indicator conveys a quality signal (not glassmorphism), so `from-green-500/20 to-emerald-500/20` is preserved; border softened from `/30` to `/20` for subtlety on dark backgrounds
- **Badge variant="teal" for bestemmingen chips:** Teal-accent maps semantically to zoning/land-use context (not amber which is for primary actions); eliminates inline `bg-blue-500/10 border border-blue-400/30` glassmorphism chip
- **Number input stays inline:** `<Input>` primitive has fixed `h-8` height sufficient, but the w-20 narrow input is clearer with inline tokens matching the panel context; pattern is consistent with prior filter panels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four `results/` components now use Industrial Amber design tokens
- `ParcelEnrichmentCard.tsx` in the results/ folder still has glassmorphism classes — not in scope for Plan 02, will be addressed in Plan 03
- `npm run check` passes with 0 errors (69 pre-existing warnings, unchanged from Plan 01)
- Ready to continue Phase 31 with next component batch

## Self-Check: PASSED

- FOUND: `frontend/src/components/results/ResultsLayout.tsx`
- FOUND: `frontend/src/components/results/ResultsTable.tsx`
- FOUND: `frontend/src/components/results/ResultsFilterPanel.tsx`
- FOUND: `frontend/src/components/results/ParcelDetailModal.tsx`
- FOUND: `.planning/phases/31-component-migration/31-02-SUMMARY.md`
- FOUND commit: `923a9d3` (Task 1)
- FOUND commit: `2678f07` (Task 2)

---
*Phase: 31-component-migration*
*Completed: 2026-02-18*
