---
phase: 03-zoning-monument-intelligence
plan: 04
subsystem: api
tags: [aggregator, integration, property-report, zoning, monuments, map-data, coordinate-transformation, cache-bypass]

# Dependency graph
requires:
  - phase: 03-02
    provides: DSO zoning client with fetch_zoning_data
  - phase: 03-03
    provides: RCE monument client with fetch_monument_status and rd_to_wgs84
  - phase: 02-03
    provides: Property aggregator foundation and /api/properties/lookup endpoint
provides:
  - "Extended property aggregator returning PropertyReportResponse with zoning, monuments, and map data"
  - "POST /api/properties/lookup endpoint with force_refresh parameter"
  - "Section-level source attribution with Dutch freshness timestamps"
  - "Map data with WGS84 coordinates for frontend rendering"
  - "Completeness score including all 5 sections (address, building, parcels, zoning, monuments)"
affects: [04-bestemmingsplan-ai, frontend-implementation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel API fetching with asyncio.gather for cadastral + zoning + monuments"
    - "RD to WGS84 coordinate transformation for map center and tile overlays"
    - "Section-level source metadata with confidence indicators (HIGH for API sources)"
    - "force_refresh parameter propagation through service layers for cache bypass"
    - "PropertyReportResponse as unified response schema with all intelligence sections"

key-files:
  created: []
  modified:
    - "backend/app/services/property_aggregator.py"
    - "backend/app/properties/router.py"

key-decisions:
  - "PropertyReportResponse replaces PropertyLookupResponse as endpoint return type"
  - "Section-level source attribution enables frontend to display freshness per section"
  - "force_refresh defaults to False for backward compatibility"
  - "Map data includes WGS84 coordinates for OpenLayers/Leaflet compatibility"
  - "Completeness score updated to 5 sections (was 3) to include zoning and monuments"
  - "Zoning geometries extracted from all rules across all plans for map overlay"

patterns-established:
  - "Service integration via parallel async fetch functions in aggregator"
  - "Coordinate transformation at aggregation layer (not in individual clients)"
  - "Section sources separate from data_sources for granular cache visibility"

# Metrics
duration: 2 min
completed: 2026-02-07
---

# Phase 3 Plan 4: Property Report Aggregator Summary

**Full property intelligence report with zoning rules, monument status, map data, section-level source attribution, and cache bypass capability**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T07:47:52Z
- **Completed:** 2026-02-07T07:50:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Property aggregator now fetches zoning + monuments + cadastral in parallel with asyncio.gather
- Map data built with RD to WGS84 coordinate transformation for frontend map rendering
- Section-level source attribution with Dutch freshness timestamps (e.g., "2 uur geleden")
- POST /api/properties/lookup returns PropertyReportResponse with all Phase 3 intelligence sections
- force_refresh parameter enables cache bypass for "Vernieuwen" button UX
- Completeness score updated to 5 sections (address, building, parcels, zoning, monuments)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend property aggregator with zoning, monuments, and map data** - `e8fdc57` (feat)
2. **Task 2: Update property lookup endpoint with force_refresh and extended response** - `de94715` (feat)

**Plan metadata:** (to be committed)

## Files Created/Modified

- `backend/app/services/property_aggregator.py` - Extended aggregate_property_data to fetch zoning/monuments in parallel, build MapData with WGS84 coordinates, assemble section_sources, return PropertyReportResponse (146 insertions, 9 deletions)
- `backend/app/properties/router.py` - Updated POST /lookup with force_refresh param and PropertyReportResponse return type, enhanced docstring (13 insertions, 7 deletions)

## Decisions Made

**PropertyReportResponse as new standard:** Replaces PropertyLookupResponse as the endpoint return type. Includes all Phase 3 sections (zoning, monuments, map_data, section_sources) while maintaining backward compatibility for core fields (address, building, cadastral_parcels, data_sources).

**Section-level source attribution:** New SectionSourceInfo provides granular cache metadata per report section. Enables frontend to display "Bestemmingsplan data van 2 dagen geleden" independently from "Monument data van 5 minuten geleden". Uses Dutch relative timestamps via freshness_display_nl property.

**force_refresh parameter:** Defaults to False for backward compatibility. When True, bypasses all caches (BAG, cadastral, zoning, monuments) and fetches fresh data from government APIs. Supports "Vernieuwen" button in frontend without affecting normal operation.

**Map data structure:** Includes both RD (EPSG:28992) and WGS84 (EPSG:4326) coordinates for map center. WGS84 enables direct use with OpenLayers/Leaflet. Collects all zoning geometries across all plans for map overlay rendering. Parcel geometries from cadastral data also included.

**Completeness score expansion:** Now 5 sections (was 3). Address always 1, building 0-1, parcels 0-1, zoning 0-1, monuments 0-1. Provides transparency about partial data availability without failing request.

**Coordinate transformation location:** RD to WGS84 transformation happens in aggregator (not in RCE client). RCE client keeps rd_to_wgs84 as utility function, but aggregator owns the conversion for map data. Prevents duplicate transformations and centralizes coordinate handling.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all implementations worked as expected.

## Next Phase Readiness

**Phase 3 Complete:** All 4 plans in zoning & monument intelligence finished. Property lookup endpoint now returns comprehensive intelligence report with:
- Address and building data (Phase 2)
- Cadastral parcels (Phase 2)
- Zoning rules and building dimensions (Phase 3)
- Monument status with multi-source conflict detection (Phase 3)
- Map data with coordinate transformation (Phase 3)
- Section-level source attribution with Dutch timestamps (Phase 3)

**Ready for Phase 4 (Bestemmingsplan AI):** Phase 4 will add Claude API integration for parsing bestemmingsplan PDFs when DSO API data is insufficient. The PropertyReportResponse schema already supports fallback_used flags and confidence indicators (MEDIUM/LOW for AI-parsed data).

**Frontend integration ready:** The endpoint now provides all data needed for frontend map rendering (WGS84 coordinates, geometries for parcels/zoning/property), data freshness display (Dutch timestamps per section), and cache refresh UX (force_refresh parameter).

**No blockers:** All government APIs operational, coordinate transformation working, parallel fetching optimized.

---
*Phase: 03-zoning-monument-intelligence*
*Completed: 2026-02-07*

## Self-Check: PASSED

All files created and commits verified successfully.
