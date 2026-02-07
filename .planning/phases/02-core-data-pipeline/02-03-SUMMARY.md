---
phase: 02-core-data-pipeline
plan: 03
subsystem: api
tags: [pdok, cadastral, property, aggregator, asyncio, parallel-fetch, fastapi]

requires:
  - phase: 02-core-data-pipeline
    plan: 01
    provides: Shared httpx AsyncClient, PostgreSQL JSONB cache with TTL
  - phase: 02-core-data-pipeline
    plan: 02
    provides: BAG API client, address resolver with hierarchical chaining, AddressInput schema

provides:
  - PDOK Cadastral OGC API client for parcel lookup by bbox/point
  - Property aggregator with parallel API fetching via asyncio.gather
  - POST /api/properties/lookup endpoint (authenticated, rate-limited)
  - GET /api/properties/suggest endpoint (address autocomplete)
  - PropertyLookupResponse with completeness score and source attribution
  - DataSourceInfo schema for cache metadata per API source
  - Graceful partial failure handling (returns partial data if APIs fail)

affects: [03-zoning-monument, 04-ai-parsing, 05-report-management]

tech-stack:
  added: []
  patterns: [asyncio.gather for parallel API calls, completeness scoring for partial data, source attribution per data section]

key-files:
  created:
    - backend/app/government_apis/pdok_cadastral.py
    - backend/app/schemas/property.py
    - backend/app/services/property_aggregator.py
    - backend/app/properties/__init__.py
    - backend/app/properties/router.py
  modified:
    - backend/app/main.py
    - backend/pyproject.toml

key-decisions:
  - "Sequential address resolution then parallel data fetch (address must succeed before fetching building/parcel data)"
  - "Completeness score calculated as fraction of available data sections (address/building/parcels)"
  - "Source attribution includes cache metadata (cached_at, age_seconds) for transparency"
  - "B008 added to ruff ignore (false positive for FastAPI Depends pattern)"

patterns-established:
  - "Parallel API fetching with asyncio.gather(return_exceptions=True) for partial failure tolerance"
  - "Completeness scoring: sections_available / total_sections (0.0 to 1.0)"
  - "Source attribution: each API call tracked with DataSourceInfo (source, cache metadata)"
  - "Error collection: failed API calls append human-readable errors to response"

duration: 3min
completed: 2026-02-07
---

# Phase 2 Plan 3: Property Aggregator & Endpoint Summary

**Property aggregation API with parallel cadastral parcel fetch, completeness scoring, and authenticated POST /api/properties/lookup endpoint**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T04:23:49Z
- **Completed:** 2026-02-07T04:26:48Z
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 2

## Accomplishments

- PDOK Cadastral OGC API client fetches parcel data by geographic coordinates
- Property aggregator resolves address sequentially, then fetches building details and cadastral parcels in parallel with asyncio.gather
- Completeness scoring provides transparency about partial data (0.33 = address only, 0.67 = address + building, 1.0 = all data)
- Source attribution tracks which APIs returned data and cache freshness per source
- Authenticated endpoints with rate limiting (30/min for lookup, 60/min for autocomplete)
- Graceful partial failure handling returns useful data even when some APIs fail

## Task Commits

Each task was committed atomically:

1. **Task 1: PDOK Cadastral client and property aggregator** - `826dd5a` (feat)
2. **Task 2: Property lookup API endpoints** - `769913a` (feat)

## Files Created/Modified

**Created:**
- `backend/app/government_apis/pdok_cadastral.py` - PDOK Cadastral OGC API client for parcel data with bbox/point lookup
- `backend/app/schemas/property.py` - PropertyLookupResponse, CadastralParcel, DataSourceInfo schemas with completeness scoring
- `backend/app/services/property_aggregator.py` - Aggregates property data with parallel fetching via asyncio.gather
- `backend/app/properties/__init__.py` - Properties module package file
- `backend/app/properties/router.py` - POST /lookup and GET /suggest endpoints with JWT auth and rate limiting

**Modified:**
- `backend/app/main.py` - Integrated properties router into FastAPI app
- `backend/pyproject.toml` - Added B008 to ruff ignore list (FastAPI Depends pattern)

## Decisions Made

1. **Sequential address resolution before parallel fetch**: Address resolution must succeed first (404 if not found). Only after successful address resolution do we fire parallel tasks for building details and cadastral parcels. This prevents wasted API calls and provides clear error messaging.

2. **Completeness score as fraction**: Calculated as `sections_available / total_sections` where sections are address (always 1), building (0 or 1), and parcels (0 or 1). Provides transparency about data completeness without failing the entire request.

3. **Source attribution with cache metadata**: Each API call tracked in `data_sources` array with source name, cache timestamp, age in seconds, and is_cached flag. Enables frontend to show data freshness and debug cache behavior.

4. **B008 ruff ignore for FastAPI Depends**: Standard FastAPI dependency injection pattern triggers B008 (function call in default argument). This is a false positive - the pattern is correct and used throughout the codebase. Added to ignore list for consistency.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all verifications passed on first attempt.

## User Setup Required

None - no external service configuration required. All APIs used are free public PDOK/BAG services with no authentication.

## Next Phase Readiness

**Phase 2 Complete**: All three core data pipeline plans finished.

**What's ready:**
- Complete property lookup flow: address input → BAG resolution → parallel building + cadastral fetch → aggregated response
- Caching infrastructure isolates data by organization_id with source-specific TTLs
- API clients follow consistent patterns (handle_api_response, error hierarchy, logging)
- Address resolution chains BAG hierarchy (address → verblijfsobject → pand)
- Property aggregator demonstrates parallel fetching pattern for future expansion

**For Phase 3 (Zoning & Monument):**
- Coordinates available from building geometry for spatial lookups
- Cadastral parcel IDs available for ownership/monument queries
- Existing cache infrastructure can handle bestemmingsplan PDFs
- Error collection pattern ready for AI parsing confidence scores

**No blockers or concerns.**

---

## Self-Check: PASSED

All created files exist:
- ✓ backend/app/government_apis/pdok_cadastral.py
- ✓ backend/app/schemas/property.py
- ✓ backend/app/services/property_aggregator.py
- ✓ backend/app/properties/__init__.py
- ✓ backend/app/properties/router.py

All commits exist:
- ✓ 826dd5a (Task 1: PDOK Cadastral client and property aggregator)
- ✓ 769913a (Task 2: Property lookup API endpoints)

---
*Phase: 02-core-data-pipeline*
*Completed: 2026-02-07*
