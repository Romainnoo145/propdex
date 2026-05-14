---
phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade
verified: 2026-04-25T00:35:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 6: WijkPolicy schema + woonvisie scoring upgrade — Verification Report

**Phase Goal:** Woonvisie-extractie produceert per-wijk beleid (prioriteit + gewenste segmenten + citaat) i.p.v. gemeente-brede platte lijsten. `score_woonvisie_match` differentieert tussen percelen in verschillende wijken binnen dezelfde gemeente.
**Verified:** 2026-04-25T00:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| #   | Truth (Success Criterion)                                                                                       | Status     | Evidence |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 1   | `WijkPolicy` pydantic model bestaat met velden `wijk_naam`, `prioriteit`, `gewenste_segmenten`, `citaat`, `pagina` | ✓ VERIFIED | `backend/app/ai/factors/woonvisie_match.py:17-34` — class WijkPolicy(BaseModel) with Literal prioriteit (groei/krimp/herstructurering/neutraal), Literal gewenste_segmenten (sociaal/midden/duur/gemengd), citaat min_length=1, pagina int\|None ge=1 |
| 2   | `WoonvisiePayload` uitgebreid met `wijk_policies: list[WijkPolicy]` + `algemeen_citaat: str` + `confidence: float`  | ✓ VERIFIED | `woonvisie_match.py:59-66,77` — wijk_policies + algemeen_citaat defaults; confidence pre-existing at 0..1. Deprecated fields retained for cache-roundtrip per plan 06-02. |
| 3   | SCHEMA_VERSION bump 3→4 invalideert oude payload-shape entries                                                  | ✓ VERIFIED | `backend/app/ai/factor_extraction_schemas.py:114` — `SCHEMA_VERSION: int = 4`; ExtractedFactor.schema_version default=4 at line 64. |
| 4   | `score_woonvisie_match()` matches `WijkPolicy` via substring-logica; prioriteit-basis en segment-bonus scoring | ✓ VERIFIED | `score_v3_factors.py:1263-1273` substring match with `_normalize_wijk` (casefold + NFKD + hyphen-normalise); `_PRIORITEIT_SCORE_DELTA` groei=+3/herstructurering=+1.5/krimp=-2.5; segment overlap +2.0 / mismatch -1.0 at lines 1307-1317. |
| 5   | `citaat` beschikbaar in `toelichting_lang` van `FactorResult` voor Phase 3 popup                                | ✓ VERIFIED | `score_v3_factors.py:1326-1329` — `toelichting_lang = ... f"Citaat ({matched.wijk_naam}{pag_suffix}): {matched.citaat}"`. Also `waarde["matched_policy"] = matched.model_dump()` gives popup direct access to citaat+pagina+prioriteit. |
| 6   | Venlo-smoke: Blerick (groei + sociaal) scoort anders dan Venlo-Centrum (neutraal) met hetzelfde projecttype    | ✓ VERIFIED | `tests/integration/test_woonvisie_match.py::test_venlo_smoke_wijk_differentiation` asserts Blerick > Venlo-Centrum en `abs(diff) >= 0.2` for project_type=nieuwbouw_wonen. Test passed (12/12 integration tests green). |
| 7   | Pre-existing 275 tests groen na schema wijziging                                                                | ✓ VERIFIED | Phase 4 SUMMARY records 1625 green / 68 pre-existing failures (none woonvisie/wijk-policy related). 28 Phase-6 tests green (16 unit + 12 integration); ruff clean on touched files. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                                      | Expected                                                                                          | Status     | Details |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- | ------- |
| `backend/app/ai/factors/woonvisie_match.py`                                   | WijkPolicy + WoonvisiePayload(wijk_policies,algemeen_citaat) + _INPUT_SCHEMA nested + prompt       | ✓ VERIFIED | 173 lines. WijkPolicy class defined with all five Literal fields, _INPUT_SCHEMA includes nested wijk_policies array with additionalProperties:false on item, required list is [periode_start, periode_einde, confidence] only (vague docs allowed), prompt_instructions rewritten for per-wijk extraction + "Geen hallucinaties" rule. |
| `backend/app/ai/factor_extraction_schemas.py`                                 | `SCHEMA_VERSION = 4`                                                                               | ✓ VERIFIED | Line 114 reads `SCHEMA_VERSION: int = 4` with Phase-6 bump comment; ExtractedFactor.schema_version default=4 at line 64. |
| `backend/app/services/score_v3_factors.py`                                    | Rewritten score_woonvisie_match + _normalize_wijk + _PRIORITEIT_SCORE_DELTA + _PROJECTTYPE_SEGMENT_MAP | ✓ VERIFIED | All four symbols at lines 1202-1231 + rewritten function at 1234-1348. Imports `unicodedata` at line 10 and `WijkPolicy, WoonvisiePayload` at line 16. FactorResult.waarde is dict {matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}. |
| `backend/tests/unit/test_wijk_policy_schema.py`                               | 7 Pydantic validation tests for WijkPolicy + WoonvisiePayload                                     | ✓ VERIFIED | 7 tests (accept valid, reject empty citaat, reject invalid prioriteit, reject invalid segment, accept None pagina, payload roundtrip, defaults for new fields). Green. |
| `backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py`       | Blerick vs Venlo-Centrum differentiation + case/diacritic + matched_policy + longest-match        | ✓ VERIFIED | 5 tests (blerick_higher, citaat_in_toelichting, matched_policy_in_waarde, case_and_diacritic_insensitive, longest_match_wins). All green. |
| `backend/tests/unit/test_score_woonvisie_match_fallback.py`                   | Empty wijk_policies + wijk_naam=None + no-match + None-payload fallback                            | ✓ VERIFIED | 4 tests (empty_policies_uses_algemeen_citaat, no_wijk_falls_back_without_crash, wijk_not_found_falls_back, none_payload_returns_missing). Green. |
| `backend/tests/integration/test_woonvisie_match.py`                           | 6 rewritten tests + Venlo-smoke                                                                    | ✓ VERIFIED | 12 tests total (6 rewritten unit-level + 2 compute_score_v3 breakdown + 1 Venlo-smoke + 3 cascade_enrichment_service). All 12 green. Venlo-smoke asserts `abs(blerick - centrum) >= 0.2`. |

