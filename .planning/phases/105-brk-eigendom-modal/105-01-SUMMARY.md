---
phase: 105-brk-eigendom-modal
plan: 01
subsystem: api
tags: [brk, kadaster, eigendom, pdok, fastapi]

# Dependency graph
requires:
  - phase: 99-scan-pipeline-enrichment
    provides: "PDOK cadastral client and parcel cache infrastructure"
provides:
  - "GET /api/scans/parcels/{parcel_id}/eigendom endpoint for live BRK ownership lookup"
affects: [105-02-frontend-eigendom-modal]

# Tech tracking
tech-stack:
  added: []
  patterns: ["ephemeral BRK endpoint pattern: PDOK centroid resolution -> fetch_brk_ownership -> return without storage"]

key-files:
  created: []
  modified: [backend/app/scans/router.py]

key-decisions:
  - "No new schema needed: BRKOwnership already exists and serves as response type"
  - "Imports done locally inside endpoint to avoid circular deps and keep router imports lean"
  - "Uses existing pdok_cadastral_client module singleton for PDOK calls"

patterns-established:
  - "Ephemeral BRK endpoint: resolve ParcelCache UUID -> PostGIS centroid -> PDOK cadastral -> fetch_brk_ownership -> return JSON"

requirements-completed: [BRK-01]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 105 Plan 01: BRK Eigendom Endpoint Summary

**On-demand BRK ownership endpoint chaining PDOK centroid resolution with existing fetch_brk_ownership infrastructure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T20:37:22Z
- **Completed:** 2026-03-11T20:40:22Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- GET /api/scans/parcels/{parcel_id}/eigendom endpoint added to scans router
- Org-scoped multi-tenant security with ParcelCache ownership check
- Rate limited at 30/min to prevent BRK API abuse
- Ephemeral response: never cached, never stored (Kadaster Tier 3 compliance)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add eigendom endpoint to scans router** - `983c429` (feat)

## Files Created/Modified
- `backend/app/scans/router.py` - Added get_parcel_eigendom endpoint (~90 lines)

## Decisions Made
- No new schema needed in scans/schemas.py -- BRKOwnership from app.schemas.brk_ownership is the response type
- Local imports inside endpoint function to keep module-level imports clean
- Uses existing pdok_cadastral_client singleton at module level (already instantiated)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Endpoint ready for frontend integration in Plan 105-02
- BRK cert configuration required for actual ownership data (endpoint gracefully returns unavailable without it)

---
*Phase: 105-brk-eigendom-modal*
*Completed: 2026-03-12*
