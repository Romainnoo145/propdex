# T01: 83-geo-contextualization-feed 01

**Slice:** S02 — **Milestone:** M001

## Description

Build the GeoContextualizer service that extracts gemeente names from ruling text, add extracted_gemeente and uitkomst columns to RulingCache via Alembic migration, and integrate geo-extraction into the ruling ingestion pipeline including RVS ruling support.

Purpose: Enable geo-relevance sorting in Phase 83 Plan 02 by persisting extracted location data on each cached ruling during ingestion rather than at query time.
Output: GeoContextualizer service, updated RulingCache model, updated ingestion job with RVS support.

## Must-Haves

- [ ] "GeoContextualizer extracts gemeente names from ruling text using regex patterns"
- [ ] "Extracted gemeente names are validated against known CBS/ECLI gemeente set (342 entries)"
- [ ] "ECLI prefix provides arrondissement-level scoping, text extraction adds gemeente-level precision"
- [ ] "RVS rulings are geo-tagged via text extraction despite having no geographic ECLI indicator"
- [ ] "Geo-extraction runs during ingestion (not query time) and results are persisted"

## Files

- `backend/app/services/geo_contextualizer.py`
- `backend/app/models/ruling_cache.py`
- `backend/alembic/versions/xxx_add_geo_columns_to_ruling_cache.py`
- `backend/app/jobs/ruling_ingestion.py`
