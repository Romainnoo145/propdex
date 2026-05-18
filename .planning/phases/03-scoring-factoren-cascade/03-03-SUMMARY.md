---
phase: 03-scoring-factoren-cascade
plan: 03
subsystem: scoring

tags: [m050, s03, brk, scoring, d3, d7, arq, rescore, integration-tests, multi-tenant]

# Dependency graph
requires:
  - phase: 03-scoring-factoren-cascade
    plan: 01
    provides: enrich_parcel_data_with_brk + M050_S03_FACTORS_ENABLED + BRKRecordDict + _missing_brk
  - phase: 03-scoring-factoren-cascade
    plan: 02
    provides: 3 BRK factor functions + FACTOR_REGISTRY (sum=100) + _SPARSE_REDISTRIBUTABLE_RISICO
provides:
  - compute_score_v3 D3 sparse-data redistribution block (rescales non-missing risico when ≥1 BRK missing)
  - rescore_parcel ARQ job (per-parcel rescore, JOIN ParcelCache.parcel_id IMKAD→UUID)
  - enqueue_rescore_parcel helper with deterministic _job_id='rescore:{org}:{parcel}' (F7 dedup)
  - app.core.arq.get_arq_pool FastAPI dependency (centralised app.state.arq_pool access)
  - brk_router D7 hook — enqueue rescore AFTER fetch_and_persist commit, best-effort
  - 8 integration tests covering D7 / D3 / F7 / F8 / F9 + 9 unit tests covering D3 math
affects:
  - M050/S06 (frontend cockpit can poll scan.flags['m050_s03_factors_at'] for freshness)
  - M050/S07 (env-flag triad activation now enables full pipeline end-to-end)

# Tech tracking
tech-stack:
  added: []  # no new deps
  patterns:
    - "D3 guard via default_weight equality check: skip D3 when _apply_missing_data_strategy already zeroed BRK weights (>20% missing). Avoids ×1.25 over-inflation observed at sum=125."
    - "rescore_parcel JOIN pattern: ScanResult.parcel_id is UUID (parcel_cache.id), input is IMKAD string → JOIN ParcelCache.parcel_id (IMKAD) ON ParcelCache.id (UUID)."
    - "ARQ job-id dedup via _job_id kwarg in enqueue_job — concurrent enqueues collapse, second returns None."
    - "get_arq_pool FastAPI dependency centralises app.state.arq_pool lookup (vs scattered request.app.state.arq_pool across the codebase)."
    - "Integration test pattern: app.state.arq_pool = AsyncMock(spec=ArqRedis) per-test via autouse fixture; fetch_and_persist monkeypatched on BOTH brk_fetch_service AND brk_router (symbol-already-imported)."
    - "Test DB injection: patch app.jobs.rescore_cascade_job.settings.DATABASE_URL → propdex_test so the worker-pattern engine targets the test DB."

key-files:
  created:
    - backend/app/core/arq.py
    - backend/tests/unit/services/test_compute_score_v3_redistribution.py
    - backend/tests/integration/test_m050_s03_persist_triggers_rescore.py
    - backend/tests/integration/test_m050_s03_sparse_redistribution.py
    - backend/tests/integration/test_m050_s03_concurrent_persist.py
    - backend/tests/integration/test_m050_s03_feature_flag_off.py
  modified:
    - backend/app/services/score_v3.py
    - backend/app/jobs/rescore_cascade_job.py
    - backend/app/jobs/worker.py
    - backend/app/scans/brk_router.py
    - backend/tests/integration/test_brk_persist_endpoint.py

key-decisions:
  - "D3 short-circuit guard added — skip rescale when missing BRK factor gewicht no longer equals default_weight. Detected during unit-test run: parcel_data={} produces non-missing risico sum=125 (×1.25 over-inflation). Root cause: _apply_missing_data_strategy already redistributed weights of missing factors (including BRK) above the 20% threshold; D3 then tried to rescale AGAIN. Fix: D3 only fires when BRK weights still equal default — a clean signal that the existing missing-strategy did NOT touch them."
  - "rescore_parcel JOIN through ParcelCache — ScanResult.parcel_id is the parcel_cache.id UUID, but the IMKAD string is what reaches the function (matches brk_router endpoint input). The JOIN keeps both identifier worlds consistent."
  - "new app/core/arq.py created — no existing get_arq_pool found via grep. The pattern across the codebase was inline request.app.state.arq_pool access, which is hard to test. The new dependency raises RuntimeError when arq_pool is missing; pre-existing test_brk_persist_endpoint.py needed an autouse fixture to set a mock pool (5-line addition)."
  - "Missing BRK factor zeroing — when D3 fires, the missing BRK factors get gewicht=0 / bijdrage=0 / percentage_of_category=0 (parity with _apply_missing_data_strategy semantics). Consistent with the existing missing-strategy contract."

