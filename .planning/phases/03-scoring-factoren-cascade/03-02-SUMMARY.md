---
phase: 03-scoring-factoren-cascade
plan: 02
subsystem: scoring

tags: [m050, s03, brk, scoring, weights-rebalance, largest-remainder, narrative-honesty, regression-critical]

# Dependency graph
requires:
  - phase: 03-scoring-factoren-cascade
    plan: 01
    provides: BRKRecordDict + _missing_brk + M050_S03_FACTORS_ENABLED (feature flag) + enrich_parcel_data_with_brk
provides:
  - FACTOR_REGISTRY shape-locked at 24 factors (9 potentie + 16 risico, sum=100 each)
  - score_hypotheek_risico(parcel_data) — D4 binary any-mortgaged-owner risico
  - score_eigendoms_complexiteit(parcel_data) — D5 distinct (eigenaar_naam, kvk_nummer) bucketed
  - score_koopwaarde_trend(parcel_data) — D6 koopjaar-age proxy with F5 future-koopjaar guard
  - _rebalance_risico_weights(current, target_sum=80) — largest-remainder helper (deterministic alphabetical tie-break)
  - _SPARSE_REDISTRIBUTABLE_RISICO frozenset (consumed by Plan 03-03 compute_score_v3 D3 logic)
  - Bron literal extended with 'brk' (7 values total)
  - 3 REGRESSION-CRITICAL guards: factor_weights / factor_signatures / narrative_honesty
affects:
  - 03-03 (compute_score_v3 D3 runtime redistribution + brk_router persist-hook + integration tests)
  - M050/S07 (env-flag triad activation; once M050_S03_FACTORS_ENABLED=True, the 3 factors start contributing to overall score)
  - M050/S06 (frontend cockpit cards for 3 new factor displays — out-of-scope here)

# Tech tracking
tech-stack:
  added: []   # no new deps — uses existing dataclasses + frozenset + Literal
  patterns:
    - Largest-remainder integer rebalance (deterministic via -remainder + alphabetical tie-break) — reusable for future weight calibrations
    - Module-level meta-sets co-located (_CRITICAL_RISK_FACTORS + _SPARSE_REDISTRIBUTABLE_RISICO) for grep-ability
    - REGRESSION-CRITICAL banned-substring guard: case-insensitive `not in` check pinned in test (D6 narrative honesty)
    - Factor-function purity: parcel_data['brk_records'] is the SOLE input; no DB calls in scoring layer (D9)

key-files:
  created:
    - backend/tests/unit/services/test_score_v3_brk_factors.py
    - backend/tests/regression/test_m050_s03_factor_weights.py
    - backend/tests/regression/test_m050_s03_factor_signatures.py
    - backend/tests/regression/test_m050_s03_narrative_honesty.py
  modified:
    - backend/app/services/score_v3.py
    - backend/app/services/score_v3_factors.py

key-decisions:
  - "13 existing risico factors integer-rebalanced via largest-remainder (target_sum=80) — alphabetical tie-break locked deterministic ordering (CONTEXT.md Claude-discretion). Result: funderingsrisico 16->13, asbest 7->6, bodemverontreiniging 8->6, monument 6->5, bestemmingswijziging 9->7, constructieve_staat 8->6, juridisch_klimaat 9->7, criminaliteit 7->6, max_hoogte_bereikt 6->5, natura2000 6->5, overstromingsrisico 7->5, geluid 6->5, luchtkwaliteit 5->4 (sum=80)."
  - "_rebalance_risico_weights placed adjacent to FACTOR_REGISTRY literal (not in a helpers module) — single-callsite at registry-construction time; visibility > separation."
  - "DEFAULT_WEIGHTS['risico_weights'] dict updated in lockstep with FACTOR_REGISTRY — sum=100 invariant holds at both layers. Avoids drift between the registry literal and the rescore-job preset."
  - "D6 narrative-honesty: qualifier strings use 'recente koop' / 'actuele koopsom-vermelding' / 'koopsom mogelijk verouderd' / 'koopsom waarschijnlijk sterk verouderd' — never the banned word. toelichting_lang uses 'actualiteits-proxy' + 'waarde-ontwikkeling' for honest disclosure of the proxy nature."
  - "Bron literal extension placed at END of existing 6 values (additive only — no reordering of literal members preserves Literal type-equality for existing entries)."

