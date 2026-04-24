---
phase: 5
slug: document-level-cache-sentinel-woonvisie
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio (async mode in conftest) |
| **Config file** | `backend/pyproject.toml` + `backend/tests/conftest.py` |
| **Quick run command** | `cd backend && uv run pytest tests/unit/test_factor_extraction_service.py tests/unit/test_factor_extraction_schemas.py -x -v` |
| **Full suite command** | `cd backend && uv run pytest -x` |
| **Estimated runtime** | ~3s quick / ~90s full |

---

## Sampling Rate

- **After every task commit:** Run quick command above
- **After every plan wave:** Run `cd backend && uv run pytest tests/unit/ tests/integration/test_factor_extractor.py tests/integration/test_cascade_enrichment_service.py -x`
- **Before `/gsd:verify-work`:** Full suite must be green + `ruff check . && mypy .`
- **Max feedback latency:** ~3 seconds for unit loop

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | CACHE-02 | unit | `uv run pytest tests/unit/test_factor_extraction_schemas.py::test_document_sentinel_constant -x` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 1 | CACHE-02 | unit | `uv run pytest tests/unit/test_factor_extraction_schemas.py::test_schema_version_is_three -x` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 1 | CACHE-02 | unit | `uv run pytest tests/unit/test_factor_extraction_schemas.py::test_extracted_factor_from_cache_flag_is_required_semantic -x` | ✅ | ⬜ pending |
| 5-01-04 | 01 | 1 | CACHE-02 | unit (introspection) | `uv run pytest tests/unit/test_factor_extraction_cache_model.py::test_parcel_id_column_documents_sentinel -x` | ❌ W0 | ⬜ pending |
| 5-01-05 | 01 | 2 | CACHE-02 | integration | `uv run pytest tests/integration/test_cascade_enrichment_service.py::test_woonvisie_uses_document_sentinel -x` | ❌ W0 | ⬜ pending |
| 5-01-06 | 01 | 2 | TEST-05 | unit | `uv run pytest tests/unit/test_factor_extraction_service.py::test_document_sentinel_one_claude_call_for_two_parcels -x` | ❌ W0 | ⬜ pending |
| 5-01-07 | 01 | 2 | TEST-05 | unit | `uv run pytest tests/unit/test_factor_extraction_service.py::test_v2_cache_entry_is_miss_after_bump_to_v3 -x` | ❌ W0 | ⬜ pending |
| 5-01-08 | 01 | 2 | TEST-05 | manual | `ls backend/alembic/versions/ \| grep -i document_sentinel` → expect empty | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `backend/tests/unit/test_factor_extraction_service.py` — add `test_document_sentinel_one_claude_call_for_two_parcels` + `test_v2_cache_entry_is_miss_after_bump_to_v3`
- [ ] Update `backend/tests/unit/test_factor_extraction_schemas.py` — add `test_document_sentinel_constant`; rename `test_schema_version_is_two` → `test_schema_version_is_three`; update `test_extracted_factor_from_cache_flag_is_required_semantic` from `== 2` to `== 3`
- [ ] Create `backend/tests/integration/test_cascade_enrichment_service.py` — NEW file, assert `get_cascade_payloads` passes `DOCUMENT_SENTINEL` to `extract_factor`
- [ ] Audit `backend/tests/test_m047_s04_iron_rule.py:39` — stale `SCHEMA_VERSION == 1` assertion, update to `== 3` or retire
- [ ] Optional `backend/tests/unit/test_factor_extraction_cache_model.py` — introspection test for sentinel doc-comment (can be manual grep instead)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No DB migration added | Success #4 | Assertion is absence, easier via shell | `ls backend/alembic/versions/*document_sentinel* 2>/dev/null` → empty output |
| Code-comment on `FactorExtractionCache.parcel_id` | Success #5 | Text grep simpler than introspection | `grep -n '"__document__" sentinel' backend/app/models/factor_extraction_cache.py` → exact hit |
| Log output sanity check | Operator UX | No assertion, visual check | Run a scan, confirm cascade log shows `parcel=__document__` once per woonvisie document |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s for quick loop
- [ ] `nyquist_compliant: true` set in frontmatter after planner sign-off

**Approval:** pending