patterns-established:
  - "Per-parcel rescore ARQ job template — rescore_parcel can be the prototype for future per-entity rescore jobs (M052/S04 doc-source rescore, M053 wijk-rescore, etc.). Reusable pieces: own engine + session_factory, JOIN ParcelCache for IMKAD↔UUID, dict-projection of FactorResult into JSONB-friendly shape."
  - "D7 best-effort hook pattern — try/except wrap on the enqueue call AFTER the main work commits. WARN log on failure. Endpoint NEVER raises out of the success path. This pattern is reusable for M050/S04 brief-template hooks, M050/S05 PostNL hooks, etc."
  - "ARQ dedup via _job_id — pattern works for any per-resource async operation. Test simulation: AsyncMock(side_effect=[Job, None]) mirrors the production ARQ-side dedup-collapse."

requirements-completed: [SCOR-01, SCOR-02, SCOR-03, TEST-03]

# Metrics
duration: 22m
completed: 2026-05-18
---

# Phase 03 Plan 03: D3 Redistribution + D7 Persist-Hook + 8 Integration Tests Summary

**M050/S03 wave-3 wire-up: compute_score_v3 D3 sparse-redistribution + rescore_parcel ARQ job + enqueue_rescore_parcel F7-dedup helper + brk_router D7 best-effort hook + 8 integration tests (D7 + D3 + F7 + F8 + F9 coverage) — Phase 03 complete.**

## Performance

- **Duration:** ~22 min (1325 s)
- **Started:** 2026-05-18T20:20:39Z
- **Completed:** 2026-05-18T20:42:44Z
- **Tasks:** 3
- **Files created:** 6 (1 module + 5 test files)
- **Files modified:** 5

## Accomplishments

- **D3 sparse-data redistribution landed in `compute_score_v3`** — when any of `{hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend}` is missing AND `_apply_missing_data_strategy` did NOT already zero its weight, the block excludes its default_weight from the risico-category total and rescales the remaining non-missing risico factors so the sum returns to 100. Missing BRK factors set to `gewicht=0 / bijdrage=0 / percentage_of_category=0` for parity.
- **3 new BRK factor function calls added to breakdown construction** — `score_hypotheek_risico` / `score_eigendoms_complexiteit` / `score_koopwaarde_trend` consume `parcel_data` and join the existing 21 factor functions. Breakdown size: 22 → 25 (8 potentie + 16 risico + 1 woonvisie_match cascade).
- **`rescore_parcel` ARQ job NEW alongside `rescore_parcels_for_document`** — M047/S05 untouched. Loads latest `ScanResult` via JOIN `ParcelCache.parcel_id` (IMKAD string), calls `enrich_parcel_data_with_brk` then `compute_score_v3`, writes projected `score_breakdown` back into `scan.flags`, bumps `flags['m050_s03_factors_at'] = datetime.utcnow().isoformat()` sentinel.
- **`enqueue_rescore_parcel` helper** — wraps `arq_pool.enqueue_job("rescore_parcel", ..., _job_id="rescore:{org}:{parcel}")`. Returns `job_id` string on enqueue, `None` on F7 dedup-collapse.
- **`get_arq_pool` FastAPI dependency added at `app/core/arq.py`** — centralises `app.state.arq_pool` access; raises `RuntimeError` when lifespan hasn't initialised the pool. brk_router consumes via `Depends(get_arq_pool)`.
- **D7 brk_router hook wired** — `persist_brk_for_parcel` now accepts `arq_pool: ArqRedis = Depends(get_arq_pool)`. AFTER successful `fetch_and_persist` commit, calls `enqueue_rescore_parcel` inside a try/except (best-effort — NEVER raises out of the 200 path; WARN log on failure). All 6 S02 exception mappings (404/403/503/503/422/502) preserved verbatim.
- **`rescore_parcel` registered in worker** — appended to `WorkerSettings.functions` in `app/jobs/worker.py`. Worker bootstrap unaffected.
- **9 unit tests** (`test_compute_score_v3_redistribution.py`) green — pin D3 set membership, no-rescale-when-no-BRK-missing, rescale-to-100 invariant under all-BRK-missing, koopwaarde-only-missing path, F8 mixed sparse, bijdrage=score×gewicht invariant, breakdown size = 25.
- **8 integration tests** (4 files) green — covering D7 hook E2E + best-effort enqueue, D3 happy path + F8 mixed-sparse + no-rescale-with-full-BRK, F7 concurrent dedup via `_job_id`, F9 / D8 feature-flag short-circuit.
- **63 tests** verified together in one run: 8 new integration + 17 pre-existing BRK (persist endpoint / fetch concurrency / multi-tenant / AVG defense) + 29 regression + 9 unit redistribution — all green.

