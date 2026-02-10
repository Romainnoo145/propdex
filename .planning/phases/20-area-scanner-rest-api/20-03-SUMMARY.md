---
phase: 20-area-scanner-rest-api
plan: 03
subsystem: area-scanner
tags:
  - service-layer
  - rest-api
  - scan-trigger
  - arq-integration
dependency_graph:
  requires:
    - scan_schemas
    - gemeente_bbox_lookup
    - area_scans_table
  provides:
    - scan_crud_service
    - scan_trigger_endpoint
    - scan_rescan_flow
  affects:
    - area_scan_job_enqueueing
    - scan_polling_endpoint
tech_stack:
  added: []
  patterns:
    - crud_service_layer
    - existing_scan_detection
    - force_rescan_in_place
    - preemptive_validation
    - arq_job_enqueueing
key_files:
  created:
    - backend/app/scans/service.py
    - backend/app/scans/router.py
  modified:
    - backend/app/main.py
decisions:
  - decision: Reset scans in-place instead of creating new scan records
    rationale: "User decision: re-scan overwrites existing scan record to maintain single source of truth per org+gemeente"
  - decision: Pre-validate parcel count before enqueueing ARQ job
    rationale: Fail fast at API layer to prevent wasted background processing on oversized scans
  - decision: Return existing scan with needs_rescan flag for scans >30 days old
    rationale: "User decision: show existing results with re-scan option to balance freshness and performance"
metrics:
  duration_seconds: 122
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  lines_added: 281
  completed_at: 2026-02-10T15:02:45Z
---

# Phase 20 Plan 03: Scan Trigger & CRUD Service Summary

**One-liner:** Scan CRUD service with duplicate detection, POST /api/scans endpoint with 10k parcel limit, and ARQ job enqueueing

## Overview

Implemented the scan trigger entry point for area intelligence operations. Created a comprehensive CRUD service layer for AreaScan management with tenant isolation. Built the POST /api/scans REST endpoint that handles existing scan detection (with needs_rescan indicator for >30 day old scans), validates parcel counts against 10,000 limit, supports force_rescan for in-place reset, and enqueues ARQ background jobs. Wired the scans router into the FastAPI application.

## Tasks Completed

### Task 1: Create scan CRUD service
**Status:** Complete
**Commit:** cdf2847

Created `backend/app/scans/service.py` with four CRUD functions following project patterns:

- **`get_existing_scan(organization_id, gemeente_code, session)`**: Queries for most recent scan per org+gemeente, returns None if not found. Uses descending created_at sort with LIMIT 1 for efficiency.

- **`create_scan(organization_id, gemeente_code, gemeente_naam, bbox, session)`**: Creates AreaScan with status="pending", progress_pct=0, and bbox coordinates (minx/miny/maxx/maxy). Uses project transaction pattern (add → flush → commit).

- **`reset_scan_for_rescan(scan, session)`**: Deletes all ScanResult rows via CASCADE delete, resets scan fields (status, progress, parcels counts, timestamps, job_id, error_message) for in-place re-scan. Implements user decision to overwrite existing scan instead of creating new record.

- **`get_scan_by_id(scan_id, organization_id, session)`**: Fetches scan with multi-tenant isolation. Returns None if not found or wrong organization (prevents cross-tenant access).

All functions use proper type hints, follow async patterns, and enforce organization_id filtering for multi-tenant security.

### Task 2: Create scan trigger endpoint and wire router
**Status:** Complete
**Commit:** 2187f8e

**Part A: Created `backend/app/scans/router.py`**

Implemented `POST /api/scans` endpoint with comprehensive logic:

1. **Existing scan detection**: Calls `service.get_existing_scan()` to check for prior scans
2. **Return existing**: If found AND `force_rescan=False`, returns ScanResponse with status="existing" and needs_rescan flag based on 30-day threshold
3. **Force rescan flow**: If found AND `force_rescan=True`, calls `service.reset_scan_for_rescan()` to delete results and reset scan record
4. **Gemeente bbox lookup**: Fetches bounding box via `get_gemeente_bbox()` using shared httpx client, raises 400 error if invalid gemeente
5. **Parcel count pre-check**: Calls `bag_wfs_client.get_pand_count_in_bbox()` to validate <10,000 limit per SCAN-06 requirement, fails fast before job creation
6. **Create scan**: Calls `service.create_scan()` with org_id, gemeente info, and bbox
7. **Enqueue ARQ job**: Calls `arq_pool.enqueue_job("area_scan_job", str(scan.id), str(organization_id))` and stores job_id in scan record
8. **Rate limiting**: Applied `@limiter.limit("10/minute")` decorator per plan specification

