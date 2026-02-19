---
phase: 37-scan-history-backend
plan: "02"
subsystem: api
tags: [fastapi, sqlalchemy, multi-tenant, projects, scans, pagination]

# Dependency graph
requires:
  - phase: 37-01
    provides: "list_scans() service function with optional project_id filter and ScanListResponse schema"
provides:
  - "GET /api/projects/{project_id}/scans sub-resource endpoint"
  - "Project-scoped scan history with multi-tenant isolation"
affects: [frontend-scan-history, scan-history-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sub-resource endpoint pattern: verify parent ownership (404) then query child resource via service layer"
    - "404 not 403 for cross-org project access -- prevents resource enumeration"

key-files:
  created: []
  modified:
    - backend/app/projects/router.py

key-decisions:
  - "404 not 403 for cross-org projects -- consistent with get_project endpoint, prevents enumeration"
  - "Reuse scan_service.list_scans(project_id=...) -- no code duplication, same multi-tenant guarantees"
  - "list_project_scans placed after GET /{project_id} and before PATCH /{project_id} -- keeps read operations grouped, /{project_id}/scans is more specific so route matching works correctly"

patterns-established:
  - "Sub-resource pattern: parent ownership check first (project -> org), then child query via service layer"

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 37 Plan 02: Scan History Backend Summary

**REST sub-resource endpoint GET /api/projects/{project_id}/scans returning ScanListResponse filtered by project_id with multi-tenant project ownership verification**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T06:27:23Z
- **Completed:** 2026-02-19T06:33:58Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments
- Added `list_project_scans` endpoint to `projects/router.py` with rate limiting (60/minute)
- Project ownership verified via 404 before returning scans (prevents resource enumeration)
- Reuses `scan_service.list_scans(project_id=project_id)` -- no code duplication
- Same `ScanListResponse` schema as `GET /api/scans` for frontend consistency
- Pagination: offset=0, limit=50 default, capped at 100

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /api/projects/{project_id}/scans sub-resource endpoint** - `0d58c49` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/projects/router.py` - Added `list_project_scans` endpoint + imports for scan service and schemas

## Decisions Made
- 404 not 403 for cross-org projects: consistent with existing `get_project` endpoint pattern, prevents enumeration
- Placed after `GET /{project_id}` and before `PATCH /{project_id}` so route matching resolves `/{project_id}/scans` correctly (more specific path wins)
- No limit query parameter type annotation needed -- FastAPI coerces int from query string automatically

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure: `test_refresh_token_reuse_detection` (auth backend issue documented in STATE.md as FIX-01 for Phase 41). Confirmed failure predates this plan via git stash check.
- Pre-existing mypy errors in `app/scans/service.py`, `app/models/`, `app/auth/` -- zero errors in `app/projects/router.py`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both Phase 37 plans complete: GET /api/scans and GET /api/projects/{id}/scans both shipped
- Phase 38 (map visualization) can proceed -- scan history backend is complete
- Frontend can now fetch project-scoped scan history via the new sub-resource endpoint

## Self-Check: PASSED
- `backend/app/projects/router.py` exists: FOUND
- Commit `0d58c49` exists: FOUND

---
*Phase: 37-scan-history-backend*
*Completed: 2026-02-19*
