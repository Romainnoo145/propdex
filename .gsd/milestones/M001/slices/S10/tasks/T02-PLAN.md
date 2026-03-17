# T02: 109-backend-foundation 02

**Slice:** S10 — **Milestone:** M001

## Description

Create the favorites CRUD router (POST/GET/DELETE + PATCH pipeline) and the portfolio grouped-query endpoint, then register both routers in main.py.

Purpose: Complete the backend API so Phase 110 can build the frontend heart button and Phase 111 can build the portfolio navigation.
Output: Working API endpoints at /api/parcels/favorites and /api/portfolio.

## Must-Haves

- [ ] "POST /api/parcels/favorites creates a favorite scoped to org + user and returns 201"
- [ ] "POST /api/parcels/favorites with existing parcel_id returns 200 with the existing favorite (idempotent)"
- [ ] "GET /api/parcels/favorites returns only the current user's favorites for the current org"
- [ ] "DELETE /api/parcels/favorites/{parcel_id} removes the favorite and returns 204; subsequent GET no longer lists it"
- [ ] "PATCH /api/parcels/favorites/{parcel_id}/pipeline updates pipeline_stage; 422 for invalid stage values"
- [ ] "GET /api/portfolio returns all favorites grouped by gemeente/wijk with per-level counts in a single query (no N+1); provincie grouping is derived by the frontend from gemeente_code using CBS GeoJSON"

## Files

- `backend/app/favorites/router.py`
- `backend/app/main.py`
