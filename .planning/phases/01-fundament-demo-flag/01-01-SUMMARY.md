---
phase: 01-fundament-demo-flag
plan: 01
subsystem: api
tags: [arq, rescore, project-type, scoring, score-v3, best-effort-enqueue]

# Dependency graph
requires:
  - phase: 01-fundament-demo-flag/01-00
    provides: Wave 0 iron-rule regression test + integration test stubs for FUND-02

provides:
  - "rescore_parcel loads stored ParcelProjectType and passes project_type into compute_score_v3"
  - "PUT /api/parcels/{parcel_id}/project-type enqueues rescore_parcel best-effort after upsert"
  - "get_arq_pool dependency override in conftest.async_client (transparent: live pool when set, no-op mock otherwise)"
affects:
  - "01-02 (DEMO-01 hauzer_demo field — builds on same router/model touched here)"
  - "future rescore consumers that rely on project_type-aware scores"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local import pattern for parcel_project_type_service inside rescore_parcel (avoids worker bootstrap circular imports)"
    - "Best-effort enqueue try/except in PUT handler — pattern matches brk_router.py M050/S03 D7"
    - "Transparent get_arq_pool override in conftest: returns app.state.arq_pool when set, fallback AsyncMock otherwise — enables both per-test pool assertions and no-pool-needed base case"

key-files:
  created: []
  modified:
    - backend/app/jobs/rescore_cascade_job.py
    - backend/app/api/endpoints/parcel_project_type_router.py
    - backend/tests/conftest.py

key-decisions:
  - "Local import of get_project_type inside rescore_parcel body (matches existing local-import pattern for ParcelCache/ScanResult/compute_score_v3 — avoids circular imports during ARQ worker bootstrap)"
  - "conftest get_arq_pool override is transparent (checks app.state.arq_pool first) so FUND-02 test's try/finally pool assignment works without modification to the test from Plan 00"
  - "Rule 2 auto-fix: conftest.async_client needed get_arq_pool override because the new PUT dependency would have broken all 6 existing parcel_project_type_router tests"

patterns-established:
  - "Transparent dependency override pattern: when adding FastAPI dependency to existing endpoint, also add conftest override that passes through live value when set (test-set app.state) and falls back to no-op mock — prevents test regression without modifying existing test files"

requirements-completed: [FUND-02]

# Metrics
duration: 6min
completed: 2026-05-21
---

# Phase 01 Plan 01: FUND-02 rescore_parcel project_type pass-through + PUT enqueue wiring Summary

**rescore_parcel now loads the stored ParcelProjectType and passes it into compute_score_v3; PUT /project-type enqueues rescore_parcel best-effort via ARQ, closing the FUND-02 silent-failure gap**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-21T18:49:50Z
- **Completed:** 2026-05-21T18:56:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- rescore_parcel uses get_project_type(db, parcel_id=, organization_id=org_uuid) via the in-scope session, then passes project_type_value into compute_score_v3 — no bare compute_score_v3(flags) call remains
- PUT /api/parcels/{parcel_id}/project-type captures upsert result, enqueues rescore_parcel best-effort (try/except), returns 200 even when ARQ is down
- Wave 0 iron-rule test (test_rescore_parcel_uses_stored_project_type) turned GREEN via source-text drift guard; FUND-02 integration test (test_put_project_type_enqueues_rescore) turned GREEN; all 6 existing router tests still GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: rescore_parcel loads + passes stored project_type into compute_score_v3** - `6c3bd1f4` (feat)
2. **Task 2: PUT /project-type enqueues rescore_parcel best-effort** - `8e760f76` (feat, includes Rule 2 conftest fix)

**Plan metadata:** (docs commit — see final_commit)

## Files Created/Modified
- `backend/app/jobs/rescore_cascade_job.py` - Added local import of get_project_type; load pt_response before compute_score_v3; pass project_type=project_type_value; updated docstring
- `backend/app/api/endpoints/parcel_project_type_router.py` - Added logging + ArqRedis import + get_arq_pool + enqueue_rescore_parcel imports; inject arq_pool via Depends; best-effort enqueue try/except in PUT handler
- `backend/tests/conftest.py` - Rule 2 auto-fix: added transparent get_arq_pool override to async_client fixture

## Decisions Made
- Local import of get_project_type inside rescore_parcel body matches the existing local-import cluster for ParcelCache/ScanResult/compute_score_v3 — correct choice for ARQ worker bootstrap safety
- Transparent conftest override (app.state.arq_pool passthrough + fallback mock) lets FUND-02 test's try/finally pool assignment work without touching the Plan 00 test file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added get_arq_pool dependency override to conftest.async_client**
- **Found during:** Task 2 (PUT /project-type enqueues rescore_parcel)
- **Issue:** Adding `arq_pool: ArqRedis = Depends(get_arq_pool)` to the PUT handler caused all 6 existing `test_parcel_project_type_router.py` tests to fail with RuntimeError ("arq_pool not initialised on app.state"), because the tests don't set up an ARQ pool
- **Fix:** Added `override_get_arq_pool` to conftest.async_client — transparent wrapper: returns app.state.arq_pool when set (for tests that assert on enqueue), falls back to no-op AsyncMock otherwise. This is the correct pattern per STATE.md M050/S03 decisions.
- **Files modified:** backend/tests/conftest.py
- **Verification:** All 6 existing tests pass; FUND-02 test (which sets app.state.arq_pool directly) still passes with its real mock assertions
- **Committed in:** 8e760f76 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical test infrastructure)
**Impact on plan:** Essential — new endpoint dependency would have regressed 6 tests without the override. No scope creep.

## Issues Encountered
- Migration `20260521_m052_s01_add_org_hauzer_demo.py` (created by Plan 00) was not yet applied; the FUND-02 test seeded an Organization that now requires the `hauzer_demo` column. Applied `alembic upgrade head` which ran the migration cleanly.

## Next Phase Readiness
- FUND-02 fully closed: project_type picker (FUND-01) now triggers a rescore that uses the M047 conditional weights for the stored type
- Plan 01-02 can proceed: DEMO-01 tests in the same regression file are still RED (Organization.hauzer_demo column exists but UserResponse doesn't expose it yet)
- All FUND-02 iron-rule + integration tests green; existing router contract unchanged

## Self-Check: PASSED

- FOUND: backend/app/jobs/rescore_cascade_job.py
- FOUND: backend/app/api/endpoints/parcel_project_type_router.py
- FOUND: .planning/phases/01-fundament-demo-flag/01-01-SUMMARY.md
- FOUND commit: 6c3bd1f4 (Task 1)
- FOUND commit: 8e760f76 (Task 2 + conftest fix)
