# Phase 5: Document-level cache sentinel (woonvisie) - Research

**Researched:** 2026-04-24
**Domain:** Backend — SQLAlchemy cache-layer, Anthropic tool-use pipeline, Pydantic contracts, pytest-asyncio testing
**Confidence:** HIGH (all findings verified against live code in this repo)

## Summary

Phase 5 changes a single piece of the existing factor-extraction pipeline: how the cache-key is composed for document-level factors. Today every parcel-scan of a woonvisie creates its own row in `factor_extraction_cache` (keyed on `parcel_id`). For Venlo (100k+ parcelen) against a single woonvisie document that means 100k Claude calls — each call produces the same output because the factor extracts *document* properties, not parcel-specific signals.

The fix is surgical: (1) caller (`cascade_enrichment_service.get_cascade_payloads`) passes the literal string `"__document__"` as `parcel_id` to `extract_factor` for document-level factors, (2) everything downstream already treats `parcel_id` as opaque text — the cache-lookup, upsert, and unique constraint already accept arbitrary 50-char strings; (3) `SCHEMA_VERSION` bumps 2→3 so existing parcel-keyed v2 entries become cache-misses and get cleaned up on next access. No DB migration. No schema changes. No new columns.

Two non-obvious risks: (a) **concurrency race** — `rescore_cascade_job.py` runs 5 parallel parcel workers (`asyncio.Semaphore(5)`) which can all cache-miss at t=0 and fire 5 simultaneous Claude calls before any writes complete; the existing `on_conflict_do_update` handles the write collision but doesn't dedupe the Claude calls themselves. (b) **backfill tool compatibility** — `backfill_cascade_scores.py` reads the cache with a query that happens to be document-scoped already (filters by `policy_document_id + factor_id`, not `parcel_id`), so it keeps working, but its log line "extracted_at=%s parcel=%s" will show "__document__" which may confuse operators.

**Primary recommendation:** Introduce a single constant `DOCUMENT_SENTINEL = "__document__"` in `factor_extraction_schemas.py`, use it at the one call-site in `cascade_enrichment_service.py`, bump `SCHEMA_VERSION` from 2 to 3, add a model-level comment, write 2 unit tests against `_get_cache_hit` + `extract_factor` with mocked Claude client. Concurrency race is a pre-existing issue, out of scope but must be documented.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | 2.x (Mapped + mapped_column syntax in-repo) | ORM + `pg_insert.on_conflict_do_update` upsert | Already the project ORM; used throughout `factor_extraction_cache.py` + `factor_extraction_service.py` |
| Pydantic | v2 | `FactorDefinition`, `ExtractedFactor`, `WoonvisiePayload` validation | Existing contract; `ExtractedFactor.schema_version` has `default=2` (literal) that must bump with SCHEMA_VERSION |
| pytest + pytest-asyncio | project-pinned | Async unit/integration tests with `test_db` fixture | Pattern already established in `tests/unit/test_factor_extraction_service.py` and `tests/integration/test_factor_extractor.py` |
| anthropic (AsyncAnthropic) | project-pinned | Claude client — mocked in tests via `tests/ai_mocks.py` | No direct work here, only injection point |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `unittest.mock.AsyncMock` | stdlib | Mock Claude client in unit/integration tests | Already used via `make_mock_anthropic_client(...)` in `tests/ai_mocks.py` — assert `client.messages.create.call_count == 1` for the "exactly 1 Claude call" success criterion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `parcel_id="__document__"` sentinel | New column `scope: Literal["parcel", "document"]` | Cleaner domain model but requires Alembic migration + unique-constraint rewrite. Success criterion #4 explicitly forbids migration. Sentinel wins. |
| Sentinel literal `"__document__"` (50 chars max) | Any fixed UUID (e.g. `00000000-0000-0000-0000-000000000000`) | String(50) accepts both; human-readable debugging wins — operators reading logs see intent immediately. |
| Caller decides sentinel | Registry field `is_document_level: bool` on `FactorDefinition` | Registry field is cleaner for M050+ when more document-level factors land (woondeals, nationale_woonagenda). However, adding a field to `FactorDefinition` forces every existing factor-def to either opt-out or default-false, and tests already assert exact FactorDefinition shape. Phase 5 scope keeps it at the caller — document the intent and revisit in M050. |

