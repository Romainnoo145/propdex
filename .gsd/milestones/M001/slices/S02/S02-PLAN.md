# S02: Geo Contextualization Feed

**Goal:** Build the GeoContextualizer service that extracts gemeente names from ruling text, add extracted_gemeente and uitkomst columns to RulingCache via Alembic migration, and integrate geo-extraction into the ruling ingestion pipeline including RVS ruling support.
**Demo:** Build the GeoContextualizer service that extracts gemeente names from ruling text, add extracted_gemeente and uitkomst columns to RulingCache via Alembic migration, and integrate geo-extraction into the ruling ingestion pipeline including RVS ruling support.

## Must-Haves


## Tasks

- [x] **T01: 83-geo-contextualization-feed 01** `est:3min`
  - Build the GeoContextualizer service that extracts gemeente names from ruling text, add extracted_gemeente and uitkomst columns to RulingCache via Alembic migration, and integrate geo-extraction into the ruling ingestion pipeline including RVS ruling support.

Purpose: Enable geo-relevance sorting in Phase 83 Plan 02 by persisting extracted location data on each cached ruling during ingestion rather than at query time.
Output: GeoContextualizer service, updated RulingCache model, updated ingestion job with RVS support.
- [x] **T02: 83-geo-contextualization-feed 02** `est:3min`
  - Upgrade the GET /rulings/{gemeente_naam} endpoint with geo-relevance sorting and win/loss aggregation, then replace the search-driven JurisprudenceSection frontend with an auto-populated feed driven by cached rulings.

Purpose: Users see relevant court rulings automatically when viewing a gemeente, sorted by geographic relevance (gemeente-matched first), with win/loss ratio visible at a glance.
Output: Updated feed endpoint, new useGemeenteRulingsFeed hook, feed-driven JurisprudenceSection.

## Files Likely Touched

- `backend/app/services/geo_contextualizer.py`
- `backend/app/models/ruling_cache.py`
- `backend/alembic/versions/xxx_add_geo_columns_to_ruling_cache.py`
- `backend/app/jobs/ruling_ingestion.py`
- `backend/app/api/endpoints/jurisprudence.py`
- `frontend/src/hooks/useJurisprudence.ts`
- `frontend/src/components/projects/JurisprudenceSection.tsx`
- `frontend/src/lib/api.ts`