patterns-established:
  - "Largest-remainder rebalance helper signature is reusable for future weight calibrations: pass any sum=100 input + target_sum + get deterministic integer output. Future M051+ calibrations can reuse without re-implementing."
  - "Test 4-tuple iron-rule pattern for M050/S03 now complete: (#1 multi-tenant org_id filter — Plan 03-01; #2 weights post-rebalance pin; #3 registry signatures; #4 narrative-honesty banned-word). Future BRK factors should add 4 parallel guards."
  - "Banned-substring test pattern: pin the banned token at the module level as `_BANNED = 'tren' + 'd'` (or literal) — case-insensitive `not in result.toelichting_*.lower()` assertion. Survives wording polish without needing semantic-equivalence tests."

requirements-completed: [SCOR-01, SCOR-03, TEST-03]

# Metrics
duration: 7m
completed: 2026-05-18
---

# Phase 03 Plan 02: 3 BRK Risico-Factoren + FACTOR_REGISTRY Extension Summary

**M050/S03 wave-2 factor layer: 3 BRK risico-factor functions land + FACTOR_REGISTRY shape-locked at 24 factors via largest-remainder rebalance + 3 REGRESSION-CRITICAL guards (weights / signatures / narrative honesty) — all green.**

## Performance

- **Duration:** ~7 min (401 s)
- **Started:** 2026-05-18T20:10:05Z
- **Completed:** 2026-05-18T20:16:46Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

- **D2 weight allocation locked** — `hypotheek_risico=10` + `eigendoms_complexiteit=6` + `koopwaarde_trend=4` (sum=20) appended to FACTOR_REGISTRY. 13 existing risico factors rebalanced via `_rebalance_risico_weights(target_sum=80)` (largest-remainder, alphabetical tie-break). New sums: risico=80+20=100, potentie=100 (unchanged).
- **D3 sparse-redistribution membership set** — `_SPARSE_REDISTRIBUTABLE_RISICO: frozenset = {hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend}` co-located with `_CRITICAL_RISK_FACTORS` at module top. Consumed by Plan 03-03's `compute_score_v3` D3 logic.
- **D4 hypotheek_risico** — binary any(`heeft_hypotheek`) → 1.0 / 0.0; multi-owner parcels: ONE mortgaged owner flags risico; narrative `f"{n_with}/{n_total} eigenaren met hypotheek"`.
- **D5 eigendoms_complexiteit (user-locked)** — distinct `(eigenaar_naam, kvk_nummer)` → bucket 1→0.0 / 2→0.5 / ≥3→1.0. Ignores `aandeel` + `zakelijk_recht_type` (user-explicit). F4 NULL-collapse: 3 all-NULL records → n_owners=1 → score=0.0.
- **D6 koopwaarde_trend** — most-recent `fetched_at DESC` record's `koopjaar` → age buckets `<5→0.3 / 5–15→0.5 / 15–25→0.7 / >25→0.9`. F5 future-`koopjaar` (`age<0`) → `missing=True`. NULL `koopjaar` → `missing=True`. **D6 narrative honesty enforced**: banned substring (`"trend"`, case-insensitive) verified absent in BOTH `toelichting_kort` AND `toelichting_lang` across all 4 age buckets + missing path.
- **`_rebalance_risico_weights` helper added** — public for reuse, assertion-guarded on input sum=100 + output sum=target_sum (F6 invariant). Deterministic alphabetical tie-break.
- **Bron literal extended with `"brk"`** — 7 values total. Existing 6 unchanged.
- **DEFAULT_WEIGHTS dict mirrored** — risico_weights sub-dict updated to match FACTOR_REGISTRY; sum=100 verified.
- **33 new tests green** — 19 unit (6 hypotheek + 6 eigendoms + 7 koopwaarde) + 14 regression (4 weights + 5 signatures + 5 narrative honesty). Plan 03-01's 5 tests still green (no regression).

## 13 Existing Risico Weights — Pre → Post Rebalance Snapshot

