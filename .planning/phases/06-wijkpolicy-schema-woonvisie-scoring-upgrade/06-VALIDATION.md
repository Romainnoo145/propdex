---
phase: 6
slug: wijkpolicy-schema-woonvisie-scoring-upgrade
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-24
updated: 2026-04-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (existing) |
| **Config file** | `backend/pyproject.toml` (existing) |
| **Quick run command** | `cd backend && pytest tests/unit/test_wijk_policy_schema.py tests/unit/test_score_woonvisie_match_wijk_differentiation.py tests/unit/test_score_woonvisie_match_fallback.py -x` |
| **Full suite command** | `cd backend && pytest tests/ -x` |
| **Estimated runtime** | Quick: ~5s · Full: ~45s (290+ tests post-Phase-6) |

---

## Sampling Rate

- **After every task commit:** quick run command (<5s)
- **After every plan wave:** `cd backend && pytest tests/ -k "woonvisie or factor_extraction" -x` (<30s)
- **Before `/gsd:verify-work`:** full suite green + `ruff check backend/` + `mypy backend/`
- **Max feedback latency:** 5 seconds at task level, 30 seconds at wave level

---

## Per-Task Verification Map

> Each task in a PLAN.md maps to one row here. Wave 0 stubs (Plan 06-01) create test files; Waves 2/3/4 turn them green.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 01 | 1 | WOON-04 | unit (stub) | `cd backend && pytest tests/unit/test_wijk_policy_schema.py --collect-only` | ❌ NEW | ⬜ pending |
| 06-01-T1 | 01 | 1 | WOON-05 | unit (stub) | `cd backend && pytest tests/unit/test_wijk_policy_schema.py::test_payload_roundtrip --collect-only` | ❌ NEW | ⬜ pending |
| 06-01-T2 | 01 | 1 | SCORE-04 | unit (stub) | `cd backend && pytest tests/unit/test_score_woonvisie_match_wijk_differentiation.py --collect-only` | ❌ NEW | ⬜ pending |
| 06-01-T2 | 01 | 1 | SCORE-04 | unit (stub) | `cd backend && pytest tests/unit/test_score_woonvisie_match_wijk_differentiation.py::test_blerick_citaat_in_toelichting_lang --collect-only` | ❌ NEW | ⬜ pending |
| 06-01-T2 | 01 | 1 | SCORE-04 | unit (stub) | `cd backend && pytest tests/unit/test_score_woonvisie_match_wijk_differentiation.py::test_case_and_diacritic_insensitive_match --collect-only` | ❌ NEW | ⬜ pending |
| 06-01-T3 | 01 | 1 | SCORE-04 | unit (stub) | `cd backend && pytest tests/unit/test_score_woonvisie_match_fallback.py --collect-only` | ❌ NEW | ⬜ pending |
| 06-01-T3 | 01 | 1 | SCORE-04 | unit (stub) | `cd backend && pytest tests/unit/test_score_woonvisie_match_fallback.py::test_no_wijk_naam_falls_back_without_crash --collect-only` | ❌ NEW | ⬜ pending |
| 06-01-T4 | 01 | 1 | WOON-05 | unit | `cd backend && pytest tests/unit/test_factor_extraction_schemas.py::test_schema_version_is_at_least_three -x` | ✅ EDIT | ⬜ pending |
| 06-01-T4 | 01 | 1 | WOON-05 | unit/integration (stub) | `cd backend && pytest tests/unit/test_factor_extraction_service.py::test_v3_cache_entry_is_miss_after_bump_to_v4 --collect-only` | ✅ EDIT | ⬜ pending |
| 06-01-T5 | 01 | 1 | TEST-06 | smoke | `cd backend && pytest tests/ --collect-only 2>&1 \| tail -3` (collection count ↑≥ 16) | ✅ | ⬜ pending |
| 06-02-T1 | 02 | 2 | WOON-04 | implementation | `cd backend && pytest tests/unit/test_wijk_policy_schema.py -x` (GOES GREEN) | ✅ | ⬜ pending |
| 06-02-T2 | 02 | 2 | WOON-05 | implementation | `cd backend && pytest tests/unit/test_factor_extraction_schemas.py tests/unit/test_factor_extraction_service.py::test_v3_cache_entry_is_miss_after_bump_to_v4 -x` (GOES GREEN) | ✅ | ⬜ pending |
| 06-03-T1 | 03 | 3 | SCORE-04 | implementation | `cd backend && pytest tests/unit/test_score_woonvisie_match_wijk_differentiation.py tests/unit/test_score_woonvisie_match_fallback.py -x` (GOES GREEN) | ✅ | ⬜ pending |
| 06-04-T1 | 04 | 4 | TEST-06 | integration | `cd backend && pytest tests/integration/test_woonvisie_match.py -x` | ✅ EDIT | ⬜ pending |
| 06-04-T2 | 04 | 4 | TEST-06 | smoke | `cd backend && pytest tests/ -x && ruff check . && mypy .` | ✅ full suite | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Note:** Plan 06-01 stubs intentionally fail red at commit time (ImportError on `WijkPolicy`) — the `--collect-only` verify commands above confirm the stubs collect syntactically. Plans 06-02 / 06-03 / 06-04 turn them green incrementally.

