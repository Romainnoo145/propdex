---
phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade
plan: 02
subsystem: ai-extraction
tags: [pydantic, anthropic-tool-use, cache-invalidation, schema-evolution, woonvisie, wijkpolicy]

requires:
  - phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade plan 01
    provides: "Wave-0 stubs — 16 red tests + version-agnostic SCHEMA_VERSION guard, explicit ImportError on WijkPolicy as Nyquist signal for Plan 06-02"
  - phase: 05-document-level-cache-sentinel-woonvisie plan 01
    provides: "DOCUMENT_SENTINEL pattern + SCHEMA_VERSION bump precedent (v1→v2→v3)"
provides:
  - "WijkPolicy Pydantic model (wijk_naam, prioriteit, gewenste_segmenten, citaat, pagina) — per-wijk beleid with literal citaten"
  - "WoonvisiePayload extended with wijk_policies: list[WijkPolicy] + algemeen_citaat: str fallback"
  - "Rewritten Anthropic _INPUT_SCHEMA with nested wijk_policies array-of-objects (item-level required + additionalProperties:false)"
  - "Rewritten prompt_instructions with hallucination guard (let WijkPolicy weg bij ontbrekend citaat) and deprecated-field references removed"
  - "SCHEMA_VERSION bumped 3→4 — all v3 cache entries auto-invalidated via existing _get_cache_hit WHERE-clause"
  - "ExtractedFactor.schema_version default bumped 3→4 (matches constant)"
affects:
  - "06-03-PLAN (scorer rewrite) — will consume wijk_policies + algemeen_citaat data-contract"
  - "Phase 3 WoonvisiePopup frontend — will render citaat + pagina per wijk"
  - "M048 factor-extraction cache — all v3 rows become cache-misses on next lookup"

tech-stack:
  added: []
  patterns:
    - "Literal-enum validation in Pydantic for structured enums (prioriteit, gewenste_segmenten)"
    - "Deprecated fields retained on payload-model but removed from _INPUT_SCHEMA + prompt — Claude stops emitting them, old cache rows still rehydrate cleanly"
    - "Version-agnostic test assertions (>= N or == SCHEMA_VERSION) per Phase-6 locked decision"

key-files:
  created: []
  modified:
    - "backend/app/ai/factors/woonvisie_match.py (172 lines; +WijkPolicy, +wijk_policies/algemeen_citaat, rewritten schema + prompt)"
    - "backend/app/ai/factor_extraction_schemas.py (SCHEMA_VERSION 3→4, ExtractedFactor.schema_version default 3→4)"
    - "backend/tests/unit/test_factor_extraction_schemas.py (version-pinned assertion made version-agnostic — Rule 3)"
    - "backend/tests/unit/test_factor_extraction_service.py (version-pinned assertion made version-agnostic — Rule 3)"

key-decisions:
  - "WijkPolicy lives in woonvisie_match.py (same module as WoonvisiePayload) per CONTEXT §Alternatives Considered lock — no separate wijk_policy.py module"
  - "Deprecated fields (growth_wijken/shrink_wijken/herstructureringswijken/prioritized_segment/doelgroepen/excluded_project_types) retained on Pydantic model for cache-roundtrip backwards-compat; removed from _INPUT_SCHEMA and prompt so Claude no longer emits them"
  - "Top-level required narrowed 5→3 fields ([periode_start, periode_einde, confidence]) per CONTEXT §3 — vague documents allowed (wijk_policies + algemeen_citaat optional)"
  - "additionalProperties:false only on nested wijk_policies item, not at top level — allows deprecated-field rehydration from old cache rows"
  - "Prompt adds explicit HARDE REGELS (no hallucinations, copy citaten letterlijk) to enforce extraction quality for downstream popup-display"
  - "No Alembic migration — same pattern as Phase 5, _get_cache_hit WHERE-clause auto-rejects stale rows on read, on_conflict_do_update supersedes on next write"

patterns-established:
  - "Nested enum arrays in Anthropic tool-use: items.enum works at both item type (string with enum) and array-of-items with enum validation"
  - "Version-agnostic pre-existing test assertions: prefer `assert X == SCHEMA_VERSION` or `assert SCHEMA_VERSION >= N` over literal `== N` to survive future bumps without per-test edits"

requirements-completed:
  - WOON-04
  - WOON-05

duration: 9min
completed: 2026-04-24
---

