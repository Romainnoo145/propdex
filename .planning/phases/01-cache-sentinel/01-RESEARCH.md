# Phase 1: Cache Sentinel - Research

**Researched:** 2026-04-22
**Domain:** Python backend — cache versioning, SQLAlchemy model, pytest unit tests
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

Phase 1 is a surgical one-file change plus one new test file. The entire cache invalidation contract is already designed and documented in the codebase — the `SCHEMA_VERSION` constant in `factor_extraction_schemas.py` was built explicitly to be bumped when backwards-incompatible changes happen. The cache lookup in `factor_extraction_service.py` already filters on `schema_version == SCHEMA_VERSION`, meaning the rejection logic is already in production code. Bumping the constant from 1 to 2 is the full scope of production code change.

The only complication is that one existing test (`test_schema_version_starts_at_one`) explicitly asserts `SCHEMA_VERSION == 1`. That test must be updated to assert `== 2`. A second existing test (`test_extracted_factor_from_cache_flag_is_required_semantic`) also has a `assert result.schema_version == 1` (default) hardcoded — it must be updated to `== 2` after the bump.

New unit tests covering the two scenarios required by TEST-01 (miss on v1 entry, hit on v2 entry) do not exist yet and must be added. These are pure in-memory unit tests — no DB needed, because the cache lookup is a simple integer equality comparison (`schema_version == SCHEMA_VERSION`).

**Primary recommendation:** Bump `SCHEMA_VERSION` from 1 to 2, update two assertions in existing tests, add two new unit tests for version-aware cache rejection.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CACHE-01 | System invalidates M047 extraction cache by bumping SCHEMA_VERSION from 1 to 2 in `backend/app/ai/factor_extraction_schemas.py` | Direct code inspection — constant is at line 114, currently `SCHEMA_VERSION: int = 1` |
| TEST-01 | Unit tests cover SCHEMA_VERSION bump — old cache entries with version < 2 are rejected | Existing test file `backend/tests/unit/test_factor_extraction_schemas.py` needs updates + 2 new tests |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | >=7.4.0 (project) | Test runner | Already used for 275-test suite |
| pytest-asyncio | >=0.21.0 | Async test support | asyncio_mode="auto" configured in pyproject.toml |
| pydantic | project dep | Schema validation | All models use Pydantic v2 |
| sqlalchemy | >=2.0.25 (project) | ORM cache model | Used throughout codebase |

No new dependencies needed.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (relevant to this phase)
```
backend/app/ai/
├── factor_extraction_schemas.py    # SCHEMA_VERSION constant lives here — CHANGE THIS
├── factor_extractor.py             # Imports SCHEMA_VERSION, stamps ExtractedFactor.schema_version
└── ...

backend/app/services/
└── factor_extraction_service.py    # _get_cache_hit() filters on schema_version == SCHEMA_VERSION

backend/tests/unit/
├── test_factor_extraction_schemas.py     # EXISTS — two assertions need updating
└── test_factor_extraction_cache_model.py # EXISTS — no changes needed here
```

### Pattern 1: SCHEMA_VERSION as integer sentinel
**What:** A module-level `int` constant in `factor_extraction_schemas.py`. Cache lookup in `factor_extraction_service._get_cache_hit()` does a WHERE filter on `FactorExtractionCache.schema_version == SCHEMA_VERSION`. Old rows with version 1 remain in the DB but are never returned because the WHERE clause requires version == 2.

**When to use:** Any time payload shape, required metadata fields, or cache-key components change backwards-incompatibly.

**The actual constant (line 114 of `factor_extraction_schemas.py`):**
```python
SCHEMA_VERSION: int = 1
```

**The cache lookup (lines 46-53 of `factor_extraction_service.py`):**
```python
stmt = select(FactorExtractionCache).where(
    FactorExtractionCache.parcel_id == parcel_id,
    FactorExtractionCache.policy_document_id == policy_document_id,
    FactorExtractionCache.factor_id == factor_id,
    FactorExtractionCache.schema_version == SCHEMA_VERSION,  # version filter is already here
)
```

