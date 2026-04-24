---
phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade
plan: 01
subsystem: testing
tags: [pytest, pydantic, woonvisie, wave-0-stubs, schema-version, factor-extraction]

requires:
  - phase: 05-document-level-cache-sentinel-woonvisie
    provides: SCHEMA_VERSION=3 + DOCUMENT_SENTINEL + Phase-5 v2->v3 cache-miss test pattern (mirrored here)
provides:
  - Wave-0 red-stub tests for WijkPolicy + WoonvisiePayload Pydantic validation (7 tests)
  - Wave-0 red-stub tests for per-wijk score differentiation (5 tests)
  - Wave-0 red-stub tests for score_woonvisie_match fallback paths (4 tests)
  - Version-agnostic SCHEMA_VERSION assertion (passes at v3 today, will pass at v4 after Plan 06-02)
  - test_v3_cache_entry_is_miss_after_bump_to_v4 stub (red until SCHEMA_VERSION bump)
  - VALIDATION.md per-task verification map populated with real Task IDs
affects: [06-02 schema bump + WijkPolicy class, 06-03 score_woonvisie_match rewrite, 06-04 integration tests]

tech-stack:
  added: []  # pure test additions, no new libraries
  patterns:
    - "Wave-0 stub-first: write failing tests with ImportError before implementation lands"
    - "Version-agnostic assertions (>= N or use SCHEMA_VERSION constant) to survive future bumps"
    - "Mirror prior phase test patterns (Phase-5 v2->v3 -> Phase-6 v3->v4)"

key-files:
  created:
    - backend/tests/unit/test_wijk_policy_schema.py
    - backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py
    - backend/tests/unit/test_score_woonvisie_match_fallback.py
  modified:
    - backend/tests/unit/test_factor_extraction_schemas.py
    - backend/tests/unit/test_factor_extraction_service.py
    - .planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-VALIDATION.md

key-decisions:
  - "Version-agnostic SCHEMA_VERSION test (>= 3 instead of == 3) — prevents future bumps from re-breaking the test"
  - "v3->v4 cache-miss stub mirrors the Phase-5 v2->v3 pattern exactly so reviewers see continuity"
  - "Stubs intentionally fail with ImportError on WijkPolicy — provides hard red signal driving Plan 06-02"

patterns-established:
  - "Stub-first Wave-0 plan: 16 new test functions land red; Plans 06-02 + 06-03 + 06-04 turn them green incrementally"
  - "VALIDATION.md per-task map uses real test commands (not collect-only) — gives downstream plans concrete go/no-go signals"

requirements-completed: [WOON-04, WOON-05, SCORE-04, TEST-06]

duration: 4m 18s
completed: 2026-04-24
---

# Phase 06 Plan 01: WijkPolicy + woonvisie scoring Wave-0 stubs Summary

**16 red test stubs + version-agnostic SCHEMA_VERSION guard + populated VALIDATION.md — Nyquist Wave 0 baseline for Phase 6**

## Performance

