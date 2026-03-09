---
phase: 93-parcel-detail-panel
plan: 01
subsystem: api
tags: [pdok, wms, aerial-imagery, react-query, blob-url]

# Dependency graph
requires: []
provides:
  - "GET /api/scans/parcels/{id}/aerial-crop endpoint returning JPEG"
  - "useAerialCrop React Query hook returning blob URL"
  - "fetchAerialCrop API helper with graceful null fallback"
affects: [93-02-parcel-detail-panel]

# Tech tracking
tech-stack:
  added: []
  patterns: ["PDOK WMS proxy pattern for image endpoints", "Blob URL hook pattern for binary responses"]

key-files:
  created: []
  modified:
    - backend/app/scans/router.py
    - frontend/src/lib/api.ts
    - frontend/src/hooks/useScans.ts

key-decisions:
  - "PDOK WMS proxied through backend to maintain auth boundary and avoid CORS"
  - "760x320 retina resolution (2x of 380x160 display size) for crisp hero images"
  - "fetchAerialCrop uses raw fetch instead of apiFetch since response is binary, not JSON"

patterns-established:
  - "Binary image proxy: backend fetches external image, returns Response with Cache-Control"
  - "Blob URL hook: useQuery returns createObjectURL(blob) for img src binding"

requirements-completed: [API-01]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 93 Plan 01: Aerial Crop API Summary

**PDOK WMS aerial crop proxy endpoint with React Query blob URL hook for parcel hero images**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T23:38:51Z
- **Completed:** 2026-03-09T23:41:18Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Backend endpoint proxies PDOK Actueel_orthoHR WMS to return JPEG centered on parcel centroid
- Frontend hook returns blob URL with 24h stale time matching backend Cache-Control
- Multi-tenant security enforced via organization_id filter on parcel lookup

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend aerial crop endpoint** - `c461473` (feat)
2. **Task 2: Frontend useAerialCrop hook + API helper** - `4567430` (feat)

## Files Created/Modified
- `backend/app/scans/router.py` - Added get_aerial_crop endpoint at /parcels/{parcel_id}/aerial-crop
- `frontend/src/lib/api.ts` - Added fetchAerialCrop function returning blob URL or null
- `frontend/src/hooks/useScans.ts` - Added useAerialCrop hook with 24h staleTime and retry:1

## Decisions Made
- Proxied PDOK WMS through backend to keep auth boundary clean and avoid browser CORS issues
- Used 760x320 (retina 2x) with BBOX of 150m x ~63m for good context around parcel
- fetchAerialCrop uses raw fetch (not apiFetch) since response is binary JPEG, not JSON
- Graceful null fallback on any error -- hero image is non-critical UI element

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- useAerialCrop hook ready for import in ParcelDetailPanel (Plan 02)
- Endpoint is rate-limited at 60/min and cached for 24h

---
*Phase: 93-parcel-detail-panel*
*Completed: 2026-03-10*