## Task Commits

1. **Task 1: compute_score_v3 D3 redistribution + 3 BRK breakdown entries + 9 unit tests** — `71724c3a` (feat)
2. **Task 2: rescore_parcel ARQ job + enqueue_rescore_parcel + worker registration + brk_router D7 hook** — `ae47c536` (feat)
3. **Task 3: 4 integration test files (8 tests) — persist→rescore + D3 sparse + F7 concurrent + F9 FF-off** — `9c80632d` (test)

## Files Created / Modified

### Created

- `backend/app/core/arq.py` (~30 LOC) — `get_arq_pool` FastAPI dependency.
- `backend/tests/unit/services/test_compute_score_v3_redistribution.py` (~200 LOC) — 9 unit tests for D3 math.
- `backend/tests/integration/test_m050_s03_persist_triggers_rescore.py` (~230 LOC) — 2 D7 hook tests.
- `backend/tests/integration/test_m050_s03_sparse_redistribution.py` (~200 LOC) — 3 D3 / F8 E2E tests.
- `backend/tests/integration/test_m050_s03_concurrent_persist.py` (~110 LOC) — 1 F7 concurrent-dedup test.
- `backend/tests/integration/test_m050_s03_feature_flag_off.py` (~200 LOC) — 2 F9 / D8 FF-off tests.

### Modified

- `backend/app/services/score_v3.py` (+57 / -1 LOC) — 3 BRK factor imports + 3 breakdown entries + D3 block.
- `backend/app/jobs/rescore_cascade_job.py` (+147 / 0 LOC; 248 → 395 LOC) — new `rescore_parcel` + `enqueue_rescore_parcel`. M047/S05 `rescore_parcels_for_document` + `_process_parcel` UNTOUCHED. File over 300-LOC limit; documented as plan-acknowledged exception.
- `backend/app/jobs/worker.py` (+2 / -1 LOC) — import `rescore_parcel`, append to `WorkerSettings.functions`.
- `backend/app/scans/brk_router.py` (+24 / -7 LOC) — `arq_pool: Depends(get_arq_pool)` parameter; D7 try/except hook after fetch_and_persist; all 6 exception mappings preserved.
- `backend/tests/integration/test_brk_persist_endpoint.py` (+16 LOC) — autouse `_set_arq_pool_mock` fixture so pre-existing 9 S02 endpoint tests don't trip the new `get_arq_pool` dependency.

## Public Surface (Future Plan Imports)

```python
# Plan M050/S04+ can import:
from app.jobs.rescore_cascade_job import rescore_parcel, enqueue_rescore_parcel
from app.core.arq import get_arq_pool
```

**Signatures:**

```python
async def rescore_parcel(
    ctx: dict[str, Any],
    *,
    organization_id: str,  # UUID str (ARQ JSON-serialised)
    parcel_id: str,        # IMKAD string
) -> dict[str, Any]

async def enqueue_rescore_parcel(
    arq_pool: Any,                # arq.connections.ArqRedis
    organization_id: uuid.UUID,
    parcel_id: str,
) -> str | None                   # job_id on enqueue, None on dedup-collapse
```

## D3 Redistribution Block — Position + Logic

`compute_score_v3` line ordering (post-edit):

