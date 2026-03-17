---
id: S09
parent: M001
milestone: M001
provides:
  - GET /api/scans/parcels/{id}/risk-profile endpoint
  - FysiekRisicoProfiel TypeScript types
  - useParcelRiskProfile React Query hook
  - FysiekRisicoprofielSection component with 4 sub-cards
  - foundation_risk_level field in MVT tile properties
  - Funderingsrisico toggleable overlay layer on area scan map
requires: []
affects: []
key_files: []
key_decisions:
  - "Extract FysiekRisicoprofielSection as separate component to keep ParcelDetailModal under 300-line per component limit"
  - "BuildingData constructed from ParcelCache fields (bouwjaar, has_pand, area_m2) since no gebruiksdoel column exists"
  - "Risk profile endpoint returns is_cached=True (all sub-components use JSONB cache underneath)"
  - "Bouwjaar-only proxy for tile coloring (full bouwjaar x bodemtype available per-parcel API)"
  - "Amber/slate palette consistent with indicative risk design (never red)"
patterns_established:
  - "Risk sub-card pattern: border-grey-800 bg-grey-850 p-3 with amber badges and italic disclaimers"
  - "Overlay layer addition pattern: catalog entry + fill layer + visibility function + toggle handler + interactive layers array"
observability_surfaces: []
drill_down_paths: []
duration: 5min
verification_result: passed
completed_at: 2026-03-10
blocker_discovered: false
---
# S09: Frontend Fysiek Risicoprofiel

**# Phase 90 Plan 01: Frontend Fysiek Risicoprofiel Summary**

## What Happened

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

# Phase 90 Plan 02: Foundation Risk Map Overlay Summary

**MVT tiles expose foundation_risk_level (bouwjaar CASE), toggleable Funderingsrisico overlay with amber/slate coloring**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T18:45:52Z
- **Completed:** 2026-03-09T18:50:26Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- MVT tiles now include foundation_risk_level (hoog/middel/laag/onbekend) derived from bouwjaar
- Funderingsrisico overlay layer available in parcel overlay menu with amber (pre-1970) and slate (post-1990) coloring
- Full hover, selection, and click interaction on foundation risk layer
- TILE_SCHEMA_VERSION bumped to 13 for browser cache refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Add foundation_risk_level to MVT tiles** - `c7bfb28` (feat)
2. **Task 2: Frontend foundation risk overlay layer and toggle** - `dc90da5` (feat)

## Files Created/Modified
- `backend/app/services/tile_proxy.py` - SQL CASE expression deriving foundation_risk_level from bouwjaar
- `frontend/src/lib/api.ts` - TILE_SCHEMA_VERSION bumped to 13
- `frontend/src/lib/map/layers.ts` - foundation_risk added to ParcelOverlayLayerId and MAP_LAYER_CATALOG
- `frontend/src/components/map/ParcelScoreLayer.tsx` - Foundation risk fill layer, visibility function, mouse handlers
- `frontend/src/components/map/LayerToggle.tsx` - Foundation risk mode and prop wiring
- `frontend/src/routes/_authenticated/map.tsx` - Handler and interactive layers array

## Decisions Made
- Used bouwjaar-only proxy for tile coloring because soil type is not stored per-parcel in scan results; full risk assessment available via per-parcel API
- Amber/slate palette (not red/green) to maintain indicative-only risk design principle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation risk overlay is fully functional and toggleable
- Per-parcel risk detail already available from phase 88 API

---
*Phase: 90-frontend-fysiek-risicoprofiel*
*Completed: 2026-03-10*
