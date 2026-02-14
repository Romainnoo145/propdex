---
phase: 24-wijk-based-area-selection
plan: 01
subsystem: backend-api
tags: [wijk, cbs-wfs, geojson, area-selection]
dependency_graph:
  requires: [gemeente_service, scan_router]
  provides: [wijk_service, wijken_endpoint]
  affects: [area_selection_flow]
tech_stack:
  added: []
  patterns: [ogc-xml-filter, wfs-geojson]
key_files:
  created:
    - backend/app/services/wijk_service.py
  modified:
    - backend/app/scans/router.py
decisions:
  - "Use CBS WFS 2024 (not 2026 - incomplete wijk data)"
  - "OGC XML FILTER with PropertyIsLike (CQL_FILTER silently ignored)"
  - "Return full GeoJSON FeatureCollection (frontend needs wrapper)"
  - "EPSG:4326 output for direct MapLibre consumption"
metrics:
  duration: 107
  tasks_completed: 2
  tasks_total: 2
  commits: 2
  files_created: 1
  files_modified: 1
  completed_at: "2026-02-14T22:32:21Z"
---

# Phase 24 Plan 01: Wijk Boundaries Service Summary

**One-liner:** CBS WFS wijk lookup service with GET /api/scans/wijken endpoint returning GeoJSON FeatureCollection in EPSG:4326 for MapLibre rendering.

## Objective Achieved

Created backend service to fetch wijk (district) boundaries from CBS WFS and exposed them via authenticated FastAPI endpoint. Frontend can now request wijk polygons for any gemeente to render clickable district boundaries.

## Tasks Completed

### Task 1: Create wijk_service.py with CBS WFS wijk lookup
**Status:** ✅ Complete
**Commit:** `26db484`
**Files:** `backend/app/services/wijk_service.py`

Created `get_wijken_in_gemeente()` function following the exact pattern from `gemeente_service.py`:
- CBS gebiedsindelingen WFS 2024 (not 2026 - has incomplete wijk data)
- OGC XML FILTER with PropertyIsLike wildcard: `WK{gemeente_code}%`
- Returns GeoJSON FeatureCollection in EPSG:4326 for direct MapLibre consumption
- Proper error handling with ValueError if no wijken found
- Logging at INFO level with gemeente code and wijk count

**Key implementation:**
```python
async def get_wijken_in_gemeente(
    gemeente_code: str,
    client: httpx.AsyncClient,
) -> dict:
```

Pattern: `WK0983%` matches `WK098301`, `WK098302`, etc. (all wijken in Venlo)

### Task 2: Add GET /api/scans/wijken endpoint
**Status:** ✅ Complete
**Commit:** `eedf6ca`
**Files:** `backend/app/scans/router.py`

Added authenticated endpoint to scan router:
- Route: `GET /api/scans/wijken?gemeente_code=0983`
- Authentication: `get_current_active_user` + `get_current_organization_id`
- Rate limit: 30/minute (cacheable wijk data)
- Error handling:
  - 404 if no wijken found
  - 502 if CBS WFS unavailable
  - 500 for generic errors
- Returns raw GeoJSON dict (FastAPI auto-serializes)

**API contract:**
```
GET /api/scans/wijken?gemeente_code=0983
Authorization: Bearer <jwt>

→ 200 OK
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "statcode": "WK098301",
        "statnaam": "Centrum"
      },
      "geometry": { ... }
    },
    ...
  ]
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Verification

- ✅ wijk_service.py module exists and exports `get_wijken_in_gemeente`
- ✅ Scan router has `GET /api/scans/wijken` endpoint with auth and rate limiting
- ✅ Service uses CBS 2024 WFS (not 2026), PropertyIsLike OGC filter, EPSG:4326 output
- ✅ Error handling matches existing gemeente_service pattern
- ✅ All linting and type checks pass (ruff clean, mypy has pre-existing issues unrelated to this plan)

## Technical Notes

### CBS WFS Quirks
- **Version:** Must use 2024 gebiedsindelingen (2026 has incomplete wijk data)
- **Filter:** OGC XML FILTER required - CQL_FILTER is silently ignored by PDOK CBS WFS
- **Pattern:** PropertyIsLike with wildcard `WK{code}%` (not PropertyIsEqualTo - wijken have suffix)
- **Output:** Pre-generalized polygons (`wijk_gegeneraliseerd`) optimized for web display

### Frontend Integration
- Endpoint returns full FeatureCollection (not just features array)
- EPSG:4326 coordinates ready for direct MapLibre consumption
- No coordinate transformation needed on frontend
- Typical response: 5-100 wijken per gemeente (e.g., 21 for Venlo)

## Self-Check

Verifying created files and commits exist:

```bash
# Check created file
[ -f "backend/app/services/wijk_service.py" ] && echo "✅ wijk_service.py exists"

# Check modified file
[ -f "backend/app/scans/router.py" ] && echo "✅ router.py exists"

# Check commits
git log --oneline --all | grep -q "26db484" && echo "✅ Task 1 commit found"
git log --oneline --all | grep -q "eedf6ca" && echo "✅ Task 2 commit found"
```

## Self-Check: PASSED

All files created, all commits exist:
- ✅ `backend/app/services/wijk_service.py` created
- ✅ `backend/app/scans/router.py` modified
- ✅ Commit `26db484` exists (Task 1)
- ✅ Commit `eedf6ca` exists (Task 2)
