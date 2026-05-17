# Phase 2: Admin API Layer — Research

**Researched:** 2026-05-14
**Domain:** FastAPI admin REST + SQLAlchemy 2.x async + asyncpg advisory locks
**Confidence:** HIGH

## Summary

Phase 2 is a thin domain-specific router on top of an S01 datamodel that already exists and matches the locked-in CONTEXT decisions exactly. Every architectural piece needed has a precedent in the codebase: a canonical gemeente_code→gemeente_naam resolver (`_gemeente_name_map` from M045/S05), an existing superuser-gated admin router (`app/admin/router.py`), and a Wave-0 RBAC scaffold (`tests/integration/test_admin_data_sources_rbac.py`) created in S01 P02 that pins the JWT + fixture pattern. The one non-trivial implementation question — how `pg_try_advisory_xact_lock` interacts with asyncpg's "no parameterized queries" caveat — resolves cleanly: the caveat is **specific to `SET LOCAL`** (a backend-config command), NOT generic function calls. `func.pg_try_advisory_xact_lock(:k)` with a bound int parameter works in SQLAlchemy 2.x + asyncpg as long as we coerce the key to `BigInteger`.

**Primary recommendation:** Reuse `_gemeente_name_map` from `app/policy_documents/service.py:332-350` verbatim for gemeente_naam resolution, mirror the M045 admin overview endpoint shape for response composition, follow the existing RBAC scaffold for tests, and use `func.pg_try_advisory_xact_lock(type_coerce(LOCK_KEY, BigInteger))` for the idempotency lock.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Router locatie & mounting**
- New file: `backend/app/admin/data_sources_router.py` (NOT extending `backend/app/admin/router.py`)
- Mount: `router = APIRouter(prefix="/api/admin/data-sources", tags=["Admin / Data Sources"])`
- Register in `backend/app/main.py` mirroring existing `admin_router` pattern

**Endpoints (3 GET + 1 POST)**
- `GET /api/admin/data-sources/gemeenten` → `list[GemeenteSummary]` sorted `last_activity_at DESC, gemeente_code ASC`
- `GET /api/admin/data-sources/{gemeente_code}` → `GemeenteDataSourcesPayload` (3 sections), <300ms, `^GM\d{4}$` regex on path param, unknown code → 404
- `POST /api/admin/data-sources/{gemeente_code}/{source_key}/refresh` → `DataSourceRow` (single), synchronous (no ARQ), advisory-lock idempotency, body-less
- All endpoints: `Depends(get_current_superuser)` only — NO TenantMixin / organization_id filtering

**Payload composition (single-query merge)**
1. `SELECT * FROM data_source_status WHERE gemeente_code = :code` → dict keyed by source_key
2. Iterate `DATA_SOURCE_KEYS` catalog (from S01); DB-row → use it; absent → synthesize default with `status="missing"`
3. Compute `available_actions` per row from `source_type + status`
4. Group by `source_type` → 3 lists
5. Resolve `gemeente_naam` from existing CBS gemeente-naam lookup

**Idempotency via pg_try_advisory_xact_lock**
- `LOCK_KEY = hash(gemeente_code + source_key) & 0x7FFFFFFFFFFFFFFF` (int8 safe)
- If lock not acquired: return current row (200, no probe run)
- If lock acquired: run probe → compare-and-update (only write if status or error_message changed)

**Probe-registry pattern**
- `PROBE_REGISTRY: dict[str, ProbeFn] = {"A": probe_type_a_cascade, "B": probe_type_b_stub, "C": probe_type_c_stub}`
- Type A: count `PolicyDocument` rows for (gemeente, source_key) → `live` if >0 else `missing`
- Type B stub: returns `not_applicable` with deferred-message
- Type C stub: returns `missing` with "Awaiting S05" message

**`available_actions` shape**
- Each action has `{action, enabled, label_nl, reason_disabled}`
- Matrix specified in CONTEXT §6 — `refresh` always present, enabled/disabled by source_type+status

**Catalog drift handling**
- DB row not in catalog: GET logs warning + skips row; POST returns 404 ("Source key not in catalog")

**Tests file:** `backend/tests/integration/test_admin_data_sources_router.py` (10 paths, see CONTEXT §8)

### Claude's Discretion

The CONTEXT explicitly flags these as "investigate in planner":
- Gemeente-naam resolution mechanism (existing mapper? new hardcoded dict?)
- Status enum centralisation location (`data_source_keys.py` vs new `data_source_enums.py`)
- Performance verification approach (`pytest -m perf` vs inline `time.perf_counter`)
- Test structure for concurrent-refresh (no codebase precedent for `asyncio.gather` httpx tests)

### Deferred Ideas (OUT OF SCOPE)

- Live probes for Type B / Type C (stubs only this phase)
- Refresh audit-log / history table
- Bulk refresh endpoint (`refresh-all`)
- WebSocket / SSE live status push
- Per-source rate limiting (advisory lock sufficient for MVP)
- GraphQL alternative
- ARQ enqueue (probes synchronous; cheap enough)
- M045 upload-flow integration (Phase 4)
- Credentials API endpoints (Phase 5)
- ActionItems deprecation (Phase 6)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| API-01 | `GET /api/admin/data-sources/{gemeente_code}` 3-section payload per gemeente | §2 single-query merge + §1 gemeente_naam resolver + §4 PolicyDocument query |
| API-02 | `GET /api/admin/data-sources/gemeenten` aggregate counts sorted by activity | §2 single-query strategy (GROUP BY gemeente_code with counts) + §1 name lookup |
| API-03 | `POST .../{source_key}/refresh` idempotent probe trigger | §2 advisory-lock pattern + §3 probe registry + §5 router registration |
| API-05 | All admin endpoints superuser-gated, NO org-scoping | §3 `get_current_superuser` reuse confirmed at `app/auth/dependencies.py:103` |
| TEST-02 | Integration tests for 5 endpoints (auth + scoping + status transitions) | §3 fixture patterns + §7 concurrent-lock test design |
</phase_requirements>