### Key Link Verification

| From                                                                           | To                                                                                  | Via                                                             | Status  | Details |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------- | ------- |
| `backend/app/services/score_v3_factors.py`                                     | `backend/app/ai/factors/woonvisie_match.py` (WijkPolicy, WoonvisiePayload)           | `from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload` | WIRED   | Line 16 (TYPE_CHECKING guarded). `WijkPolicy | None` annotation at line 1264; `payload.wijk_policies`, `payload.algemeen_citaat`, `payload.confidence` accessed throughout. |
| `_INPUT_SCHEMA.properties.wijk_policies`                                       | `WijkPolicy` Pydantic model                                                          | Manual-mirror property shape                                     | WIRED   | Schema items.required = [wijk_naam, prioriteit, gewenste_segmenten, citaat]; Pydantic model has same four required fields + optional pagina. Top-level required = [periode_start, periode_einde, confidence] — matches plan 06-02 truth. |
| `FactorResult.waarde` dict                                                     | Phase 3 WoonvisiePopup consumer contract                                             | `waarde={"matched_wijk", "matched_policy", "prioritized_segment", "algemeen_citaat"}` | WIRED   | `score_v3_factors.py:1290-1295, 1332-1339`. `matched_policy` is `matched.model_dump()` on hit, `None` on fallback. Legacy `prioritized_segment` field retained so `PotentieLayer.tsx:203-204` keeps working (frontend audit confirmed). |
| `cache `_get_cache_hit` WHERE schema_version = SCHEMA_VERSION`                 | v3 entries become cache-miss after bump                                              | factor_extraction_service.py SQL predicate                        | WIRED   | Validated by `test_v3_cache_entry_is_miss_after_bump_to_v4` in test_factor_extraction_service.py (green) + pattern reused from Phase 5 v2→v3 bump. |
| `tests/integration/test_woonvisie_match.py::test_extract_factor_woonvisie_cache_hit` | `WOONVISIE_MATCH_FACTOR_DEF` Claude tool-use flow                                    | mock Anthropic client → extract_factor → cache read              | WIRED   | Round-trip test green: 1st call from_cache=False, 2nd from_cache=True, `mock_client.messages.create.call_count == 1` after both. Asserts `r1.payload.wijk_policies[0].wijk_naam == "Blerick-Oost"`. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description                                                                                                                       | Status        | Evidence |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------- |
| WOON-04     | 06-01, 06-02   | `WijkPolicy` pydantic model met velden wijk_naam/prioriteit/gewenste_segmenten/citaat/pagina                                     | ✓ SATISFIED   | `woonvisie_match.py:17-34` WijkPolicy class — all 5 fields with Literal types + min_length/ge constraints. Unit tests in test_wijk_policy_schema.py green. REQUIREMENTS.md line 106 "Complete". |
| WOON-05     | 06-01, 06-02   | `WoonvisiePayload` uitgebreid met `wijk_policies`, `algemeen_citaat`, `confidence`; SCHEMA_VERSION bump 3→4                       | ✓ SATISFIED   | `woonvisie_match.py:59-66,77` new fields; `factor_extraction_schemas.py:114` SCHEMA_VERSION=4. REQUIREMENTS.md line 107 "Complete". |
| SCORE-04    | 06-01, 06-03   | `score_woonvisie_match()` uses per-wijk `WijkPolicy` to produce differentiating scores                                             | ✓ SATISFIED   | `score_v3_factors.py:1234-1348` rewritten scorer reads only `wijk_policies/algemeen_citaat/confidence`; Blerick > Centrum proved by wijk_differentiation tests (5 green) + Venlo-smoke. REQUIREMENTS.md line 102 "Complete". |
| TEST-06     | 06-01, 06-04   | Unit/integration tests cover WijkPolicy schema + scoring — Venlo Blerick vs Venlo-Centrum produce verschillende scores            | ✓ SATISFIED   | 16 unit tests + 12 integration tests = 28 new/rewritten, all green. Venlo-smoke at `test_woonvisie_match.py:186-233` asserts diff ≥ 0.2. REQUIREMENTS.md line 120 "Complete". |

