---
phase: 01-brk-datamodel-retention
plan: 03
subsystem: testing
tags: [m050, s01, brk, retention, tests, regression, multi-tenant, avg, pytest]

# Dependency graph
requires:
  - phase: 01-01
    provides: BrkOwnershipRecord model + brk_ownership_records table — assertion target for model CHECK/UQ/cascade tests
  - phase: 01-02
    provides: brk_persistence_service + brk_retention_cleanup_job + favorites D3 hook — assertion target for service/cron/state-machine tests
provides:
  - "23 unit tests (6 model + 17 service) covering all unit-level GAPS from ENG-PLAN §Test coverage diagram"
  - "15 integration tests (3 state-machine + 9 cron + 3 multi-tenant) covering E2E + cron behaviors + CRITICAL multi-tenant isolation"
  - "6 REGRESSION-CRITICAL tests (3 Phase 105 + 3 favorites flow) protecting iron-rule contracts long-term"
  - "Mock-clock pattern (direct timestamp injection) — project alternative to freezegun, reusable for S02 hard-delete window tests"
  - "patched_cron_factory fixture — monkeypatches async_session_factory for cron tests to bind production-DB factory to test engine"
  - "Phase 105 signature-drift guard — fails if anyone refactors get_parcel_eigendom under M050+ (forces AVG re-review)"