# Phase 06 Plan 02: WijkPolicy Schema + SCHEMA_VERSION v4 Summary

**WijkPolicy Pydantic model + extended WoonvisiePayload with nested per-wijk array, Anthropic tool-use schema + prompt rewrite, and SCHEMA_VERSION 3→4 bump — turns 7/7 Wave-0 WijkPolicy stubs green and flips v3→v4 cache-miss test green, zero migration.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-24T21:35:01Z
- **Completed:** 2026-04-24T21:43:49Z
- **Tasks:** 2
- **Files modified:** 4 (2 planned + 2 version-agnostic test fixes via Rule 3)

## Accomplishments

- New `WijkPolicy` Pydantic model with Literal-enum validation for prioriteit (groei/krimp/herstructurering/neutraal) and gewenste_segmenten (sociaal/midden/duur/gemengd) — delivers the UI-ready citaat carrier for WoonvisiePopup
- `WoonvisiePayload` extended with `wijk_policies: list[WijkPolicy]` and `algemeen_citaat: str` as primary wijk-differentiatie source (Plan 06-03 scorer will read these); deprecated fields retained for cache-roundtrip
- `_INPUT_SCHEMA` rewritten with nested `wijk_policies` array-of-objects (item-level required + `additionalProperties: false`); top-level required narrowed 5→3 fields to allow vague documents
- `prompt_instructions` rewritten with per-wijk extraction flow + HARDE REGELS anti-hallucination guard; deprecated-field terminology removed so Claude stops emitting them
- `SCHEMA_VERSION = 4` — all v3 cache rows auto-invalidated via existing `_get_cache_hit` WHERE-clause (Phase-5 pattern, zero migration)
- `ExtractedFactor.schema_version` default bumped 3→4 (stays in sync with constant)
- 15/15 relevant tests green: 7 WijkPolicy + 6 schema-surface + 2 cache-miss (v2 at v4 + v3 at v4)

## Task Commits

1. **Task 1: Add WijkPolicy + extend WoonvisiePayload + rewrite tool-use schema + rewrite prompt** — `2e0919a4` (feat)
2. **Task 2: Bump SCHEMA_VERSION 3→4 + ExtractedFactor default + version-agnostic test fixes** — `c0cf5550` (feat)

_Plan metadata commit added separately after SUMMARY.md lands._

## Files Created/Modified

- `backend/app/ai/factors/woonvisie_match.py` — Added WijkPolicy class; extended WoonvisiePayload with wijk_policies + algemeen_citaat; rewrote _INPUT_SCHEMA with nested wijk_policies array and narrowed top-level required; rewrote prompt_instructions with per-wijk extraction flow + hallucination guards; updated WOONVISIE_MATCH_FACTOR_DEF.description to match new schema focus. 172 lines (< 300 budget).
- `backend/app/ai/factor_extraction_schemas.py` — `SCHEMA_VERSION: int = 4` (bumped 3→4 comment added); `ExtractedFactor.schema_version = Field(default=4, ...)`.
- `backend/tests/unit/test_factor_extraction_schemas.py` — Made `test_extracted_factor_from_cache_flag_is_required_semantic` version-agnostic: `result.schema_version == 3` → `result.schema_version == SCHEMA_VERSION`. Preserves spirit (default tracks constant) while surviving future bumps.
- `backend/tests/unit/test_factor_extraction_service.py` — Made `test_v2_cache_entry_is_miss_after_bump_to_v3` version-agnostic: `SCHEMA_VERSION == 3` → `SCHEMA_VERSION >= 3`. v2 entries still rejected at v4 (plan success criterion).

## Decisions Made

- WijkPolicy class lives inline in woonvisie_match.py (no new module) per CONTEXT lock
- Deprecated field removal strategy: keep on Pydantic model (cache-roundtrip compat) but drop from _INPUT_SCHEMA + prompt (Claude stops emitting) — matches CONTEXT §2
- Top-level required narrowed to 3 fields ([periode_start, periode_einde, confidence]) so vague documents with no per-wijk paragraphs still extract cleanly
- `additionalProperties: false` applied only at the nested wijk_policies item level, not at top level — lets old cache rows with deprecated fields still rehydrate through the Pydantic validator on cache read

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made two pre-existing version-pinned test assertions version-agnostic**

