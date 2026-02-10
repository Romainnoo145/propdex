# Plan 21-04 Summary: PostGIS MVT Tile Endpoint

## Result: COMPLETE

**Tasks:** 2/2
**Commits:** 2
**Duration:** ~3 minutes

## What Was Built

### Task 1: Martin Docker + PostGIS Tile Proxy
- **docker-compose.yml**: Added Martin tile server service (optional, for dev/debug)
- **backend/app/core/config.py**: Added `MARTIN_TILE_URL` setting
- **backend/app/services/tile_proxy.py** (118 lines): `generate_mvt_tile()` function using PostGIS ST_AsMVT with multi-tenant filtering

### Task 2: Tile Endpoint + Frontend Helper
- **backend/app/scans/router.py**: Added `GET /api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf` endpoint with auth + org filtering + 120/min rate limit
- **frontend/src/lib/api.ts**: `getScanTileUrl()` helper (added by parallel 21-05 agent)

## Key Decisions
- **21-04:** PostGIS ST_AsMVT directly instead of Martin proxy (better security -- SQL WHERE filters by organization_id)
- **21-04:** Martin kept in docker-compose as optional dev tool, not used in production tile path
- **21-04:** CROSS JOIN bounds pattern for ST_AsMVT with explicit ST_Intersects filter
- **21-04:** 1-hour Cache-Control on tile responses (scan results are immutable)

## Deviations
- Frontend `getScanTileUrl` was already added by the parallel 21-05 agent -- no duplicate needed

## Self-Check: PASSED
- [x] tile_proxy.py imports successfully
- [x] Backend ruff check passes
- [x] Frontend npm run check passes
- [x] 2 atomic commits created

## Key Files

### key-files.created
- backend/app/services/tile_proxy.py

### key-files.modified
- docker-compose.yml
- backend/app/core/config.py
- backend/app/scans/router.py
