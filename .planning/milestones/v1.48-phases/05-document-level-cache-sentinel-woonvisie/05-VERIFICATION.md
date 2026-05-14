---
phase: 05-document-level-cache-sentinel-woonvisie
verified: 2026-04-24T21:15:00Z
status: passed
score: 6/6 success criteria verified
requirements:
  - id: CACHE-02
    status: satisfied
    evidence: "DOCUMENT_SENTINEL constant + SCHEMA_VERSION 2→3 bump + cascade_enrichment_service wiring + model comment; unit test test_v2_cache_entry_is_miss_after_bump_to_v3 passes"
  - id: TEST-05
    status: satisfied
    evidence: "test_document_sentinel_one_claude_call_for_two_parcels (call_count == 1 asserted 2x) + test_v2_cache_entry_is_miss_after_bump_to_v3 + test_woonvisie_uses_document_sentinel all green"
---

# Phase 5: Document-level Cache Sentinel (Woonvisie) — Verification Report

**Phase Goal:** Woonvisie-extractie voor gemeente Venlo (100k+ parcelen) produceert precies 1 Claude-call per woonvisie-document, niet per perceel. Document-level factors slaan cache op met sentinel-key i.p.v. parcel_id.

**Verified:** 2026-04-24T21:15:00Z
**Status:** passed
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `cascade_enrichment_service.py` calls `extract_factor()` with `parcel_id="__document__"` for document-level factors (woonvisie_match) | VERIFIED | `backend/app/services/cascade_enrichment_service.py:81` — `parcel_id=DOCUMENT_SENTINEL` kwarg; import at line 17. Integration test `test_woonvisie_uses_document_sentinel` passes and asserts `captured_kwargs["parcel_id"] == DOCUMENT_SENTINEL`. |
| 2 | SCHEMA_VERSION bump 2→3 in `factor_extraction_schemas.py` — old v2 entries return cache-miss | VERIFIED | `backend/app/ai/factor_extraction_schemas.py:114` — `SCHEMA_VERSION: int = 3`. `ExtractedFactor.schema_version` default=3 at line 64. Unit test `test_v2_cache_entry_is_miss_after_bump_to_v3` seeds a `schema_version=2` row and asserts `_get_cache_hit(..., SENTINEL)` returns None. |
| 3 | 2 sequential scans of different parcels against same Venlo-woonvisie = exactly 1 Claude-call (measurable via logs) | VERIFIED | Unit test `test_document_sentinel_one_claude_call_for_two_parcels` invokes `extract_factor` twice with `DOCUMENT_SENTINEL`; asserts `mock_client.messages.create.call_count == 1` after first call AND after second call (lines 204 + 215). Test green. |
| 4 | No DB migration required (sentinel fits existing `String(50)` column); unique-constraint stays correct | VERIFIED | `ls backend/alembic/versions/` contains no `*sentinel*` or `*document*` migration files. `String(50)` column unchanged at `factor_extraction_cache.py:46`. `UniqueConstraint(parcel_id, policy_document_id, factor_id, schema_version)` intact at line 94. |
| 5 | Code-comment added at `FactorExtractionCache` model: `# "__document__" sentinel used for document-level factor types` | VERIFIED | `backend/app/models/factor_extraction_cache.py:42-44` contains the exact comment block, referencing `factor_extraction_schemas.DOCUMENT_SENTINEL`. |
| 6 | Unit tests cover: sentinel-write → sentinel-hit on 2nd lookup; v2→v3 bump invalidates old entries | VERIFIED | `test_document_sentinel_one_claude_call_for_two_parcels` proves sentinel write→hit (second call `from_cache is True` + no new Claude call). `test_v2_cache_entry_is_miss_after_bump_to_v3` proves v2→v3 invalidation. Both pass. |

