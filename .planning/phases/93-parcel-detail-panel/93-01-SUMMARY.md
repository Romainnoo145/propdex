---
phase: 93-parcel-detail-panel
plan: 01
subsystem: api
tags: [pdok, wms, aerial-imagery, react-query, blob-url]

requires:
  - phase: 92-viewport-layout
    provides: "Aura layout with 420px panel width"
provides:
  - "GET /api/scans/parcels/{id}/aerial-crop returns 840x360 JPEG"
  - "useAerialCrop React Query hook returning blob URL"
affects: [93-02, 93-03]

tech-stack:
  added: []
  patterns:
    - "PDOK WMS proxy with retina dimensions (2x display size)"

key-files:
  created: []
  modified:
    - backend/app/scans/router.py

key-decisions:
  - "Updated aerial crop from 760x320 to 840x360 to match new 420px panel width"

patterns-established:
  - "Aerial crop aspect ratio 7:3 (420:180) for parcel detail hero"

requirements-completed: [API-01]

duration: 1min
completed: 2026-03-10
---

# Phase 93 Plan 01: Aerial Crop API Summary

**PDOK WMS aerial crop endpoint updated to 840x360 retina dimensions for 420px parcel detail panel**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-10T13:28:52Z
- **Completed:** 2026-03-10T13:30:05Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Updated backend aerial crop endpoint dimensions from 760x320 to 840x360 (retina 2x of 420x180)
- Adjusted BBOX aspect ratio from 380:160 to 420:180 (7:3)
- Verified frontend useAerialCrop hook and fetchAerialCrop API helper already present and working

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend aerial crop endpoint** - `9e936e9` (feat)
2. **Task 2: Frontend useAerialCrop hook verification** - No changes needed (hook already exists and compiles)

## Files Created/Modified
- `backend/app/scans/router.py` - Updated aerial crop dimensions to 840x360 and BBOX ratio to 7:3

## Decisions Made
- Updated aerial crop from 760x320 to 840x360 to match new 420px panel width (was 380px)
- Frontend hook and API helper confirmed correct -- no modifications needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in SideRailNav.tsx (undefined values cast to Record<string, string>) -- out of scope, not related to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Aerial crop endpoint ready for use in ParcelDetailPanel hero image (93-02)
- useAerialCrop hook importable for the panel component

---
*Phase: 93-parcel-detail-panel*
*Completed: 2026-03-10*
