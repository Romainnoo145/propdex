---
phase: 05-report-management
plan: 02
subsystem: api
tags: [fastapi, sqlalchemy, crud, rest-api, multi-tenant, rate-limiting, soft-delete]

# Dependency graph
requires:
  - phase: 05-01
    provides: SavedReport and Project models with JSONB storage, schemas, migration
  - phase: 04-04
    provides: PropertyReportResponse schema for report_data validation
  - phase: 01-02
    provides: JWT authentication and tenant middleware

provides:
  - Report CRUD service layer with active_reports_query helper
  - 9 report API endpoints (save, list, get, delete, restore, update notes, assign project, refresh)
  - 5 project API endpoints (create, list, get, update, delete)
  - Report filtering by city, project, search query with sorting
  - Project list with report counts via subquery

affects: [05-03, frontend-integration, report-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "active_reports_query() helper prevents deleted report leakage"
    - "Report service layer centralizes query logic for all endpoints"
    - "Project delete hard-deletes with FK SET NULL for reports"
    - "Report list supports ILIKE search, city/project filters, multi-field sorting"
    - "Completeness score extracted from JSONB report_data"

key-files:
  created:
    - backend/app/reports/__init__.py
    - backend/app/reports/service.py
    - backend/app/reports/router.py
    - backend/app/projects/__init__.py
    - backend/app/projects/router.py
  modified:
    - backend/app/main.py

key-decisions:
  - "active_reports_query() helper ensures all list/get operations filter deleted_at IS NULL"
  - "Report list completeness_score extracted from JSONB report_data field"
  - "Project list includes report_count via subquery for efficient aggregation"
  - "Rate limiting: 30/min writes, 60/min reads, 10/min refresh (stricter for API-triggering ops)"
  - "Error handling: ValueError->400, HTTPException pass-through, generic->500"

patterns-established:
  - "Service layer pattern: router calls service functions for all business logic"
  - "Centralized query helpers: active_reports_query() for consistent filtering"
  - "Report refresh endpoint (PUT) accepts fresh PropertyReportResponse and updates JSONB"
  - "Project deletion hard-deletes with FK SET NULL (projects don't need soft-delete)"

# Metrics
duration: 3m 39s
completed: 2026-02-07
---

# Phase 05 Plan 02: CRUD Endpoints Summary

**Report CRUD API with save, list, get, delete, restore, notes, project assignment, and refresh endpoints; project folders with report counts**

## Performance

- **Duration:** 3 minutes 39 seconds
- **Started:** 2026-02-07T10:45:28Z
- **Completed:** 2026-02-07T10:49:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created report service layer with 9 CRUD functions and active_reports_query() helper for tenant-filtered active reports
- Implemented 9 report API endpoints covering full lifecycle: save with validation, list with filters/search/sort, get detail, soft-delete, restore, update notes, assign to project, refresh data
- Implemented 5 project API endpoints with report count aggregation via subquery
- All endpoints authenticated, tenant-isolated, and rate-limited (30/min writes, 60/min reads, 10/min refresh)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create report service layer with CRUD operations** - `c045066` (feat)
2. **Task 2: Create report and project API routers with endpoint registration** - `b6d1de3` (feat)

## Files Created/Modified

- `backend/app/reports/__init__.py` - Report management module init
- `backend/app/reports/service.py` - Report CRUD service with save_report, list_reports (filters/search/sort), get_report, soft_delete_report, restore_report, update_report_notes, assign_report_to_project, update_report_data, get_distinct_cities
- `backend/app/reports/router.py` - 9 report endpoints (POST save, GET list, GET cities, GET detail, DELETE soft-delete, POST restore, PATCH notes, PATCH project, PUT refresh)
- `backend/app/projects/__init__.py` - Project folder module init
- `backend/app/projects/router.py` - 5 project endpoints (POST create, GET list with report_count, GET detail, PATCH update, DELETE hard-delete)
- `backend/app/main.py` - Register reports_router and projects_router

## Decisions Made

1. **active_reports_query() centralized helper** - All list/get operations use this helper to filter deleted_at IS NULL, preventing deleted report leakage and ensuring consistent tenant isolation
2. **Completeness score from JSONB** - Report list extracts completeness_score from report_data JSONB field rather than denormalizing it to a column (follows pattern from Phase 4)
3. **Project list report count** - Uses subquery with scalar_subquery() for efficient aggregation without N+1 queries
4. **Rate limiting tiers** - 30/min for writes, 60/min for reads, 10/min for refresh (stricter because refresh may trigger fresh API calls)
5. **Hard delete projects** - Projects don't need soft-delete (simpler model); FK SET NULL handles report cleanup automatically
6. **Error handling pattern** - ValueError (validation) -> 400, HTTPException (service layer) pass-through, generic Exception -> 500 with safe message

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all endpoints implemented as specified and verified successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Report management API complete and ready for:
- Phase 05-03: Report export functionality (PDF generation from saved reports)
- Frontend integration: Report save UI after property lookup, report library with filters/search
- Testing: Integration tests for report CRUD workflows

All endpoints verified:
- App loads without errors
- All 9 report endpoints registered at /api/reports/*
- All 5 project endpoints registered at /api/projects/*
- All endpoints require JWT authentication
- All queries filter by organization_id (multi-tenant isolation)
- Ruff check passes on all files

Requirements satisfied:
- RPT-01: User can save property intelligence report with full JSONB snapshot
- RPT-02: User can view list of saved reports filtered by city, project, search query
- RPT-03: User can re-open saved report and see full details including report_data

---
*Phase: 05-report-management*
*Completed: 2026-02-07*

## Self-Check: PASSED

All files and commits verified successfully.