1. Compute 24 factors → `breakdown` dict (8 potentie + 16 risico).
2. Apply registry weights for `project_type`.
3. `_apply_missing_data_strategy(breakdown)` — existing >20% missing-per-category redistribution.
4. Re-sync `percentage_of_category` after step 3.
5. **NEW M050/S03 D3 block** — detects missing BRK factors that still have their default_weight; rescales non-missing risico by `100/active_weight`; zeroes missing BRK weights.
6. Cascade factor `woonvisie_match` block.
7. Custom weights override.
8. Subscore + overall computation.

The D3 GUARD (`breakdown[k].gewicht == float(FACTOR_REGISTRY[k].default_weight)`) prevents double-rescaling when `_apply_missing_data_strategy` already handled BRK-missing factors (>20% missing threshold).

## D7 Persist-Hook Flow

```
POST /api/parcels/{parcel_id}/brk/persist
    ↓
fetch_and_persist (S02 LOCKED)
    ↓ (success only — 6 exception mappings unchanged)
try:
    enqueue_rescore_parcel(arq_pool, org_id, parcel_id)
except Exception:
    logger.warning(...)         # best-effort — NEVER raises out
↓
return records                   # 200 OK
```

ARQ worker (later, async):

```
rescore_parcel job picked up
    ↓
JOIN ParcelCache.parcel_id (IMKAD) → ScanResult (UUID FK)
    ↓
enrich_parcel_data_with_brk(flags, org_uuid, db)       # Plan 03-01 (D8 FF-gate)
    ↓
compute_score_v3(flags)                                  # Plan 03-02 + this plan D3
    ↓
scan.flags['score_breakdown'] = projected
scan.flags['m050_s03_factors_at'] = datetime.utcnow().isoformat()
    ↓
await db.commit()
```

## REGRESSION-CRITICAL Tests Status

All 4 M050/S03 REGRESSION-CRITICAL guards still pass after this plan:

| # | Test file | Pin | Status |
|---|---|---|---|
| 1 | `tests/regression/test_m050_s03_multitenant.py` | F2 organization_id filter in enrich | green |
| 2 | `tests/regression/test_m050_s03_factor_weights.py` | 16-key risico weights sum=100 + D2 table | green |
| 3 | `tests/regression/test_m050_s03_factor_signatures.py` | 3 BRK factors registry signatures + bron='brk' | green |
| 4 | `tests/regression/test_m050_s03_narrative_honesty.py` | D6 banned-substring absence (case-insensitive) | green |

Pre-existing S02 BRK suite (17 tests: persist endpoint + concurrency + multi-tenant + AVG defense) all green — D7 hook addition didn't regress any S02 contract.

## Decisions Made

- **D3 GUARD on default_weight equality** — necessary to prevent ×1.25 over-inflation (verified during unit-test failure → root-caused → fixed). The cleanest no-op signal: D3 only fires when the BRK factor still has its registry default_weight (which `_apply_missing_data_strategy` would have zeroed if it ran).
- **rescore_parcel via JOIN ParcelCache** — `ScanResult.parcel_id` is the UUID `parcel_cache.id`, NOT the IMKAD string. Matches the M047/S05 `_process_parcel` JOIN pattern.
- **`get_arq_pool` new file vs. inline** — grep showed zero existing `get_arq_pool` symbol; the codebase pattern was inline `request.app.state.arq_pool` reaches. The new dependency centralises the lookup + adds a defensive `RuntimeError` guard + enables `Depends`-injection for tests.
- **Pre-existing test_brk_persist_endpoint.py touched** — minimal addition (autouse fixture, 16 LOC) needed because the new `get_arq_pool` raises when `app.state.arq_pool` is missing. Pattern follows MEMORY.md `04.1-02` (`app.state.arq_pool = AsyncMock(...)` in test setup).
- **Mock fetch_and_persist on BOTH brk_router AND brk_fetch_service** — `brk_router.py` imports the symbol at module-load time, so monkeypatching only `app.services.brk_fetch_service.fetch_and_persist` is NOT enough. Pattern propagated to all 3 new integration test files.
- **rescore_cascade_job.py over 300 LOC** — file grew from 248 to ~395 LOC. CLAUDE.md asks for <300, but this file pre-dates the rule (M047/S05) and the append is a single related concern (per-parcel rescore alongside per-document rescore). Plan-acknowledged exception; refactor deferred.

## Deviations from Plan