Follows existing patterns from `app/reports/router.py` with proper error handling, JWT authentication dependencies, and structured responses.

**Part B: Wired router into `backend/app/main.py`**

- Added import: `from app.scans.router import router as scans_router`
- Added: `app.include_router(scans_router)` after existing router includes
- Verified route registration via app.routes inspection

## Deviations from Plan

None - plan executed exactly as written.

## Technical Highlights

**Service Layer Design:**
- Pure CRUD functions with clear single responsibilities
- Consistent parameter ordering (organization_id first for tenant context)
- Proper transaction management following project pattern (add/flush/commit, NOT async with db.begin())
- Type hints on all parameters and return types for IDE support

**Existing Scan Detection:**
- Implements 30-day freshness threshold for needs_rescan indicator
- Returns existing scan with metadata (scan_date, status) to inform client decision
- Prevents duplicate scans while enabling refresh workflow

**Force Rescan Flow:**
- In-place reset preserves scan_id for referential integrity
- Deletes ScanResult rows to prevent stale data
- Resets all tracking fields (progress, parcels counts, timestamps) for clean job execution
- User decision: Single scan record per org+gemeente simplifies data model

**Preemptive Validation:**
- Gemeente bbox lookup validates code before processing
- Parcel count check (10k limit) prevents wasted background job execution
- Fail-fast approach returns 400 errors at API layer for immediate user feedback
- Saves Redis queue capacity and worker resources

**ARQ Integration:**
- Retrieves arq_pool from app.state (created in lifespan startup)
- Passes scan_id and organization_id as string parameters for job context
- Stores job_id in scan record for status tracking and cancellation support
- Proper error handling preserves scan record on job enqueueing failures

## Success Criteria

- [x] Four service functions importable (get_existing_scan, create_scan, reset_scan_for_rescan, get_scan_by_id)
- [x] All functions use organization_id for tenant isolation
- [x] reset_scan_for_rescan deletes ScanResult rows and resets scan fields
- [x] POST /api/scans endpoint functional
- [x] Checks existing scan with needs_rescan flag (>30 days)
- [x] Validates parcel count <10k before enqueueing
- [x] Enqueues ARQ job with scan_id and org_id
- [x] Router wired into main.py
- [x] Rate limited at 10/minute
- [x] ruff check passes on all files

## Files Created

1. **backend/app/scans/service.py** - Scan CRUD operations (140 lines)
2. **backend/app/scans/router.py** - POST /api/scans endpoint (139 lines)

## Files Modified

1. **backend/app/main.py** - Added scans_router import and registration (+2 lines)

## Next Steps

This trigger endpoint enables:
- **Plan 20-04**: ARQ background job implementation (area_scan_job orchestrator)
- **Plan 20-05**: Polling endpoint (GET /api/scans/{scan_id}/status)
- **Plan 20-06**: Results endpoint (GET /api/scans/{scan_id}/results with filtering)
- **Plan 20-07**: Excel export (openpyxl with score transparency)

## Self-Check: PASSED

**Created files exist:**
- FOUND: backend/app/scans/service.py
- FOUND: backend/app/scans/router.py

**Commits exist:**
- FOUND: cdf2847 (scan CRUD service)
- FOUND: 2187f8e (scan trigger endpoint and router wiring)

**Router wired:**
- CONFIRMED: scans_router imported in main.py
- CONFIRMED: scans_router registered via app.include_router()
- CONFIRMED: /api/scans route exists in app.routes

**Imports verified:**
- PASSED: All service functions importable
- PASSED: Router importable
- PASSED: Route registered in application

**Lint check:**
- PASSED: ruff check passed on app/scans/ and app/main.py