**The cache write (line 74 of `factor_extraction_service.py`):**
```python
schema_version=SCHEMA_VERSION,  # writes current version on every upsert
```

**The unique constraint** (`uq_factor_extraction_cache_key`) covers `(parcel_id, policy_document_id, factor_id, schema_version)` — meaning version 1 and version 2 rows for the same (parcel, doc, factor) can coexist without conflict. Old v1 rows are orphaned, not deleted.

### Pattern 2: Existing unit tests for schemas
**What:** Pure import-based unit tests in `backend/tests/unit/test_factor_extraction_schemas.py`. No DB, no async, no fixtures. Import from `app.ai.factor_extraction_schemas` and assert.

**Relevant existing tests that must change:**
1. `test_schema_version_starts_at_one` (line 110-114) — asserts `SCHEMA_VERSION == 1`. After bump: update to `== 2` and rename to `test_schema_version_is_two`.
2. `test_extracted_factor_from_cache_flag_is_required_semantic` (line 75) — asserts `result.schema_version == 1`. After bump: update to `== 2`.

### Pattern 3: New version-aware cache rejection unit tests
**What:** Two new unit tests that simulate the version-mismatch scenario. Because the cache lookup is a DB query, these are best written as unit tests that either:
  - (a) Use a minimal in-memory mock of `_get_cache_hit` to verify version filtering, or
  - (b) Directly call `_get_cache_hit` with a mock `AsyncSession` that returns a `FactorExtractionCache` row with version 1, asserting it is NOT returned (i.e., the WHERE clause filters it out).

**Simpler approach** that does not require DB or async session mocking: test at the model/logic level.

The cleanest approach for TEST-01 unit tests is to test the WHERE clause logic by:
1. Checking that a `FactorExtractionCache` row with `schema_version=1` would not match when `SCHEMA_VERSION==2` — this can be proven by checking the WHERE clause comparison directly.
2. Using a real `AsyncSession` against the test DB (already available via `test_db` fixture in conftest.py) to insert a v1 row and verify the lookup returns None (miss), then insert a v2 row and verify hit.

The second approach is an integration test pattern already established in `test_factor_extractor.py`. However TEST-01 specifies "unit tests" — the simpler path is to write these in `test_factor_extraction_schemas.py` (no DB) by:
- Asserting `SCHEMA_VERSION == 2` (the bump itself)
- Asserting a hypothetical version-1 cache row would be rejected by checking that `1 != SCHEMA_VERSION`
- Asserting a version-2 cache row would be accepted by checking that `2 == SCHEMA_VERSION`

Or write them in `test_factor_extraction_service.py` (new file) using the `test_db` fixture (integration-style unit tests). The 275-test suite already includes integration tests that access DB so either location fits within the suite.

### Anti-Patterns to Avoid
- **Deleting v1 rows from the DB:** Out of scope for this phase. The design comment in `factor_extraction_cache.py` says "S05 cascade job kan via separate cleanup-query oude versies verwijderen (out-of-scope voor S04)" — same applies here. Leave v1 rows in place.
- **Changing the DB schema or running a migration:** No Alembic migration needed. The `schema_version` column already exists in the `factor_extraction_cache` table (migration `x0_m047_s04_create_factor_extraction_cache.py` already merged). The column defaults to 1 at DB level (`server_default=text("1")`). After the bump, newly written rows will have version 2 because `_write_cache` passes `schema_version=SCHEMA_VERSION` explicitly.
- **Modifying `ExtractedFactor.schema_version` default:** The default in the Pydantic model is `default=1` (line 65 of `factor_extraction_schemas.py`). It should remain as-is OR be updated to match. Since `extract_factor_live` explicitly passes `schema_version=SCHEMA_VERSION`, the Pydantic default is only a fallback. Updating the Pydantic default to 2 is optional but cleaner.
- **Touching `factor_extractor.py` production logic:** No changes needed there. It already stamps `schema_version=SCHEMA_VERSION`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache rejection on version mismatch | Custom version-check wrapper | Already in `_get_cache_hit` WHERE clause | The `schema_version == SCHEMA_VERSION` filter is already the mechanism — just bump the constant |
| Test DB for version-aware test | Full DB setup from scratch | `test_db` + `create_test_user` fixtures in conftest.py | Already used in `test_factor_extractor.py` (7 integration tests) |
| Mock Anthropic client | Custom mock | `make_mock_anthropic_client()` + `make_tool_use_response()` in `tests/ai_mocks.py` | Already the established pattern |

