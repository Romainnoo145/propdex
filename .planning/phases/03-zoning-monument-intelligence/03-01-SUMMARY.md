---
phase: 03-zoning-monument-intelligence
plan: 01
subsystem: schemas
tags: [shapely, pyproj, pydantic, geojson, spatial]

# Dependency graph
requires:
  - phase: 02-core-data-pipeline
    provides: Cache manager infrastructure and property aggregation patterns
provides:
  - Spatial dependencies (shapely, pyproj) for geometry operations
  - DSO and RCE cache configuration with appropriate TTLs
  - Force refresh capability on cache manager
  - Complete Pydantic schemas for Phase 3 (zoning, monuments, map data)
  - Data gap tracking for zoning rules
  - Multi-source monument conflict detection
  - Dutch freshness timestamps on section metadata
affects: [03-02-api-clients, 03-03-aggregator, phase-04-intelligent-insights]

# Tech tracking
tech-stack:
  added: [shapely>=2.0.0, pyproj>=3.7.0]
  patterns:
    - "Computed properties for model-level business logic (has_any_data, freshness_display_nl)"
    - "model_validator for automatic field computation (is_monument from sources)"
    - "Gap markers for partial API data (data_gaps field)"
    - "Multi-source conflict detection pattern (MonumentStatus)"

key-files:
  created:
    - backend/app/schemas/zoning.py
    - backend/app/schemas/monument.py
  modified:
    - backend/pyproject.toml
    - backend/app/core/config.py
    - backend/app/services/cache_manager.py
    - backend/app/schemas/property.py

key-decisions:
  - "shapely for GeoJSON parsing instead of separate geojson library (shapely.geometry.shape handles it)"
  - "90-day cache TTL for DSO zoning data (same as bestemmingsplan - changes rarely)"
  - "30-day cache TTL for RCE monument data (changes more frequently than zoning)"
  - "force_refresh parameter defaults to False (backward compatible, opt-in behavior)"
  - "Monument status computed via ANY source indicating monument (conservative approach)"
  - "Confidence indicators on DataSourceInfo (HIGH for API sources, MEDIUM/LOW for parsed)"

patterns-established:
  - "BuildingDimensions.has_any_data computed property for checking if any dimension exists"
  - "SectionSourceInfo.freshness_display_nl for Dutch-language relative timestamps"
  - "MonumentStatus.is_monument computed via model_validator from sources list"
  - "PropertyReportResponse extends PropertyLookupResponse with Phase 3 sections"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Phase 03 Plan 01: Foundation for Zoning & Monument Intelligence

**Spatial dependencies (shapely, pyproj) installed; DSO/RCE cache configuration added; complete Pydantic schemas created for zoning rules, monument status, map data, and extended property reports**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T07:32:52Z
- **Completed:** 2026-02-07T07:36:06Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Spatial libraries (shapely, pyproj) installed for GeoJSON geometry operations and coordinate transformations
- DSO API key configuration added with 90-day cache TTL for zoning data
- RCE cache TTL (30 days) configured for monument status
- Cache manager extended with force_refresh parameter for cache bypass
- Complete Phase 3 Pydantic schemas: ZoningData, MonumentStatus, PropertyReportResponse, SectionSourceInfo, MapData
- Data gap tracking for partial zoning information
- Multi-source monument conflict detection with consensus logic
- Dutch-language freshness timestamps for user-facing metadata
- Confidence indicators on all data sources

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dependencies and extend configuration** - `d4d28cd` (feat)
2. **Task 2: Create zoning, monument, and extended property schemas** - `2e2cbf1` (feat)

## Files Created/Modified

### Created
- `backend/app/schemas/zoning.py` - ZoningData, ZoningPlan, ZoningRule, BuildingDimensions schemas with gap markers
- `backend/app/schemas/monument.py` - MonumentStatus, MonumentSourceResult schemas with conflict detection

### Modified
- `backend/pyproject.toml` - Added shapely>=2.0.0 and pyproj>=3.7.0 dependencies
- `backend/app/core/config.py` - Added DSO_API_KEY setting, dso/rce cache TTLs
- `backend/app/services/cache_manager.py` - Added force_refresh parameter to get_cached_or_fetch
- `backend/app/schemas/property.py` - Added confidence field to DataSourceInfo, created SectionSourceInfo, MapData, PropertyReportResponse

## Decisions Made

**1. shapely handles GeoJSON parsing natively**
- Rationale: No need for separate geojson library; shapely.geometry.shape() parses GeoJSON directly and provides geometry operations

**2. 90-day cache TTL for DSO zoning data**
- Rationale: Same as bestemmingsplan - zoning rules change very rarely, long cache is appropriate

**3. 30-day cache TTL for RCE monument data**
- Rationale: Monument status changes more frequently than zoning but still infrequent

**4. force_refresh defaults to False**
- Rationale: Backward compatible with existing code, opt-in behavior for explicit cache bypass

**5. Monument status is True if ANY source confirms**
- Rationale: Conservative approach - better to flag potential monument and investigate than miss heritage status

**6. Confidence indicators on DataSourceInfo**
- Rationale: Enables frontend to show HIGH confidence for API data, MEDIUM/LOW for AI-parsed data in Phase 4

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully.

## User Setup Required

None - no external service configuration required. DSO_API_KEY and RCE endpoints will be configured when API clients are implemented in 03-02.

## Next Phase Readiness

**Ready for 03-02 (API Clients):**
- All schemas defined and importable
- Cache infrastructure supports both DSO and RCE sources
- force_refresh available for explicit cache bypass
- Confidence indicators ready for API vs AI distinction
- Spatial libraries installed for coordinate transformations

**Ready for 03-03 (Aggregator):**
- PropertyReportResponse schema includes zoning, monuments, map_data fields
- SectionSourceInfo provides per-section cache metadata with Dutch freshness
- Data gap tracking enables partial data handling
- Multi-source conflict detection ready for monument aggregation

**No blockers** - all dependencies installed, schemas validated, ready for API integration work.

---
*Phase: 03-zoning-monument-intelligence*
*Completed: 2026-02-07*

## Self-Check: PASSED

All created files exist and all commits are present in git history.
