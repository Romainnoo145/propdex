---
phase: 37-scan-history-backend
plan: 01
subsystem: api
tags: [fastapi, sqlalchemy, pagination, multi-tenant, scans]

# Dependency graph
requires:
  - phase: 36-ux-redesign
    provides: existing AreaScan model and scans router/service/schemas foundation
provides:
  - GET /api/scans paginated endpoint returning scan history with gemeente/wijk metadata and parcel count
  - ScanListItem and ScanListResponse Pydantic schemas
  - list_scans() service function with COUNT(scan_results) subquery
affects: [38-scan-history-frontend, plan-02-scan-history-project-filter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scalar subquery pattern: COUNT(scan_results) correlated subquery for accurate parcel counts"
    - "Count-from-subquery pattern: select(func.count()).select_from(query.subquery()) to share filters"
    - "Query alias pattern: Query(alias='status') so URL reads ?status= not ?status_filter="

key-files:
  created: []
  modified:
    - backend/app/scans/schemas.py
    - backend/app/scans/service.py
    - backend/app/scans/router.py

key-decisions:
  - "Use COUNT(scan_results) not parcels_total for parcel_count -- parcels_total reflects discovered parcels before qualification, scan_results count is actual qualifying results"
  - "Derive count query from main query subquery to automatically share filters (avoid duplication)"
  - "Accept optional project_id in list_scans() so Plan 37-02 can reuse the same function"
  - "Place GET '' before POST '' in router to avoid route ordering ambiguity"

patterns-established:
  - "Route ordering: static GET '' must come before POST '' and dynamic /{scan_id} routes"
  - "Pagination cap: min(limit, 100) enforced in router before service call"

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 37 Plan 01: Scan History Backend Summary

**GET /api/scans paginated endpoint returning scan history with COUNT(scan_results) subquery for accurate parcel counts, organization-scoped with optional status filter**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T06:17:59Z
- **Completed:** 2026-02-19T06:22:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added ScanListItem and ScanListResponse Pydantic schemas covering all required fields
- Added list_scans() service function with correlated COUNT(scan_results) subquery and shared-filter count query
- Added GET /api/scans endpoint as first route in router with pagination, status filter, and multi-tenant isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ScanListItem/ScanListResponse schemas and list_scans service** - `1d41795` (feat)
2. **Task 2: Add GET /api/scans list endpoint to router** - `1e1db1e` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `backend/app/scans/schemas.py` - Added ScanListItem (8 fields) and ScanListResponse (4 fields) schemas after ParcelEnrichmentResponse
- `backend/app/scans/service.py` - Added list_scans() returning (AreaScan, parcel_count) tuples with pagination and optional filters
- `backend/app/scans/router.py` - Added GET '' as first route with ScanListItem/ScanListResponse imports, Query(alias='status') param

## Decisions Made

- Used COUNT(scan_results) not parcels_total: parcels_total is set during scan to reflect all discovered parcels, but scan_results only holds qualified results. Using COUNT(scan_results) shows the actual useful output count.
- Count query derived from main query subquery: ensures filter conditions (project_id, status_filter, organization_id) are automatically shared without duplication.
- Optional project_id parameter in list_scans() service: Plan 37-02 adds project-scoped scan listing, this parameter enables reuse without changes.
- Query(alias="status") for status_filter: keeps Python name distinct from built-in `status` while exposing clean ?status= URL parameter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Existing mypy errors in the codebase are pre-existing and unrelated to this plan (missing type stubs for openpyxl/shapely, untyped dict/tuple generics in older files).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GET /api/scans endpoint ready for Plan 37-02 (project-scoped filter extension)
- Schema types ready for Plan 38 frontend scan history page
- list_scans() accepts optional project_id -- Plan 37-02 only needs to wire it to the router

## Self-Check: PASSED

All files verified present. All commits verified in git log. All key patterns verified in source files.

---
*Phase: 37-scan-history-backend*
*Completed: 2026-02-19*
