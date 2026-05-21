---
phase: 03-scoring-factoren-cascade
verified: 2026-05-18T22:55:00Z
status: human_needed
score: 4/4 must-haves verified (backend), 1 human-verification item (frontend refetch ≤60s, out-of-scope)
re_verification:
  is_re_verification: false
human_verification:
  - test: "BRK persist → frontend score refetch within 60s"
    expected: "After POST /api/parcels/{id}/brk/persist returns 200, the cockpit React Query cache invalidates and the 3 BRK factors (hypotheek_risico / eigendoms_complexiteit / koopwaarde_trend) appear in the parcel score breakdown within 60 seconds with the ARQ worker live."
    why_human: "End-to-end frontend refetch timing is explicitly out-of-scope for Phase 03 (backend trigger side only). Requires a running ARQ worker + frontend session + clock observation."
---

# Phase 03: Scoring-Factoren Cascade (M050/S03) Verification Report

**Phase Goal:** 3 nieuwe BRK-driven factoren live in score-v3 engine, met rescore-cascade trigger op BRK-write.
**Verified:** 2026-05-18T22:55:00Z
**Status:** human_needed (backend complete; frontend refetch-within-60s flow outside phase scope)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                       | Status     | Evidence                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Factoren `hypotheek_risico`, `eigendoms_complexiteit`, `koopwaarde_trend` zijn in `score_v3_factors.py` met conditional-weights mechanism per projecttype | ✓ VERIFIED | `score_v3_factors.py:1446` `score_hypotheek_risico`, `:1483` `score_eigendoms_complexiteit`, `:1526` `score_koopwaarde_trend`; `FACTOR_REGISTRY` entries at `score_v3.py:340-363` with `category="risico"`, `bron="brk"`, `weight_by_projecttype` parameter exposed (None = default across projecttypes, same as 11 other risico factors) |
| 2   | BRK-write triggert `rescore_cascade_job(parcel_id)` (backend side)                                                          | ✓ VERIFIED | `brk_router.py:104-117` D7 hook calls `enqueue_rescore_parcel` AFTER `fetch_and_persist` commit (best-effort try/except); `rescore_cascade_job.py:256` `rescore_parcel` + `:368` `enqueue_rescore_parcel`; `worker.py:68` `rescore_parcel` registered in `WorkerSettings.functions` |
| 3   | Sparse-data fallback: parcels zonder BRK-coverage → `silent_neutral` (niet 0)                                                | ✓ VERIFIED | `score_v3_factors.py:1408` `_missing_brk` returns `missing=True, genormaliseerde_score=0.0, bijdrage=0.0`; D3 redistribution at `score_v3.py:572-602` rescales non-missing risico factors to sum=100, zeroes weight of missing BRK factors. The 3 BRK keys are NOT in `_CRITICAL_RISK_FACTORS` → no −10% penalty. Pin: `test_m050_s03_factor_signatures.py::test_brk_factors_not_in_critical_risk_factors` PASS |
| 4   | Bestaande score-v3 factor-set ongewijzigd (REGRESSION-CRITICAL)                                                              | ✓ VERIFIED | 21 pre-existing factor FUNCTION signatures untouched (per `03-02-SUMMARY.md` "zero deletions verified" in `score_v3_factors.py`); 13 existing risico `default_weight` integers WERE rebalanced via `_rebalance_risico_weights(target_sum=80)` deterministically (largest-remainder) — pinned by `test_m050_s03_factor_weights.py` (PASS). Risico-category sum invariant `=100` enforced by module-level assert at `score_v3.py:373-374`. M047/S05 `rescore_parcels_for_document` + `_process_parcel` untouched (per 03-03-SUMMARY decisions section + visual diff `rescore_cascade_job.py:1,60,129`) — non-BRK rescore-triggers preserved. S02 BRK persist endpoint regression: 9 tests green |

**Score:** 4/4 truths verified (backend). 1 human-verification item for frontend refetch-within-60s flow.

---

### Required Artifacts

