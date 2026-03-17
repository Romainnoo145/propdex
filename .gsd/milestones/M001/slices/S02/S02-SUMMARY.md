---
id: S02
parent: M001
milestone: M001
provides:
  - "GeoContextualizer service (extract_gemeente_from_text, extract_uitkomst)"
  - "RulingCache with extracted_gemeente and uitkomst columns"
  - "RVS ruling ingestion support"
  - "GET /rulings/{gemeente_naam} with geo-relevance sorting and win/loss aggregation"
  - "useGemeenteRulingsFeed hook for auto-populated ruling feed"
  - "Feed-driven JurisprudenceSection (no search input)"
  - "Win/loss ratio bar with color-coded percentages"
  - "Geo-relevance badges (gemeente vs arrondissement)"
requires: []
affects: []
key_files: []
key_decisions:
  - "Progressive word-prefix matching instead of suffix stripping for gemeente candidate validation"
  - "RVS rulings use gemeente_query=None (national scope) but still geo-tagged via text extraction"
  - "Shared Semaphore(5) for combined rechtbank + RVS document fetching"
  - "Geo-relevance computed at query time via SQLAlchemy case(), not stored on model"
  - "Win/loss aggregation done in Python after fetch, not as separate SQL aggregate query"
  - "Feed replaces search entirely in JurisprudenceSection -- search moves to Phase 85 Explorer"
patterns_established:
  - "Word-prefix matching: try progressively shorter word prefixes against known set for fuzzy extraction"
  - "Geo-extraction at ingestion time, not query time -- results persisted on ruling_cache"
  - "Feed-driven component: useGemeenteRulingsFeed replaces useJurisprudenceSearch for auto-populated views"
  - "GeoRelevanceBadge: emerald dot for gemeente-level, grey dot for arrondissement-level"
observability_surfaces: []
drill_down_paths: []
duration: 3min
verification_result: passed
completed_at: 2026-03-07
blocker_discovered: false
---
# S02: Geo Contextualization Feed

**# Phase 83 Plan 01: Geo Contextualization Service Summary**

## What Happened

# Phase 83 Plan 01: Geo Contextualization Service Summary

**Regex-based gemeente extraction from legal text with 342-gemeente validation, uitkomst keyword classifier, and RVS ruling ingestion**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T15:19:29Z
- **Completed:** 2026-03-07T15:22:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- GeoContextualizer extracts gemeente names from Dutch legal text using 5 regex patterns validated against 342 known gemeenten
- Uitkomst keyword matching classifies rulings as toegewezen/afgewezen/gedeeltelijk/onbekend
- RVS (Raad van State) rulings fetched in second pass and geo-tagged via text extraction
- Alembic migration adds indexed extracted_gemeente and uitkomst columns to ruling_cache

## Task Commits

Each task was committed atomically:

1. **Task 1: GeoContextualizer service + RulingCache migration** - `1a0112c` (feat)
2. **Task 2: Integrate GeoContextualizer into ingestion job + RVS support** - `dee7e47` (feat)

## Files Created/Modified
- `backend/app/services/geo_contextualizer.py` - Extract gemeente and uitkomst from ruling text
- `backend/app/models/ruling_cache.py` - Added extracted_gemeente and uitkomst columns
- `backend/alembic/versions/d44ef8c851c9_add_geo_columns_to_ruling_cache.py` - Migration for new columns
- `backend/app/jobs/ruling_ingestion.py` - Integrated geo-extraction + RVS ruling fetch pass

## Decisions Made
- Used progressive word-prefix matching (try "Amsterdam heeft besloten" -> "Amsterdam heeft" -> "Amsterdam") instead of suffix stripping, which handles arbitrary trailing text more robustly
- RVS rulings stored with gemeente_query=None since they are national scope, but still geo-tagged via text extraction
- Single shared Semaphore(5) for all document fetching (rechtbank + RVS combined)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed gemeente candidate cleaning approach**
- **Found during:** Task 1 (GeoContextualizer service)
- **Issue:** Suffix-stripping approach failed for multi-word trailing text (e.g., "Amsterdam heeft besloten")
- **Fix:** Replaced suffix stripping with progressive word-prefix matching against known gemeenten set
- **Files modified:** backend/app/services/geo_contextualizer.py
- **Verification:** All test assertions pass including "gemeente Amsterdam heeft besloten" -> "Amsterdam"
- **Committed in:** 1a0112c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** More robust gemeente extraction. No scope creep.

## Issues Encountered
- Alembic autogenerate detected many unrelated PostGIS tiger tables for removal -- cleaned migration to only include the two new columns

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GeoContextualizer ready for Phase 83 Plan 02 (geo-relevance sorting + feed endpoint)
- extracted_gemeente column indexed for efficient gemeente-based queries
- Uitkomst classification available for feed filtering

---
*Phase: 83-geo-contextualization-feed*
*Completed: 2026-03-07*

# Phase 83 Plan 02: Geo Contextualization Feed Summary

**Auto-populated ruling feed with geo-relevance sorting (gemeente-first) and win/loss ratio bar replacing search-driven jurisprudence section**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T15:25:27Z
- **Completed:** 2026-03-07T15:28:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- GET /rulings/{gemeente_naam} returns rulings sorted by geo-relevance with win/loss aggregation
- JurisprudenceSection auto-populates from cached rulings without search input
- Geo-relevance badges distinguish gemeente-matched from arrondissement-level rulings
- Win/loss ratio displayed as color-coded percentage pills (emerald/red/amber/grey)
- Ingestion status indicators for pending/refreshing states

## Task Commits

Each task was committed atomically:

1. **Task 1: Feed endpoint with geo-relevance sorting and win/loss ratio** - `e351580` (feat)
2. **Task 2: Frontend feed hook and JurisprudenceSection rewrite** - `c435f25` (feat)

## Files Created/Modified
- `backend/app/api/endpoints/jurisprudence.py` - Added geo-relevance sorting via SQLAlchemy case(), win/loss aggregation, extracted_gemeente/geo_relevance/uitkomst in response
- `frontend/src/lib/api.ts` - Added GemeenteRulingsFeedItem, WinLossRatio, GemeenteRulingsFeedResponse types and getGemeenteRulingsFeed API binding
- `frontend/src/hooks/useJurisprudence.ts` - Added useGemeenteRulingsFeed hook with 5min stale time
- `frontend/src/components/projects/JurisprudenceSection.tsx` - Replaced search-driven section with feed-driven, added WinLossBar and GeoRelevanceBadge components

## Decisions Made
- Geo-relevance computed at query time via SQLAlchemy case(), not stored on model -- keeps model clean, computation is cheap
- Win/loss aggregation done in Python after fetch rather than separate SQL query -- single query pattern, small result sets
- Feed replaces search entirely in JurisprudenceSection -- search UX moves to Phase 85 Explorer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Feed endpoint and frontend complete for Phase 83
- Phase 84 (AI Analysis Doorlooptijd) can proceed -- analysis flow preserved
- Phase 85 (Explorer UI) will add search-based exploration on top of feed

---
*Phase: 83-geo-contextualization-feed*
*Completed: 2026-03-07*