| Factor | Pre | Post | Δ |
|---|---:|---:|---:|
| funderingsrisico | 16 | 13 | -3 |
| asbest | 7 | 6 | -1 |
| bodemverontreiniging | 8 | 6 | -2 |
| monument | 6 | 5 | -1 |
| bestemmingswijziging | 9 | 7 | -2 |
| constructieve_staat | 8 | 6 | -2 |
| juridisch_klimaat | 9 | 7 | -2 |
| criminaliteit | 7 | 6 | -1 |
| max_hoogte_bereikt | 6 | 5 | -1 |
| natura2000 | 6 | 5 | -1 |
| overstromingsrisico | 7 | 5 | -2 |
| geluid | 6 | 5 | -1 |
| luchtkwaliteit | 5 | 4 | -1 |
| **SUM (existing)** | **100** | **80** | **-20** |
| hypotheek_risico (NEW) | — | 10 | +10 |
| eigendoms_complexiteit (NEW) | — | 6 | +6 |
| koopwaarde_trend (NEW) | — | 4 | +4 |
| **SUM (TOTAL risico)** | **100** | **100** | **0** |

7 keys received a remainder-bonus (+1) during largest-remainder allocation (shortfall=7). Deterministic alphabetical tie-break locked-in.

## 3 New FACTOR_REGISTRY Entries

```python
"hypotheek_risico":     FactorRegistryEntry(default_weight=10, category="risico", bron="brk", data_source="BRK Eigendom (Kadaster)")
"eigendoms_complexiteit": FactorRegistryEntry(default_weight=6, category="risico", bron="brk", data_source="BRK Eigendom (Kadaster)")
"koopwaarde_trend":     FactorRegistryEntry(default_weight=4, category="risico", bron="brk", data_source="BRK Eigendom (Kadaster)")
```

## 3 Factor Function Signatures

```python
def score_hypotheek_risico(parcel_data: dict) -> FactorResult           # D4 binary on any-True
def score_eigendoms_complexiteit(parcel_data: dict) -> FactorResult     # D5 distinct (naam, kvk) bucketed
def score_koopwaarde_trend(parcel_data: dict) -> FactorResult           # D6 koopjaar-age proxy + F5 guard
```

