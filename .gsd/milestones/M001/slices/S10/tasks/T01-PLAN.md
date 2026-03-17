# T01: 109-backend-foundation 01

**Slice:** S10 — **Milestone:** M001

## Description

Create the ParcelFavorite SQLAlchemy model, Alembic migration with RLS, and Pydantic schemas for the favorites + portfolio API.

Purpose: Establish the data layer that Plan 02 builds CRUD endpoints on top of.
Output: Model file, migration, schemas module, models/__init__.py registration.

## Must-Haves

- [ ] "parcel_favorites table exists in PostgreSQL with correct columns and constraints"
- [ ] "RLS policy tenant_isolation_parcel_favorites is active on parcel_favorites"
- [ ] "UniqueConstraint on (organization_id, user_id, parcel_id) prevents duplicate favorites"
- [ ] "ParcelFavorite model importable from app.models"
- [ ] "Pydantic schemas validate pipeline_stage against 5 allowed values"

## Files

- `backend/app/models/parcel_favorite.py`
- `backend/app/models/__init__.py`
- `backend/alembic/versions/h8c9d0e1f2g3_create_parcel_favorites_table.py`
- `backend/app/favorites/__init__.py`
- `backend/app/favorites/schemas.py`
