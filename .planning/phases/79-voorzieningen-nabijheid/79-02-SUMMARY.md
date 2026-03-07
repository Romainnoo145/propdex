---
phase: 79-voorzieningen-nabijheid
plan: 02
subsystem: ui
tags: [cbs, nabijheid, proximity, voorzieningen, react, card]

requires:
  - phase: 79-voorzieningen-nabijheid
    provides: CBS nabijheid backend data stored in neighborhood_metrics["nabijheid"]

provides:
  - CbsNabijheid TypeScript interface with 6 proximity distance fields
  - NabijheidCard component with color-coded facility distances
  - WijkDetailView integration showing nabijheid after IncomeCard

affects: [81-locatie-score-investeringsprofiel]

tech-stack:
  added: []
  patterns:
    - "Color-coded distance thresholds: daily facilities (1/3km), transport (3/10km)"

key-files:
  created:
    - frontend/src/components/projects/NabijheidCard.tsx
  modified:
    - frontend/src/lib/types/scan.ts
    - frontend/src/components/projects/WijkDetailView.tsx

key-decisions:
  - "Nabijheid stored at root level of CbsNeighborhoodMetrics (sibling of data), matching backend storage pattern"
  - "Distance thresholds: daily facilities green<=1km/amber<=3km/red>3km, transport green<=3km/amber<=10km/red>10km"

patterns-established:
  - "Proximity color coding pattern: distanceColor() with type-aware thresholds"

requirements-completed: [VOORZ-02]

duration: 2min
completed: 2026-03-07
---

# Phase 79 Plan 02: NabijheidCard Frontend Summary

**NabijheidCard component with color-coded facility proximity distances (supermarkt, huisarts, school, kdv, trein, overstap) integrated into WijkDetailView**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T11:12:36Z
- **Completed:** 2026-03-07T11:14:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added CbsNabijheid TypeScript interface with 6 proximity distance fields
- Created NabijheidCard component with green/amber/red distance color coding
- Integrated NabijheidCard into WijkDetailView after IncomeCard, conditional on nabijheid data

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CbsNabijheid interface and extend CbsNeighborhoodMetrics** - `810fb1e` (feat)
2. **Task 2: Create NabijheidCard component and integrate into WijkDetailView** - `6b55741` (feat)

## Files Created/Modified
- `frontend/src/lib/types/scan.ts` - Added CbsNabijheid interface, optional nabijheid field on CbsNeighborhoodMetrics
- `frontend/src/components/projects/NabijheidCard.tsx` - New card component with 6 facility distances and color coding
- `frontend/src/components/projects/WijkDetailView.tsx` - Import and conditional render of NabijheidCard after IncomeCard

## Decisions Made
- CbsNabijheid placed at root level of CbsNeighborhoodMetrics (not inside `data`), matching backend storage pattern where nabijheid is a sibling of the Kerncijfers payload
- Distance color thresholds: daily facilities (supermarkt, huisarts, school, kdv) use 1km/3km boundaries; transport (trein, overstap) use 3km/10km boundaries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 79 (Voorzieningen Nabijheid) is now complete -- backend + frontend
- Nabijheid data visible in WijkDetailView after next scan of a gemeente
- Ready for Phase 80 (Criminaliteitsdata) and Phase 81 (Locatie Score)

---
*Phase: 79-voorzieningen-nabijheid*
*Completed: 2026-03-07*