**Orphaned check:** `grep "Phase 6" .planning/REQUIREMENTS.md` returns exactly the 4 IDs above. No orphaned requirements — every Phase 6 REQ is accounted for in a plan's frontmatter.

### Anti-Patterns Found

| File                                                             | Line | Pattern          | Severity | Impact |
| ---------------------------------------------------------------- | ---- | ---------------- | -------- | ------ |
| _None found_                                                     | -    | TODO/FIXME/stub  | -        | Ruff clean on all 7 touched files. No TODO/FIXME/PLACEHOLDER comments introduced by Phase 6 in modified regions. |

### Human Verification Required

None. All success criteria are programmatically verifiable via tests + grep and all passed. Phase 3 (woonvisie popup) will consume `waarde.matched_policy` and provide UI-level human verification at that time; Phase 6 is pure backend schema + scoring.

### Gaps Summary

No gaps. Phase 6 delivers:
1. **WijkPolicy data contract** (Pydantic + JSON Schema + prompt) ready for Claude extraction.
2. **Per-wijk differentiating scorer** with NFKD+casefold+hyphen-normaliser (`_normalize_wijk`), longest-match tiebreak, prioriteit-basis + segment × projecttype bonus, confidence-pull.
3. **SCHEMA_VERSION 3→4** invalidates v3 cache entries via existing WHERE clause (Phase-5 reused pattern, no migration).
4. **Rich `FactorResult.waarde` dict** (matched_wijk/matched_policy/prioritized_segment/algemeen_citaat) + `toelichting_lang` with literal citaat(p.{pagina}) — everything Phase 3 WoonvisiePopup needs is populated.
5. **Venlo-smoke** proves Blerick (groei + sociaal-overlap for nieuwbouw_wonen) ≥ 0.2 score-diff vs Venlo-Centrum (neutraal + segment-mismatch).
6. **Test gate:** 28 Phase-6 tests green, ruff clean, SUMMARY records 1625 full-suite passing with zero woonvisie/wijk-policy regressions (68 pre-existing failures unchanged from before Phase 6).
7. **Frontend audit** captured in 06-04-SUMMARY — `PotentieLayer.tsx:199-204` is the sole `.waarde` consumer and keeps working because the scorer still populates `prioritized_segment` for legacy label rendering.

Phase 6 goal achieved. Ready to proceed to Phase 3 (which depends on Phase 6 per ROADMAP.md line 58: "Depends on: Phase 6 (needs WijkPolicy data in scan flags to render wijk-specific content)").

---

_Verified: 2026-04-25T00:35:00Z_
_Verifier: Claude (gsd-verifier)_
