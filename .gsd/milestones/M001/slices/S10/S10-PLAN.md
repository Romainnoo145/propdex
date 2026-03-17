# S10: Backend Foundation

**Goal:** Create the ParcelFavorite SQLAlchemy model, Alembic migration with RLS, and Pydantic schemas for the favorites + portfolio API.
**Demo:** Create the ParcelFavorite SQLAlchemy model, Alembic migration with RLS, and Pydantic schemas for the favorites + portfolio API.

## Must-Haves


## Tasks

- [x] **T01: 109-backend-foundation 01** `est:8min`
  - Create the ParcelFavorite SQLAlchemy model, Alembic migration with RLS, and Pydantic schemas for the favorites + portfolio API.

Purpose: Establish the data layer that Plan 02 builds CRUD endpoints on top of.
Output: Model file, migration, schemas module, models/__init__.py registration.
- [x] **T02: 109-backend-foundation 02** `est:2min`
  - Create the favorites CRUD router (POST/GET/DELETE + PATCH pipeline) and the portfolio grouped-query endpoint, then register both routers in main.py.

Purpose: Complete the backend API so Phase 110 can build the frontend heart button and Phase 111 can build the portfolio navigation.
Output: Working API endpoints at /api/parcels/favorites and /api/portfolio.

## Files Likely Touched

- `backend/app/models/parcel_favorite.py`
- `backend/app/models/__init__.py`
- `backend/alembic/versions/h8c9d0e1f2g3_create_parcel_favorites_table.py`
- `backend/app/favorites/__init__.py`
- `backend/app/favorites/schemas.py`
- `backend/app/favorites/router.py`
- `backend/app/main.py`
