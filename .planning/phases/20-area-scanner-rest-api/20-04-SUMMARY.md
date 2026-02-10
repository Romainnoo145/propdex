---
phase: 20-area-scanner-rest-api
plan: 04
subsystem: background-jobs
tags: [arq, area-scan, bag-wfs, parcel-scoring, background-processing]

# Dependency graph
requires:
  - phase: 20-01
    provides: ParcelCache model, AreaScan model, ScanResult model
  - phase: 20-02
    provides: Parcel scoring service with weighted factors
  - phase: 19-02
    provides: BAG WFS client with pagination

provides:
  - Area scan background job orchestrating full pipeline
  - ARQ worker configuration with area_scan_job registered
  - Job cancellation support via allow_abort_jobs
  - Streaming progress updates via database commits

affects: [20-05, 20-06, area-scanning, background-jobs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Background job pattern: create engine + session_factory per job"
    - "CancelledError handler preserving partial results"
    - "Batch progress updates every 10 parcels"

key-files:
  created:
    - backend/app/jobs/area_scan.py
  modified:
    - backend/app/jobs/worker.py

key-decisions:
  - "Skip DSO bestemming queries during bulk scan (MVP optimization - add as on-demand Tier 2)"
  - "Process BAG WFS features as buildings (has_pand=True) since WFS returns panden"
  - "Skip failed parcels and count in parcels_failed (not aborting entire scan)"
  - "Update progress every 10 parcels to balance responsiveness vs commit overhead"

patterns-established:
  - "Pattern: Helper functions for upsert and progress updates"
  - "Pattern: Fresh session from session_factory in error handlers (original may be in bad state)"
  - "Pattern: Always dispose engine and close http_client in finally block"

# Metrics
duration: 2min
completed: 2026-02-10
---

# Phase 20 Plan 04: Area Scan Background Job Summary

**ARQ background job orchestrating full area scan pipeline: BAG WFS fetch → ParcelCache upsert → score computation → ScanResult creation with streaming progress**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-10T15:00:43Z
- **Completed:** 2026-02-10T15:02:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created area_scan_job function handling full scan pipeline with 4 phases
- Registered job in ARQ worker with cancellation support and 1-hour timeout
- Implemented streaming progress updates committed after each batch
- Built error tolerance: skip failed parcels, preserve results on cancellation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create area scan background job** - `bd31562` (feat)
2. **Task 2: Register area_scan_job in ARQ worker** - `7c90f1a` (feat)

## Files Created/Modified

- `backend/app/jobs/area_scan.py` - Area scan background job with BAG WFS fetching, ParcelCache upserting, score computation, and ScanResult creation
- `backend/app/jobs/worker.py` - ARQ worker configuration with area_scan_job registered, allow_abort_jobs=True, and job_timeout=3600

## Decisions Made

**1. Skip DSO bestemming queries during bulk scan**
- DSO spatial lookups are slow for large datasets
- Keep scans fast by deferring DSO enrichment to on-demand Tier 2
- bestemmingen field stays NULL during scan, populated when user clicks parcel

**2. Process BAG WFS features as buildings (has_pand=True)**
- BAG WFS returns panden (building footprints), not parcels
- For MVP, each pand becomes a ParcelCache entry with has_pand=True
- Scoring still works (vacant_land factor gives 0 points for has_pand=True)
- Future: Add PDOK cadastral WFS for actual parcel boundaries with cross-reference

**3. Skip failed parcels and count in parcels_failed**
- Individual parcel failures should not abort entire scan
- Wrap parcel processing in try/except, log warning, increment failed_count
- User sees count of failed parcels in scan results

**4. Update progress every 10 parcels**
- Balance responsiveness (users see live progress) vs commit overhead
- Commit after every 10 parcels or at end of batch
- Progress updates include phase, percentage, and parcels_processed count

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed established patterns from pdf_parsing.py.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Area scan job ready for integration with REST API endpoints
- Job can be enqueued via ARQ and status polled from database
- Next: Create REST API endpoints for scan creation, status polling, and result retrieval

## Self-Check: PASSED

Created files verification:
- FOUND: backend/app/jobs/area_scan.py
- FOUND: backend/app/jobs/worker.py (modified)

Commits verification:
- FOUND: bd31562 (Task 1: area scan job)
- FOUND: 7c90f1a (Task 2: worker registration)

---
*Phase: 20-area-scanner-rest-api*
*Completed: 2026-02-10*