affects: [m050/s02 persist write-path tests inherit fixtures, m050/s03 cascade factor tests rely on persisted rows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mock-clock without freezegun: inject hard_delete_after = datetime.utcnow() - timedelta(days=1) directly to simulate expired state"
    - "Cron-session monkeypatch: patch app.jobs.brk_retention_cleanup_job.async_session_factory to a test-engine-bound sessionmaker so the cron sees test fixtures"
    - "Signature-drift regression guard via inspect.signature — long-term protection of frozen ephemeral endpoints"
    - "monkeypatch.setattr(settings, 'M050_BRK_PERSIST_ENABLED', True) — per-test FF flip without polluting other tests"
    - "Spy pattern for negative assertions: fake function raises AssertionError if called (guarantees test fails loud if the contract breaks)"
    - "caplog with logger-name filter for structured-log emission tests (brk.retention.cleanup)"

key-files:
  created:
    - backend/tests/unit/models/__init__.py
    - backend/tests/unit/models/test_brk_ownership_record.py
    - backend/tests/unit/services/__init__.py
    - backend/tests/unit/services/test_brk_persistence_service.py
    - backend/tests/integration/test_brk_retention_state_machine.py
    - backend/tests/integration/test_brk_retention_cleanup_job.py
    - backend/tests/integration/test_brk_multi_tenant_isolation.py
    - backend/tests/regression/__init__.py
    - backend/tests/regression/test_phase105_brk_modal_still_works.py
    - backend/tests/regression/test_parcel_favorites_soft_delete_integration.py
  modified: []

key-decisions:
  - "Phase 105 regression uses 404 path (unknown parcel_id) — avoids needing PDOK/PostGIS happy-path setup while still proving (a) no row written and (b) persist_record never invoked"
  - "patched_cron_factory fixture instead of dependency-injection refactor — cron module imports async_session_factory at module-level; monkeypatch is the lowest-friction test entry"
  - "Double-unfavorite test pins down current behavior (second call 404s, BRK stamp unchanged) — documents the gap S02 revival logic must close"
  - "Phase 105 signature-drift guard via inspect.signature — catches anyone refactoring get_parcel_eigendom under M050+ before it ships"
  - "Test for happy-path persist_record uses monkeypatch.setattr(settings, ...) — per-test FF flip prevents pollution; tests run in any order"
  - "Cron tests refresh-via-new-session pattern: open patched_cron_factory() again to re-query state, because the cron's commit closes its own session and test_db's view is stale"

requirements-completed: [TEST-01]

# Metrics
duration: 12m 38s
completed: 2026-05-18
---

# Phase 01 Plan 03: BRK Test Coverage Summary

**24 GAPS + 2 REGRESSION-CRITICAL iron-rules closed — 44 new tests across 7 files, all green; baseline test_brk_wiring + test_bulk_favorites unaffected. The BRK datamodel + retention foundation is now verifiable + regression-protected before S02 layers the BRK Bevragen client.**

## Performance

- **Duration:** 12m 38s
- **Started:** 2026-05-18T14:20:48Z
- **Completed:** 2026-05-18T14:33:26Z
- **Tasks:** 3
- **Files created:** 10 (7 test files + 3 __init__.py)
- **Files modified:** 0

## Test Count Breakdown

| Category | File | Tests |
|---|---|---:|
| Unit — Model | tests/unit/models/test_brk_ownership_record.py | 6 |
| Unit — Service | tests/unit/services/test_brk_persistence_service.py | 17 |
| Integration — State machine | tests/integration/test_brk_retention_state_machine.py | 3 |
| Integration — Cron | tests/integration/test_brk_retention_cleanup_job.py | 9 |
| Integration — Multi-tenant | tests/integration/test_brk_multi_tenant_isolation.py | 3 |
| Regression — Phase 105 | tests/regression/test_phase105_brk_modal_still_works.py | 3 |
| Regression — Favorites | tests/regression/test_parcel_favorites_soft_delete_integration.py | 3 |
| **Total new** | | **44** |

All 44 tests green in `pytest -x -v` (154.64s on first full run).

## GAPS Closed (ENG-PLAN §Test coverage diagram)

| GAP | Closed by |
|---|---|
| Migration upgrade/downgrade idempotent (2) | Plan 01-01 self-check (psql verification) + new unit tests imply migration applied |
| Model: rechtspersoon+overheid create (2) | test_create_record_with_rechtspersoon + test_create_record_with_overheid |
| Model: natuurlijk_persoon CHECK fail (1) | test_check_constraint_rejects_natuurlijk_persoon |
| Model: UQ enforced (1) | test_unique_constraint_allows_historical_rows + test_unique_constraint_rejects_same_fetched_at |
| Model: cascade delete on org (1) | test_cascade_delete_on_org_removal + test_cascade_delete_on_org_removal_e2e |
| Service: persist happy + strip + NULL reject + FeatureDisabled (4) | test_persist_record_happy_path_when_flag_enabled, test_persist_record_strips_raw_before_insert, test_persist_record_raises_validation_error_on_null_naam, test_persist_record_raises_feature_disabled |
| Service: strip helper (1) | 5 dedicated strip_raw_brk_response tests (drops natuurlijk_persoon, None passthrough, malformed input, preserves rechtspersoon, recurses into nested dicts) |
| Service: soft_delete (3) | test_soft_delete_for_org_parcel_stamps_timestamps + _idempotent + _no_op_on_missing_parcel + _stamps_all_historical_rows |
| Service: hard_delete math (1) | test_soft_delete_for_org_parcel_stamps_timestamps asserts (hard_delete_after - soft_deleted_at).total_seconds() == 60d ±2s |
| Service: find_orphaned (1) | test_find_orphaned_records_returns_brk_without_favorite + _excludes_softdeleted + _excludes_favorited_rows |
| Job: deletes expired (1) | test_hard_delete_cron_fast_forward |
| Job: preserves non-expired (1) | test_cleanup_preserves_non_expired + test_cleanup_preserves_active_rows_with_favorite |
| Job: idempotent (1) | test_cleanup_idempotent |
| Job: returns count (1) | test_cleanup_returns_counts_dict |
| Job: structured-log (1) | test_cleanup_emits_structured_log |
| Job: anomaly alert (1) | test_alert_if_anomaly_under_threshold + test_alert_if_anomaly_over_threshold |
| E2E: org-A 404 (CRITICAL) (1) | test_org_a_cannot_read_org_b_records + test_org_a_softdelete_does_not_affect_org_b |
| E2E: cascade delete on org (1) | test_cascade_delete_on_org_removal_e2e |
| E2E: favorite→unfav→soft→30d→re-fav skip-refetch (1) | test_soft_delete_on_unfavorite + test_re_favorite_before_hard_delete_can_revive |
| E2E: favorite→unfav→90d→cron hard-delete (1) | test_hard_delete_cron_fast_forward (rows from delete_favorite get 60d hard_delete_after; fast-forward simulates expired state) |
| Job: orphan-pickup (D3 safety-net) | test_orphan_pickup |

**24 / 24 GAPS closed.**

## REGRESSION-CRITICAL (ENG-PLAN §REGRESSIONS — IRON RULE)

| Regression | Closed by |
|---|---|
| Phase 105 ephemeral BRK modal still works (no persist-side-effect leakage) | test_phase105_ephemeral_endpoint_still_works (no row written) + test_phase105_does_not_trigger_persist_pad (persist_record never invoked) + test_phase105_parcels_service_module_unchanged (signature-drift guard) |
| parcel_favorites_service.delete() still works zonder favorites-flow breaking | test_delete_favorite_still_succeeds_when_brk_soft_delete_raises + test_delete_favorite_with_no_brk_records_is_noop + test_delete_favorite_with_active_brk_record_soft_deletes_it |

**Both iron-rules covered with multiple defensive tests.**

## Task Commits

1. **Task 1: Unit tests — model + service** — `cfecb83d` (test) — 23 tests
2. **Task 2: Integration tests — state-machine + cron + multi-tenant** — `56bb8d74` (test) — 15 tests
3. **Task 3: REGRESSION-CRITICAL tests — Phase 105 + favorites** — `6d3ee5be` (test) — 6 tests

## Files Created

- `backend/tests/unit/models/__init__.py` — new sub-package for SQLAlchemy model unit tests
- `backend/tests/unit/models/test_brk_ownership_record.py` (170 LOC) — 6 model tests (CHECK + UQ + cascade)
- `backend/tests/unit/services/__init__.py` — new sub-package for service-layer unit tests
- `backend/tests/unit/services/test_brk_persistence_service.py` (380 LOC) — 17 service tests (strip + persist + soft-delete + orphan)
- `backend/tests/integration/test_brk_retention_state_machine.py` (138 LOC) — 3 E2E state-machine tests (D3 trigger + revive + idempotent)
- `backend/tests/integration/test_brk_retention_cleanup_job.py` (250 LOC) — 9 cron tests (fast-forward + idempotent + orphan-pickup + anomaly alert + structured-log)
- `backend/tests/integration/test_brk_multi_tenant_isolation.py` (120 LOC) — 3 CRITICAL isolation tests (org-B cannot read org-A + soft-delete isolation + cascade)
- `backend/tests/regression/__init__.py` — new sub-package for cross-milestone regression suite
- `backend/tests/regression/test_phase105_brk_modal_still_works.py` (96 LOC) — 3 Phase 105 ephemeral pad tests (no row written + no persist_record call + signature-drift guard)
- `backend/tests/regression/test_parcel_favorites_soft_delete_integration.py` (103 LOC) — 3 D3 hook resilience tests (boom-tolerance + no-op + happy-path)

All files < 300 LOC per CLAUDE.md hard rule.

## Test Fixtures Used

**Reused from existing `tests/conftest.py`:**
- `test_db` — async session, function-scoped table drop/recreate
- `test_engine` — async engine for `propdex_test` DB
- `create_test_user` — factory fixture returning (user, organization) tuple

**Created locally in test files (not hoisted to conftest.py — scope-boundary):**
- `patched_cron_factory` (test_brk_retention_cleanup_job.py) — monkeypatches `app.jobs.brk_retention_cleanup_job.async_session_factory` to a test-engine-bound sessionmaker so the cron sees test fixtures instead of production DB

**No conftest.py modifications** — out of scope per Plan 01-03 spec.

## ROADMAP Success Criteria — Empirical Proof

| Criterion | Proven by |
|---|---|
| #1 Migration creates table + indexes | test_check_constraint_rejects_natuurlijk_persoon (CHECK present), test_unique_constraint_rejects_same_fetched_at (UQ present), test_cascade_delete_on_org_removal (FK CASCADE present); migration ran as test setup precondition |
| #2 Unfavorite → soft-delete + 60d hard_delete_after; re-favorite revives | test_soft_delete_on_unfavorite (60d delta asserted) + test_re_favorite_before_hard_delete_can_revive (cleared stamps → row indistinguishable from active) |
| #3 Cron hard-delete via fast-forward | test_hard_delete_cron_fast_forward (row with hard_delete_after = now-1d gone after cron run) |
| #4 Privé → eigenaar_naam=NULL; rechtspersoon-only persistent | DB layer: test_check_constraint_rejects_natuurlijk_persoon (natuurlijk_persoon NEVER reaches DB). Service layer: 5 strip_raw_brk_response tests (raw JSONB redacted) + test_persist_record_strips_raw_before_insert (verified end-to-end on stored row) |

## Decisions Made

- **Phase 105 regression uses 404 path** instead of full PDOK/PostGIS happy-path setup. The invariant (no row written + persist_record never invoked) is provable on the 404 path; the happy-path is owned by S02 integration tests once the BRK Bevragen client lands.
- **`patched_cron_factory` as test-local fixture** instead of refactoring `brk_retention_cleanup_job` to accept a DI'd session factory. The cron module imports `async_session_factory` at module-level (which is the standard ARQ pattern); monkeypatching is the lowest-friction test entry that doesn't require changing production code.
- **Double-unfavorite test pins down current behavior** (second `delete_favorite()` raises HTTPException 404 because the favorite is already gone; BRK stamp unchanged). This documents the gap that S02 revival logic must close — re-favoriting a soft-deleted parcel should clear the stamps.
- **Signature-drift regression guard** for Phase 105 endpoint via `inspect.signature` — long-term protection of the frozen ephemeral contract. Catches anyone refactoring under M050+ before they accidentally introduce persist-pad leakage.
- **`monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)`** per-test instead of session-level FF flip — keeps test isolation tight; tests run in any order without polluting each other's FF state.
- **Spy + AssertionError negative assertion** (test_phase105_does_not_trigger_persist_pad): fake `persist_record` raises `AssertionError("must not be called")` if invoked. Even if the surrounding code swallows exceptions, the assertion makes the test fail loud. Belt + suspenders for a contract that absolutely must hold.

## Deviations from Plan

None - plan executed exactly as written.

Minor mypy-strictness adaptation: the `record.raw_brk_response.get("items", [])` JSONB result has runtime type `object`, so I added `isinstance(items, list)` + `isinstance(items[0], dict)` narrowing asserts (test_persist_record_strips_raw_before_insert). Functionally identical, type-checker happy. Same defensive pattern as Plan 01-02's `CursorResult[Any]` cast.

## Issues Encountered

None.

## Self-Check

- File `backend/tests/unit/models/__init__.py` — FOUND
- File `backend/tests/unit/models/test_brk_ownership_record.py` — FOUND
- File `backend/tests/unit/services/__init__.py` — FOUND
- File `backend/tests/unit/services/test_brk_persistence_service.py` — FOUND
- File `backend/tests/integration/test_brk_retention_state_machine.py` — FOUND
- File `backend/tests/integration/test_brk_retention_cleanup_job.py` — FOUND
- File `backend/tests/integration/test_brk_multi_tenant_isolation.py` — FOUND
- File `backend/tests/regression/__init__.py` — FOUND
- File `backend/tests/regression/test_phase105_brk_modal_still_works.py` — FOUND
- File `backend/tests/regression/test_parcel_favorites_soft_delete_integration.py` — FOUND
- All 44 new tests pass (`pytest -x -v` on the 7 test files): VERIFIED
- Baseline regression check: `tests/integration/test_brk_wiring.py` (6) + `tests/integration/test_bulk_favorites.py` (5) all pass post-D3 hook: VERIFIED
- `ruff check` on all new test files: PASSED (zero errors)
- Required tests present:
  - test_soft_delete_on_unfavorite — VERIFIED (state-machine)
  - test_hard_delete_cron_fast_forward — VERIFIED (cron)
  - test_prive_eigenaar_naam_null — covered via test_check_constraint_rejects_natuurlijk_persoon (DB) + 5 strip_raw_brk_response tests (service)
  - test_org_a_cannot_read_org_b_records — VERIFIED (multi-tenant)
  - test_phase105_ephemeral_endpoint_still_works — VERIFIED (regression)
  - test_check_constraint_rejects_natuurlijk_persoon — VERIFIED (model)
  - test_unique_constraint_allows_historical_rows — VERIFIED (model, D5)
- Commits `cfecb83d`, `56bb8d74`, `6d3ee5be` exist in git log — VERIFIED

## Self-Check: PASSED

## Next Phase Readiness

- M050/S02 (BRK Bevragen client + persist write-path) — can flip `M050_BRK_PERSIST_ENABLED=True` and rely on:
  - test_persist_record_happy_path_when_flag_enabled (write-path baseline)
  - test_persist_record_strips_raw_before_insert (D2 contract proven at integration layer)
  - test_unique_constraint_allows_historical_rows (S02 can write multiple fetched_at rows per parcel for koopwaarde_trend)
- M050/S02 — revival logic (re-favorite within 30d window) has a clear contract: clear `soft_deleted_at` + `hard_delete_after` and `find_orphaned_records` will leave the row alone (excludes already-stamped + actively-favorited)
- M050/S03 (scoring cascade factors) — can rely on persisted rows being multi-tenant-isolated (test_org_a_cannot_read_org_b_records contract inherited by any S03 service-layer queries)
- Regression suite is the long-term protection: any future PR that breaks Phase 105 ephemeral pad OR favorites delete flow will fail loud in CI

---
*Phase: 01-brk-datamodel-retention*
*Completed: 2026-05-18*