- **Duration:** 4m 18s
- **Started:** 2026-04-24T21:27:56Z
- **Completed:** 2026-04-24T21:32:14Z
- **Tasks:** 5
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- 3 new red test files in `backend/tests/unit/` with 16 total test functions importing `WijkPolicy` (which doesn't exist yet) — fails loud with ImportError, drives Plan 06-02
- Renamed `test_schema_version_is_three` -> `test_schema_version_is_at_least_three` and relaxed `== 3` to `>= 3` (passes at v3 today AND v4 tomorrow)
- Added `test_v3_cache_entry_is_miss_after_bump_to_v4` mirroring the Phase-5 v2->v3 pattern (line-129 of `test_factor_extraction_service.py`)
- Populated `06-VALIDATION.md` per-task map with 14 real Task IDs (no `6-XX-XX` placeholders), flipped `wave_0_complete: true`
- Full backend suite collects 1676 tests + 3 expected collection errors (the new Phase-6 stubs only); no pre-existing test broke

## Task Commits

Each task was committed atomically:

1. **Task 1: WijkPolicy + WoonvisiePayload Pydantic stubs** - `01f75be5` (test)
2. **Task 2: Per-wijk score differentiation stubs** - `ebfee520` (test)
3. **Task 3: score_woonvisie_match fallback stubs** - `38dd0761` (test)
4. **Task 4: Version-agnostic SCHEMA_VERSION + v3->v4 cache-miss stub** - `ad6b23e5` (test)
5. **Task 5: VALIDATION.md per-task map + wave_0_complete flip** - `8e8703dd` (docs)

**Plan metadata:** _(final commit will include SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md)_

## Files Created/Modified

- `backend/tests/unit/test_wijk_policy_schema.py` (95 lines) — 7 stubs: valid input, empty citaat reject, invalid prioriteit, invalid segment, None pagina, payload roundtrip, payload defaults
- `backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py` (97 lines) — 5 stubs: Blerick > Centrum scoring, citaat in toelichting_lang, matched_policy in waarde dict, case/diacritic insensitive, longest-match wins
- `backend/tests/unit/test_score_woonvisie_match_fallback.py` (66 lines) — 4 stubs: empty wijk_policies + algemeen_citaat, wijk_naam=None no-crash, wijk-not-found, payload=None missing=True
- `backend/tests/unit/test_factor_extraction_schemas.py` (134 lines) — renamed test + relaxed assertion (>= 3)
- `backend/tests/unit/test_factor_extraction_service.py` (250 lines) — added `test_v3_cache_entry_is_miss_after_bump_to_v4` after the Phase-5 sibling
- `.planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-VALIDATION.md` — per-task map populated, `wave_0_complete: true`

## Decisions Made

- **Version-agnostic SCHEMA_VERSION assertion** — `>= 3` instead of `== 3`. Same test passes at v3 today and v4 after Plan 06-02 bump; no per-bump test edits needed (continues Phase-5 pattern).
- **Mirror Phase-5 v2->v3 stub exactly** — `test_v3_cache_entry_is_miss_after_bump_to_v4` uses the same fixture pattern (`_seed_policy_document`), same imports, same payload-shape assertion. Reviewers see the continuity at a glance.
- **Stubs fail loud with ImportError** — no `pytest.skip`, no try/except guards. The ImportError on `WijkPolicy` is the explicit Nyquist signal driving Plan 06-02.

## Deviations from Plan

None — plan executed exactly as written. All 5 tasks landed on first attempt with passing acceptance criteria.

## Issues Encountered

- One transient `grep -c | wc -l` pipeline returned non-zero when a sub-grep found 0 matches (expected: old test name removed). Resolved by splitting the verification into separate commands. No code/test impact.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 06-02 ready:** WijkPolicy class + WoonvisiePayload extension + SCHEMA_VERSION 3->4 bump. Will turn `test_wijk_policy_schema.py` (7) + `test_factor_extraction_service.py::test_v3_cache_entry_is_miss_after_bump_to_v4` (1) green.
- **Plan 06-03 ready:** score_woonvisie_match rewrite (dict-shaped waarde, per-wijk match, citaat in toelichting_lang). Will turn `test_score_woonvisie_match_wijk_differentiation.py` (5) + `test_score_woonvisie_match_fallback.py` (4) green.
- **Plan 06-04 ready:** integration test rewrite + smoke. No blockers.

## Self-Check: PASSED

All 6 files exist on disk:

- FOUND: backend/tests/unit/test_wijk_policy_schema.py
- FOUND: backend/tests/unit/test_score_woonvisie_match_wijk_differentiation.py
- FOUND: backend/tests/unit/test_score_woonvisie_match_fallback.py
- FOUND: backend/tests/unit/test_factor_extraction_schemas.py (modified)
- FOUND: backend/tests/unit/test_factor_extraction_service.py (modified)
- FOUND: .planning/phases/06-wijkpolicy-schema-woonvisie-scoring-upgrade/06-VALIDATION.md (modified)

All 5 task commits exist:

- FOUND: 01f75be5 (Task 1)
- FOUND: ebfee520 (Task 2)
- FOUND: 38dd0761 (Task 3)
- FOUND: ad6b23e5 (Task 4)
- FOUND: 8e8703dd (Task 5)

---
*Phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade*
*Completed: 2026-04-24*