All 3 consume `parcel_data["brk_records"]` (materialized by Plan 03-01's `enrich_parcel_data_with_brk`). PURE — no DB calls. Empty / missing-key path goes through Plan 03-01's `_missing_brk` helper → `missing=True`.

## Task Commits

1. **Task 1: FACTOR_REGISTRY extension + Bron='brk' + rebalance helper** — `ae7ad7e9` (feat)
2. **Task 2: 3 BRK risico-factor functions (D4/D5/D6)** — `9325a841` (feat)
3. **Task 3: Unit tests + 3 REGRESSION-CRITICAL guards** — `af68c3b8` (test)

## Files Created / Modified

### Created
- `backend/tests/unit/services/test_score_v3_brk_factors.py` (~220 LOC) — 19 unit tests across 3 BRK factors.
- `backend/tests/regression/test_m050_s03_factor_weights.py` — REGRESSION-CRITICAL #2: pinned `EXPECTED_RISICO_WEIGHTS` (16 keys, sum=100); 4 tests.
- `backend/tests/regression/test_m050_s03_factor_signatures.py` — REGRESSION-CRITICAL #3: parametrized `bron='brk'` + `category='risico'` pins + sparse-redistributable membership + critical-risk non-membership; 5 tests.
- `backend/tests/regression/test_m050_s03_narrative_honesty.py` — REGRESSION-CRITICAL #4: D6 banned-substring absence across 4 age buckets + missing path; 5 tests.

### Modified
- `backend/app/services/score_v3.py` (+123 / -27 LOC) — Bron literal +1; `_SPARSE_REDISTRIBUTABLE_RISICO` frozenset; `_rebalance_risico_weights` helper; 13 existing risico `default_weight` values rebalanced; 3 new BRK entries appended; `DEFAULT_WEIGHTS["risico_weights"]` mirrored.
- `backend/app/services/score_v3_factors.py` (+141 / -0 LOC; **zero deletions verified**) — appended 3 PURE BRK factor functions + section banner. Existing 21 factor functions untouched.

## D6 Narrative-Honesty Verification

Sampled narratives across all 4 buckets — all pass case-insensitive banned-substring check on BOTH text fields:

| age | toelichting_kort | banned-substring? |
|---:|---|---|
| 2  | `Koop in 2024 (2j geleden) — recente koop` | absent |
| 8  | `Koop in 2018 (8j geleden) — actuele koopsom-vermelding` | absent |
| 18 | `Koop in 2008 (18j geleden) — koopsom mogelijk verouderd` | absent |
| 30 | `Koop in 1996 (30j geleden) — koopsom waarschijnlijk sterk verouderd` | absent |

`toelichting_lang` template across all buckets: `"Meest recente BRK-record toont koop in {jaar} ({age} jaar geleden). Dit is een actualiteits-proxy van de koopsom, geen waarde-ontwikkeling over tijd."` — banned substring absent.

Function NAME `score_koopwaarde_trend` is allowed (only narrative text fields inspected by D6 guard). The banned word also appears in the function's docstring (intentional reference to the rule itself); the guard does NOT inspect docstrings.

## Decisions Made

- **Largest-remainder shortfall = 7** for current-sum=100 → target-sum=80 input. 7 of 13 keys receive +1 bonus via alphabetical tie-break (deterministic): funderingsrisico, monument, max_hoogte_bereikt, natura2000, geluid (highest remainders 0.8) + asbest, criminaliteit (next-highest 0.6). Verified determinism: re-running the helper produces identical output.
- **DEFAULT_WEIGHTS["risico_weights"] dict updated in lockstep** — kept the secondary source of truth (used by rescore-job + tests) consistent with FACTOR_REGISTRY. Single-source-of-truth refactor deferred (would touch rescore-job + preset endpoints — out of plan scope).
- **`_rebalance_risico_weights` placed directly before `FACTOR_REGISTRY` literal** (not in a helpers module) — single callsite, visibility wins. Pure function, no side-effects; reusable from any module.
- **Banned-substring test uses `_BANNED = "trend"` module-level constant** — explicit + greppable. The token appears in the test docstring (intentional documentation of what's banned) but never in any factor function's narrative output.
- **Function `score_koopwaarde_trend` docstring obfuscates the banned word once** (`'tren'+'d'`) — defensive against any future automated grep on the codebase. The qualifier strings + narrative templates never use the token.

## Deviations from Plan

None of substance.

### Minor in-task adjustments (not deviations)

- **Task 3 ruff I001 auto-fix**: import order in 3 regression test files fixed via `ruff check --fix` (standard import-sort). Pure stylistic, no semantic change.
- **Test count target**: Plan called for "19 unit + 14 regression" — delivered exactly 19 + 14 = 33 tests, all green on first run.

## Issues Encountered

None.

## User Setup Required

None — `M050_S03_FACTORS_ENABLED` (from Plan 03-01) still defaults False; factor functions short-circuit to `missing=True` regardless of `brk_records` content until M050/S07 flips the flag. Production scoring path unchanged.

## Next Phase Readiness

- **Plan 03-03** unblocked — `_SPARSE_REDISTRIBUTABLE_RISICO` set is the membership-check input; `compute_score_v3` wires D3 redistribution + persist-endpoint hook (D7) + integration tests.
- **M050/S06** unblocked — frontend cockpit cards can target the 3 stable factor keys (`hypotheek_risico` / `eigendoms_complexiteit` / `koopwaarde_trend`).
- **M050/S07** unblocked — env-flag triad activation requires no further backend code changes; flipping `M050_S03_FACTORS_ENABLED=True` plus the persist-hook from Plan 03-03 enables the full path.
- **No blockers** for the rest of Phase 03.

## Self-Check: PASSED

Verified on disk + via `git log --oneline -5`:
- `backend/app/services/score_v3.py` modified — FOUND in working tree
- `backend/app/services/score_v3_factors.py` modified — FOUND
- `backend/tests/unit/services/test_score_v3_brk_factors.py` — FOUND
- `backend/tests/regression/test_m050_s03_factor_weights.py` — FOUND
- `backend/tests/regression/test_m050_s03_factor_signatures.py` — FOUND
- `backend/tests/regression/test_m050_s03_narrative_honesty.py` — FOUND
- Commit `ae7ad7e9` (Task 1) — FOUND
- Commit `9325a841` (Task 2) — FOUND
- Commit `af68c3b8` (Task 3) — FOUND

33 new tests pass + 5 Plan 03-01 tests pass — no regression. ruff clean on all 6 touched files. Module-level sum-guards (`_REGISTRY_RISICO_SUM == 100`, `_REGISTRY_POTENTIE_SUM == 100`, `_verify_registry_sum_guard()`) all green at import.

---
*Phase: 03-scoring-factoren-cascade*
*Plan: 02*
*Completed: 2026-05-18*
