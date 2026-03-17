# T01: 111.1-parcel-identity-unification 01

**Slice:** S13 — **Milestone:** M001

## Description

Add parcel_code column to parcel_cache, parcel_cache_id FK to parcel_favorites, and populate parcel_code at scan time.

Purpose: Unify the three identifier namespaces (BRK numeric in parcel_cache.parcel_id, PDOK display string in parcel_favorites.parcel_id, UUID in parcel_documents.parcel_id) so favorites can join to geometry/address/enrichment data.

Output: Alembic migration applied, models updated, new scans populate parcel_code automatically.

## Must-Haves

- [ ] "parcel_cache table has a parcel_code VARCHAR(50) nullable column"
- [ ] "parcel_favorites table has a parcel_cache_id UUID nullable FK column"
- [ ] "New scans populate parcel_code at scan time from PDOK feature properties"
- [ ] "SQLAlchemy models match the migrated schema"

## Files

- `backend/alembic/versions/i9d0e1f2g3h4_add_parcel_code_and_fk_columns.py`
- `backend/app/models/parcel_cache.py`
- `backend/app/models/parcel_favorite.py`
- `backend/app/jobs/area_scan.py`
