---
phase: 03-zoning-monument-intelligence
plan: 03
subsystem: api
tags: [rce, rijksmonument, pyproj, coordinate-transformation, multi-source-aggregation, conflict-detection]

# Dependency graph
requires:
  - phase: 03-01
    provides: Monument schemas (MonumentStatus, MonumentSourceResult), cache manager with force_refresh
  - phase: 02-01
    provides: Cache infrastructure with get_cached_or_fetch, httpx AsyncClient pattern
provides:
  - RCE Rijksmonument API client with Solr geofilt spatial queries
  - Monument aggregator with multi-source conflict detection (RCE, BAG, Kadaster)
  - Coordinate transformation utilities (RD ↔ WGS84) via pyproj
  - Plain-language Dutch heritage restriction summaries
affects: [03-04-property-report-aggregator, 04-ai-zoning-parser]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Solr geofilt for spatial proximity queries with WGS84 coordinates"
    - "pyproj Transformer for RD (EPSG:28992) to WGS84 (EPSG:4326) conversion"
    - "Multi-source aggregation with asyncio.gather for parallel API calls"
    - "Conflict detection between government data sources"
    - "Standard guidance text summaries (not building-specific API data)"

key-files:
  created:
    - backend/app/government_apis/rce_monuments.py
    - backend/app/services/monument_aggregator.py
  modified: []

key-decisions:
  - "RCE Solr API uses WGS84 coordinates, requiring pyproj transformation from RD"
  - "Monument restrictions are standard guidance text per monument type (not building-specific from API)"
  - "Conflict detection compares definitive sources (is_monument not None)"
  - "Consensus status only when all sources agree (conservative approach)"
  - "BAG and Kadaster monument indicators not available in MVP (return error)"
  - "ANY source confirming monument status sets is_monument=True (conservative)"

patterns-established:
  - "Module-level pyproj Transformers initialized once for performance"
  - "Coordinate transformation functions (rd_to_wgs84, wgs84_to_rd) exported for reuse"
  - "Solr geofilt queries use lat,lon order in pt parameter"
  - "Dutch plain-language restriction summaries for user-facing display"

# Metrics
duration: 2 min
completed: 2026-02-07
---

# Phase 03 Plan 03: Monument Intelligence Summary

**RCE Rijksmonument API client with pyproj coordinate transformation and multi-source monument aggregator with conflict detection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T07:41:10Z
- **Completed:** 2026-02-07T07:43:01Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- RCE Rijksmonument API client querying Solr API with WGS84 geofilt (pyproj transformation from RD)
- Monument aggregator fetching from RCE, BAG, Kadaster in parallel with asyncio.gather
- Conflict detection when sources disagree on monument status
- Plain-language Dutch restriction summaries (4 restrictions for rijksmonument, 3 for gemeentelijk)
- Conservative approach: ANY source confirming monument sets is_monument=True

## Task Commits

Each task was committed atomically:

1. **Task 1: RCE Rijksmonument API client with coordinate transformation** - `ae34b2b` (feat)
2. **Task 2: Monument aggregation service with multi-source conflict detection** - `527d58d` (feat)

**Plan metadata:** (to be committed)

## Files Created/Modified

- `backend/app/government_apis/rce_monuments.py` - RCE Rijksmonument Solr API client with WGS84 geofilt queries, pyproj coordinate transformation (RD↔WGS84)
- `backend/app/services/monument_aggregator.py` - Multi-source monument aggregator with conflict detection, consensus logic, Dutch restriction summaries

## Decisions Made

**RCE coordinate transformation**: RCE Solr API requires WGS84 coordinates for geofilt queries. Dutch building coordinates are in RD (EPSG:28992). Added pyproj Transformer for RD to WGS84 conversion. Module-level transformers initialized once for performance.

**Standard guidance text summaries**: Monument restrictions are standard guidance per monument type (e.g., "omgevingsvergunning required for rijksmonument") rather than building-specific restrictions from API. Provides immediate user value without additional API complexity.

**Conservative conflict detection**: When sources disagree on monument status, has_conflict=True and consensus_status=None. Better to flag uncertainty than provide false consensus. Dutch conflict_note explains disagreement.

**ANY source confirms monument**: MonumentStatus.is_monument=True if ANY source says monument (conservative approach per decision #36 from STATE.md). Better to flag potential monument than miss heritage status.

**BAG/Kadaster MVP limitation**: BAG and Kadaster don't provide monument indicators in standard API fields. Return error message for MVP. Future implementation could check cached data if monument fields become available.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RCE monument client ready for property report aggregation (03-04)
- Coordinate transformation utilities available for future spatial queries
- Multi-source conflict detection pattern established for other data sources
- Monument restrictions ready for user-facing display
- Conservative monument detection protects users from missing heritage restrictions

Monument aggregation provides critical investment intelligence - a rijksmonument can add €200k-500k in renovation costs due to strict preservation requirements. Multi-source checking catches cases where one registry is outdated.

## Self-Check: PASSED

All key files verified present:
- ✓ backend/app/government_apis/rce_monuments.py
- ✓ backend/app/services/monument_aggregator.py

All commits verified in git log:
- ✓ ae34b2b (Task 1)
- ✓ 527d58d (Task 2)

---
*Phase: 03-zoning-monument-intelligence*
*Completed: 2026-02-07*
