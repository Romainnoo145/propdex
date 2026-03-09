---
phase: 90-frontend-fysiek-risicoprofiel
plan: 01
subsystem: ui, api
tags: [risk-profile, fysiek-risico, foundation-risk, soil, asbest, contamination, parcel-detail]

# Dependency graph
requires:
  - phase: 87-soil-data-integration
    provides: soil_aggregator, BRO Bodemkaart WMS client
  - phase: 88-foundation-risk-engine
    provides: foundation_risk_engine, funderingsrisico_aggregator, KCAF cost estimation
  - phase: 89-asbestos-v2-refinement
    provides: asbest_indicator with gebruiksdoel uplift
provides:
  - GET /api/scans/parcels/{id}/risk-profile endpoint
  - FysiekRisicoProfiel TypeScript types
  - useParcelRiskProfile React Query hook
  - FysiekRisicoprofielSection component with 4 sub-cards
affects: [parcel-detail, report-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel data fetching with asyncio.gather for risk sub-components"
    - "Extracted FysiekRisicoprofielSection as standalone component (sub-300 lines)"
    - "Amber-only risk badge palette (never red/definitive)"

key-files:
  created:
    - frontend/src/components/results/FysiekRisicoprofielSection.tsx
  modified:
    - backend/app/scans/router.py
    - backend/app/scans/schemas.py
    - frontend/src/lib/types/property.ts
    - frontend/src/lib/types/scan.ts
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useScans.ts
    - frontend/src/components/results/ParcelDetailModal.tsx

key-decisions:
  - "Extract FysiekRisicoprofielSection as separate component to keep ParcelDetailModal under 300-line per component limit"
  - "BuildingData constructed from ParcelCache fields (bouwjaar, has_pand, area_m2) since no gebruiksdoel column exists"
  - "Risk profile endpoint returns is_cached=True (all sub-components use JSONB cache underneath)"

patterns-established:
  - "Risk sub-card pattern: border-grey-800 bg-grey-850 p-3 with amber badges and italic disclaimers"

requirements-completed: [FRNT-01, FRNT-02]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 90 Plan 01: Frontend Fysiek Risicoprofiel Summary

**Risk-profile REST endpoint with parallel soil/foundation/asbest/contamination fetching, served as 4 amber-badged sub-cards in ParcelDetailModal**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T18:45:18Z
- **Completed:** 2026-03-09T18:50:11Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Backend endpoint aggregates BRO soil, PDOK funderingsrisico, Bodemloket, and asbest data in parallel via asyncio.gather
- TypeScript types for all fysiek risico schemas (FysiekRisicoProfiel, FoundationRisk, SoilProfile, KCAFCostIndication)
- FysiekRisicoprofielSection renders 4 sub-cards (Fundering, Bodemtype, Asbest, Bodemkwaliteit) with amber-only badges
- Loading skeleton and error fallback states handled gracefully

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend risk-profile endpoint and TypeScript types** - `e2c4289` (feat)
2. **Task 2: FysiekRisicoProfiel section in ParcelDetailModal** - `ad3e546` (feat)

## Files Created/Modified
- `backend/app/scans/router.py` - GET /api/scans/parcels/{id}/risk-profile endpoint
- `backend/app/scans/schemas.py` - ParcelRiskProfileResponse schema
- `frontend/src/lib/types/property.ts` - FysiekRisicoProfiel and sub-risk TypeScript interfaces
- `frontend/src/lib/types/scan.ts` - ParcelRiskProfileResponse type
- `frontend/src/lib/api.ts` - fetchParcelRiskProfile API function
- `frontend/src/hooks/useScans.ts` - useParcelRiskProfile React Query hook
- `frontend/src/components/results/FysiekRisicoprofielSection.tsx` - 4 sub-card risk component (NEW)
- `frontend/src/components/results/ParcelDetailModal.tsx` - Integrated risk section

## Decisions Made
- Extracted FysiekRisicoprofielSection as separate component to maintain sub-300-line file guideline
- BuildingData constructed from ParcelCache columns since ParcelCache lacks a dedicated gebruiksdoel column
- Soil type card has no risk badge (informational only, not a risk level)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Risk profile visible in ParcelDetailModal for any parcel with scan data
- Ready for Phase 90 Plan 02 (if exists)

---
*Phase: 90-frontend-fysiek-risicoprofiel*
*Completed: 2026-03-10*