| Artifact                                                            | Expected                                              | Status     | Details                                                                                                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend/app/core/config.py`                                        | `M050_S03_FACTORS_ENABLED` feature flag (default False) | ✓ VERIFIED | Line 263 `M050_S03_FACTORS_ENABLED: bool = Field(...)` with self-prefixed description string                                                                              |
| `backend/app/services/scoring_pipeline.py`                          | `enrich_parcel_data_with_brk` + `BRKRecordDict`        | ✓ VERIFIED | 149 LOC; line 43 TypedDict, line 68 async function with `WHERE organization_id = :org_id`, `soft_deleted_at IS NULL`, ORDER BY `fetched_at DESC`; D8 FF-gate at line 104 |
| `backend/app/services/score_v3_factors.py`                          | `_missing_brk` + 3 BRK factor functions                | ✓ VERIFIED | Line 1408 `_missing_brk`, lines 1446/1483/1526 the 3 factors. All consume `parcel_data["brk_records"]` (pure — no DB calls). 25 total factor functions (up from 22)        |
| `backend/app/services/score_v3.py`                                  | FACTOR_REGISTRY 24 factors + `_SPARSE_REDISTRIBUTABLE_RISICO` + D3 block | ✓ VERIFIED | Line 65 frozenset, line 97 `_rebalance_risico_weights` helper, lines 340-363 the 3 new FACTOR_REGISTRY entries (bron=`brk`, category=`risico`), lines 528-530 breakdown wiring, lines 557-602 D3 sparse-data redistribution block with guard at line 576 `gewicht == default_weight` |
| `backend/app/jobs/rescore_cascade_job.py`                           | `rescore_parcel` + `enqueue_rescore_parcel`            | ✓ VERIFIED | Line 256 `rescore_parcel` ARQ job (loads ScanResult via JOIN ParcelCache, calls `enrich_parcel_data_with_brk` then `compute_score_v3`, writes `score_breakdown` + bumps `flags['m050_s03_factors_at']` sentinel); line 368 `enqueue_rescore_parcel` with `_job_id="rescore:{org}:{parcel}"` (F7 dedup). M047/S05 `rescore_parcels_for_document` + `_process_parcel` UNTOUCHED |
| `backend/app/jobs/worker.py`                                        | `rescore_parcel` registered                            | ✓ VERIFIED | Line 26 import, line 68 appended to `WorkerSettings.functions` alongside `rescore_parcels_for_document`                                                                  |
| `backend/app/scans/brk_router.py`                                   | D7 hook after fetch_and_persist commit                 | ✓ VERIFIED | Line 69 `arq_pool: ArqRedis = Depends(get_arq_pool)`; line 104-117 best-effort try/except wrapping `enqueue_rescore_parcel`; all 6 S02 typed-exception → HTTP mappings preserved verbatim |
| `backend/app/core/arq.py`                                           | `get_arq_pool` FastAPI dependency                      | ✓ VERIFIED | New module (~30 LOC); centralises `app.state.arq_pool` lookup with `RuntimeError` guard when lifespan hasn't initialised the pool                                        |
| `backend/tests/regression/test_m050_s03_multitenant.py`             | F2 org_id pin (drift-verified)                          | ✓ VERIFIED | PASS — `test_enrich_filters_by_org_id`; drift-detection executed in 03-01 (filter removed → fail → restored → pass)                                                       |
| `backend/tests/regression/test_m050_s03_factor_weights.py`          | 16-key risico weights post-rebalance pin                | ✓ VERIFIED | 4 tests PASS — pinned `EXPECTED_RISICO_WEIGHTS` (funderingsrisico=13, …, 3 BRK new keys=10/6/4, sum=100)                                                                  |
| `backend/tests/regression/test_m050_s03_factor_signatures.py`       | 3 BRK factors registry signatures + non-critical pin    | ✓ VERIFIED | 5 tests PASS — registry membership, `bron='brk'`, `_SPARSE_REDISTRIBUTABLE_RISICO == {3 keys}`, NOT in `_CRITICAL_RISK_FACTORS`                                            |
| `backend/tests/regression/test_m050_s03_narrative_honesty.py`       | D6 banned-substring absence guard                       | ✓ VERIFIED | 5 tests PASS — case-insensitive banned-word absent in 4 age buckets + missing path                                                                                       |
| `backend/tests/integration/test_m050_s03_persist_triggers_rescore.py` | D7 hook E2E                                            | ✓ VERIFIED | 2 tests PASS — persist triggers rescore with factor keys; endpoint returns 200 even if enqueue fails                                                                      |
| `backend/tests/integration/test_m050_s03_sparse_redistribution.py`  | D3 E2E                                                  | ✓ VERIFIED | 3 tests PASS — all 3 BRK missing rescales 13 existing; F8 mixed sparse; no redistribution when BRK present                                                                |
| `backend/tests/integration/test_m050_s03_concurrent_persist.py`     | F7 ARQ dedup                                            | ✓ VERIFIED | 1 test PASS — concurrent persists collapse via `_job_id`                                                                                                                  |
| `backend/tests/integration/test_m050_s03_feature_flag_off.py`       | F9 / D8 FF-off                                          | ✓ VERIFIED | 2 tests PASS — all 3 BRK factors missing regardless of records; endpoint still 200 + enqueues                                                                             |
| `backend/tests/unit/services/test_score_v3_brk_factors.py`          | 19 unit tests (6+6+7)                                   | ✓ VERIFIED | 19 PASS — hypotheek/eigendoms/koopwaarde unit coverage incl. F3-F5 defensive paths                                                                                       |
| `backend/tests/unit/services/test_compute_score_v3_redistribution.py` | 9 D3-math unit tests                                  | ✓ VERIFIED | 9 PASS — set membership, no-rescale-on-no-BRK-missing, rescale-to-100 invariant, F8 mixed sparse, bijdrage invariant, breakdown_size=25                                  |
| `backend/tests/unit/services/test_scoring_pipeline.py`              | 4 enrich unit tests                                     | ✓ VERIFIED | 4 PASS — FF-off short-circuit, empty result, soft-delete exclusion, ORDER BY DESC + boundary coercion                                                                    |

---

### Key Link Verification

| From                                    | To                                                            | Via                                                                   | Status  | Details                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `brk_router.persist_brk_for_parcel`     | `rescore_cascade_job.enqueue_rescore_parcel`                  | D7 hook after commit (best-effort try/except)                          | WIRED   | `brk_router.py:32` import, `:105` await call; integration test `test_persist_triggers_rescore_with_factor_keys` PASS                                                                                                       |
| `enqueue_rescore_parcel`                | ARQ worker `rescore_parcel` task                              | `arq_pool.enqueue_job("rescore_parcel", ..., _job_id="rescore:{org}:{parcel}")` | WIRED   | `worker.py:26,68` registers `rescore_parcel` in `WorkerSettings.functions`; F7 dedup via deterministic `_job_id`; integration test `test_concurrent_persists_dedup_via_arq_job_id` PASS                                  |
| `rescore_parcel`                        | `scoring_pipeline.enrich_parcel_data_with_brk`                | local import inside job + `await` call                                | WIRED   | `rescore_cascade_job.py:295,340`; FF-off makes it a no-op (D8)                                                                                                                                                            |
| `rescore_parcel`                        | `score_v3.compute_score_v3`                                   | local import + call after enrich                                       | WIRED   | `rescore_cascade_job.py:294,341`; D3 redistribution runs internally                                                                                                                                                       |
| `compute_score_v3`                      | 3 BRK factor functions                                        | direct call + breakdown wiring                                         | WIRED   | `score_v3.py:482-488` imports, `:528-530` `breakdown["hypotheek_risico"] = score_hypotheek_risico(parcel_data)` (+ 2 more)                                                                                                |
| `compute_score_v3` D3 block             | `_SPARSE_REDISTRIBUTABLE_RISICO` frozenset                    | set-membership iteration                                              | WIRED   | `score_v3.py:573`; rescales risico back to sum=100 when ≥1 BRK factor missing AND still at default_weight                                                                                                                |
| BRK factor functions                    | `_missing_brk(reason, weight)`                                | early-return on empty/null inputs                                     | WIRED   | `score_v3_factors.py:1455,1493,1543,1547,1552` all 5 missing-paths call the DRY helper; sets `missing=True`, `genormaliseerde_score=0.0`, `data_bronnen=["brk_ownership_records"]`                                          |
| `enrich_parcel_data_with_brk`           | `BrkOwnershipRecord` table                                    | SELECT WHERE org_id + parcel_id + soft_deleted_at IS NULL, ORDER BY fetched_at DESC | WIRED   | `scoring_pipeline.py:115-125`; regression-pinned by `test_m050_s03_multitenant.py::test_enrich_filters_by_org_id`                                                                                                          |
| Feature flag `M050_S03_FACTORS_ENABLED` | `enrich_parcel_data_with_brk` short-circuit                   | top-of-function early return                                          | WIRED   | `scoring_pipeline.py:104` — FF-off returns parcel_data unchanged (no DB query, no key insertion); FF-on inserts `brk_records: list[...]`; pinned by `test_flag_off_all_3_brk_factors_missing_regardless_of_records` PASS |

All 10 key links WIRED.

---

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                                                       | Status      | Evidence                                                                                                                                                                                                                            |
| ----------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCOR-01     | 03-01, 03-02        | 3 nieuwe factoren in `score_v3_factors.py` registry: `hypotheek_risico`, `eigendoms_complexiteit`, `koopwaarde_trend` met conditional weights per projecttype | SATISFIED   | `score_v3.py:340-363` FACTOR_REGISTRY entries (cat=`risico`, bron=`brk`, weights 10/6/4); `score_v3_factors.py:1446/1483/1526` factor functions; `weight_by_projecttype` mechanism present on FactorRegistryEntry (set to None for these factors per same pattern as 13 of 16 existing risico factors) |
| SCOR-02     | 03-03               | BRK-write triggert `rescore_cascade_job(parcel_id)` async; frontend React Query refetch toont nieuwe scores binnen 60s | SATISFIED (backend) / NEEDS HUMAN (frontend) | Backend D7 hook + ARQ job + worker registration all WIRED + integration-tested. Frontend React Query refetch-within-60s flow is documented as out-of-scope for Phase 03 per the user prompt; flagged for human verification |
| SCOR-03     | 03-01, 03-02, 03-03 | Sparse-data fallback: parcels zonder BRK-coverage → `silent_neutral` (niet 0). Bestaande 16 score-v3 factoren ongewijzigd (REGRESSION-CRITICAL) | SATISFIED   | `_missing_brk` returns `missing=True` (silent-neutral semantics) + NOT in `_CRITICAL_RISK_FACTORS` (no penalty) + D3 redistribution rescales non-missing risico to sum=100. Regression on existing factor SIGNATURES locked (21 factor functions untouched, `git diff` zero deletions per 03-02-SUMMARY). Weight rebalance of 13 existing-risico integers is INTENTIONAL + DETERMINISTIC + REGRESSION-PINNED (`test_m050_s03_factor_weights.py`) — preserves sum=100 invariant |
| TEST-03     | 03-01, 03-02, 03-03 | Backend tests voor 3 nieuwe scoring-factoren + cascade-trigger + sparse-data fallback. REGRESSION-CRITICAL op bestaande 16 factoren + non-BRK rescore-triggers | SATISFIED   | 55/55 tests PASS in single run: 19 unit (BRK factors) + 9 unit (D3 math) + 4 unit (scoring_pipeline) + 4 regression (weights) + 5 regression (signatures) + 5 regression (narrative honesty) + 1 regression (multi-tenant) + 8 integration (D7+D3+F7+F8+F9). Non-BRK rescore-trigger (M047/S05 `rescore_parcels_for_document`) untouched. S02 BRK persist endpoint regression: 9/9 PASS |

No orphaned requirement IDs — REQUIREMENTS.md lists exactly SCOR-01/02/03 + TEST-03 for Phase 3, all covered.

---

### Anti-Patterns Found

None. Scans on `scoring_pipeline.py`, `score_v3.py`, `score_v3_factors.py`, `rescore_cascade_job.py`, `worker.py`, `brk_router.py`, `core/arq.py`, `config.py` show:
- No TODO/FIXME/XXX/HACK/PLACEHOLDER stubs in the new code paths
- No `return None` / `return {}` / empty-handler stubs
- No `console.log`-only / log-only functions
- D3 redistribution short-circuit guard documented + verified (×1.25 over-inflation root-cause + fix in 03-03-SUMMARY)
- `rescore_cascade_job.py` exceeds 300-LOC project limit (395 LOC) — plan-acknowledged exception (single related concern alongside M047/S05's `rescore_parcels_for_document`). Refactor deferred — not a blocker for goal achievement.

---

### Human Verification Required

#### 1. BRK persist → frontend score refetch within 60s

**Test:** With ARQ worker running and `M050_S03_FACTORS_ENABLED=True`:
1. Open cockpit for a parcel `NL.IMKAD.xxx` with no BRK data yet (all 3 BRK factors should show `missing=True`).
2. POST `/api/parcels/{parcel_id}/brk/persist` (or trigger via UI).
3. Wait ≤60s while observing the React Query cache state for the scan-result query.

**Expected:**
- Endpoint returns 200 immediately (D7 hook is best-effort, never blocks).
- ARQ worker picks up `rescore_parcel` job within seconds.
- `scan.flags['m050_s03_factors_at']` is bumped to current UTC ISO timestamp.
- `scan.flags['score_breakdown']` now contains the 3 BRK factors with `missing=False` and non-zero `bijdrage`.
- Frontend React Query refetch displays the updated breakdown within 60s.

**Why human:** End-to-end timing observation across a running worker + frontend session is not assertable via pytest. The Phase 03 user prompt explicitly tags the frontend refetch as outside this phase's scope; this is the surfaced human-verification gap.

---

### Gaps Summary

No backend gaps. The single open item is a human-verification step for the frontend refetch flow (SCOR-02 frontend half), which is explicitly out-of-scope per the user prompt. All 4 must-haves are backend-verified; all 55 M050/S03 backend tests + 9 S02 endpoint regression tests are green.

**Recommendation:** Mark Phase 03 closed for backend; carry forward the frontend refetch-within-60s verification into the M050/S06 frontend cockpit slice or schedule a manual smoke test at the next deploy that flips `M050_S03_FACTORS_ENABLED=True`.

---

*Verified: 2026-05-18T22:55:00Z*
*Verifier: Claude (gsd-verifier)*
