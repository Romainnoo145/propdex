---
phase: 04-m045-upload-flow-integratie
plan: "05"
subsystem: backend/admin
tags: [opportunistic-probe, data-sources, advisory-lock, refactor, integration-test]
dependency_graph:
  requires: [04-04]
  provides: [INT-04-opportunistic-probe-on-load]
  affects: [data_sources_router, data_source_probe_orchestrator, data_sources_helpers]
tech_stack:
  added: []
  patterns: [extract-helpers-module, three-file-no-circular, opportunistic-probe, asyncio-gather, pg-advisory-lock]
key_files:
  created:
    - backend/app/admin/data_sources_helpers.py
    - backend/app/admin/data_source_probe_orchestrator.py
  modified:
    - backend/app/admin/data_sources_router.py
    - backend/tests/integration/test_admin_data_sources_router.py
decisions:
  - "helpers extracted to data_sources_helpers.py to break circular import between router and orchestrator"
  - "cast(DataSourceStatusValue, ...) applied in helpers to fix pre-existing mypy str→Literal type errors (also fixed in router)"
  - "orchestrator rebuilds only cascade_uploads (Type A) after probe — open_apis and paid_integrations unchanged"
metrics:
  duration: 6m
  completed: "2026-05-15"
  tasks_completed: 2
  files_changed: 4
---

# Phase 04 Plan 05: Opportunistic Probe-on-Load Summary

**One-liner:** Async advisory-lock probe-on-GET auto-flips pre-existing PolicyDocument uploads to status='live' without manual Refresh, via three-file no-circular-import refactor.

## What Was Built

Added opportunistic probe-on-load to `get_gemeente_sources` so that M045/S05-era PolicyDocument uploads are automatically reflected as `status='live'` on the first GET for that gemeente.

### INT-04 Gap (pre-existing uploads)
Plan 04-04 covers new uploads (post-upload probe trigger). This plan covers PRE-EXISTING uploads — documents already in `policy_documents` table but lacking a `data_source_status` row.

### Architecture

Import topology (no cycles):
```
data_sources_helpers.py         ← no app.admin imports
data_source_probes.py           ← unchanged
data_source_probe_orchestrator.py  ← imports helpers + probes
data_sources_router.py          ← imports helpers + orchestrator
```

### `run_opportunistic_probes` logic (orchestrator)
1. Find missing Type A keys in `cascade_uploads`
2. Acquire pg advisory lock per (gemeente_code, source_key) — non-blocking, sequential
3. Run `asyncio.gather` over locked keys via `probe_type_a_cascade`
4. Update `DataSourceStatus` rows for non-missing probe results
5. `db.commit()` once
6. Re-fetch and rebuild `cascade_uploads` for Type A entries

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Extract helpers, create orchestrator, wire call site | 0a892866 |
| 2 | Integration tests — 3 new tests for INT-04 | 562ede7a |

## Verification Results

- `ruff check` on all 3 files: passed
- `mypy --ignore-missing-imports` on all 3 files: 0 errors (pre-existing router errors also fixed)
- `pytest backend/tests/integration/test_admin_data_sources_router.py`: 18 passed (15 pre-existing + 3 new)
- No circular imports verified via grep
- File sizes: router 197 lines, helpers 110 lines, orchestrator 80 lines (all under 300)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Fixed pre-existing mypy type errors in data_sources_router.py**
- **Found during:** Task 1 mypy run
- **Issue:** `status=db_row.status` (str) where DataSourceRow.status expects DataSourceStatusValue; `counts: dict[str, int]` where GemeenteSummary expects dict[DataSourceStatusValue, int]
- **Fix:** Added `cast(DataSourceStatusValue, ...)` in helpers.py `_row_from_db` and `_synthesize_missing_row`; changed `counts` type annotation + cast on `r.status` in router
- **Files modified:** data_sources_helpers.py, data_sources_router.py
- **Commit:** 0a892866

**2. [Rule 3 - Blocking] Missing `select` import in test file**
- **Found during:** Task 2 first test run
- **Issue:** Test used `select()` from SQLAlchemy without importing it
- **Fix:** Added `from sqlalchemy import select` and `from sqlalchemy import func as sa_func` to test file imports; removed redundant inline import in test body
- **Files modified:** test_admin_data_sources_router.py
- **Commit:** 562ede7a

## Self-Check: PASSED

- backend/app/admin/data_sources_helpers.py: FOUND
- backend/app/admin/data_source_probe_orchestrator.py: FOUND
- Commit 0a892866: FOUND
- Commit 562ede7a: FOUND
