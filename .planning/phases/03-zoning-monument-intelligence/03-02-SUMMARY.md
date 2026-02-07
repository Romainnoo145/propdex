---
phase: 03-zoning-monument-intelligence
plan: 02
subsystem: api
tags: [dso, spatial-plans, shapely, zoning, bestemmingsplan, geojson, hal-json]

# Dependency graph
requires:
  - phase: 03-01
    provides: ZoningData schemas, shapely library, cache force_refresh capability
  - phase: 02-01
    provides: httpx AsyncClient, cache_manager with TTL support
provides:
  - DSOSpatialPlansClient for querying bestemmingsplannen via POST with GeoJSON
  - fetch_zoning_data aggregator with spatial intersection and dimension extraction
  - Building dimension parsing from Dutch maatvoering fields
  - Data gap tracking for transparency on partial results
affects: [03-04-property-report-aggregator, 04-ai-fallback-parsing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HAL+JSON pagination with _embedded and _links.next"
    - "shapely.geometry.shape() for GeoJSON to geometry conversion"
    - "Spatial intersection with contains() and intersects() for point-in-polygon"
    - "Dutch maatvoering field parsing with regex extraction"
    - "Plan filtering: vastgesteld > ontwerp, sorted by datum descending"

key-files:
  created:
    - backend/app/government_apis/dso_spatial_plans.py
    - backend/app/services/zoning_aggregator.py
  modified: []

key-decisions:
  - "POST with GeoJSON Point to DSO /plannen/_zoek for spatial lookups"
  - "HAL+JSON pagination limited to 5 pages per endpoint to prevent timeouts"
  - "Sequential fetches for bestemmingsvlakken/maatvoeringen instead of asyncio.gather (safer inside cache_manager)"
  - "Primary bestemming determined by most common function across all plans"
  - "Consolidated building dimensions from first available rule with data"
  - "Data gaps in Dutch for user-facing transparency"

patterns-established:
  - "Pattern 1: DSO API uses POST with GeoJSON body for spatial queries, not GET with bbox"
  - "Pattern 2: HAL+JSON responses require parsing _embedded.{collection} and _links.next"
  - "Pattern 3: Spatial intersection filters API results to only relevant geometries"
  - "Pattern 4: Dutch field name parsing with lowercase matching (bouwhoogte, goothoogte, bebouwingspercentage)"

# Metrics
duration: 2 min
completed: 2026-02-07
---

# Phase 3 Plan 2: DSO Spatial Plans API Client & Zoning Aggregator Summary

**DSO Ruimtelijke Plannen v4 client with POST+GeoJSON spatial queries, HAL+JSON pagination, shapely intersection, and Dutch maatvoering parsing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T07:40:29Z
- **Completed:** 2026-02-07T07:42:45Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- DSOSpatialPlansClient with POST /plannen/_zoek using GeoJSON Point body for spatial lookups
- HAL+JSON pagination support (up to 5 pages) for bestemmingsvlakken, bouwvlakken, maatvoeringen
- Zoning aggregator with shapely spatial intersection filtering geometries to property point
- Dutch maatvoering field parsing (bouwhoogte, goothoogte, bebouwingspercentage) with regex extraction
- Plan filtering (vastgesteld > ontwerp) and sorting by datum descending
- Primary bestemming determination from most common function across plans
- Consolidated building dimensions from first available rule
- Data gap tracking in Dutch for user-facing transparency
- Cache integration with dso source (90d TTL) and force_refresh support

## Task Commits

Each task was committed atomically:

1. **Task 1: DSO Spatial Plans API client** - `10a5c21` (feat)
2. **Task 2: Zoning aggregation service with DSO-first strategy** - `3f4eddd` (feat)

**Plan metadata:** (to be committed)

## Files Created/Modified

- `backend/app/government_apis/dso_spatial_plans.py` - DSO Ruimtelijke Plannen API v4 client with POST+GeoJSON spatial queries, HAL+JSON pagination, and singleton pattern
- `backend/app/services/zoning_aggregator.py` - Zoning aggregation service with shapely spatial intersection, Dutch maatvoering parsing, plan filtering, and cache integration

## Decisions Made

**POST with GeoJSON Point for spatial queries:** DSO API requires POST to /plannen/_zoek with GeoJSON body for location-based lookups, not GET with bbox parameters.

**HAL+JSON pagination limited to 5 pages:** Prevents excessive API calls and timeouts. Each endpoint (bestemmingsvlakken, maatvoeringen, bouwvlakken) can paginate up to 5 pages.

**Sequential fetches inside cache_manager:** Using asyncio.gather inside the cache_manager's fetch function can cause issues. Sequential fetches for bestemmingsvlakken/maatvoeringen/bouwvlakken are safer.

**Primary bestemming from most common function:** When multiple plans overlap, the most frequently occurring bestemming across all rules is selected as primary.

**Consolidated dimensions from first available:** Building dimensions taken from the first rule that has any dimension data, rather than attempting complex merging.

**Data gaps in Dutch:** Transparency messages like "Geen bestemmingsvlakken op deze locatie" are user-facing and should be in Dutch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- 03-03 Monument Client: Can proceed independently (parallel execution)
- 03-04 Property Report Aggregator: Will need both zoning and monument data

**Dependencies satisfied:**
- Spatial dependencies (shapely, pyproj) available from 03-01
- ZoningData schemas defined in 03-01
- Cache manager with force_refresh from 03-01
- Building coordinates available from Phase 2 for RD spatial queries

**Notes:**
- DSO API client ready for production use
- Zoning data properly cached with 90-day TTL
- Spatial intersection ensures only relevant geometries returned
- Data gap tracking provides transparency on partial results
- Fallback to AI parsing (Phase 4) will use this as first attempt

---
*Phase: 03-zoning-monument-intelligence*
*Completed: 2026-02-07*

## Self-Check: PASSED