**Score:** 6/6 truths verified.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/ai/factor_extraction_schemas.py` | SCHEMA_VERSION=3, DOCUMENT_SENTINEL constant, ExtractedFactor default=3 | VERIFIED | 132 lines. `SCHEMA_VERSION: int = 3` (L114), `DOCUMENT_SENTINEL: Final[str] = "__document__"` (L124), `schema_version: int = Field(default=3, ...)` (L63-69). Docstring documents M048/Phase 5 bump. |
| `backend/app/models/factor_extraction_cache.py` | Code-comment on parcel_id documenting sentinel | VERIFIED | 110 lines. Comment block L42-44 matches the success-criterion text exactly. `String(50)` unchanged. Unique constraint unchanged. |
| `backend/app/services/cascade_enrichment_service.py` | get_cascade_payloads passes DOCUMENT_SENTINEL | VERIFIED | 128 lines. Import L17 (`from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, ...`). Single call-site L81 uses `parcel_id=DOCUMENT_SENTINEL`. Outer signature `parcel_id: str` (L55) intact — real id still passed by callers, only internal sentinel substitution. |
| `backend/tests/unit/test_factor_extraction_schemas.py` | test_document_sentinel_constant + test_schema_version_is_three + updated from_cache assertion | VERIFIED | 133 lines. `test_document_sentinel_constant` (L122), `test_schema_version_is_three` (L110). Line 75 asserts `result.schema_version == 3`. |
| `backend/tests/unit/test_factor_extraction_service.py` | test_document_sentinel_one_claude_call_for_two_parcels + test_v2_cache_entry_is_miss_after_bump_to_v3 | VERIFIED | 216 lines. Both tests present (L169, L129). `call_count == 1` asserted at L204 + L215 (key mechanism). |
| `backend/tests/integration/test_cascade_enrichment_service.py` | test_woonvisie_uses_document_sentinel (monkeypatch spy) | VERIFIED | 87 lines. New file. `test_woonvisie_uses_document_sentinel` at L17. `monkeypatch.setattr(cascade_enrichment_service, "extract_factor", ...)` at L72. Assertion `captured_kwargs["parcel_id"] == DOCUMENT_SENTINEL` at L83. |
| `backend/tests/test_m047_s04_iron_rule.py` | SCHEMA_VERSION assertion bumped to 3 | VERIFIED | 154 lines. L42: `assert SCHEMA_VERSION == 3`. Test renamed to `test_schema_version_exists_and_is_int`. Iron-rule `isinstance(SCHEMA_VERSION, int)` preserved at L43. |

All 7 artifacts: 3-level verified (exists, substantive, wired).

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|------|--------|---------|
| `cascade_enrichment_service.py` | `factor_extraction_schemas.py` | `from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL` | WIRED | Combined import at L17 — `DOCUMENT_SENTINEL, FactorExtractionError`. |
| `cascade_enrichment_service.get_cascade_payloads` (woonvisie branch) | `factor_extraction_service.extract_factor` | `parcel_id=DOCUMENT_SENTINEL` kwarg | WIRED | Exactly one occurrence at L81 (verified via grep). Surrounding log statement still uses real `parcel_id` (L88) — operator context preserved. |
| Unit test (new) | `mock_client.messages.create.call_count` | Assert count stays 1 after 2nd invocation | WIRED | `test_document_sentinel_one_claude_call_for_two_parcels` L215 asserts call_count is still 1 after cache-hit — the core performance proof. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CACHE-02 | 05-01-PLAN.md frontmatter | Document-level factors (woonvisie_match) cache with sentinel `parcel_id="__document__"` — 1 Claude call per document; SCHEMA_VERSION bump 2→3 invalidates old entries | SATISFIED | Sentinel constant + schema bump + caller wiring + model comment + v2→v3 invalidation test all in place. REQUIREMENTS.md L98 marked Complete. |
| TEST-05 | 05-01-PLAN.md frontmatter | Unit tests cover document-level sentinel cache — 2 scans of different parcels against same woonvisie = 1 Claude call; v2→v3 bump invalidates | SATISFIED | `test_document_sentinel_one_claude_call_for_two_parcels` + `test_v2_cache_entry_is_miss_after_bump_to_v3` + integration `test_woonvisie_uses_document_sentinel`. 18/18 phase-scoped tests green. REQUIREMENTS.md L119 marked Complete. |

No orphaned requirements — the 2 IDs in REQUIREMENTS.md mapped to Phase 5 are both declared in 05-01-PLAN.md frontmatter.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| _none_ | — | — | — | — |

Scanned all 7 phase-modified files for TODO/FIXME/PLACEHOLDER/stub patterns: zero hits. All file contents are substantive implementations, not placeholders.

---

## Automated Verification Runs

**Phase-scoped pytest** (`backend && uv run pytest tests/unit/test_factor_extraction_schemas.py tests/unit/test_factor_extraction_service.py tests/integration/test_cascade_enrichment_service.py tests/test_m047_s04_iron_rule.py -x -v`):
- 18 passed in 16.34s. All 4 new tests green; all pre-existing cache/schema guards still pass.

**Ruff** on 7 touched files: `All checks passed!`

**File-length guard**: all files under 300 lines (largest is `test_factor_extraction_service.py` at 216).

**Commits**: all 6 task commits present in git history (c2cf5714, 8efcfe39, f9bd6530, f846fdaf, 7b2f393c, fb0acd0d) — matches SUMMARY.md.

**Migration sanity**: `ls backend/alembic/versions/ | grep -i sentinel` → empty. Success criterion #4 holds.

---

## Known Issues (Non-Blocking)

Per SUMMARY.md:
- 63 failed + 22 errors in unrelated modules (`tests/integration/test_admin_router.py`, `tests/unit/test_eval_service.py`, `tests/eval/*`) with zero `SCHEMA_VERSION`/`DOCUMENT_SENTINEL` references — pre-existing (OpenRouter credit exhaustion + greenlet loop issues). Do NOT block this phase.
- Concurrency race in `rescore_cascade_job` under `asyncio.Semaphore(5)`: first burst can still produce multiple Claude calls before cache warms. Success criterion #3 specifies "sequentiële scans" — sequential behavior is verified. Parallel-burst optimisation deferred to M050+.
- Log line in `backfill_cascade_scores.py` cosmetically emits `parcel=__document__` — functional, polish deferred.
- v2 stale row cleanup is dormant (excluded by WHERE-clause); manual SQL documented in SUMMARY.md for operator runbook.

---

## Gaps Summary

None. All 6 roadmap success criteria are backed by code + passing tests. Both requirement IDs (CACHE-02, TEST-05) are satisfied with implementation + test evidence. Phase 5 is complete and ready for Phase 6.

---

*Verified: 2026-04-24T21:15:00Z*
*Verifier: Claude (gsd-verifier)*