**Installation:** No new dependencies.

## Architecture Patterns

### Current call chain (relevant to this phase)
```
area_scan.py / rescore_cascade_job.py
    → get_cascade_payloads(db, parcel_id, gemeente_code, organization_id)
        → get_woonvisie_document(db, gemeente_code, organization_id)  [returns PolicyDocument or None]
        → extract_factor(db, factor_def=WOONVISIE_MATCH_FACTOR_DEF,
                         parcel_id=<real_parcel_id>,  # <- CHANGE POINT
                         policy_document=doc)
            → _get_cache_hit(db, parcel_id, policy_document_id, factor_id)
            → extract_factor_live(...)  [Claude call]
            → _write_cache(db, parcel_id, policy_document_id, factor_id, payload, extracted_at)
```

### Recommended change surface (minimal)
```
backend/app/ai/factor_extraction_schemas.py
  - SCHEMA_VERSION: 2 → 3
  - ExtractedFactor.schema_version default: 2 → 3
  - ADD: DOCUMENT_SENTINEL: Final[str] = "__document__"
  - ADD: module docstring paragraph explaining sentinel semantics

backend/app/services/cascade_enrichment_service.py
  - import DOCUMENT_SENTINEL
  - In get_cascade_payloads, for the woonvisie_match branch:
      extracted = await extract_factor(
          db,
          factor_def=WOONVISIE_MATCH_FACTOR_DEF,
          parcel_id=DOCUMENT_SENTINEL,  # was: parcel_id  (the function argument)
          policy_document=doc,
      )
  - Preserve logging context: emit the REAL parcel_id in surrounding log calls so operator traces still show which parcel triggered the scan
  - NOTE: the returned `ExtractedFactor.parcel_id` will now be "__document__"; downstream consumers (scoring) must not depend on that field

backend/app/models/factor_extraction_cache.py
  - ADD code-comment on parcel_id column:
      # "__document__" sentinel used for document-level factor types
      # (woonvisie_match and future cascade factors where extraction is
      # not parcel-specific). See factor_extraction_schemas.DOCUMENT_SENTINEL.

backend/tests/unit/test_factor_extraction_service.py (or new file)
  - Add 2 tests per TEST-05
```

### Pattern 1: Sentinel key as literal string constant
**What:** Export `DOCUMENT_SENTINEL = "__document__"` from `factor_extraction_schemas.py`. Any caller that wants document-scoped caching imports and passes it. The string itself is chosen to be (a) obviously-not-a-real-parcel (leading double underscore, no BAG/Kadaster format), (b) under 50 chars (fits existing `String(50)`), (c) ASCII-safe.
**When to use:** Any cascade factor where the extraction payload is independent of `parcel_id` (document-level factors). Today: `woonvisie_match`. Future (M050): `woondeals`, `nationale_woonagenda`, `welstandsnota`.
**Example:**
```python
# backend/app/ai/factor_extraction_schemas.py
from typing import Final

SCHEMA_VERSION: int = 3
"""Bumped to 3 in M048/Phase 5: document-level cache sentinel for woonvisie_match.
Old v2 entries (which cached per-parcel) become cache-misses and are superseded
on next access via on_conflict_do_update; no cleanup migration required."""

DOCUMENT_SENTINEL: Final[str] = "__document__"
"""Use as parcel_id in extract_factor() when the factor extracts document-level
signals that do not vary per parcel. Ensures exactly 1 Claude call per unique
(policy_document_id, factor_id, SCHEMA_VERSION) tuple across all parcels."""
```

```python
# backend/app/services/cascade_enrichment_service.py
from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, FactorExtractionError

# inside get_cascade_payloads:
extracted = await extract_factor(
    db,
    factor_def=WOONVISIE_MATCH_FACTOR_DEF,
    parcel_id=DOCUMENT_SENTINEL,  # document-level: cache shared across all parcels in gemeente
    policy_document=doc,
)
payloads["woonvisie_match"] = extracted.payload
```

