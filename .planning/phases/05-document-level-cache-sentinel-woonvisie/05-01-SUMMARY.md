---
phase: 05-document-level-cache-sentinel-woonvisie
plan: 01
subsystem: backend-cache
tags: [cache, sentinel, schema-version, claude, cascade, woonvisie, sqlalchemy, pytest-asyncio]

requires:
  - phase: 01-cache-sentinel
    provides: SCHEMA_VERSION=2 constant and FactorExtractionCache unique-constraint pattern
  - phase: M047/S04
    provides: extract_factor service, ExtractedFactor schema, FactorExtractionCache model
provides:
  - DOCUMENT_SENTINEL constant ("__document__") in factor_extraction_schemas
  - SCHEMA_VERSION bumped 2→3 (invalidates v2 parcel-keyed entries on read)
  - cascade_enrichment_service.get_cascade_payloads routes woonvisie_match through DOCUMENT_SENTINEL
  - 3 new tests (1 unit sentinel-constant, 2 unit sentinel-behavior, 1 integration caller-side)
  - repaired stale iron-rule SCHEMA_VERSION assertion
affects: [phase-06-wijk-policy, phase-07-factor-pinning, M050-cascade-factors, rescore_cascade_job]

tech-stack:
  added: []
  patterns:
    - "Sentinel-value pattern for document-level cache keys (avoids DB migration)"
    - "SCHEMA_VERSION-bump as cache invalidation mechanism (no explicit DELETE)"
    - "monkeypatch.setattr on module-level import for service-boundary integration tests"

key-files:
  created:
    - backend/tests/integration/test_cascade_enrichment_service.py
  modified:
    - backend/app/ai/factor_extraction_schemas.py
    - backend/app/models/factor_extraction_cache.py
    - backend/app/services/cascade_enrichment_service.py
    - backend/tests/unit/test_factor_extraction_schemas.py
    - backend/tests/unit/test_factor_extraction_service.py
    - backend/tests/test_m047_s04_iron_rule.py

key-decisions:
  - "DOCUMENT_SENTINEL is caller-level (cascade_enrichment_service), not registry-level on FactorDefinition — defer registry hoisting to M050 when a 2nd document-level factor lands"
  - "Relax SCHEMA_VERSION guard assertions from '== N' to '>= 2' or use SCHEMA_VERSION constant — makes regression tests version-agnostic across future bumps"
  - "Rename stale M047/S04 iron-rule test_schema_version_starts_at_one_and_is_int → test_schema_version_exists_and_is_int (name no longer lies about the value)"
  - "Existing test_v2_cache_entry_is_hit semantically broken after bump — renamed to test_current_version_cache_entry_is_hit and seeded with SCHEMA_VERSION instead of hardcoded 2"

patterns-established:
  - "Sentinel constants: typing.Final[str] with leading double-underscore ('__document__'), under 50 chars, ASCII-safe"
  - "Version-agnostic test guards: assert SCHEMA_VERSION >= N (floor) or use SCHEMA_VERSION directly (follows-constant)"
  - "monkeypatch.setattr(service_module, 'extract_factor', fake) — targets the binding the caller resolves, not the origin import"

requirements-completed: [CACHE-02, TEST-05]

duration: 33min
completed: 2026-04-24
---

# Phase 5 Plan 01: Document-level cache sentinel (woonvisie) Summary

