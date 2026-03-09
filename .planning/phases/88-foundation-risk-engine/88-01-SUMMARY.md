---
phase: 88-foundation-risk-engine
plan: 01
subsystem: api
tags: [foundation-risk, kcaf, fysiek-risico, pydantic, heuristic]

# Dependency graph
requires:
  - phase: 87-soil-data-integration
    provides: SoilProfile schema, soil_aggregator, funderingsrisico_aggregator
provides:
  - FoundationRisk schema with bouwjaar x bodemtype decision matrix
  - KCAFCostIndication schema with reference cost ranges
  - FysiekRisicoProfiel combined physical risk profile schema
  - foundation_risk_engine.py pure functions (assess, estimate, build)
  - PropertyReportResponse fysiek_risico_profiel field
affects: [89-frontend-risk-display, property-aggregator, parcel-detail-modal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure synchronous risk engine: zero I/O, zero async, derived from pre-fetched data"
    - "Worst-of risk aggregation across sub-components with onbekend exclusion"
    - "model_rebuild() pattern for Pydantic circular import resolution"

key-files:
  created:
    - backend/app/services/foundation_risk_engine.py
  modified:
    - backend/app/schemas/fysiek_risico.py
    - backend/app/schemas/property.py
    - backend/app/services/property_aggregator.py

key-decisions:
  - "TYPE_CHECKING guard + model_rebuild() for circular import between fysiek_risico.py and property.py"
  - "onbekend risks excluded from worst-of overall calculation (don't drag overall down)"
  - "Bodem dossiers presence = at least middel in overall risk"
  - "funderingsrisicogebied accepted but not yet influencing score (PC6-level too coarse)"

patterns-established:
  - "Pure function risk engine: synchronous post-processing after asyncio.gather in aggregator"
  - "rebuild_fysiek_risico_models() callable for deferred Pydantic type resolution"

requirements-completed: [FUND-01, FUND-02, FUND-03]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 88 Plan 01: Foundation Risk Engine Summary

**Pure-function foundation risk engine with bouwjaar x bodemtype decision matrix, KCAF cost indications, and combined FysiekRisicoProfiel schema wired into property aggregator**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T17:28:13Z
- **Completed:** 2026-03-09T17:33:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Foundation risk decision matrix: pre-1970 + klei/veen = hoog, leem = middel, zand = laag, post-1970 = always laag
- KCAF cost indications: 700-1000 EUR/m2 for hoog, 400-700 EUR/m2 for middel, with mandatory disclaimers
- Combined FysiekRisicoProfiel with worst-of risk aggregation across foundation, asbest, and contamination
- Zero new dependencies, zero new API calls, zero async functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Schemas + foundation risk engine pure functions** - `157778b` (feat)
2. **Task 2: Wire into PropertyReportResponse and property_aggregator** - `2518e0c` (feat)

## Files Created/Modified
- `backend/app/services/foundation_risk_engine.py` - Pure functions: assess_foundation_risk, estimate_kcaf_cost, build_fysiek_risico_profiel
- `backend/app/schemas/fysiek_risico.py` - Added FoundationRisk, KCAFCostIndication, FysiekRisicoProfiel schemas
- `backend/app/schemas/property.py` - Added fysiek_risico_profiel field to PropertyReportResponse
- `backend/app/services/property_aggregator.py` - Wired foundation risk engine as synchronous post-processing

## Decisions Made
- Used TYPE_CHECKING guard + rebuild_fysiek_risico_models() to resolve circular import between fysiek_risico.py (FoundationRisk) and property.py (AsbestIndicator)
- onbekend risks excluded from worst-of overall calculation to avoid false escalation when data is missing
- funderingsrisicogebied parameter accepted in assess_foundation_risk() but not yet used in scoring (PC6-level data is too coarse for parcel-level decisions)
- Completeness score denominator kept at 11 (fysiek_risico_profiel is derived, not a new data fetch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved Pydantic circular import with model_rebuild()**
- **Found during:** Task 1 (Schema creation)
- **Issue:** FysiekRisicoProfiel references AsbestIndicator (property.py) and BodemData (bodem.py), but property.py imports from fysiek_risico.py creating a circular dependency. TYPE_CHECKING guard caused "class not fully defined" at runtime.
- **Fix:** Added rebuild_fysiek_risico_models() function that calls FysiekRisicoProfiel.model_rebuild() with resolved types. Called at import time in foundation_risk_engine.py.
- **Files modified:** backend/app/schemas/fysiek_risico.py, backend/app/services/foundation_risk_engine.py
- **Verification:** All schema instantiation and serialization tests pass
- **Committed in:** 157778b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for Pydantic type resolution. No scope creep.

## Issues Encountered
None beyond the circular import resolution documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation risk engine fully functional and wired into API response
- Frontend can now display fysiek_risico_profiel data in ParcelDetailModal
- Ready for Phase 89 (frontend risk display)

---
*Phase: 88-foundation-risk-engine*
*Completed: 2026-03-10*
