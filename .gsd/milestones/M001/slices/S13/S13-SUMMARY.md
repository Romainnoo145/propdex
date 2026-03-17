---
id: S13
parent: M001
milestone: M001
provides:
  - "parcel_code VARCHAR(50) nullable column in parcel_cache table"
  - "parcel_cache_id UUID nullable FK in parcel_favorites pointing to parcel_cache.id"
  - "Scan-time parcel_code derivation from PDOK WFS feature properties"
  - "CLI backfill tool (python -m app.tools.backfill_parcel_code)"
  - "99.97% parcel_code coverage on queryable 14-digit Kadaster IDs"
  - "100% FK linkage for existing parcel_favorites"
requires: []
affects: []
key_files:
  - backend/alembic/versions/i9d0e1f2g3h4_add_parcel_code_and_fk_columns.py
  - backend/app/models/parcel_cache.py
  - backend/app/models/parcel_favorite.py
  - backend/app/jobs/area_scan.py
  - backend/app/tools/backfill_parcel_code.py
key_decisions:
  - "parcel_code is display-only (space-separated); parcel_id remains BRK numeric dashes ID"
  - "No UniqueConstraint on (org, parcel_code) yet — deferred until backfill confirms no duplicates/nulls"
  - "PDOK OGC API (api.pdok.nl) not WFS (service.pdok.nl) — OGC supports identificatie_lokaal_id filter param directly"
  - "16-digit BAG pand IDs skipped — they are NOT Kadaster OGC IDs"
  - "parcel_code coverage is 50.8% overall but 99.97% of queryable 14-digit rows resolved"
patterns_established:
  - "PDOK OGC API batch lookup with asyncio.Semaphore(10) and 0.5s batch sleep"
  - "Two-phase backfill: Phase 1 populates parcel_code, Phase 2 joins FK"
observability_surfaces: []
drill_down_paths: []
duration: 61min
verification_result: passed
completed_at: 2026-03-16
blocker_discovered: false
---
# S13: Parcel Identity Unification

**Unified parcel identifiers across parcel_cache, parcel_favorites, and parcel_documents via parcel_code column + FK backfill**

## What Happened

Added parcel_code column to parcel_cache and parcel_cache_id FK to parcel_favorites, enabling favorites to join to geometry/address/enrichment data. Backfilled 63,796 rows (99.97% of queryable 14-digit Kadaster IDs) via PDOK OGC API batch lookup.

## Accomplishments
- Alembic migration adding parcel_code VARCHAR(50) + parcel_cache_id UUID FK with proper indexes
- Scan-time parcel_code derivation from PDOK WFS properties (kadastrale_gemeente_waarde + sectie + perceelnummer)
- CLI backfill tool with PDOK OGC API batch lookup, semaphore concurrency, and two-phase execution
- 100% FK linkage for existing parcel_favorites to parcel_cache
- JOIN between parcel_favorites and parcel_cache confirmed working in live DB

## Files Created/Modified
- `backend/alembic/versions/i9d0e1f2g3h4_add_parcel_code_and_fk_columns.py` — Migration
- `backend/app/models/parcel_cache.py` — Added parcel_code column + composite index
- `backend/app/models/parcel_favorite.py` — Added parcel_cache_id FK
- `backend/app/jobs/area_scan.py` — Scan-time parcel_code population
- `backend/app/tools/backfill_parcel_code.py` — CLI backfill tool

---
*Phase: 111.1-parcel-identity-unification*
*Completed: 2026-03-16*