---

## 1. Gemeente-naam resolution pattern

### Existing canonical resolver: USE THIS

`backend/app/policy_documents/service.py:332-350` defines `_gemeente_name_map(db) -> dict[str, str]` that returns a complete `{gemeente_code: gemeente_naam}` mapping sourced from `area_scans.gemeente_naam`. M045/S05's admin overview endpoint (`fetch_admin_overview`) uses this exact pattern — there is precedent.

**Exact signature (re-exportable):**
```python
# Source: backend/app/policy_documents/service.py:332
async def _gemeente_name_map(db: AsyncSession) -> dict[str, str]:
    """Return a best-effort {gemeente_code: gemeente_naam} map.

    Single query — not N+1. Returns at most ~342 rows.
    """
    stmt = (
        select(AreaScan.gemeente_code, AreaScan.gemeente_naam)
        .distinct()
        .where(AreaScan.gemeente_code.is_not(None))
    )
    rows = (await db.execute(stmt)).all()
    return {row.gemeente_code: row.gemeente_naam for row in rows}
```

**Constraints (HIGH confidence):**
- The function is `async`, takes `AsyncSession`, single DISTINCT SELECT on `area_scans`.
- Module-private naming (`_` prefix) — Phase 2 must either (a) call it via the existing service or (b) extract into a shared helper. Recommend extracting to `backend/app/services/gemeente_name_lookup.py` and re-importing from policy_documents.service to avoid cross-module reach-through.
- The docstring explicitly warns about gemeentes that have policy docs but no scan yet — they fall back to raw code (`"GM0983"`).

**Secondary seed list (for gemeentes never scanned):**
`backend/app/policy_documents/auto_ingest.py:53-59` has `KNOWN_GEMEENTES_FOR_AUTO_INGEST` (Venlo, Amsterdam, Utrecht, Den Haag, Rotterdam). Useful as a tiebreaker fallback before falling all the way back to raw code.

**Tertiary: `backend/app/models/gemeente_provincie_map.py`** stores only code↔code (gemeente_code → provincie_code), NOT names. Not useful for naam resolution.

**Recommendation for planner:** Reuse `_gemeente_name_map` as-is; no need for a hardcoded MVP dict. The function returns 342 rows max (all NL gemeentes) and is one cheap DISTINCT query. For the `GET /gemeenten` endpoint, this map merged with `data_source_status`-derived codes gives the full list; for `GET /{gemeente_code}` and `POST refresh`, the same map resolves the single naam.

**Source citations (HIGH):** `backend/app/policy_documents/service.py:332-350`, `backend/app/policy_documents/service.py:374` (fetch_admin_overview consumer), `backend/tests/integration/test_m045_admin_overview_endpoint.py:151-163` (test seed pattern), `backend/app/models/area_scan.py:36` (column definition).

---

## 2. asyncpg + `pg_try_advisory_xact_lock` quirks with SQLAlchemy async sessions

### Lock works inside session transaction — IS xact_lock not session_lock

**HIGH confidence:** `pg_try_advisory_xact_lock(key)` releases automatically on transaction commit/rollback. Since each FastAPI request runs in a SQLAlchemy session that auto-commits on the route exit, the lock lifecycle matches exactly the refresh-request lifecycle. No manual release needed.

### asyncpg parameterization caveat — does NOT apply to advisory_lock

The `CLAUDE.md` warning "SET LOCAL + asyncpg: Cannot use parameterized queries (`$1`)" is **specific to `SET LOCAL` and similar backend config commands**. It is NOT a general asyncpg limitation. Function calls like `pg_try_advisory_xact_lock(...)` are regular SQL and support normal bind parameters.

**Source: `backend/app/core/database.py:55`** — only `SET LOCAL` is affected:
> "Note: SET LOCAL does not support parameterized queries in asyncpg, so we use string formatting after UUID validation"

### Exact SQLAlchemy 2.x + asyncpg invocation

The asyncpg dialect requires explicit type coercion for the int8 key (otherwise it defaults to int4 and overflows on hash values >2^31). Two equivalent verified patterns:

**Option A — `func` + `type_coerce` (recommended, type-safe):**
```python
from sqlalchemy import func, type_coerce, BigInteger, select

lock_acquired = await db.scalar(
    select(func.pg_try_advisory_xact_lock(
        type_coerce(LOCK_KEY, BigInteger())
    ))
)
```

**Option B — `text()` + bindparams with explicit type (closer to existing codebase style):**
```python
from sqlalchemy import text, BigInteger, bindparam

stmt = text("SELECT pg_try_advisory_xact_lock(:k)").bindparams(
    bindparam("k", type_=BigInteger())
)
lock_acquired = await db.scalar(stmt, {"k": LOCK_KEY})
```

**Option C — f-string fallback (safe since key is int, not user-controlled):**
The CONTEXT-provided `LOCK_KEY = hash(...) & 0x7FFFFFFFFFFFFFFF` is always an int from a constant hash. f-string interpolation is safe (no SQL injection risk). This matches the existing `SET LOCAL` pattern in the codebase if option A/B run into asyncpg quirks.

**Recommendation:** Start with Option A. If asyncpg complains about prepared-statement parameter typing (rare in 2026 SQLAlchemy ≥2.0 with asyncpg ≥0.27), fall back to Option C since `LOCK_KEY` is provably int.