---

## Common Pitfalls

### Pitfall 1: Forgetting to update the existing `test_schema_version_starts_at_one` test
**What goes wrong:** After bumping `SCHEMA_VERSION` to 2, the existing test at line 110 of `test_factor_extraction_schemas.py` fails with `AssertionError: assert 2 == 1`. The 275-test suite breaks.
**Why it happens:** The test was written when version 1 was correct — it's a guard test, not future-proof.
**How to avoid:** Update the assertion from `== 1` to `== 2` and rename the test function to `test_schema_version_is_two`. Do this in the same commit as the constant bump.
**Warning signs:** Running `pytest backend/tests/unit/test_factor_extraction_schemas.py` before committing.

### Pitfall 2: Missing the second assertion `result.schema_version == 1` in `test_extracted_factor_from_cache_flag_is_required_semantic`
**What goes wrong:** Line 75 asserts `result.schema_version == 1` (the Pydantic model default). After the bump to 2, this also fails if the Pydantic `default=1` is updated.
**Why it happens:** `ExtractedFactor.schema_version` has `default=1` in Pydantic. If that default is updated to 2, the test breaks.
**How to avoid:** Decide: either leave Pydantic default as 1 (test stays green but is slightly inconsistent) or update default to 2 (update test assertion to `== 2`). Recommended: update default to `default=2` for consistency and update the assertion.
**Warning signs:** Check every `schema_version == 1` occurrence in test files before committing.

### Pitfall 3: Writing the new version-rejection test against a live DB without the right fixture isolation
**What goes wrong:** Inserting a v1 cache row in one test bleeds into another test's cache lookup.
**Why it happens:** The test DB uses function-scoped table drop/recreate (per MEMORY.md pattern) but if tests share state via DB without proper teardown, stale rows appear.
**How to avoid:** Use the `test_db` fixture (function-scoped) which already handles isolation. Each test function gets a fresh DB state.

### Pitfall 4: Assuming the `ExtractedFactor.schema_version` Pydantic `default=1` is the cache key version
**What goes wrong:** Confusing the Pydantic model's `default=1` field with the `SCHEMA_VERSION` module constant. The Pydantic default only matters when `ExtractedFactor` is constructed without an explicit `schema_version` argument. In all actual code paths, `schema_version=SCHEMA_VERSION` is passed explicitly (in `extract_factor_live`, line 209; and cached rows read their `schema_version` from the DB row directly).
**How to avoid:** Understand the flow — the Pydantic default is a safety net, not the source of truth. The module constant `SCHEMA_VERSION` is the source of truth.

---

## Code Examples

### The single production change
```python
# backend/app/ai/factor_extraction_schemas.py — line 114
# BEFORE:
SCHEMA_VERSION: int = 1

# AFTER:
SCHEMA_VERSION: int = 2
```

### Updating the existing test
```python
# backend/tests/unit/test_factor_extraction_schemas.py

# BEFORE (line 110-114):
def test_schema_version_starts_at_one() -> None:
    from app.ai.factor_extraction_schemas import SCHEMA_VERSION
    assert SCHEMA_VERSION == 1
    assert isinstance(SCHEMA_VERSION, int)

# AFTER:
def test_schema_version_is_two() -> None:
    """SCHEMA_VERSION bumped 1→2 in M048/Phase 1 to invalidate M047 extraction cache."""
    from app.ai.factor_extraction_schemas import SCHEMA_VERSION
    assert SCHEMA_VERSION == 2
    assert isinstance(SCHEMA_VERSION, int)
```