---

## Wave 0 Requirements

All Wave 0 stubs are created in Plan 06-01 (Wave 1 in the execution graph — Wave 0 here refers to the Nyquist "tests must exist before implementation" convention, not a separate wave).

- [x] `backend/tests/unit/test_wijk_policy_schema.py` — stubs for WOON-04 + WOON-05 (Pydantic validation roundtrip + literal rejection) — created in 06-01-T1
- [x] `backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py` — stubs for SCORE-04 (Blerick vs Venlo-Centrum, citaat in toelichting_lang, case/diacritic-insensitive match, longest-match) — created in 06-01-T2
- [x] `backend/tests/unit/test_score_woonvisie_match_fallback.py` — stubs for SCORE-04 (empty wijk_policies, wijk_naam=None no-crash, wijk-not-found, payload=None missing=True) — created in 06-01-T3
- [x] Edit `backend/tests/unit/test_factor_extraction_service.py` — add `test_v3_cache_entry_is_miss_after_bump_to_v4` alongside existing Phase-5 v2→v3 test — in 06-01-T4
- [x] Edit `backend/tests/unit/test_factor_extraction_schemas.py` — version-agnostic assertion (>= 3 via SCHEMA_VERSION constant) instead of `== 3` — in 06-01-T4
- [x] Edit `backend/tests/integration/test_woonvisie_match.py` — rewrite 6 existing tests to use `wijk_policies=[WijkPolicy(...)]` shape + add `test_venlo_smoke_wijk_differentiation` — in 06-04-T1

No framework install needed (pytest already configured in `backend/pyproject.toml`). No new fixtures beyond existing `test_db` + `create_test_user` in `backend/tests/conftest.py`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Venlo woonvisie PDF extraction produces plausible `wijk_policies` entries | SCORE-04 / TEST-06 | Claude API nondeterminism + real-PDF text heterogeneity; automated tests mock the extractor. | Run `python -m app.jobs.worker` + trigger cascade enrichment for a Venlo parcel via admin; inspect stored `WoonvisiePayload` JSON in DB for ≥ 1 wijk_policy with non-empty `citaat`. Deferred to Phase 8 E2E. |
| Frontend popup renders `toelichting_lang` citaat correctly in Aura glass surface | SCORE-04 | Phase 3 UI consumer not in scope of Phase 6; only contract is validated here. | Post-Phase-3 merge: open ParcelDetailModal for Blerick parcel, verify citaat string visible in woonvisie factor card. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ NEW references above
- [x] No watch-mode flags in test commands
- [x] Feedback latency < 5s quick / < 30s wave
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-complete (Wave-0 stubs will be created in Plan 06-01 execution; current file references are forward-looking).