**Sources:**
- [SQLAlchemy 2.x asyncpg + advisory lock discussion (verified MEDIUM)](https://github.com/sqlalchemy/sqlalchemy/discussions/7814)
- [asyncpg issuing advisory lock (HIGH — official asyncpg repo)](https://github.com/MagicStack/asyncpg/issues/972)
- `backend/app/core/database.py:55-66` — Propdex's only existing precedent for asyncpg parameterization quirks (limited to SET LOCAL)

### Codebase has NO existing advisory_lock usage

**LOW confidence (because it's a negative claim):** `grep -rn "pg_try_advisory\|advisory_xact\|advisory_lock\|pg_advisory" backend/ --include="*.py"` returns zero matches. Phase 2 introduces the first advisory lock in Propdex. Plan should include one focused unit test that asserts the lock primitive works on `propdex_test` (e.g., `assert (await db.scalar(select(func.pg_try_advisory_xact_lock(type_coerce(42, BigInteger()))))) is True`).

---

## 3. Existing admin endpoint test patterns

### Superuser token creation — direct JWT helper, no HTTP login

The Wave-0 scaffold `backend/tests/integration/test_admin_data_sources_rbac.py` (lines 36-80) pins the pattern exactly. **Phase 2 tests should mirror this file** since it was built specifically for these endpoints.

**Pattern (HIGH confidence — from test_admin_data_sources_rbac.py:39-44):**
```python
from app.auth.jwt import create_access_token

user, org = await create_test_user(email="super@test", is_superuser=True)
token = create_access_token(str(user.id), str(org.id))
headers = {"Authorization": f"Bearer {token}"}
```

**`create_test_user` fixture (`backend/tests/conftest.py:202-244`):**
- Factory function returning `(user, org)` tuple.
- Accepts `**kwargs` including `is_superuser`.
- Persists via `test_db.add()` + `test_db.commit()` (matches CLAUDE.md "Transactions: direct db.add/commit" pattern).

**`auth_headers` fixture (`backend/tests/conftest.py:187-199`):**
- Creates a non-superuser by default — useful for 403 test cases without rebuilding the user.

### Test isolation: function-scoped table drop/recreate

**HIGH confidence:** `backend/tests/conftest.py:115-146` (`test_db` fixture) drops all tables after each test. **YES this applies to admin tests** — `test_admin_data_sources_rbac.py` uses `test_db` directly and works. There's no opt-out. Tests are slow-ish (full schema drop+create per test) but completely isolated.

**Important asyncpg gotcha already handled:** `test_engine` fixture uses `connect_args={"statement_cache_size": 0}` and `pool_pre_ping=False` (`backend/tests/conftest.py:102-107`) — this is required because Python 3.14 + asyncpg + SQLAlchemy 2.x has a prepared-statement cache bug that causes `pg_type` UniqueViolation between tests when DDL runs repeatedly. Phase 2 tests will inherit this fix transparently.

### 403 vs 200 assertion pattern

From `backend/tests/integration/test_admin_data_sources_rbac.py:56` and `test_m045_admin_overview_endpoint.py:90-106`:
```python
# 403 (regular user)
resp = await async_client.get("/api/admin/data-sources/gemeenten",
                               headers=_auth_headers(regular_user, regular_org))
assert resp.status_code == 403, resp.text  # include .text in message for debug

# 200 (superuser)
resp = await async_client.get("/api/admin/data-sources/gemeenten",
                               headers=_auth_headers(super_user, vendor_org))
assert resp.status_code == 200, resp.text
```

**Important nuance:** `test_m045_admin_overview_endpoint.py` has an EXTRA defense-in-depth layer where superusers from non-vendor orgs ALSO get 403 (line 109-135). For Phase 2 / DataSourceStatus, the eng-review locked decision says **plain superuser is sufficient** — no vendor-org check. The S01 RBAC scaffold (`test_admin_data_sources_rbac.py`) confirms this: only `is_superuser=True` is required.

### `async_client` fixture vs per-test app

Two patterns coexist:
- **`async_client` fixture (`conftest.py:149-184`)** — uses `app` (full app), overrides `get_db`, disables rate limiter. Best for full integration tests.
- **`_build_dummy_app` (`test_admin_data_sources_rbac.py:19-33`)** — creates a minimal FastAPI app per test. Was needed for S01 because the real router didn't exist yet.

**Recommendation:** Phase 2 tests should use `async_client` (real `app`) since the router will be mounted. The dummy-app pattern from S01 can be deleted or kept as the lightest possible RBAC smoke test.

---

## 4. PolicyDocument query target for Type A probe

### ⚠️ FIELD MISMATCH — Critical correction

**`PolicyDocument` does NOT have `gemeente_code` — it has `entity_type` + `entity_code`.**

Source: `backend/app/models/policy_document.py:28-42`:
```python
entity_type: Mapped[str]  # "gemeente" | "provincie" | "landelijk"
entity_code: Mapped[str]  # "GM0983" | "PV31" | "NL"
source_key: Mapped[str]   # e.g. "woonvisie"
```

The CONTEXT §5 probe pseudocode that says:
```python
.where(PolicyDocument.gemeente_code == gemeente_code)
```
**is wrong.** Correct probe query:

```python
async def probe_type_a_cascade(source_key, gemeente_code, db) -> ProbeResult:
    count = await db.scalar(
        select(func.count())
        .select_from(PolicyDocument)
        .where(PolicyDocument.entity_type == "gemeente")
        .where(PolicyDocument.entity_code == gemeente_code)
        .where(PolicyDocument.source_key == source_key)
    )
    if count > 0:
        return {"status": "live", "error_message": None}
    return {"status": "missing", "error_message": "No PolicyDocument rows found"}
```

### Count query syntax — both work, pick one convention

Codebase precedent for both forms:
- `func.count()` (no arg) → `backend/app/admin/router.py:91,112,133` (3 occurrences)
- `func.count(PolicyDocument.id)` → `backend/app/policy_documents/service.py:421`
- `select(func.count())` standalone → `backend/app/policy_documents/service.py:169`

**Recommendation:** Use `select(func.count()).select_from(PolicyDocument)` since it's the closest to `app/admin/router.py` style and the test pattern in M045 admin endpoints. Both compile to identical SQL.

### Tenant filter consideration

`PolicyDocument` uses `TenantMixin` (has `organization_id`). But the probe runs in a superuser context where RLS is NOT set (no org_id in `request.state` for vendor routes). **Confirm**: `_gemeente_name_map` in the same file (`service.py:332`) does a query without tenant filter on `AreaScan` (which has no TenantMixin) and works.

For `PolicyDocument` specifically: the probe needs to count documents across all orgs (vendor-uploaded global + per-org). The `is_global` flag exists (`policy_document.py:74-82`) and vendor-uploaded docs have `is_global=True`. Since the new admin router uses `Depends(get_current_superuser)` (NOT the tenant-aware `get_db` flow), RLS won't be set and queries will see all rows.

**Open question for planner:** Should the Type A probe count ONLY `is_global=True` docs (vendor uploads) or ALL rows? The eng-review didn't specify. **Recommendation:** Count `is_global=True` only, since `data_source_status` is vendor-managed and should reflect vendor-provided documentation. Customer-org-private uploads (rare) shouldn't flip a vendor row to "live". Document this in plan.

---

## 5. FastAPI router registration pattern

### Exact main.py pattern to mirror

**Import (`backend/app/main.py:18`):**
```python
from app.admin.router import router as admin_router
```

**Registration (`backend/app/main.py:167`):**
```python
app.include_router(admin_router)
```

The registrations are alphabetically clustered with other admin/agent/etc routers at lines 154-167. Phase 2 should add (alphabetically near `admin_router`):
```python
# Import block (alongside line 18)
from app.admin.data_sources_router import router as admin_data_sources_router

# Registration block (alongside line 167)
app.include_router(admin_data_sources_router)
```

**No middleware additions needed.** `get_current_superuser` injects from existing JWT middleware; CORS/rate-limit/tenant middleware applies globally without changes.

---

## 6. Pydantic v2 schemas conventions in this codebase

### Verified conventions

**HIGH confidence (multiple file precedents):**

1. **Base class:** Plain `BaseModel` from pydantic (no custom Propdex base).
2. **ORM mapping:** `model_config = ConfigDict(from_attributes=True)` — pattern in `app/schemas/project.py:41`, `app/schemas/report.py:80,131,195`, `app/schemas/monitoring.py:24`, `app/policy_documents/schemas.py:12`, `app/models/data_source_status.py:117` (S01).
3. **Field validators:** `@field_validator` decorator with `@classmethod` — pattern in `app/schemas/report.py:50-58`. Example:
   ```python
   @field_validator("report_data")
   @classmethod
   def validate_report_data(cls, v: dict) -> dict:
       ...
   ```
4. **Strict mode:** `model_config = ConfigDict(extra="forbid")` for write payloads — pattern in `app/models/data_source_status.py:103` (S01 `DataSourceStatusCreate`).
5. **Field metadata:** `Field(max_length=..., description=...)` standard.
6. **Imports:** `from pydantic import BaseModel, ConfigDict, Field, field_validator` (project always imports from top-level `pydantic`).

### Recommended file structure for `data_sources_schemas.py`

```python
"""Pydantic v2 schemas for M049/S02 admin data-sources API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DataSourceStatusValue = Literal["live", "broken", "missing", "not_applicable"]  # reuse from S01 model
SourceType = Literal["A", "B", "C"]
ActionType = Literal["upload", "configure_credential", "view_versions", "refresh"]


class Action(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    action: ActionType
    enabled: bool
    label_nl: str
    reason_disabled: str | None = None


class DataSourceRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    source_key: str
    label_nl: str
    source_type: SourceType
    status: DataSourceStatusValue
    last_checked: datetime | None
    error_message: str | None
    configuratie: dict | None
    available_actions: list[Action]


class GemeenteDataSourcesPayload(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    gemeente_code: str = Field(pattern=r"^GM\d{4}$")
    gemeente_naam: str
    cascade_uploads: list[DataSourceRow]
    open_apis: list[DataSourceRow]
    paid_integrations: list[DataSourceRow]


class GemeenteSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    gemeente_code: str
    gemeente_naam: str
    total_sources: int
    status_counts: dict[DataSourceStatusValue, int]
    last_activity_at: datetime | None
```

### Status enum centralisation

**Recommendation (Claude's discretion → recommend):** Reuse `DataSourceStatusValue` from `backend/app/models/data_source_status.py:28` (S01 already exports it). Import in `data_sources_schemas.py` and `data_source_probes.py`. **Do NOT create a new `data_source_enums.py`** — adds files without value; S01 already owns this contract.

### Path param regex

FastAPI supports `Path(..., pattern=r"^GM\d{4}$")` for path-level validation that returns 422 on mismatch (before route body runs). Pattern works in FastAPI 0.100+ with Pydantic v2. Example:
```python
from fastapi import Path

@router.get("/{gemeente_code}")
async def get_gemeente_sources(
    gemeente_code: str = Path(..., pattern=r"^GM\d{4}$"),
    ...
):
    ...
```

**Note:** 422 (validation error) is the FastAPI default for path-pattern mismatch. CONTEXT §2 says "unknown code → 404". These are different paths: malformed code (e.g. `XX9999`) → 422, valid format but no rows → 404. Plan should clarify both cases in error handling.

---

## 7. Concurrent test pattern

### No existing precedent

**MEDIUM confidence (negative claim, grep-based):** `grep -rn "asyncio.gather.*get\|asyncio.gather.*post" backend/tests --include="*.py"` returns zero matches. Propdex has no existing test that fires two concurrent httpx requests at the same endpoint within one test.

### Proposed test structure for advisory-lock contention

```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_refresh_concurrent_calls_one_wins_lock(
    async_client: AsyncClient,
    test_db: AsyncSession,
    create_test_user,
):
    user, org = await create_test_user(is_superuser=True, email="su@test")
    from app.auth.jwt import create_access_token
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id), str(org.id))}"}

    # Seed: DataSourceStatus row exists already so probe target is deterministic.
    # (Optionally: seed PolicyDocument so Type A probe returns 'live'.)
    ...

    # Fire 2 concurrent refresh calls
    results = await asyncio.gather(
        async_client.post(
            "/api/admin/data-sources/GM0983/woonvisie/refresh",
            headers=headers,
        ),
        async_client.post(
            "/api/admin/data-sources/GM0983/woonvisie/refresh",
            headers=headers,
        ),
        return_exceptions=False,
    )

    # Both should succeed with 200; both return DataSourceRow shape.
    assert all(r.status_code == 200 for r in results), [r.text for r in results]

    # Exactly one row in DB; both responses report identical state.
    bodies = [r.json() for r in results]
    assert bodies[0]["status"] == bodies[1]["status"]
    assert bodies[0]["last_checked"] == bodies[1]["last_checked"]
```

### Concurrency caveat with single `async_client`

**Important (LOW confidence — needs validation during implementation):** `httpx.AsyncClient` with `ASGITransport` shares the same FastAPI app instance, and each request gets its own `get_db` invocation → separate AsyncSessions → separate DB connections → separate transactions. **This is what we want** for advisory-lock testing: two transactions racing on the same lock key.

**Potential failure mode:** If the test infrastructure serializes ASGI calls (older `httpx`/`starlette` versions did), the test will be a no-op (always succeed sequentially). Verify by adding a `time.sleep(0.1)` inside the probe function during test (via monkeypatch) and checking that both requests complete within ~0.1s (overlap proves concurrency) vs ~0.2s (sequential).

**Backup test pattern (if `async_client` doesn't parallelize):** Use raw `asyncpg` connections in the test to grab the same advisory lock manually, then fire one HTTP refresh and assert the response is "current state, no probe run" (the lock-not-acquired branch).

### Validation seed
```python
# Pre-test: row missing → probe must flip to live
test_db.add(DataSourceStatus(
    gemeente_code="GM0983", source_key="woonvisie", status="missing"
))
# Plus a PolicyDocument to make Type A probe return 'live':
test_db.add(PolicyDocument(
    entity_type="gemeente", entity_code="GM0983", source_key="woonvisie",
    is_global=True, organization_id=org.id,  # vendor-org via S01 RBAC test pattern
    filename="seed.pdf", content_type="application/pdf", file_data=b"x",
    file_size=1, uploaded_by_user_id=user.id, version_number=1,
))
await test_db.commit()
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gemeente_code → naam | Hardcoded dict | `_gemeente_name_map(db)` from `app/policy_documents/service.py:332` | Existing impl is correct, sourced from `area_scans` (auto-updates), single DISTINCT query |
| Superuser RBAC | Custom dependency | `get_current_superuser` from `app/auth/dependencies.py:103` | Already enforces JWT → User → `is_superuser` check; reused in 8+ admin endpoints |
| JWT in tests | HTTP login flow | `create_access_token(user_id, org_id)` from `app/auth/jwt` | Direct token creation skips auth router; matches all existing integration tests |
| Test DB isolation | Per-test BEGIN/ROLLBACK | `test_db` fixture from conftest (drops tables) | Project's `db.commit()` pattern breaks transaction rollback |
| Concurrent locking | Python `threading.Lock` / Redis SETNX | `pg_try_advisory_xact_lock` | Auto-released on transaction end, no Redis dependency, atomic |
| Catalog drift detection | Manual iterate-and-check | `get_entry(source_key)` from `app/policy_documents/data_source_keys.py:383` | Returns `None` for missing keys — direct fit for 404 branch |
| Status enum repeats | New `enums.py` module | Reuse `DataSourceStatusValue` from `app/models/data_source_status.py:28` | Single source of truth, S01 already exported it |

---

## Common Pitfalls

### Pitfall 1: PolicyDocument field name mismatch
**What goes wrong:** CONTEXT pseudocode shows `PolicyDocument.gemeente_code` — that column doesn't exist.
**Why it happens:** S01 catalog uses `gemeente_code`/`source_key`; M045 PolicyDocument was built earlier with `entity_type`/`entity_code` to support landelijk/provincie/gemeente cascade.
**How to avoid:** Always filter Type A probe with `(entity_type == "gemeente") AND (entity_code == gemeente_code)`. See §4.
**Warning signs:** Tests pass on empty DB but fail on M045-style seeded data (rows exist but probe returns missing).

### Pitfall 2: BigInteger type coercion for advisory lock
**What goes wrong:** asyncpg sees Python int, infers int4, overflows for hash values >2^31.
**Why it happens:** Default SQLAlchemy ↔ asyncpg type mapping uses int4 for unbounded Python ints.
**How to avoid:** Always wrap key with `type_coerce(key, BigInteger())` or `bindparam("k", type_=BigInteger())`. The `& 0x7FFFFFFFFFFFFFFF` mask only ensures the value fits int8 — doesn't fix the SQL-level type inference.
**Warning signs:** `InvalidIntegerOverflow` or `function pg_try_advisory_xact_lock(integer) does not exist` errors.

### Pitfall 3: Path param 422 vs 404 confusion
**What goes wrong:** CONTEXT says "unknown code → 404", but FastAPI Path-level regex returns 422 for malformed codes.
**Why it happens:** Two different failure modes — malformed format vs valid format with no DB rows.
**How to avoid:** Use `Path(pattern=r"^GM\d{4}$")` for format validation (returns 422 automatically). Then inside the handler, if the gemeente_code has NO rows in `data_source_status` AND NO entry in `_gemeente_name_map`, raise `HTTPException(404, "Gemeente not found")`. Test BOTH cases.

### Pitfall 4: Test DB schema bug between tests
**What goes wrong:** Without `statement_cache_size=0`, asyncpg's prepared-statement cache clashes with table drop/recreate, causing `UniqueViolation` on `pg_type`.
**Why it happens:** Python 3.14 + asyncpg 0.27 + SQLAlchemy 2.x caches prepared statements at the connection level; recreating tables invalidates types but cache doesn't know.
**How to avoid:** Already fixed by `conftest.py:102-107`. Phase 2 tests inherit transparently — DO NOT use a different engine fixture.
**Warning signs:** Tests pass individually, fail when run in a suite.

### Pitfall 5: Tenant context blocks superuser refresh path
**What goes wrong:** If the route is `@require_superuser` but uses `Depends(get_db)`, the tenant middleware extracts org_id from JWT and sets `SET LOCAL app.current_tenant_id = ...`. RLS policies on `policy_documents` then filter out vendor-global rows owned by a different org.
**Why it happens:** Propdex's `get_db` always sets RLS context if `request.state.organization_id` is set, even for superuser routes.
**How to avoid:** Either (a) bypass RLS with a dedicated `get_db_no_rls` dependency for vendor routes, or (b) accept that vendor superusers must be members of the vendor org. The S01 RBAC test uses option (b) — `create_test_user` puts the superuser in a fresh org. **For Phase 2, verify which org has the PolicyDocument seed; use the same org for the superuser**, then RLS works correctly.
**Warning signs:** Probe returns "missing" even when PolicyDocument rows exist for that gemeente+source_key.

### Pitfall 6: Hash() non-determinism across processes
**What goes wrong:** Python's `hash(str)` is randomized per process (PYTHONHASHSEED). Different worker processes will pick different LOCK_KEY values for the same (gemeente, source_key) → no contention protection across workers.
**Why it happens:** Python intentionally randomizes string hashes against DoS.
**How to avoid:** Use a stable hash. Recommended:
```python
import hashlib

def _lock_key(gemeente_code: str, source_key: str) -> int:
    raw = f"{gemeente_code}:{source_key}".encode()
    digest = hashlib.blake2b(raw, digest_size=8).digest()
    return int.from_bytes(digest, "big", signed=False) & 0x7FFFFFFFFFFFFFFF
```
**Warning signs:** Test passes locally, prod has occasional dual-probe writes.

---

## Code Examples

### Reusable gemeente_naam resolver (extract from policy_documents.service)
```python
# Suggested new: backend/app/services/gemeente_name_lookup.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.area_scan import AreaScan


async def get_gemeente_name_map(db: AsyncSession) -> dict[str, str]:
    """{gemeente_code: gemeente_naam} sourced from area_scans.

    Falls back to raw code in caller for gemeentes never scanned.
    Source: extracted from app/policy_documents/service.py:332 (M045/S05).
    """
    stmt = (
        select(AreaScan.gemeente_code, AreaScan.gemeente_naam)
        .distinct()
        .where(AreaScan.gemeente_code.is_not(None))
    )
    rows = (await db.execute(stmt)).all()
    return {row.gemeente_code: row.gemeente_naam for row in rows}
```

### Router skeleton mirroring existing admin/router.py
```python
# backend/app/admin/data_sources_router.py
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.data_source_probes import PROBE_REGISTRY
from app.admin.data_sources_schemas import (
    DataSourceRow,
    GemeenteDataSourcesPayload,
    GemeenteSummary,
)
from app.auth.dependencies import get_current_superuser
from app.core.database import get_db
from app.models.user import User
from app.policy_documents.data_source_keys import DATA_SOURCE_KEYS, get_entry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/data-sources", tags=["Admin / Data Sources"])

GemeenteCodePath = Annotated[str, Path(pattern=r"^GM\d{4}$")]


@router.get("/gemeenten", response_model=list[GemeenteSummary])
async def list_gemeenten(
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> list[GemeenteSummary]:
    ...


@router.get("/{gemeente_code}", response_model=GemeenteDataSourcesPayload)
async def get_gemeente_sources(
    gemeente_code: GemeenteCodePath,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> GemeenteDataSourcesPayload:
    ...


@router.post(
    "/{gemeente_code}/{source_key}/refresh", response_model=DataSourceRow,
)
async def refresh_source(
    gemeente_code: GemeenteCodePath,
    source_key: str,
    _: User = Depends(get_current_superuser),
    db: AsyncSession = Depends(get_db),
) -> DataSourceRow:
    entry = get_entry(source_key)
    if entry is None:
        raise HTTPException(404, detail="Source key not in catalog")
    ...
```

### Advisory lock (verified pattern)
```python
from sqlalchemy import BigInteger, func, select, type_coerce

LOCK_KEY = _lock_key(gemeente_code, source_key)  # stable hash, see Pitfall 6

acquired: bool = await db.scalar(
    select(func.pg_try_advisory_xact_lock(type_coerce(LOCK_KEY, BigInteger())))
)
```

### Type A probe (corrected per §4)
```python
from sqlalchemy import func, select

from app.models.policy_document import PolicyDocument


async def probe_type_a_cascade(
    source_key: str, gemeente_code: str, db: AsyncSession,
) -> ProbeResult:
    count = await db.scalar(
        select(func.count())
        .select_from(PolicyDocument)
        .where(PolicyDocument.entity_type == "gemeente")
        .where(PolicyDocument.entity_code == gemeente_code)
        .where(PolicyDocument.source_key == source_key)
        .where(PolicyDocument.is_global.is_(True))  # vendor uploads only
    )
    if count and count > 0:
        return {"status": "live", "error_message": None}
    return {"status": "missing", "error_message": "No PolicyDocument rows found"}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pydantic v1 `Config` inner class | `model_config = ConfigDict(...)` | Pydantic 2.0 (2023) | Already adopted throughout Propdex; no migration needed |
| `@validator` | `@field_validator` + `@classmethod` | Pydantic 2.0 | Codebase uses new form (`report.py:50`) |
| `from sqlalchemy.orm import Query` | `select()` + `db.execute()` | SQLAlchemy 2.0 | Codebase fully on 2.x async pattern |
| `passlib + bcrypt` | `pwdlib + Argon2id` | Pre-Propdex | Per CLAUDE.md memory |
| `python-jose` for JWT | `PyJWT` | Pre-Propdex | Per CLAUDE.md memory |
| `datetime.now(timezone.utc)` | `datetime.utcnow()` (naive UTC) | Project convention | Required for TIMESTAMP WITHOUT TIME ZONE columns |

**No deprecated patterns relevant to this phase.**

---

## Open Questions

1. **Should Type A probe count ALL PolicyDocument rows or only `is_global=True`?**
   - What we know: `data_source_status` is vendor-managed; probe should reflect vendor coverage.
   - What's unclear: CONTEXT didn't specify. M045/S05 cascade query DOES filter by is_global for landelijk/provincie levels.
   - Recommendation: Filter `is_global=True` to match vendor-managed semantics. Plan should document this decision.

2. **Where does superuser org_id come from for RLS-on-PolicyDocument queries?**
   - What we know: `get_db` sets `SET LOCAL app.current_tenant_id` from JWT org_id.
   - What's unclear: PolicyDocument has RLS on `organization_id`; vendor uploads have a specific org. If superuser's JWT carries a different org_id, RLS blocks the probe count.
   - Recommendation: For Phase 2 tests, put the superuser in the vendor org (the org that uploaded the seed PolicyDocument). For production, the `VENDOR_ORG_ID` setting (`test_m045_admin_overview_endpoint.py:149`) identifies the vendor org. Plan should ensure tests use this same org alignment.

3. **Should the planner extract `_gemeente_name_map` to a shared module?**
   - What we know: Function is private (`_` prefix) in `policy_documents/service.py`.
   - What's unclear: Cross-module reach-through is a code smell, but extracting requires a refactor.
   - Recommendation: Phase 2 plan should include a small refactor task: move helper to `backend/app/services/gemeente_name_lookup.py` (no name change beyond removing `_` prefix), re-import in policy_documents.service.py. Net change: +1 file, -1 private function. Zero behavior change.

4. **Concurrent test reliability — does `httpx.AsyncClient` with `ASGITransport` actually parallelize?**
   - What we know: No precedent in codebase.
   - What's unclear: Some httpx/starlette versions serialize ASGI in-process calls.
   - Recommendation: Plan should include a 5-min spike during implementation to verify; if serialization confirmed, fall back to raw asyncpg lock-acquire-in-fixture (see §7 backup pattern).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio + httpx 0.27 (AsyncClient + ASGITransport) |
| Config file | `backend/pyproject.toml` (pytest section) + `backend/tests/conftest.py` |
| Quick run command | `cd backend && pytest tests/integration/test_admin_data_sources_router.py -x` |
| Full suite command | `cd backend && pytest tests/ -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | GET `{code}` returns 3-section payload, all catalog entries render, missing rows default to status="missing" | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_get_gemeente_sources_200_full_catalog -x` | Wave 0 — NEW FILE |
| API-01 | GET `{code}` reflects DB status mix (live/broken/missing/not_applicable) | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_get_gemeente_sources_200_status_mix -x` | Wave 0 |
| API-01 | GET `{code}` 404 for unknown gemeente (`GM9999`) | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_get_gemeente_sources_404_unknown_code -x` | Wave 0 |
| API-01 | GET `{code}` 422 for malformed code (`XX1234`) | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_get_gemeente_sources_422_malformed_code -x` | Wave 0 |
| API-02 | GET `/gemeenten` returns aggregate counts sorted by activity DESC | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_list_gemeenten_200_aggregate_counts -x` | Wave 0 |
| API-03 | POST refresh flips `missing→live` after PolicyDocument seed | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_refresh_200_status_flips_to_live -x` | Wave 0 |
| API-03 | POST refresh idempotent (2× call, no extra UPDATE writes) | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_refresh_idempotent_no_op_on_unchanged -x` | Wave 0 |
| API-03 | POST refresh concurrent calls — one wins lock, both return current state | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_refresh_concurrent_calls_one_wins_lock -x` | Wave 0 |
| API-03 | POST refresh 404 for unknown source_key | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_refresh_404_unknown_source_key -x` | Wave 0 |
| API-03 | POST refresh Type B/C stubs return not_applicable/missing without external calls | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_refresh_type_b_stub_returns_not_applicable -x` and `::test_refresh_type_c_stub_returns_missing` | Wave 0 |
| API-05 | 403 for regular user on all 4 endpoints | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_all_endpoints_403_for_regular_user -x` | Wave 0 |
| API-05 | 401 for missing token | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_all_endpoints_401_without_token -x` | Wave 0 |
| TEST-02 | Catalog-drift: orphaned data_source_status row skipped from GET; POST returns 404 | integration | `pytest tests/integration/test_admin_data_sources_router.py::test_catalog_drift_orphan_row -x` | Wave 0 |
| Perf | GET `{code}` <300ms with 50 catalog entries + 50 DB rows | integration (perf-marked) | `pytest tests/integration/test_admin_data_sources_router.py::test_get_gemeente_sources_under_300ms -x` | Wave 0 — inline `time.perf_counter()` (no `pytest -m perf` infrastructure yet) |

### Sampling Rate
- **Per task commit:** `pytest tests/integration/test_admin_data_sources_router.py -x` (≈10s on a clean test DB)
- **Per wave merge:** `pytest tests/ -x` (full backend suite — ~275 existing + new)
- **Phase gate:** Full suite green + manual `time.perf_counter()` confirms <300ms on a populated test DB before `/gsd:verify-work`

### Detection Thresholds
- **Regression:** Any test marked `tests/integration/test_admin_data_sources_router.py` failing — block merge.
- **Perf:** GET `{code}` >300ms with the standard seed → block merge; investigate query plan.
- **Coverage:** All 13 test cases in §8 CONTEXT must be present (counted via `pytest --collect-only`).

### Reconstruction Fidelity
The test suite reconstructs the full API contract:
- Auth/RBAC (403/401)
- Path validation (422 + 404)
- Payload composition (full catalog rendered + status mix)
- Probe registry dispatch (A/B/C all exercised)
- Idempotency (lock + compare-and-update)
- Concurrency (advisory lock contention)
- Catalog drift (DB-row not in catalog)
- Performance bound (300ms)

**Missing from automation (acceptable for Phase 2):**
- Load-test under hundreds of concurrent refreshes (deferred — advisory lock theoretically scales, but not measured here).
- Real Type B / Type C live probes — stubs only by design.

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_admin_data_sources_router.py` — NEW FILE, covers API-01/02/03/05 + TEST-02. Should be created in Wave 0 with all tests RED (importing `app.admin.data_sources_router` which doesn't exist yet).
- [ ] `backend/app/services/gemeente_name_lookup.py` — NEW FILE, extract `_gemeente_name_map` from `policy_documents/service.py:332` (rename to drop underscore). Wave 0 stub: empty module raising NotImplementedError, gets implemented Wave 2.
- [ ] No framework install needed — pytest, httpx, pytest-asyncio already configured.
- [ ] Optionally: keep `backend/tests/integration/test_admin_data_sources_rbac.py` (S01 RBAC scaffold) as the lightest possible smoke test, OR delete once `test_admin_data_sources_router.py::test_all_endpoints_403_for_regular_user` is green (same assertion, real router).

---

## Sources

### Primary (HIGH confidence)
- `backend/app/policy_documents/service.py:332-350` — `_gemeente_name_map` canonical resolver
- `backend/app/admin/router.py:21-29` — existing admin router pattern + `get_current_superuser` reuse
- `backend/app/auth/dependencies.py:103-123` — superuser dependency
- `backend/app/main.py:18,167` — router registration pattern
- `backend/tests/conftest.py:102-244` — test fixtures (test_engine, test_db, async_client, create_test_user, auth_headers)
- `backend/tests/integration/test_admin_data_sources_rbac.py` — S01 Wave-0 RBAC scaffold
- `backend/tests/integration/test_m045_admin_overview_endpoint.py:90-238` — admin auth test patterns + AreaScan-driven gemeente_naam seeding
- `backend/app/models/policy_document.py:28-42` — entity_type/entity_code field names (NOT gemeente_code)
- `backend/app/models/data_source_status.py:28,103,117` — S01 status Literal + Pydantic config conventions
- `backend/app/policy_documents/data_source_keys.py:376-393` — DATA_SOURCE_KEYS + get_entry
- `backend/app/policy_documents/auto_ingest.py:53-59` — hardcoded gemeente fallback list
- `backend/app/policy_documents/schemas.py` — Pydantic v2 conventions (BaseModel + ConfigDict)
- `backend/app/schemas/project.py:41`, `backend/app/schemas/report.py:50-58` — field_validator + ConfigDict patterns
- `backend/app/core/database.py:55` — asyncpg parameterization caveat (SET LOCAL only)

### Secondary (MEDIUM confidence — verified with official source)
- [SQLAlchemy 2.x asyncpg BigInteger type coercion for advisory lock](https://github.com/sqlalchemy/sqlalchemy/discussions/7814) — recommended `type_coerce(key, BigInteger())` pattern
- [asyncpg advisory lock usage](https://github.com/MagicStack/asyncpg/issues/972) — confirms basic function call works through normal SQL parameter binding (not `SET LOCAL` constrained)
- [Postgres advisory locks reference](https://leontrolski.github.io/postgres-advisory-locks.html) — pg_try_advisory_xact_lock 8-byte signed int limit
- [Practical advisory lock guide](https://medium.com/inspiredbrilliance/a-practical-guide-to-using-advisory-locks-in-your-application-7f0e7908d7e9) — xact_lock auto-releases on commit/rollback

### Tertiary (LOW confidence — flagged for validation)
- Concurrent `httpx.AsyncClient + ASGITransport` parallelism — no codebase precedent; relies on starlette behavior. Plan should include a 5-min spike to validate during Wave 0.

---

## Metadata

**Confidence breakdown:**
- Standard stack (FastAPI + SQLAlchemy 2.x + Pydantic v2): HIGH — fully aligned with existing codebase; S01 already shipped using these versions.
- Architecture (router structure, schemas, probes): HIGH — every pattern has a direct codebase precedent.
- Gemeente naam resolution: HIGH — direct copy of `_gemeente_name_map`.
- Advisory lock + asyncpg: MEDIUM-HIGH — verified through two GitHub sources; no in-codebase precedent so first use needs a smoke test.
- Concurrent test (asyncio.gather of httpx requests): LOW — no codebase precedent. Backup plan documented (raw asyncpg lock-acquire from fixture).
- PolicyDocument field mismatch: HIGH — verified directly from model file. CONTEXT pseudocode IS WRONG on this point.
- Pitfalls (RLS, hash randomness, 422 vs 404): HIGH — each tied to a concrete code reference.

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (30 days — stable Python ecosystem; SQLAlchemy/asyncpg releases unlikely to invalidate)