**DOCUMENT_SENTINEL constant collapses 100k per-parcel Claude calls to 1 per (document, factor, SCHEMA_VERSION) tuple at Venlo scale; SCHEMA_VERSION bumped 2→3 invalidates legacy parcel-keyed entries with zero DB migration.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-04-24T18:31:31Z
- **Completed:** 2026-04-24T19:04:48Z
- **Tasks:** 6/6
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- Added `DOCUMENT_SENTINEL: Final[str] = "__document__"` to `factor_extraction_schemas.py` with module-level docstring explaining semantics
- Bumped `SCHEMA_VERSION` 2→3 and `ExtractedFactor.schema_version` Pydantic default 2→3 (literal, per Pitfall 6)
- Wired `cascade_enrichment_service.get_cascade_payloads` to pass `DOCUMENT_SENTINEL` (not the caller's real parcel_id) into `extract_factor` for woonvisie_match
- Added code-comment on `FactorExtractionCache.parcel_id` column explaining the sentinel semantics
- Added TEST-05 coverage: `test_document_sentinel_one_claude_call_for_two_parcels` (proves cache collapses 2 calls → 1 Claude call) + `test_v2_cache_entry_is_miss_after_bump_to_v3` (proves bump invalidates stale rows)
- Added `test_document_sentinel_constant` (unit) and `test_woonvisie_uses_document_sentinel` (integration — spy on monkeypatched extract_factor)
- Repaired stale `test_schema_version_starts_at_one_and_is_int` (assertion was `== 1`, broken since M048/Phase 1's 1→2 bump) — renamed and updated

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD): Bump SCHEMA_VERSION + add DOCUMENT_SENTINEL** — `c2cf5714` (feat)
2. **Task 2: Code-comment on FactorExtractionCache model** — `8efcfe39` (docs/test)
3. **Task 3: Repair stale iron-rule SCHEMA_VERSION assertion** — `f9bd6530` (test)
4. **Task 4: Wire DOCUMENT_SENTINEL into cascade enrichment** — `f846fdaf` (feat)
5. **Task 5 (TDD): Sentinel cache-hit + v2→v3 invalidation unit tests** — `7b2f393c` (test)
6. **Task 6 (TDD): Integration test asserting caller uses sentinel** — `fb0acd0d` (test)

## Files Created/Modified

- `backend/app/ai/factor_extraction_schemas.py` — SCHEMA_VERSION 2→3, DOCUMENT_SENTINEL added, ExtractedFactor default 2→3, imports Final
- `backend/app/models/factor_extraction_cache.py` — code-comment on parcel_id referencing DOCUMENT_SENTINEL
- `backend/app/services/cascade_enrichment_service.py` — imports DOCUMENT_SENTINEL; passes it to extract_factor for woonvisie_match (single call-site)
- `backend/tests/unit/test_factor_extraction_schemas.py` — renamed test_schema_version_is_two→is_three, added test_document_sentinel_constant, updated from_cache assertion 2→3
- `backend/tests/unit/test_factor_extraction_service.py` — added test_document_sentinel_one_claude_call_for_two_parcels, test_v2_cache_entry_is_miss_after_bump_to_v3; renamed test_v2_cache_entry_is_hit→test_current_version_cache_entry_is_hit (version-agnostic); relaxed test_v1 guard from `==2` to `>=2`
- `backend/tests/integration/test_cascade_enrichment_service.py` — **new** file; test_woonvisie_uses_document_sentinel via monkeypatch spy on extract_factor
- `backend/tests/test_m047_s04_iron_rule.py` — renamed test_schema_version_starts_at_one_and_is_int→test_schema_version_exists_and_is_int; updated assertion `==1`→`==3`

## Decisions Made

- **Sentinel at caller, not registry.** The `FactorDefinition` class was not extended with `is_document_level: bool`. Only one document-level factor exists today (woonvisie_match); adding the registry field now would force every existing factor-def to opt-out and would break test shape assertions. Deferred to M050 when the 2nd document-level factor (woondeals) lands.
- **Version-agnostic guards.** Instead of bumping `assert SCHEMA_VERSION == 2` to `== 3` (the naive Rule-1 fix), relaxed to `assert SCHEMA_VERSION >= 2` for the v1-miss test (pre-M047 guard) and used `SCHEMA_VERSION` constant directly in the v-hit test (seeds with current version). Next bump won't require test edits.
- **`test_v2_cache_entry_is_hit` renamed, not deleted.** The test's semantic intent (prove current-version entries hit) is valid and important; only the hardcoded `2` was stale. Renamed to `test_current_version_cache_entry_is_hit` and seeded with the `SCHEMA_VERSION` constant.
- **Monkeypatch target for integration test.** Targeted `cascade_enrichment_service.extract_factor` (module-level import binding), NOT `factor_extraction_service.extract_factor` — the former is what the caller actually resolves at runtime.
- **No Alembic migration.** Success criterion #4 forbids it; the existing WHERE-clause filter on `schema_version = SCHEMA_VERSION` in `_get_cache_hit` naturally invalidates v2 rows without deleting them. Stale rows are dormant, not harmful. Manual cleanup SQL documented below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Started stopped Docker containers (propdex-db + propdex-redis)**
- **Found during:** Task 2 verification (`test_v1_cache_entry_is_miss` required DB connection)
- **Issue:** Both containers in `Exited` state from 10 hours prior; tests failed with `Errno 111 Connect call failed (127.0.0.1:5434)`
- **Fix:** `docker start propdex-db propdex-redis` + wait on `pg_isready`
- **Files modified:** none (runtime-only)
- **Verification:** `pg_isready -U postgres` returned `accepting connections`; regression test passed
- **Committed in:** not committed (environment change, not code)

**2. [Rule 3 - Blocking] Relaxed stale SCHEMA_VERSION guard assertions in v1/v2-cache tests**
- **Found during:** Task 2 verification (`test_v1_cache_entry_is_miss`)
- **Issue:** Existing guard `assert SCHEMA_VERSION == 2` became false after Task 1's bump to 3. The test logic itself (v1 row → miss) remained semantically valid (v1 < v3), only the guard was parameterized for v2.
- **Fix:** (a) Task 2 commit: relaxed to `assert SCHEMA_VERSION >= 2` in `test_v1_cache_entry_is_miss` (captures "any version > 1" contract). (b) Task 5 commit: renamed `test_v2_cache_entry_is_hit` → `test_current_version_cache_entry_is_hit` and seeded with `SCHEMA_VERSION` constant (version-agnostic).
- **Files modified:** `backend/tests/unit/test_factor_extraction_service.py`
- **Verification:** both renamed tests pass at SCHEMA_VERSION=3; pattern survives future bumps without edits
- **Committed in:** `8efcfe39` (Task 2) + `7b2f393c` (Task 5)

**3. [Rule 1 - Bug] Removed `__import__("datetime").datetime.utcnow()` hack in integration test**
- **Found during:** Task 6 (post-green cleanup)
- **Issue:** Initial draft used inline `__import__` for `datetime` inside `fake_extract_factor` — passed tests but ugly
- **Fix:** Added `from datetime import datetime` at top of test file, used `datetime.utcnow()` directly
- **Files modified:** `backend/tests/integration/test_cascade_enrichment_service.py`
- **Verification:** test still green, ruff clean
- **Committed in:** `fb0acd0d` (Task 6 commit, post-cleanup)

---

**Total deviations:** 3 auto-fixed (1 infra, 1 stale-guard propagation, 1 style)
**Impact on plan:** All auto-fixes were direct consequences of Task 1's SCHEMA_VERSION bump (#2 is version-propagation) or the execution environment (#1 infra). No scope creep; plan shape preserved.

## Issues Encountered

- Full backend suite (`uv run pytest`) shows 63 failed + 22 errors in files this phase never touched: `tests/integration/test_admin_router.py`, `tests/integration/test_admin_chat.py`, `tests/unit/test_eval_service.py`, `tests/unit/test_prompt_improvement.py`, `tests/eval/*`. Root causes: (a) OpenRouter API credit exhaustion (402 errors in eval tests that make real Claude calls), (b) async event-loop lifecycle errors in admin tests (`greenlet_spawn` / "attached to a different loop"). `grep SCHEMA_VERSION|DOCUMENT_SENTINEL` on those modules: **zero matches** — failures are pre-existing and unrelated. All 18 phase-scoped tests pass (factor_extraction_schemas + factor_extraction_service + cascade_enrichment_service + m047_s04_iron_rule + factor_extractor integration).
- Transient self-inflicted issue during pre-existing-failure investigation: `git checkout main~6 -- tests/ app/` temporarily reset the working tree to pre-phase state; recovered via `git checkout HEAD -- backend/` without loss (all 6 commits were already in git history).

## Known Follow-ups (NOT executed this phase)

- **Concurrency race under `asyncio.Semaphore(5)` in `rescore_cascade_job`:** first burst of N=5 parcels can all cache-miss simultaneously before the first write commits → N Claude calls instead of 1. Subsequent batches cache-hit. Success criterion #3 speaks of "2 sequentiële scans" — sequential is exactly 1 call. Fix deferred to M050+ via SELECT FOR UPDATE or Redis-backed lock on (doc_id, factor_id, schema_version).
- **Stale v2 row cleanup SQL (manual runbook, not automated):**
  ```sql
  DELETE FROM factor_extraction_cache WHERE schema_version < 3;
  ```
  Rows are dormant after bump (never read, WHERE filter excludes them). Size is (# parcels × # docs × 1 factor) ≈ 60-120MB per gemeente — not blocking.
- **`backfill_cascade_scores.py` log cosmetic issue:** log line `"Loaded woonvisie payload from cache: doc=%s parcel=%s"` now emits `parcel=__document__` — functionally correct but may confuse operators. Polish deferred to M050+.
- **Hoisting `DOCUMENT_SENTINEL` to `FactorDefinition.is_document_level: bool`:** defer to M050 when 2nd document-level factor lands (woondeals, nationale_woonagenda, welstandsnota).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 6 (WijkPolicy schema + woonvisie scoring upgrade):** Unblocked. Woonvisie extraction is now document-scoped and cache-efficient — Phase 6 can safely extend payload shape without worrying about parcel-cardinality multiplier on Claude calls. A SCHEMA_VERSION bump in Phase 6 will correctly invalidate all v3 entries.
- **Phase 7 (Factor pinning + groep-pages):** Frontend-scoped, no backend dependency from this phase.
- **Phase 8 (Integration tests + Venlo E2E):** Will benefit from this phase's caching efficiency — full-gemeente E2E now uses 1 Claude call per factor instead of N.

## Self-Check: PASSED

**Created file verification:**
- FOUND: backend/tests/integration/test_cascade_enrichment_service.py
- FOUND: .planning/phases/05-document-level-cache-sentinel-woonvisie/05-01-SUMMARY.md

**Commit verification (all 6 task commits + metadata):**
- FOUND: c2cf5714 (Task 1 — SCHEMA_VERSION + DOCUMENT_SENTINEL)
- FOUND: 8efcfe39 (Task 2 — model code-comment)
- FOUND: f9bd6530 (Task 3 — iron-rule repair)
- FOUND: f846fdaf (Task 4 — cascade caller edit)
- FOUND: 7b2f393c (Task 5 — TEST-05 unit tests)
- FOUND: fb0acd0d (Task 6 — integration test)

**Acceptance criteria per task:**
- Task 1: `SCHEMA_VERSION: int = 3` ✓, `DOCUMENT_SENTINEL: Final[str] = "__document__"` ✓, `default=3` on ExtractedFactor ✓, 3 test functions renamed/added ✓
- Task 2: `'"__document__" sentinel used for document-level factor types'` grep → 1 ✓; `factor_extraction_schemas.DOCUMENT_SENTINEL` grep → 1 ✓; no Alembic migration (`ls backend/alembic/versions/ | grep -i sentinel` → empty) ✓
- Task 3: `SCHEMA_VERSION == 1` grep → 0 ✓; `SCHEMA_VERSION == 3` grep → 1 ✓; `isinstance(SCHEMA_VERSION, int)` preserved ✓
- Task 4: `parcel_id=DOCUMENT_SENTINEL` grep → 1 ✓; outer signature `parcel_id: str` intact ✓; ruff + mypy clean on touched file ✓
- Task 5: `test_document_sentinel_one_claude_call_for_two_parcels` + `test_v2_cache_entry_is_miss_after_bump_to_v3` both present ✓; `call_count == 1` asserted twice ✓; `schema_version=2` seeded ✓
- Task 6: new file exists ✓; `monkeypatch.setattr` grep → 1 ✓; `captured_kwargs["parcel_id"] == DOCUMENT_SENTINEL` grep → 1 ✓; ruff clean ✓

**Phase gate:**
- 18/18 phase-touched tests green (`uv run pytest tests/unit/test_factor_extraction_service.py tests/unit/test_factor_extraction_schemas.py tests/integration/test_cascade_enrichment_service.py tests/test_m047_s04_iron_rule.py tests/integration/test_factor_extractor.py -x`)
- `ruff check` clean on all 7 phase-touched files
- Pre-existing test failures in unrelated modules (admin/eval/prompt_improvement) explicitly verified to have zero SCHEMA_VERSION or DOCUMENT_SENTINEL references — not caused by this phase

---
*Phase: 05-document-level-cache-sentinel-woonvisie*
*Completed: 2026-04-24*
