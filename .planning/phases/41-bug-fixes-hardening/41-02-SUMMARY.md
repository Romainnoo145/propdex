---
phase: 41-bug-fixes-hardening
plan: 02
subsystem: database
tags: [sqlalchemy, postgresql, on-conflict, idempotent, arq, background-jobs]

# Dependency graph
requires:
  - phase: 41-01
    provides: register endpoint 500 fix (independent bug fix)
provides:
  - Idempotent ScanResult insertion using ON CONFLICT (scan_id, parcel_id) DO NOTHING
affects: [area_scan_job, arq-worker, scan-results]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bulk idempotent insert: pg_insert(Model).values([...]).on_conflict_do_nothing(index_elements=[...])"
    - "Guard with if qualifying: before bulk insert to avoid empty values list"

key-files:
  created: []
  modified:
    - backend/app/jobs/area_scan.py

key-decisions:
  - "Use index_elements=['scan_id', 'parcel_id'] not constraint name — more robust and explicit"
  - "Batch all qualifying values into single execute call (not N individual calls) — faster and idempotent"
  - "Wrap in if qualifying: guard — avoids executing empty VALUES list which is a PostgreSQL error"

patterns-established:
  - "Idempotent background job inserts: always use ON CONFLICT DO NOTHING for re-runnable jobs"

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 41 Plan 02: ARQ ScanResult Idempotent Insert Summary

**Replaced per-row session.add(ScanResult()) loop with single bulk INSERT ... ON CONFLICT (scan_id, parcel_id) DO NOTHING, making ARQ worker re-runs safe against IntegrityError on duplicate scan results**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-20T02:34:37Z
- **Completed:** 2026-02-20T02:35:36Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced N individual `session.add(ScanResult(...))` calls in Phase 4 of area_scan_job with a single bulk `pg_insert(ScanResult).values([...]).on_conflict_do_nothing(index_elements=["scan_id", "parcel_id"])` execute
- Added `from sqlalchemy.dialects.postgresql import insert as pg_insert` import
- Wrapped the bulk insert in `if qualifying:` guard to safely handle zero-qualifying-parcel scans
- ARQ worker re-runs of a crashed scan no longer raise `IntegrityError` on the `uq_scan_results_scan_parcel` unique constraint

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace session.add loop with bulk ON CONFLICT DO NOTHING insert** - `18ac2e9` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/jobs/area_scan.py` - Phase 4 ScanResult insertion replaced with idempotent bulk insert

## Decisions Made
- Use `index_elements=["scan_id", "parcel_id"]` (not `constraint="uq_scan_results_scan_parcel"`) — the index_elements form is more robust and does not depend on constraint naming
- Batch all qualifying values into a single execute call — more efficient than N individual executes
- `if qualifying:` guard before bulk insert — prevents empty VALUES list PostgreSQL error

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - ruff check clean, import test passed, compiled SQL confirmed ON CONFLICT (scan_id, parcel_id) DO NOTHING.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FIX-02 (ARQ duplicate ScanResult rows) resolved
- Phase 41 Plan 03 (legacy gray-* classes + react-resizable-panels cleanup) is ready to execute
- v5.0 milestone close pending Plan 03 completion

---
*Phase: 41-bug-fixes-hardening*
*Completed: 2026-02-20*