### Pattern 2: SCHEMA_VERSION bump as cache invalidation
**What:** The unique constraint includes `schema_version`, so bumping the constant means new writes land on a new row; old rows are left in place but never read (WHERE clause filters on current SCHEMA_VERSION). No DELETE migration needed — orphan rows are tiny (one row per parcel × doc × factor pre-bump) and can be cleaned up later if needed.
**When to use:** Any change to cache-key semantics (which this is), payload shape, or extraction behavior that would produce different output for same input.
**Example:** Existing pattern — M048/Phase 1 already bumped 1→2 for the same reason.

### Anti-Patterns to Avoid
- **Do not mutate existing v2 rows in-place to v3.** Let the WHERE-clause filter do its job. On next access the caller will miss, call Claude once, and upsert via `on_conflict_do_update` which keys on (parcel_id, policy_document_id, factor_id, schema_version) — v3 gets a new row, v2 stays dormant.
- **Do not change `parcel_id` type or length.** It is `String(50)` NOT NULL. `"__document__"` is 12 chars — safe.
- **Do not add a `scope` column.** Forbidden by success criterion #4 (no DB migration). Use the sentinel value in the existing string column.
- **Do not change `ExtractedFactor.parcel_id` field type.** It's `str`, the sentinel is a str, no Pydantic friction.
- **Do not pass the sentinel blindly from callers upstream of `get_cascade_payloads`.** The sentinel is an implementation detail of the cascade service; `area_scan.py` / `rescore_cascade_job.py` must continue passing real parcel IDs into `get_cascade_payloads` for logging + wijk-matching. Only the internal call to `extract_factor` substitutes the sentinel.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent insert when multiple workers race | Custom SELECT-then-INSERT with row-lock | Existing `pg_insert.on_conflict_do_update` already at `_write_cache` lines 79-87 | SQL-level UPSERT is atomic; the existing implementation already handles the write-collision half of the race |
| Claude client mocking | Custom HTTP-intercept or VCR cassettes | `tests/ai_mocks.py` factories: `make_tool_use_response` + `make_mock_anthropic_client` | Already used in `test_factor_extractor.py`; pattern validated; `call_count` assertion is the primitive we need |
| Cache-hit/miss integration test | New DB setup | `test_db` + `create_test_user` fixtures in `conftest.py` (line 108 + 195) | Existing fixtures already handle async session + org seeding; test `test_cache_hit_second_call_no_claude` (integration/test_factor_extractor.py:146) is the template |
| Schema-version invalidation test | Custom | Existing `test_v1_cache_entry_is_miss` + `test_v2_cache_entry_is_hit` in `test_factor_extraction_service.py` | The template is literally one file away — copy-adapt for v2→v3 |

**Key insight:** Every single test utility, DB fixture, and mock helper you need already exists. Phase 5 is almost entirely a test-and-edit-two-files phase; the research-risk is architectural understanding, not tooling discovery.

## Common Pitfalls

