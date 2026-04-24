---
phase: 6
slug: wijkpolicy-schema-woonvisie-scoring-upgrade
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
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
| **Estimated runtime** | Quick: ~5s · Full: ~45s (275+ tests) |

---

## Sampling Rate

- **After every task commit:** quick run command (<5s)
- **After every plan wave:** `cd backend && pytest tests/ -k "woonvisie or factor_extraction" -x` (<30s)
- **Before `/gsd:verify-work`:** full suite green + `ruff check backend/` + `mypy backend/`
- **Max feedback latency:** 5 seconds at task level, 30 seconds at wave level

---

## Per-Task Verification Map

> Filled by planner. Each task in a PLAN.md must map to one row here (or a Wave-0 stub).

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-XX-XX | TBD  | TBD  | WOON-04 | unit | `pytest backend/tests/unit/test_wijk_policy_schema.py -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | WOON-05 | unit | `pytest backend/tests/unit/test_wijk_policy_schema.py::test_payload_roundtrip -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | WOON-05 | unit | `pytest backend/tests/unit/test_factor_extraction_schemas.py -x` | ✅ EDIT | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | WOON-05 | unit/integration | `pytest backend/tests/unit/test_factor_extraction_service.py::test_v3_cache_entry_is_miss_after_bump_to_v4 -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | SCORE-04 | unit | `pytest backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | SCORE-04 | unit | `pytest backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py::test_blerick_citaat_in_toelichting_lang -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | SCORE-04 | unit | `pytest backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py::test_case_and_diacritic_insensitive_match -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | SCORE-04 | unit | `pytest backend/tests/unit/test_score_woonvisie_match_fallback.py -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | SCORE-04 | unit | `pytest backend/tests/unit/test_score_woonvisie_match_fallback.py::test_no_wijk_naam_falls_back_without_crash -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | TEST-06 | integration | `pytest backend/tests/integration/test_woonvisie_match.py -x` | ✅ EDIT | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | TEST-06 | integration | `pytest backend/tests/integration/test_woonvisie_match.py::test_venlo_smoke_wijk_differentiation -x` | ❌ W0 | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | TEST-06 | integration | `pytest backend/tests/integration/test_woonvisie_match.py::test_extract_factor_woonvisie_cache_hit -x` | ✅ EDIT | ⬜ pending |
| 6-XX-XX | TBD  | TBD  | TEST-06 | smoke | `cd backend && pytest tests/ -x` | ✅ full suite | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_wijk_policy_schema.py` — stubs for WOON-04 + WOON-05 (Pydantic validation roundtrip + literal rejection)
- [ ] `backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py` — stubs for SCORE-04 (Blerick vs Venlo-Centrum, citaat in toelichting_lang, case/diacritic-insensitive match)
- [ ] `backend/tests/unit/test_score_woonvisie_match_fallback.py` — stubs for SCORE-04 (empty wijk_policies, wijk_naam=None no-crash)
- [ ] Edit `backend/tests/unit/test_factor_extraction_service.py` — add `test_v3_cache_entry_is_miss_after_bump_to_v4` alongside existing Phase-5 v2→v3 test
- [ ] Edit `backend/tests/unit/test_factor_extraction_schemas.py` — version-agnostic assertion (use `SCHEMA_VERSION` constant or `>= 4`) instead of `== 3`
- [ ] Edit `backend/tests/integration/test_woonvisie_match.py` — rewrite 6 existing tests to use `wijk_policies=[WijkPolicy(...)]` shape; add `test_venlo_smoke_wijk_differentiation`

No framework install needed (pytest already configured in `backend/pyproject.toml`). No new fixtures beyond existing `test_db` + `create_test_user` in `backend/tests/conftest.py`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Venlo woonvisie PDF extraction produces plausible `wijk_policies` entries | SCORE-04 / TEST-06 | Claude API nondeterminism + real-PDF text heterogeneity; automated test mocks extractor. | Run `python -m app.jobs.worker` + trigger cascade enrichment for a Venlo parcel via admin; inspect stored `WoonvisiePayload` JSON in DB for ≥1 wijk_policy with non-empty `citaat`. |
| Frontend popup renders `toelichting_lang` citaat correctly in Aura glass surface | SCORE-04 | Phase 3 UI consumer not in scope of phase 6; only contract is validated. | Post-phase 3 merge: open ParcelDetailModal for Blerick parcel, verify citaat string visible in woonvisie factor card. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ W0 references above
- [ ] No watch-mode flags in test commands
- [ ] Feedback latency < 5s quick / < 30s wave
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills task IDs

**Approval:** pending