### New unit test: v1 entry is a miss
```python
# Pattern: insert v1 row into test_db, call _get_cache_hit, assert None returned
import uuid
from app.services.factor_extraction_service import _get_cache_hit
from app.models.factor_extraction_cache import FactorExtractionCache

@pytest.mark.asyncio
async def test_v1_cache_entry_is_miss(test_db):
    """Cache entry with schema_version=1 returns None when SCHEMA_VERSION==2."""
    doc_id = uuid.uuid4()
    parcel = "NL.IMBAG.Pand.test_v1_miss"
    factor = "woonvisie_match"

    # Insert a v1 row directly (bypassing _write_cache which stamps current version)
    row = FactorExtractionCache(
        parcel_id=parcel,
        policy_document_id=doc_id,
        factor_id=factor,
        schema_version=1,          # stale — pre-M048 entry
        extracted_payload={"prioritized_segment": "sociaal", "growth_wijken": [], "confidence": 0.9},
    )
    test_db.add(row)
    await test_db.commit()

    result = await _get_cache_hit(
        test_db, parcel_id=parcel, policy_document_id=doc_id, factor_id=factor
    )
    assert result is None  # v1 entry not served
```

### New unit test: v2 entry is a hit
```python
@pytest.mark.asyncio
async def test_v2_cache_entry_is_hit(test_db):
    """Cache entry with schema_version=2 returns the row when SCHEMA_VERSION==2."""
    from app.ai.factor_extraction_schemas import SCHEMA_VERSION
    assert SCHEMA_VERSION == 2  # guard: this test only makes sense at v2

    doc_id = uuid.uuid4()
    parcel = "NL.IMBAG.Pand.test_v2_hit"
    factor = "woonvisie_match"

    row = FactorExtractionCache(
        parcel_id=parcel,
        policy_document_id=doc_id,
        factor_id=factor,
        schema_version=2,          # current version
        extracted_payload={"prioritized_segment": "midden", "growth_wijken": ["Centrum"], "confidence": 0.8},
    )
    test_db.add(row)
    await test_db.commit()

    result = await _get_cache_hit(
        test_db, parcel_id=parcel, policy_document_id=doc_id, factor_id=factor
    )
    assert result is not None
    assert result.schema_version == 2
```

Note: These two tests require a live `test_db` — so they belong in `tests/integration/` or a new `tests/unit/test_factor_extraction_service.py` that imports the `test_db` fixture. Since they test the service layer logic (not just schema introspection), `tests/unit/test_factor_extraction_service.py` is appropriate. The FK constraint on `policy_document_id` references `policy_documents.id` — inserting a `FactorExtractionCache` row with a random `doc_id` will fail if the FK is enforced in the test DB. Use `test_db` + create a real `PolicyDocument` row first (see `_seed_policy_document` helper in `test_factor_extractor.py`), OR disable FK constraint checking for the test.

The cleaner approach is to use `_seed_policy_document` (copy it or make it a shared fixture) to get a real `doc_id`.

---

## State of the Art

| Old State | New State | When | Impact |
|-----------|-----------|------|--------|
| `SCHEMA_VERSION = 1` | `SCHEMA_VERSION = 2` | M048/Phase 1 | All pre-M047 cache entries become cache misses on next lookup — next LLM call will use the new factor_extractor pipeline and write a v2 entry |

**No schema migration needed.** The `schema_version` column and `uq_factor_extraction_cache_key` unique constraint already exist in production (migration `x0_m047_s04_create_factor_extraction_cache.py` is the current Alembic head at `bbdb5c6ff811` per MEMORY.md).

---

## Open Questions

