---
phase: 01-fundament-demo-flag
plan: 00
subsystem: test-infra
tags: [wave-0, nyquist, regression, integration, frontend-unit, m052-s01]
dependency_graph:
  requires: []
  provides: [FUND-01-test, FUND-02-test, DEMO-01-test]
  affects: [01-01-PLAN, 01-02-PLAN, 01-03-PLAN]
tech_stack:
  added: []
  patterns: [pytest-asyncio asyncio_mode=auto, inspect.getsource drift-guard, vitest node-env unit]
key_files:
  created:
    - backend/tests/integration/test_m052_s01_hauzer_demo.py
    - backend/tests/regression/test_m052_s01_project_type_rescore.py
    - frontend/src/hooks/__tests__/useToggleFavorite.test.ts
  modified: []
decisions:
  - "FUND-02 iron-rule uses inspect.getsource drift-guard (lighter than full mock-DB; mirrors M050/S03 F2 pattern)"
  - "Task 3 import path locked as @/components/map/panels/parcel/HeartButton — Plan 01-03 must export from that module"
metrics:
  duration: 3m
  completed: 2026-05-21
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 01 Plan 00: Wave 0 Validation Test Stubs Summary

One-liner: Three RED test stubs encoding M052/S01 behavior as executable specs — hauzer_demo /me field, PUT rescore enqueue iron-rule, and picker-on-save logic.

## What Was Built

Three Wave 0 validation test files that encode the M052/S01 behaviors as executable specs. All tests are RED today (the explicit Nyquist signal) and will turn GREEN as Waves 1-2 ship the production code.

### Files Created

| File | Requirement | Mechanism | RED Signal |
|------|-------------|-----------|------------|
| `backend/tests/integration/test_m052_s01_hauzer_demo.py` | DEMO-01 + FUND-02 | httpx AsyncClient + ARQ AsyncMock | KeyError on `hauzer_demo`; `enqueue_job.await_count == 0` |
| `backend/tests/regression/test_m052_s01_project_type_rescore.py` | FUND-02 iron-rule + DEMO-01 isolation | inspect.getsource drift-guard + two-org /me test | regex pattern absent; AttributeError on `hauzer_demo` column |
| `frontend/src/hooks/__tests__/useToggleFavorite.test.ts` | FUND-01 | vitest node-env unit, 4 pure-logic cases | import fails: `shouldShowProjectTypePicker` not exported from HeartButton |

### Test Coverage

| Req | Test | Type | File |
|-----|------|------|------|
| DEMO-01 | `test_me_returns_hauzer_demo_false` | Integration | test_m052_s01_hauzer_demo.py |
| FUND-02 | `test_put_project_type_enqueues_rescore` | Integration | test_m052_s01_hauzer_demo.py |
| FUND-02 | `test_rescore_parcel_uses_stored_project_type` | Regression (iron-rule) | test_m052_s01_project_type_rescore.py |
| DEMO-01 | `test_hauzer_demo_multi_tenant_isolation` | Regression | test_m052_s01_project_type_rescore.py |
| FUND-01 | 4 cases for `shouldShowProjectTypePicker` | Frontend unit (node-env) | useToggleFavorite.test.ts |

## Verification Results

- Backend collect: `4 tests collected, 0 collection errors`
- Frontend: test runs, 4 tests collected, 4 FAIL with `shouldShowProjectTypePicker is not a function` (expected RED)
- No skip/xfail in any test file

## Deviations from Plan

None — plan executed exactly as written.

The FUND-02 iron-rule mechanism was chosen as the source-text drift guard (inspect.getsource) rather than a full mock-DB flow, as documented in the plan's task 2 action: "If a full mock of rescore_parcel's session flow is too heavy for a stub, fall back to a SIGNATURE/SOURCE drift guard." This is also consistent with the existing `test_brk_bevragen_signature_drift.py` pattern in the regression directory.

## Decisions Made

1. **FUND-02 iron-rule uses inspect.getsource drift-guard** — lighter than mocking the full ARQ session factory; fails immediately on the exact missing `project_type=` kwarg in the `compute_score_v3(flags)` call at line 341. Same pattern as M050/S03 F2 drift-detection in STATE.md.

2. **Task 3 import path locked** — `shouldShowProjectTypePicker` must be exported from `@/components/map/panels/parcel/HeartButton`. Plan 01-03 is the implementer (documented as a one-line comment in the test file).

## Self-Check

- [x] `backend/tests/integration/test_m052_s01_hauzer_demo.py` exists
- [x] `backend/tests/regression/test_m052_s01_project_type_rescore.py` exists
- [x] `frontend/src/hooks/__tests__/useToggleFavorite.test.ts` exists
- [x] Backend: 4 tests collected, 0 errors
- [x] Frontend: 4 tests collected, all RED (import/resolve failure)
- [x] No skip/xfail anywhere
- [x] Commits: 32e0c951 (Task 1), 91e6e7c9 (Task 2), 85d13b46 (Task 3)