- **Found during:** Task 2 (SCHEMA_VERSION bump verification)
- **Issue:** Two pre-existing tests contained literal `== 3` assertions that hard-blocked the bump from landing:
  - `test_extracted_factor_from_cache_flag_is_required_semantic`: `assert result.schema_version == 3`
  - `test_v2_cache_entry_is_miss_after_bump_to_v3`: `assert SCHEMA_VERSION == 3, "Test only valid at SCHEMA_VERSION==3"`
  The plan success criterion explicitly requires the Phase-5 v2 test to "STAY green" at v4, and the Phase-6 locked decision in STATE.md mandates "version-agnostic SCHEMA_VERSION assertion". These pins contradict both.
- **Fix:**
  - `test_extracted_factor_from_cache_flag_is_required_semantic`: switched to `assert result.schema_version == SCHEMA_VERSION` (imports the constant)
  - `test_v2_cache_entry_is_miss_after_bump_to_v3`: switched to `assert SCHEMA_VERSION >= 3` + updated docstring to note version-agnostic coverage
- **Files modified:** `backend/tests/unit/test_factor_extraction_schemas.py`, `backend/tests/unit/test_factor_extraction_service.py`
- **Verification:** All 15 plan-verification tests pass after the fix; `pytest tests/unit/test_factor_extraction_schemas.py tests/unit/test_factor_extraction_service.py::test_v2_cache_entry_is_miss_after_bump_to_v3 tests/unit/test_factor_extraction_service.py::test_v3_cache_entry_is_miss_after_bump_to_v4 tests/unit/test_wijk_policy_schema.py` → 17 passed.
- **Committed in:** `c0cf5550` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking; strictly test-assertion modernization to honor the Phase-6 locked decision — no production-code scope creep)
**Impact on plan:** Necessary for the SCHEMA_VERSION bump to land. Matches the decision recorded in STATE.md ("Phase 6: version-agnostic SCHEMA_VERSION assertion"). No scope expansion.

## Issues Encountered

- During initial full-suite sanity check, `git stash` + `git stash pop` round-trip ran into an unrelated conflict on `backend/uv.lock` / `frontend/tsconfig.app.tsbuildinfo`. Resolved by `git checkout` on the conflict file, then `git stash pop stash@{0}` to restore the in-flight Task 2 edits. No code lost; confirmed pre-existing failures in `test_agent_tools.py`, `test_claude_client.py`, `test_eval_service.py`, `test_prompt_improvement.py`, `test_post_migration_model_contracts.py` are unrelated to Phase-6 edits (they fail on both sides of the stash — pre-existing, out-of-scope per SCOPE BOUNDARY).

## User Setup Required

None — pure backend schema evolution. No env vars, no external services, no database migration (cache-miss is the intended "migration" per Phase-5 pattern).

## Next Phase Readiness

- **Plan 06-03 ready:** Scorer rewrite can now consume `payload.wijk_policies` + `payload.algemeen_citaat` data-contract. Currently-red scorer tests (`test_score_woonvisie_match_wijk_differentiation.py`, `test_score_woonvisie_match_fallback.py`, `tests/integration/test_woonvisie_match.py`) remain red as expected — Plan 06-03 flips them green.
- **Frontend Phase 3 (WoonvisiePopup) ready:** Backend data-contract stable. Frontend can render `wijk_policies[].citaat` + `pagina` + `prioriteit` + `gewenste_segmenten` per wijk, with `algemeen_citaat` as fallback.
- **Cache roll-out:** Next production scan of any woonvisie-bearing gemeente triggers 1 Claude call (v3 entry is miss, sentinel key hits `on_conflict_do_update` and supersedes). Fresh v4 rows carry the new payload shape end-to-end.
- **No blockers.**

## Self-Check: PASSED

Verified:
- `backend/app/ai/factors/woonvisie_match.py` exists (172 lines) — FOUND
- `backend/app/ai/factor_extraction_schemas.py` exists — FOUND; `grep -c "^SCHEMA_VERSION: int = 4"` → 1, `grep -c "default=4"` → 1
- Commits: `2e0919a4` (Task 1) FOUND, `c0cf5550` (Task 2) FOUND in `git log`
- Plan verification gate: 15/15 tests pass (`test_wijk_policy_schema.py` 7 + `test_factor_extraction_schemas.py` 6 + `test_factor_extraction_service.py` v2/v3 cache-miss 2)
- Ruff + mypy green on both modified production files

---
*Phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade*
*Completed: 2026-04-24*
