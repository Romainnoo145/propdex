---
phase: 79-voorzieningen-nabijheid
plan: 01
subsystem: api
tags: [cbs, odata, nabijheid, proximity, voorzieningen]

requires:
  - phase: 78-extended-cbs-demographics
    provides: CBSODataClient with resolver infrastructure and Kerncijfers fetch

provides:
  - CBSODataClient.get_nabijheid_data() querying CBS 86134NED
  - 6 proximity measure codes (supermarkt, huisarts, basisschool, kinderdagverblijf, treinstation, overstapstation)
  - Scan job integration storing nabijheid under neighborhood_metrics["nabijheid"]

affects: [79-02, 80-criminaliteitsdata, 81-locatie-score-investeringsprofiel]

tech-stack:
  added: []
  patterns:
    - dataset_id override on resolver methods for multi-dataset CBS queries

key-files:
  created: []
  modified:
    - backend/app/government_apis/cbs_odata.py
    - backend/app/jobs/area_scan.py

key-decisions:
  - "Resolver methods accept optional dataset_id parameter for cross-dataset reuse"
  - "Nabijheid output keys mapped from afstand_X to X_km for cleaner frontend consumption"
  - "Peiljaar hardcoded to 2024 for nabijheid (86134NED is a stable yearly dataset)"

patterns-established:
  - "Multi-dataset CBS pattern: pass dataset_id override to shared resolver methods"

requirements-completed: [VOORZ-01, VOORZ-03]

duration: 3min
completed: 2026-03-07
---

# Phase 79 Plan 01: CBS Nabijheid Backend Summary

**CBS Nabijheid voorzieningen (86134NED) client with 6 proximity measures and scan job integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T11:08:26Z
- **Completed:** 2026-03-07T11:11:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added get_nabijheid_data() to CBSODataClient querying CBS dataset 86134NED
- Refactored resolver methods to accept optional dataset_id for multi-dataset reuse
- Integrated nabijheid fetch into area scan job with non-fatal error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Add get_nabijheid_data() method to CBSODataClient** - `805d206` (feat)
2. **Task 2: Integrate nabijheid fetch into scan job** - `768fcec` (feat)

## Files Created/Modified
- `backend/app/government_apis/cbs_odata.py` - Added NABIJHEID_DATASET_ID, 6 measure codes, _fetch_nabijheid_observations(), get_nabijheid_data(), refactored resolvers with dataset_id param
- `backend/app/jobs/area_scan.py` - Added nabijheid fetch block after CBS Kerncijfers, stores under neighborhood_metrics["nabijheid"]

## Decisions Made
- Resolver methods (_resolve_wijk_identifier, _resolve_gemeente_identifier) accept optional dataset_id parameter instead of creating separate resolver methods for nabijheid -- enables clean multi-dataset CBS queries
- Output keys mapped from afstand_supermarkt to supermarkt_km for cleaner frontend consumption
- Peiljaar hardcoded to 2024 for 86134NED (stable yearly dataset, not configurable like Kerncijfers)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Nabijheid data will be available in neighborhood_metrics["nabijheid"]["afstanden"] after next scan
- Ready for Plan 02 (frontend cards) to consume the stored proximity data
- CBS resolver infrastructure now supports multi-dataset queries for future Phase 80 (criminaliteitsdata)

---
*Phase: 79-voorzieningen-nabijheid*
*Completed: 2026-03-07*
