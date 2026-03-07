---
phase: 80-criminaliteitsdata
plan: 02
subsystem: frontend
tags: [criminaliteit, cbs, wijk-detail, card-component]

requires:
  - phase: 80-criminaliteitsdata
    provides: "Crime data in neighborhood_metrics['criminaliteit'] JSONB"
provides:
  - "CbsCriminaliteit TypeScript interface"
  - "CriminaliteitCard component with color-coded crime rates"
  - "WijkDetailView integration for crime statistics display"
affects: [81-locatie-score]

tech-stack:
  added: []
  patterns: ["Color-coded crime rate thresholds: green <30, amber 30-60, red >60 per 1000"]

key-files:
  created:
    - frontend/src/components/projects/CriminaliteitCard.tsx
  modified:
    - frontend/src/lib/types/scan.ts
    - frontend/src/components/projects/WijkDetailView.tsx

key-decisions:
  - "Crime color thresholds: <30 green, 30-60 amber, >60 red per 1000 inwoners"
  - "CriminaliteitCard follows NabijheidCard pattern with hero metric and category breakdown"

requirements-completed: [CRIME-02]

duration: 1min
completed: 2026-03-07
---

# Phase 80 Plan 02: Criminaliteit Frontend Card Summary

**CriminaliteitCard component with green/amber/red color-coded crime rates per 1000 inwoners and 3-category breakdown in WijkDetailView**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-07T11:38:18Z
- **Completed:** 2026-03-07T11:39:33Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- CbsCriminaliteit TypeScript interface matching backend payload structure
- CriminaliteitCard with hero metric (per_1000_inwoners) and category breakdown (vermogensdelicten, vernieling, geweld)
- Color coding: green (<30), amber (30-60), red (>60) per 1000 inwoners
- Conditional render in WijkDetailView after NabijheidCard

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CbsCriminaliteit interface and extend CbsNeighborhoodMetrics** - `bef1087` (feat)
2. **Task 2: Create CriminaliteitCard and integrate into WijkDetailView** - `9488d24` (feat)

## Files Created/Modified
- `frontend/src/lib/types/scan.ts` - CbsCriminaliteit interface, criminaliteit field on CbsNeighborhoodMetrics
- `frontend/src/components/projects/CriminaliteitCard.tsx` - Crime stats card with hero metric, category rows, color coding
- `frontend/src/components/projects/WijkDetailView.tsx` - CriminaliteitCard import and conditional render

## Decisions Made
- Crime color thresholds: <30 green (safe), 30-60 amber (moderate), >60 red (high crime) per 1000 inwoners
- CriminaliteitCard follows NabijheidCard visual pattern for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Phase 81 score engine can consume CbsCriminaliteit per_1000_inwoners values directly
- All crime data visually presented in wijk detail view

---
*Phase: 80-criminaliteitsdata*
*Completed: 2026-03-07*