1. **FK constraint in new unit tests for `policy_document_id`**
   - What we know: `FactorExtractionCache.policy_document_id` has a FK to `policy_documents.id` with `ondelete="CASCADE"`. Inserting a row with a non-existent `policy_document_id` will raise an FK violation in the test DB.
   - What's unclear: Whether it's cleaner to (a) reuse `_seed_policy_document` helper inline, (b) extract it to conftest as a fixture, or (c) insert the `FactorExtractionCache` row via raw SQL with `SET CONSTRAINTS DEFERRED`.
   - Recommendation: Reuse the `_seed_policy_document` helper (copy the body or call it) — it is already proven in `test_factor_extractor.py`. This keeps the test DB in a valid state and does not require FK workarounds.

2. **Pydantic `ExtractedFactor.schema_version` default value**
   - What we know: Currently `default=1`. After the bump the default is inconsistent with the module constant.
   - What's unclear: Whether callers ever rely on the Pydantic default (i.e., construct `ExtractedFactor` without passing `schema_version`).
   - Recommendation: Update the Pydantic default to `default=2` (or derive it from the constant: `default=SCHEMA_VERSION`) for consistency. All active call sites pass it explicitly so this is safe.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest >=7.4.0 + pytest-asyncio >=0.21.0 |
| Config file | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `cd /home/klarifai/Documents/klarifai/clientprojects/propdex/backend && python -m pytest tests/unit/test_factor_extraction_schemas.py -x -q` |
| Full suite command | `cd /home/klarifai/Documents/klarifai/clientprojects/propdex/backend && python -m pytest tests/ -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CACHE-01 | SCHEMA_VERSION constant reads 2 | unit | `pytest tests/unit/test_factor_extraction_schemas.py::test_schema_version_is_two -x` | ❌ Wave 0 (rename existing test) |
| TEST-01 (miss) | v1 cache entry → cache miss (None returned) | unit/integration | `pytest tests/unit/test_factor_extraction_service.py::test_v1_cache_entry_is_miss -x` | ❌ Wave 0 |
| TEST-01 (hit) | v2 cache entry → cache hit (row returned) | unit/integration | `pytest tests/unit/test_factor_extraction_service.py::test_v2_cache_entry_is_hit -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/unit/test_factor_extraction_schemas.py tests/unit/test_factor_extraction_service.py -x -q`
- **Per wave merge:** `python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green (275+ tests) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_factor_extraction_service.py` — covers TEST-01 (v1 miss + v2 hit)
- [ ] Update `tests/unit/test_factor_extraction_schemas.py` — rename `test_schema_version_starts_at_one` to `test_schema_version_is_two`, update assertion from `== 1` to `== 2`
- [ ] Update `tests/unit/test_factor_extraction_schemas.py` — update `assert result.schema_version == 1` in `test_extracted_factor_from_cache_flag_is_required_semantic` to `== 2` (if Pydantic default is also bumped)

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `backend/app/ai/factor_extraction_schemas.py` — SCHEMA_VERSION location, current value, docstring
- Direct inspection: `backend/app/services/factor_extraction_service.py` — `_get_cache_hit()` WHERE clause, `_write_cache()` version stamping
- Direct inspection: `backend/app/models/factor_extraction_cache.py` — DB model, unique constraint, FK definition
- Direct inspection: `backend/tests/unit/test_factor_extraction_schemas.py` — existing tests to update
- Direct inspection: `backend/tests/integration/test_factor_extractor.py` — existing integration test patterns, `_seed_policy_document` helper
- Direct inspection: `backend/tests/ai_mocks.py` — mock factory patterns
- Direct inspection: `backend/pyproject.toml` — pytest config, asyncio_mode="auto"
- Direct inspection: `backend/alembic/versions/x0_m047_s04_create_factor_extraction_cache.py` — confirms migration exists, no new migration needed

### Secondary (MEDIUM confidence)
- None required — all findings from direct code inspection.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing project dependencies, no new libs needed
- Architecture: HIGH — cache mechanism fully implemented, change is surgical
- Pitfalls: HIGH — discovered via direct test-file inspection, not speculation

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (stable domain — only changes if factor_extraction_schemas.py is refactored)
