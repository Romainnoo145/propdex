---
id: S06
parent: M001
milestone: M001
provides:
  - "BRO Bodemkaart WMS client for per-coordinate soil type (klei/veen/zand/leem)"
  - "PDOK Funderingsrisicogebieden WFS client for postcode-level foundation risk context"
  - "SoilProfile and FunderingsrisicogebiedData Pydantic schemas"
  - "soil_classifier static lookup for BRO soil code prefix classification"
  - "PropertyReportResponse includes soil_profile and funderingsrisicogebied fields"
requires: []
affects: []
key_files: []
key_decisions:
  - "Use WMS GetFeatureInfo with 1km window (500m half-width) for BRO point queries"
  - "Round percvoor1970 to 2 decimal places for clean display"
  - "Empty dict cached for postcodes without funderingsrisico data (avoids repeat API calls)"
  - "Completeness score denominator increased from 9 to 11 for two new sections"
patterns_established:
  - "WMS GetFeatureInfo pattern: bbox around point, 100x100 grid, center pixel (50,50)"
  - "Static soil code classification via longest-prefix-first matching"
observability_surfaces: []
drill_down_paths: []
duration: 4min
verification_result: passed
completed_at: 2026-03-09
blocker_discovered: false
---
# S06: Soil Data Integration

**# Phase 87 Plan 01: Soil Data Integration Summary**

## What Happened

# Phase 87 Plan 01: Soil Data Integration Summary

**BRO Bodemkaart WMS soil classifier and PDOK Funderingsrisicogebieden WFS client with JSONB caching, integrated into property aggregation pipeline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T16:48:04Z
- **Completed:** 2026-03-09T16:52:13Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- BRO Bodemkaart WMS client classifies any RD coordinate into klei/veen/zand/leem/onbekend
- PDOK Funderingsrisicogebieden WFS client returns postcode-level foundation risk context with string-to-numeric parsing
- Both data sources integrated into asyncio.gather parallel fetch in property_aggregator.py
- Zero new dependencies added

## Task Commits

Each task was committed atomically:

1. **Task 1: BRO Bodemkaart WMS client, soil classifier, and schema** - `d17e8c4` (feat)
2. **Task 2: PDOK Funderingsrisicogebieden WFS client and aggregator** - `8838267` (feat)
3. **Task 3: Wire soil data into property aggregator and response schema** - `99cfd1e` (feat)

## Files Created/Modified
- `backend/app/schemas/fysiek_risico.py` - SoilProfile and FunderingsrisicogebiedData Pydantic models
- `backend/app/services/soil_classifier.py` - Static BRO soil code prefix-to-grondsoort mapping
- `backend/app/government_apis/bro_bodemkaart.py` - WMS GetFeatureInfo client for soilarea layer
- `backend/app/services/soil_aggregator.py` - Cached soil profile fetch with 365-day TTL
- `backend/app/government_apis/pdok_funderingsrisico.py` - WFS GetFeature client with CQL_FILTER by PC6
- `backend/app/services/funderingsrisico_aggregator.py` - Cached funderingsrisico fetch with 180-day TTL
- `backend/app/government_apis/rate_limiter.py` - Added bro_bodemkaart_limiter and pdok_funderingsrisico_limiter
- `backend/app/core/config.py` - Added CACHE_TTL entries for both sources
- `backend/app/schemas/property.py` - Added soil_profile and funderingsrisicogebied fields
- `backend/app/services/property_aggregator.py` - Wired both fetches into asyncio.gather, updated completeness score

## Decisions Made
- Used WMS GetFeatureInfo with 1km window (500m half) as verified in research
- Rounded percvoor1970 to 2 decimal places for cleaner display
- Cache empty dict for postcodes without funderingsrisico data to avoid repeat API calls
- Completeness score denominator increased from 9 to 11 for two new data sections

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import sorting in property_aggregator.py**
- **Found during:** Task 3 (wiring into property aggregator)
- **Issue:** New imports were not in isort order, ruff check failed
- **Fix:** Ran `ruff check --fix` to auto-sort imports
- **Files modified:** backend/app/services/property_aggregator.py
- **Verification:** `ruff check` passes on all files
- **Committed in:** 99cfd1e (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial import ordering fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Both PDOK endpoints are public, free, no auth.

## Next Phase Readiness
- Soil type classification and funderingsrisico area context available in PropertyReportResponse
- Phase 88 (Foundation Risk Engine) can combine soil_profile.dominant_type with building.bouwjaar for risk heuristic
- Frontend parcel detail can display both new data sections

## Self-Check: PASSED

All 6 created files exist. All 3 task commits verified in git log.

---
*Phase: 87-soil-data-integration*
*Completed: 2026-03-09*