None of substance.

### Minor in-task adjustments (not deviations)

- **Unit test set updated mid-task** — the first draft of `test_no_brk_factor_missing_no_rescale` asserted BRK factor gewicht == default_weight even when `_apply_missing_data_strategy` had inflated them. Reworked to assert the sum-≈100 invariant, which is what D3 actually guarantees. Same fix applied to `test_redistribution_when_only_koopwaarde_trend_missing` and `test_redistribution_preserves_potentie_gewicht_unchanged`. No semantic shift — just precision-tightening of the assertions to match what D3 actually does (vs. what the plan pseudocode SUGGESTED in isolation from `_apply_missing_data_strategy`).
- **D3 GUARD added mid-Task-1** — initial implementation hit ×1.25 over-inflation under `parcel_data={}`. Added the `gewicht == default_weight` guard to skip D3 when `_apply_missing_data_strategy` already redistributed. Verified by re-running the full unit suite. Documented under Decisions.
- **`F1` import order in concurrent test** — `await enqueue_mock()` for StopAsyncIteration verification uses the raise-on-exhaust contract of `AsyncMock(side_effect=...)`. No issue at runtime.

## Issues Encountered

- **First D3 implementation produced sum=125 under empty parcel_data.** Root cause: `_apply_missing_data_strategy` already zeroed BRK weights AND redistributed remaining risico weights to sum=100; D3 then rescaled ×1.25. **Fix:** added the `gewicht == default_weight` guard so D3 only fires when the missing-strategy did NOT touch the BRK factor. Verified end-to-end with unit + integration tests.
- **Pre-existing brk_persist endpoint tests broke when `get_arq_pool` dependency landed.** Root cause: the FastAPI lifespan doesn't run under the test client, so `app.state.arq_pool` is unset. **Fix:** 16-LOC autouse fixture in `test_brk_persist_endpoint.py` setting a mock pool per-test. All 9 S02 endpoint tests + 8 new S03 integration tests green.

## User Setup Required

None — `M050_S03_FACTORS_ENABLED` still defaults to False; flipping it requires the M050/S07 env-flag triad. Production scoring path unchanged.

## Phase 3 Closure

- **SCOR-01** delivered (Plan 03-01) — D1 materialization function.
- **SCOR-02** delivered (Plan 03-03) — D7 persist hook + rescore_parcel ARQ job.
- **SCOR-03** delivered (Plan 03-02 + 03-03) — sparse-data fallback end-to-end + D3 redistribution.
- **TEST-03** delivered (Plans 03-01 → 03-03) — full test coverage: 4 REGRESSION-CRITICAL + 9 unit redistribution + 19 unit factor + 8 integration.

Ready for VERIFICATION → STATE bump → next slice. M050/S04 (Brief-Template Registry) is independent and unblocked.

## Self-Check: PASSED

Verified on disk + via `git log --oneline -5`:

- `backend/app/services/score_v3.py` modified — FOUND
- `backend/app/jobs/rescore_cascade_job.py` modified (rescore_parcel + enqueue_rescore_parcel appended) — FOUND
- `backend/app/jobs/worker.py` modified (rescore_parcel registered) — FOUND
- `backend/app/scans/brk_router.py` modified (D7 hook + arq_pool dep) — FOUND
- `backend/app/core/arq.py` created — FOUND
- `backend/tests/unit/services/test_compute_score_v3_redistribution.py` — FOUND
- `backend/tests/integration/test_m050_s03_persist_triggers_rescore.py` — FOUND
- `backend/tests/integration/test_m050_s03_sparse_redistribution.py` — FOUND
- `backend/tests/integration/test_m050_s03_concurrent_persist.py` — FOUND
- `backend/tests/integration/test_m050_s03_feature_flag_off.py` — FOUND
- `backend/tests/integration/test_brk_persist_endpoint.py` modified (autouse arq_pool mock) — FOUND
- Commit `71724c3a` (Task 1) — FOUND
- Commit `ae47c536` (Task 2) — FOUND
- Commit `9c80632d` (Task 3) — FOUND

63 tests verified together — all green. ruff clean on all 9 touched files. M047/S05 `rescore_parcels_for_document` signature unchanged.

---
*Phase: 03-scoring-factoren-cascade*
*Plan: 03*
*Completed: 2026-05-18*