### Pitfall 1: Concurrency race — 5 parallel workers, 1 Claude call each
**What goes wrong:** `rescore_cascade_job._process_parcel` runs under `asyncio.Semaphore(5)` (line 192). When the very first re-score of a gemeente fires, 5 parcel workers enter `get_cascade_payloads` concurrently. Each calls `extract_factor` with the same sentinel → all 5 hit `_get_cache_hit` → all 5 return None (no cache yet) → all 5 call `extract_factor_live` → 5 Claude calls. After the first finishes, the other 4 writes collide on the unique constraint; `on_conflict_do_update` resolves the write by overwriting — but the 4 extra Claude calls already happened.
**Why it happens:** No row-level lock / SELECT FOR UPDATE around the cache-check-then-call path. The cache-aware wrapper is read-modify-write without a lock.
**How to avoid:** Out of scope for Phase 5 (success criterion #3 says "2 sequentiële scans", explicitly sequential). Document the limitation in RESEARCH + in code-comment on `extract_factor`. For M050+ with full batch-rescore: add `SELECT ... FOR UPDATE` + `NOWAIT` pattern, or a distinct Redis-backed lock keyed on `(document_id, factor_id, schema_version)`.
**Warning signs:** On first-time gemeente ingest under load, see N Claude calls instead of 1 in usage logs; subsequent re-scans show exactly 1 (cache warm).

### Pitfall 2: Silent cache-write failure hides sentinel bug
**What goes wrong:** `_write_cache` is wrapped in `try/except Exception` (factor_extraction_service.py:155-161) that logs and swallows. If the sentinel value fails (e.g., someone later tightens the `parcel_id` column to a regex-validated BAG-format), writes silently skip and every call becomes a live Claude call — 100k-call regression.
**Why it happens:** Defensive exception handling obscures cache-layer failures.
**How to avoid:** The test `test_document_sentinel_cache_hit_on_second_call` must assert `mock_client.messages.create.call_count == 1` after the SECOND call and also verify the row exists via SELECT — not just trust `from_cache=True`.
**Warning signs:** `factor_extract cache-write failed (non-fatal)` log line appearing in prod after deploy.

### Pitfall 3: Downstream consumers reading `ExtractedFactor.parcel_id`
**What goes wrong:** After the fix, `ExtractedFactor.parcel_id == "__document__"` always for woonvisie_match. Any downstream code that reads this field for logging, scoring, or flag-storage would emit/store the sentinel string instead of the real parcel.
**Why it happens:** The caller (`cascade_enrichment_service.get_cascade_payloads`) passes the sentinel; the ExtractedFactor just echoes it back.
**How to avoid:** Grep for `.parcel_id` accesses on `ExtractedFactor` instances. Currently the only consumer is `get_cascade_payloads` which reads `extracted.payload` (not `extracted.parcel_id`). Safe. But add a unit assertion: when sentinel is used, caller must NOT propagate `extracted.parcel_id` — only `extracted.payload`.
**Warning signs:** Strings `"__document__"` appearing in scan_result flags, scoring logs, or UI rendering.

### Pitfall 4: Test shares the same `policy_document` across scenarios and hits sentinel collision
**What goes wrong:** Test file at `tests/unit/test_factor_extraction_service.py` seeds a fresh `doc` per test, but if a future test tries to assert "document-level isolation between gemeenten" and reuses the same doc, the sentinel cache row from test A leaks into test B.
**Why it happens:** The unique constraint is `(parcel_id, policy_document_id, factor_id, schema_version)` — with sentinel as parcel_id, two tests against the same doc share the row.
**How to avoid:** Each test seeds its own `PolicyDocument` with `uuid.uuid4()`. The existing `_seed_policy_document` helper already does this. Function-scoped `test_db` fixture in conftest.py drops/recreates tables between tests (per memory: "Isolation: Function-scoped table drop/recreate").
**Warning signs:** Flaky tests when run in parallel or in reordered sequence.

### Pitfall 5: `backfill_cascade_scores.py` log confusion
**What goes wrong:** Line 108 logs `"Loaded woonvisie payload from cache: doc=%s parcel=%s"` — after fix this always logs `parcel=__document__`. Ops reading logs thinks something broke.
**Why it happens:** Pre-existing log line now shows the sentinel.
**How to avoid:** Either (a) leave the log as-is and document in runbook, (b) change log to not include `cached.parcel_id`, (c) log "document-level cache entry" when `cached.parcel_id == DOCUMENT_SENTINEL`. Minimal option (a) with a todo for M050 is fine — the tool still works correctly, only the log line is cosmetic.
**Warning signs:** Ops-ticket "why does every woonvisie cache entry have parcel=__document__".

### Pitfall 6: Forgetting to bump the Pydantic default
**What goes wrong:** `ExtractedFactor.schema_version` has `Field(default=2, ...)` at factor_extraction_schemas.py:63-69. The existing test `test_extracted_factor_from_cache_flag_is_required_semantic` asserts `result.schema_version == 2` (line 75 in test_factor_extraction_schemas.py). When SCHEMA_VERSION bumps to 3 but the default stays at 2, every `ExtractedFactor` created without explicit `schema_version` kwarg silently gets 2 — tests fail, and downstream code reading `.schema_version` sees stale values.
**Why it happens:** Pydantic default is a literal, not a reference to SCHEMA_VERSION.
**How to avoid:** Bump the `default=2` to `default=3` in the same commit. Update the assertion in `test_factor_extraction_schemas.py:75` from `== 2` to `== 3`. Update `test_schema_version_is_two` (same file, line 110) to assert `== 3` (and rename the test function).
**Warning signs:** `test_extracted_factor_from_cache_flag_is_required_semantic` fails with "AssertionError: assert 2 == 3".

## Code Examples

Verified patterns from the repo:

### Atomic upsert (already in place — no change needed)
```python
# backend/app/services/factor_extraction_service.py:70-88
insert_stmt = pg_insert(FactorExtractionCache).values(
    parcel_id=parcel_id,  # accepts "__document__" unchanged
    policy_document_id=policy_document_id,
    factor_id=factor_id,
    schema_version=SCHEMA_VERSION,  # reads bumped value
    extracted_payload=extracted_payload,
    extracted_at=extracted_at,
    cached_at=datetime.utcnow(),
)
upsert_stmt = insert_stmt.on_conflict_do_update(
    constraint="uq_factor_extraction_cache_key",
    set_={
        "extracted_payload": insert_stmt.excluded.extracted_payload,
        "extracted_at": insert_stmt.excluded.extracted_at,
        "cached_at": insert_stmt.excluded.cached_at,
    },
)
await db.execute(upsert_stmt)
await db.commit()
```

### Mocked Claude client with call_count assertion
```python
# Based on tests/integration/test_factor_extractor.py:146-195 (cache-hit test)
@pytest.mark.asyncio
async def test_document_sentinel_one_claude_call_for_two_parcels(test_db, create_test_user):
    from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
    from app.services.cascade_enrichment_service import get_cascade_payloads
    from tests.ai_mocks import make_mock_anthropic_client, make_tool_use_response

    doc, _user, org = await _seed_policy_document(test_db, create_test_user)

    # Seed parcel_cache rows for 2 different parcels in Venlo gemeente
    # ... (use existing ParcelCache fixture or inline seeding)

    fixed_payload = {
        "periode_start": 2025, "periode_einde": 2030,
        "prioritized_segment": "sociaal",
        "growth_wijken": ["Blerick"], "confidence": 0.9,
    }
    mock_client = make_mock_anthropic_client(
        make_tool_use_response(
            tool_name="extract_woonvisie_match",
            tool_input=fixed_payload,
        )
    )

    # NOTE: get_cascade_payloads doesn't accept claude_client directly — either
    # (a) test at extract_factor() level passing claude_client + DOCUMENT_SENTINEL,
    # (b) add claude_client param to get_cascade_payloads for testability,
    # (c) monkeypatch create_claude_client. Approach (a) is cleanest for unit test.

    # Direct approach (a):
    from app.ai.factors.woonvisie_match import WOONVISIE_MATCH_FACTOR_DEF
    from app.services.factor_extraction_service import extract_factor

    # Scan parcel A
    result_a = await extract_factor(
        test_db,
        factor_def=WOONVISIE_MATCH_FACTOR_DEF,
        parcel_id=DOCUMENT_SENTINEL,   # caller would pass this
        policy_document=doc,
        claude_client=mock_client,
    )
    assert result_a.from_cache is False
    assert mock_client.messages.create.call_count == 1

    # Scan parcel B — same sentinel, same doc → cache hit, NO new Claude call
    result_b = await extract_factor(
        test_db,
        factor_def=WOONVISIE_MATCH_FACTOR_DEF,
        parcel_id=DOCUMENT_SENTINEL,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert result_b.from_cache is True
    assert mock_client.messages.create.call_count == 1  # STILL 1 — key assertion
```

### v2→v3 invalidation test (mirror of existing test_v1_cache_entry_is_miss)
```python
@pytest.mark.asyncio
async def test_v2_cache_entry_is_miss_after_bump_to_v3(test_db, create_test_user):
    """v2 entries (M048/Phase 1 writes) become cache-miss after bump to v3."""
    from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
    from app.models.factor_extraction_cache import FactorExtractionCache
    from app.services.factor_extraction_service import _get_cache_hit

    assert SCHEMA_VERSION == 3, f"Test only valid at SCHEMA_VERSION==3, got {SCHEMA_VERSION}"

    doc = await _seed_policy_document(test_db, create_test_user)

    # Stale v2 entry — note: keyed on a real parcel_id (pre-sentinel era)
    stale = FactorExtractionCache(
        parcel_id="NL.IMBAG.Pand.0983100000000091",
        policy_document_id=doc.id,
        factor_id="woonvisie_match",
        schema_version=2,
        extracted_payload={"prioritized_segment": "sociaal", "growth_wijken": [], "confidence": 0.9},
    )
    test_db.add(stale)
    await test_db.commit()

    # Lookup with sentinel + current SCHEMA_VERSION=3 → miss
    result = await _get_cache_hit(
        test_db,
        parcel_id=DOCUMENT_SENTINEL,
        policy_document_id=doc.id,
        factor_id="woonvisie_match",
    )
    assert result is None
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cache keyed on real parcel_id for all factors | Sentinel `"__document__"` for document-level factors | M048/Phase 5 (this phase) | 100k→1 Claude calls for Venlo-scale woonvisie extraction |
| SCHEMA_VERSION = 1 (M047/S04) | SCHEMA_VERSION = 2 (M048/Phase 1) | 2026-04-22 | Pre-M047 cache entries invalidated |
| SCHEMA_VERSION = 2 | SCHEMA_VERSION = 3 | This phase | v2 parcel-keyed entries become dormant |

**Deprecated/outdated:**
- `tests/test_m047_s04_iron_rule.py:39` asserts `SCHEMA_VERSION == 1` — this test is already wrong post-Phase-1 and must be updated or retired in Phase 5 along with the bump.

## Open Questions

1. **Should `DOCUMENT_SENTINEL` be hoisted to registry-level metadata in this phase or deferred?**
   - What we know: Only one document-level factor exists today (`woonvisie_match`). M050+ will introduce 3-5 more.
   - What's unclear: Whether adding `is_document_level: bool = False` to `FactorDefinition` NOW (Phase 5) is worth touching `FactorDefinition` tests, or defer to M050 first new factor.
   - Recommendation: Defer. Keep sentinel at caller-level in `cascade_enrichment_service`. When M050's second document-level factor (woondeals) lands, introduce the registry field then — at that point the pattern is obvious and the refactor-cost is justified.

2. **Should `get_cascade_payloads` accept a `claude_client` param for testability?**
   - What we know: Currently `extract_factor` accepts `claude_client: AsyncAnthropic | None` — testable at that layer. `get_cascade_payloads` does NOT accept it — not testable with mocked Claude without monkeypatching.
   - What's unclear: Whether the integration test should test `get_cascade_payloads` end-to-end or be a unit test at `extract_factor` layer.
   - Recommendation: Unit test at `extract_factor` layer (as shown above) satisfies TEST-05. Add `claude_client` passthrough to `get_cascade_payloads` if/when Phase 8 E2E needs it.

3. **Does `rescore_cascade_job.py` need changes in this phase?**
   - What we know: It already calls `get_cascade_payloads` which internally calls `extract_factor`. After Phase 5 fix, first parcel-rescore in a batch primes the cache; subsequent 99,999 parcels cache-hit.
   - What's unclear: Whether the concurrency race (see Pitfall 1) blocks the success criterion of "exactly 1 Claude call".
   - Recommendation: Success criterion #3 says "2 sequentiële scans". Sequential = no race. Phase 5 does not need a concurrency fix. Add a code-comment in `rescore_cascade_job._process_parcel` acknowledging the race on first-parcel burst; create a todo for M050+ to add locking.

4. **Should we clean up the stale v2 rows?**
   - What we know: Row count = (# Venlo parcelen in ParcelCache) × (# woonvisie docs) × 1 factor. At ~60k rows per gemeente, 100-200MB of JSONB is not trivial but not blocking.
   - What's unclear: Whether ops wants a cleanup script.
   - Recommendation: Out of scope. Add a one-line SQL cleanup command to the phase VERIFICATION.md (runbook): `DELETE FROM factor_extraction_cache WHERE schema_version < 3;` — run manually post-deploy, not automated in migration.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio (async mode in conftest) |
| Config file | `backend/pyproject.toml` (pytest settings) + `backend/tests/conftest.py` |
| Quick run command | `cd backend && uv run pytest tests/unit/test_factor_extraction_service.py tests/unit/test_factor_extraction_schemas.py -x -v` |
| Full suite command | `cd backend && uv run pytest -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CACHE-02 | `extract_factor` called with `parcel_id="__document__"` for woonvisie_match; 1 Claude call for N parcels | unit | `uv run pytest tests/unit/test_factor_extraction_service.py::test_document_sentinel_one_claude_call_for_two_parcels -x` | ❌ Wave 0 |
| CACHE-02 | SCHEMA_VERSION == 3 constant | unit | `uv run pytest tests/unit/test_factor_extraction_schemas.py::test_schema_version_is_three -x` | ❌ Wave 0 (rename existing `test_schema_version_is_two`) |
| CACHE-02 | `ExtractedFactor.schema_version` default == 3 | unit | `uv run pytest tests/unit/test_factor_extraction_schemas.py::test_extracted_factor_from_cache_flag_is_required_semantic -x` | ✅ (update existing assertion) |
| CACHE-02 | `DOCUMENT_SENTINEL` constant exported and == "__document__" | unit | `uv run pytest tests/unit/test_factor_extraction_schemas.py::test_document_sentinel_constant -x` | ❌ Wave 0 |
| CACHE-02 | Code-comment present on `FactorExtractionCache.parcel_id` column | unit (introspection) | `uv run pytest tests/unit/test_factor_extraction_cache_model.py::test_parcel_id_column_documents_sentinel -x` | ❌ Wave 0 (optional — can be manual verify via grep) |
| CACHE-02 | `cascade_enrichment_service.get_cascade_payloads` passes `DOCUMENT_SENTINEL` to `extract_factor` for woonvisie_match | integration | `uv run pytest tests/integration/test_cascade_enrichment_service.py::test_woonvisie_uses_document_sentinel -x` | ❌ Wave 0 (new file) |
| TEST-05 | Sentinel-write → sentinel-hit on 2nd lookup | unit | same as first row above | ❌ Wave 0 |
| TEST-05 | v2→v3 bump invalidates old entries | unit | `uv run pytest tests/unit/test_factor_extraction_service.py::test_v2_cache_entry_is_miss_after_bump_to_v3 -x` | ❌ Wave 0 |
| TEST-05 | No DB migration exists for this phase | manual | `ls backend/alembic/versions/ \| grep -i document_sentinel` → expect empty | ✅ (manual grep) |
| Regression guard | Pre-M048/Phase1 `test_v1_cache_entry_is_miss` still passes at v3 (v1 < v3) | unit | `uv run pytest tests/unit/test_factor_extraction_service.py::test_v1_cache_entry_is_miss -x` | ✅ (works — v1 != v3) |
| Regression guard | Existing 275 tests stay green | full | `cd backend && uv run pytest` | ✅ |

### Sampling Rate
- **Per task commit:** `cd backend && uv run pytest tests/unit/test_factor_extraction_service.py tests/unit/test_factor_extraction_schemas.py -x -v`
- **Per wave merge:** `cd backend && uv run pytest tests/unit/ tests/integration/test_factor_extractor.py tests/integration/test_cascade_enrichment_service.py -x`
- **Phase gate:** `cd backend && uv run pytest -x` (full 275+ suite green) + `ruff check . && mypy .`

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_factor_extraction_service.py` — add `test_document_sentinel_one_claude_call_for_two_parcels` + `test_v2_cache_entry_is_miss_after_bump_to_v3` (file exists, extend)
- [ ] `backend/tests/unit/test_factor_extraction_schemas.py` — add `test_document_sentinel_constant`; rename + update `test_schema_version_is_two` → `test_schema_version_is_three`; update `test_extracted_factor_from_cache_flag_is_required_semantic` assertion from `== 2` to `== 3`
- [ ] `backend/tests/integration/test_cascade_enrichment_service.py` — NEW file, test that `get_cascade_payloads` internally uses the sentinel (can be achieved by a partial mock on `extract_factor` and asserting kwargs)
- [ ] Audit & possibly update `backend/tests/test_m047_s04_iron_rule.py:39` — still asserts `SCHEMA_VERSION == 1` after Phase 1 bump; must be either updated to `== 3` or removed as stale
- [ ] Framework install: none required — pytest + pytest-asyncio + all mock fixtures already configured

## Sources

### Primary (HIGH confidence)
- `backend/app/ai/factor_extraction_schemas.py` — canonical SCHEMA_VERSION, FactorDefinition, ExtractedFactor, FactorExtractionError
- `backend/app/models/factor_extraction_cache.py` — table structure, unique constraint, `String(50)` parcel_id column
- `backend/app/services/factor_extraction_service.py` — `extract_factor`, `_get_cache_hit`, `_write_cache` (sole cache entrypoints)
- `backend/app/services/cascade_enrichment_service.py` — `get_cascade_payloads` (sole caller that needs the edit)
- `backend/app/ai/factors/woonvisie_match.py` — `WOONVISIE_MATCH_FACTOR_DEF`, `WoonvisiePayload`
- `backend/app/ai/factor_extractor.py` — `extract_factor_live` (Claude-call layer, untouched in this phase)
- `backend/app/jobs/rescore_cascade_job.py` — concurrency surface (Semaphore=5) that produces the race
- `backend/app/tools/backfill_cascade_scores.py:88-113` — reads cache with document-level query (naturally compatible with sentinel)
- `backend/tests/unit/test_factor_extraction_service.py` — template for v-miss/v-hit tests (M048/Phase 1 patterns)
- `backend/tests/unit/test_factor_extraction_schemas.py` — SCHEMA_VERSION + ExtractedFactor default tests to update
- `backend/tests/integration/test_factor_extractor.py:146-195` — template for cache-hit mocked-Claude tests
- `backend/tests/ai_mocks.py` — `make_tool_use_response` + `make_mock_anthropic_client` helpers
- `backend/tests/conftest.py:108-232` — `test_db`, `create_test_user` fixtures
- `.planning/REQUIREMENTS.md` — CACHE-02 + TEST-05 definition
- `.planning/ROADMAP.md` — Phase 5 success criteria
- `.planning/STATE.md` — M048 Phase 1 context (previous SCHEMA_VERSION bump)
- `CLAUDE.md` — project rules (file <300 lines, ruff+mypy, multi-tenant)

### Secondary (MEDIUM confidence)
- Memory entry on ARQ worker invocation (`python -m app.jobs.worker`) — relevant for any concurrency repro beyond Phase 5 scope.

### Tertiary (LOW confidence)
- None. This phase is entirely verifiable against live code; no external docs consulted.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library and pattern verified against in-repo code
- Architecture: HIGH — full call-chain traced end-to-end, change surface is 4 files
- Pitfalls: HIGH for 1,2,3,6 (code-inspected); MEDIUM for 4 (test-isolation inference); HIGH for 5 (log line direct-quoted)
- Test strategy: HIGH — all helpers and fixtures exist, template tests are one file away

**Research date:** 2026-04-24
**Valid until:** 2026-06-01 (stable backend domain; only invalidated by major refactor of factor_extraction_service or FactorExtractionCache model)
