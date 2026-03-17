# S13: Parcel Identity Unification

**Goal:** Add parcel_code column to parcel_cache, parcel_cache_id FK to parcel_favorites, and populate parcel_code at scan time.
**Demo:** Add parcel_code column to parcel_cache, parcel_cache_id FK to parcel_favorites, and populate parcel_code at scan time.

## Must-Haves


## Tasks

- [x] **T01: 111.1-parcel-identity-unification 01** `est:12min`
  - Add parcel_code column to parcel_cache, parcel_cache_id FK to parcel_favorites, and populate parcel_code at scan time.

Purpose: Unify the three identifier namespaces (BRK numeric in parcel_cache.parcel_id, PDOK display string in parcel_favorites.parcel_id, UUID in parcel_documents.parcel_id) so favorites can join to geometry/address/enrichment data.

Output: Alembic migration applied, models updated, new scans populate parcel_code automatically.
- [x] **T02: 111.1-parcel-identity-unification 02** `est:49min`
  - Backfill parcel_code for all existing parcel_cache rows via PDOK WFS batch lookup, then populate parcel_favorites.parcel_cache_id FK by joining on the now-shared display string.

Purpose: Without backfill, existing 137k rows have NULL parcel_code and the favorites FK is unpopulated. Portfolio queries that join favorites to geometry/address would return no data.

Output: CLI tool `python -m app.tools.backfill_parcel_code` that populates both columns, with progress logging and error handling.

## Files Likely Touched

- `backend/alembic/versions/i9d0e1f2g3h4_add_parcel_code_and_fk_columns.py`
- `backend/app/models/parcel_cache.py`
- `backend/app/models/parcel_favorite.py`
- `backend/app/jobs/area_scan.py`
- `backend/app/tools/backfill_parcel_code.py`
