---
phase: 02-brk-fetch-persist-endpoint
plan: 01
subsystem: backend-services
tags: [m050, s02, brk, credential-resolver, quota-stub, client-factory, alembic, multi-tenant-exception, d1, d6, d7, d8, d11, d14, d15]

# Dependency graph
requires:
  - phase: m049/s05
    provides: integration_credentials table + credential_crypto (Fernet/MultiFernet decrypt) + IntegrationCredential model (no organization_id; vendor-managed)
  - phase: m050/s01
    provides: brk_ownership_records table + alembic head 20260518_m050_s01 + BrkOwnershipRecord model + brk_persistence_service shape (logger/exception patterns)
provides:
  - credential_resolver.get_brk_credentials() + BrkCredentials NamedTuple + CredentialNotConfigured exception (D1 + D6)
  - 60s in-process credential cache + _clear_cache_for_tests() test helper
  - quota_service.record_brk_lookup() async no-op stub (D8)
  - build_brk_client(creds) per-request BRK client factory (D6)
  - BRKBevragenClient class docstring with explicit ephemeral-vs-persist channel separation (D11)
  - Alembic head 20260519_m050_s02 + partial composite index idx_brk_latest (D15)
affects: [02-02 brk_fetch_service + persist endpoint, 02-03 tests, m050/s03 scoring factors that read persisted rows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vendor-managed credential resolver (D1) — sole documented exception to CLAUDE.md multi-tenant filter rule, locked by M049 eng-review 2026-05-14/16"
    - "60s in-process credential cache via module-level dict[str, tuple[BrkCredentials, datetime]] (D6); _clear_cache_for_tests() helper for test isolation"
    - "Per-request client factory + module-singleton shim pattern (D6) — factory accepts creds arg now for callsite contract; api_key becomes load-bearing when env-key removed (deferred hardening)"
    - "Channel-separation docstring on a shared client class (D11) — documents both ephemeral (Phase 105 MUST NOT persist) and persist (M050/S02 MAY persist with FF+DPA) consumers in one place"
    - "Partial composite index for ordered cache lookups: (org_id, parcel_id, fetched_at DESC) WHERE soft_deleted_at IS NULL (D15) — supports ORDER BY fetched_at DESC LIMIT 1 with index-only scan"
    - "TYPE_CHECKING forward-ref pattern for cross-service typing (BrkCredentials in brk_bevragen.py) — avoids circular import while keeping runtime decoupled"

key-files:
  created:
    - backend/app/services/credential_resolver.py
    - backend/app/services/quota_service.py
    - backend/alembic/versions/20260519_m050_s02_brk_latest_index.py
  modified:
    - backend/app/government_apis/brk_bevragen.py

key-decisions:
  - "D1 vendor-managed lookup: get_brk_credentials() reads ONE row WHERE source_key='brk' AND credential_name='api_key' with NO organization_id filter — IntegrationCredential has no organization_id column by design; multi-tenant safety lives at persistence layer (S01 BrkOwnershipRecord), NOT credential layer"
  - "D6 60s cache: module-level dict + datetime.utcnow() (per CLAUDE.md); cache-hit skips DB entirely; rotation visible on next call past TTL — no restart required"
  - "D7 cert/key on disk: resolver returns api_key only; BRK_CLIENT_CERT_PATH / BRK_CLIENT_KEY_PATH / BRK_CA_BUNDLE_PATH stay env-driven; CREDENTIAL_FIELDS['brk'].client_cert documented as deferred to InfoSec hardening"
  - "D8 quota stub: async def record_brk_lookup(org_id, parcel_id) -> None with debug log + return None; full counter lands in M050.5/S02; callers wrap in try/except (non-blocking)"
  - "D11 docstring rewrite: explicit Ephemeral channel (Phase 105 fetch_brk_ownership — MUST NOT persist) + Persist channel (M050/S02 brk_fetch_service.fetch_and_persist — MAY persist rechtspersoon/overheid when FF=True + DPA signed); gating lives in brk_persistence_service.persist_record, NOT the client"
  - "D14 IRON RULE: get_eigendom signature ['self', 'identificatie', 'client'] unchanged; verified via inspect.signature in plan-end check; Phase 105 caller property_aggregator.py untouched (git diff main..HEAD = 0 lines)"
  - "D15 partial composite index: idx_brk_latest ON brk_ownership_records (organization_id, parcel_id, fetched_at DESC) WHERE soft_deleted_at IS NULL — partial keeps it tiny, DESC ordering enables index-only scan for 30-day cache hot path"
  - "build_brk_client(creds) accepts BrkCredentials now but discards it (_ = creds) — locks callsite shape; api_key becomes load-bearing when settings.BRK_API_KEY is removed in future hardening pass (deferred per ENG-PLAN §NOT in scope)"
  - "decrypt() returns bytes (cryptography.fernet contract); resolver decodes to str via isinstance guard so BrkCredentials.api_key is always plaintext str — guards against future decrypt-signature drift"

patterns-established:
  - "M050/S02 commit prefix: 'M050/S02: <what>' (per CLAUDE.md hard rule 1)"
  - "Module-level _CACHE dict with explicit _clear_cache_for_tests() helper — pattern reusable for future per-source resolvers (vindsubsidies, nvm)"
  - "TYPE_CHECKING forward-ref for service ↔ government_apis boundary — avoids circular import at runtime"

requirements-completed: [BRK-04]

# Metrics
duration: 2m 37s
completed: 2026-05-18
---

# Phase 02 Plan 01: BRK Persist Foundation Summary

**Foundation infrastructure for M050/S02 BRK persist write-path shipped — vendor-managed credential resolver + 60s cache, no-op quota stub, per-request client factory, channel-separation docstring on BRKBevragenClient, and partial composite cache index. All four artifacts atomic, independent, parallel-able within Wave 1.**

## Performance

- **Duration:** 2m 37s
- **Started:** 2026-05-18T16:43:48Z
- **Completed:** 2026-05-18T16:46:25Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `credential_resolver.get_brk_credentials()` resolves the BRK api_key from `integration_credentials` (one row platform-wide WHERE `source_key='brk' AND credential_name='api_key'` — D1 vendor-managed, NO `organization_id` filter)
- 60s in-process cache (D6) — cache-hit path skips the DB; `_clear_cache_for_tests()` helper exposed for unit-test isolation
- `BrkCredentials` NamedTuple + `CredentialNotConfigured` exception exported (Plan 02-02 imports both); maps to HTTP 503 at router layer (D12)
- `quota_service.record_brk_lookup(org_id, parcel_id)` async no-op stub (D8) — debug-logs + returns None; full counter deferred to M050.5/S02
- `build_brk_client(creds)` per-request factory exported from `brk_bevragen.py` (D6); module-singleton `brk_client = BRKBevragenClient()` preserved as backward-compat shim
- `BRKBevragenClient` class docstring rewritten (D11) — explicit Ephemeral channel (Phase 105 `fetch_brk_ownership` MUST NOT persist) + Persist channel (M050/S02 `brk_fetch_service.fetch_and_persist` MAY persist `rechtspersoon`/`overheid` when `M050_BRK_PERSIST_ENABLED=True` + DPA signed); D14 IRON RULE note embedded
- Alembic migration `20260519_m050_s02_brk_latest_index.py` creates partial composite index backing the 30-day cache hot path (D15)
- Migration is idempotent — upgrade → downgrade → upgrade verified clean
- Alembic head bumped: `20260518_m050_s01` → `20260519_m050_s02`
- D14 IRON RULE preserved: `get_eigendom` signature unchanged (`(self, identificatie, client)`), Phase 105 caller `property_aggregator.py` untouched (git diff main..HEAD = 0 lines)

## Task Commits

1. **Task 1: Credential resolver + quota stub** — `14beadb5` (feat)
2. **Task 2: BRK client factory + D11 docstring** — `9cd5993e` (feat)
3. **Task 3: Alembic migration — partial composite cache index** — `7cef0cff` (feat)

## Files Created/Modified

- `backend/app/services/credential_resolver.py` (NEW, 117 LOC) — vendor-managed BRK api_key resolver + 60s cache + BrkCredentials NamedTuple + CredentialNotConfigured + `_clear_cache_for_tests()` helper
- `backend/app/services/quota_service.py` (NEW, 40 LOC) — `record_brk_lookup(org_id, parcel_id) -> None` async no-op stub
- `backend/app/government_apis/brk_bevragen.py` (MOD, 324 LOC) — added `build_brk_client(creds)` factory + TYPE_CHECKING import + rewrote BRKBevragenClient class docstring (D11 channel-separation + D14 iron-rule note); `get_eigendom` body + signature unchanged; module singleton preserved
- `backend/alembic/versions/20260519_m050_s02_brk_latest_index.py` (NEW, 43 LOC) — partial composite index `idx_brk_latest ON brk_ownership_records (organization_id, parcel_id, fetched_at DESC) WHERE soft_deleted_at IS NULL`

## Public surface (Plan 02-02 imports)

### `app.services.credential_resolver`

```python
CRED_CACHE_TTL_SECONDS: int = 60
BRK_SOURCE_KEY: str = "brk"
BRK_CREDENTIAL_NAME: str = "api_key"

class BrkCredentials(NamedTuple):
    api_key: str

class CredentialNotConfigured(Exception): ...

async def get_brk_credentials(db: AsyncSession) -> BrkCredentials: ...
def _clear_cache_for_tests() -> None: ...
```

### `app.services.quota_service`

```python
async def record_brk_lookup(
    organization_id: uuid.UUID,
    parcel_id: str,
) -> None: ...
```

### `app.government_apis.brk_bevragen`

```python
def build_brk_client(creds: "BrkCredentials") -> "BRKBevragenClient": ...
# Returns a fresh BRKBevragenClient. creds.api_key accepted but unused — settings.BRK_API_KEY
# still drives X-Api-Key header (deferred env-key removal). mTLS cert/key from disk via env (D7).
```

## D14 Iron-Rule Confirmation

```python
>>> import inspect
>>> from app.government_apis.brk_bevragen import BRKBevragenClient
>>> list(inspect.signature(BRKBevragenClient.get_eigendom).parameters)
['self', 'identificatie', 'client']
```

`git diff main..HEAD -- backend/app/services/property_aggregator.py | wc -l` → `0`
`grep -c "fetch_brk_ownership" backend/app/services/property_aggregator.py` → `3` (Phase 105 path intact)

## D15 Index Confirmation (psql `\d brk_ownership_records`)

```
"idx_brk_latest" btree (organization_id, parcel_id, fetched_at DESC) WHERE soft_deleted_at IS NULL
```

```
SELECT version_num FROM alembic_version;
   version_num
-------------------
 20260519_m050_s02
```

## Channel-Separation Docstring Summary (D11)

The new BRKBevragenClient class docstring documents both consumers explicitly:

1. **Ephemeral channel** — Phase 105 BRK Eigendom Modal via `property_aggregator.fetch_brk_ownership`. Response returned for immediate display ONLY. MUST NOT persist. `BRKOwnership.never_cache=True` is the defense-in-depth marker. AVG Tier-3 never-store applies in full.
2. **Persist channel** — M050/S02 BRK Fetch + Persist Endpoint via `brk_fetch_service.fetch_and_persist`. Response MAY be persisted to `brk_ownership_records` ONLY when (a) `M050_BRK_PERSIST_ENABLED=True` (D4 runtime gate), (b) Kadaster DPA signed, (c) `eigenaar_type IN ('rechtspersoon', 'overheid')` only (DB CHECK + service strip enforce AVG defense-in-depth — D1/D2/D8). Gating lives in `brk_persistence_service.persist_record`, NOT the client.

Embedded D14 note: `get_eigendom` signature is REGRESSION-CRITICAL; the `BRKOwnershipRecordRead` shape is reserved for the persist channel only (Phase 105 keeps `BRKOwnership`).

## Decisions Made

- **D1 vendor-managed: NO `organization_id` filter on credential lookup** — `IntegrationCredential` has no `organization_id` column by design (eng-review locks 2026-05-14 + 2026-05-16). Multi-tenant safety lives at the PERSISTENCE layer (`BrkOwnershipRecord` filtered by `organization_id` in S01). This is the SOLE documented exception to the CLAUDE.md "every query filters by `organization_id`" rule and is annotated at the top of `credential_resolver.py` for future maintainers.
- **decrypt() return-type guard**: `cryptography.fernet.MultiFernet.decrypt()` returns `bytes`; `BrkCredentials.api_key` must be `str`. Resolver does `plaintext = plaintext_bytes.decode() if isinstance(plaintext_bytes, bytes) else plaintext_bytes`. Costs one isinstance check; protects against future decrypt-signature drift in `credential_crypto.py`.
- **TYPE_CHECKING forward-ref in brk_bevragen.py** for `BrkCredentials` — keeps the runtime import direction `credential_resolver → integration_credential` clean (resolver imports the model) and the typing import direction `brk_bevragen ← credential_resolver` (factory references the resolver type only at type-check time). Avoids circular import.
- **`build_brk_client(creds)` discards creds today** (`_ = creds  # noqa: F841`) — factory contract locked for the future env-key removal hardening pass. When `settings.BRK_API_KEY` is removed (deferred per ENG-PLAN §NOT in scope), `creds.api_key` will be wired into the X-Api-Key header inside `BRKBevragenClient.__init__` without changing any callsite.
- **No new module-level singleton refactor** — kept the existing `brk_client = BRKBevragenClient()` line intact. Plan 02-02 callers use `build_brk_client(creds)` directly via `brk_fetch_service`; the singleton remains for legacy Phase 105 callers (`property_aggregator.fetch_brk_ownership`).

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks landed in plan order; no auto-fixes triggered; D14 iron rule preserved.

## Issues Encountered

None.

## Self-Check

- File `backend/app/services/credential_resolver.py` — FOUND
- File `backend/app/services/quota_service.py` — FOUND
- File `backend/app/government_apis/brk_bevragen.py` — MODIFIED (build_brk_client + D11 docstring + TYPE_CHECKING)
- File `backend/alembic/versions/20260519_m050_s02_brk_latest_index.py` — FOUND
- Commit `14beadb5` in git log — FOUND
- Commit `9cd5993e` in git log — FOUND
- Commit `7cef0cff` in git log — FOUND
- `ruff check` on all 4 files — PASSED (zero issues)
- `python -c "from app.services.credential_resolver import get_brk_credentials, BrkCredentials, CredentialNotConfigured, CRED_CACHE_TTL_SECONDS, BRK_SOURCE_KEY, BRK_CREDENTIAL_NAME, _clear_cache_for_tests"` — PASSED
- `python -c "from app.services.quota_service import record_brk_lookup"` — PASSED
- `python -c "from app.government_apis.brk_bevragen import build_brk_client, BRKBevragenClient, brk_client"` — PASSED
- D14 signature check `inspect.signature(BRKBevragenClient.get_eigendom)` returns `['self', 'identificatie', 'client']` — PASSED
- D1 grep `grep -n "IntegrationCredential.organization_id" credential_resolver.py` returns 0 matches — PASSED
- Phase 105 caller untouched: `git diff main..HEAD -- backend/app/services/property_aggregator.py | wc -l` = 0 — PASSED
- `fetch_brk_ownership` still in Phase 105 path (3 mentions) — PASSED
- Alembic upgrade → downgrade → upgrade idempotent — PASSED
- psql `\d brk_ownership_records` shows `idx_brk_latest btree (organization_id, parcel_id, fetched_at DESC) WHERE soft_deleted_at IS NULL` — PASSED
- psql `SELECT version_num FROM alembic_version` returns `20260519_m050_s02` — PASSED
- File LOC limits: resolver 117 ≤ 120, quota 40 ≤ 60, brk_bevragen 324 ≤ 360, migration 43 — ALL PASSED
- mypy net-new errors on new files: 0 (all 25 pre-existing errors live in `app/models/`)

## Self-Check: PASSED

## Next Phase Readiness

- Plan 02-02 (`brk_fetch_service` + `POST /api/parcels/{parcel_id}/brk/persist` endpoint) can import:
  - `from app.services.credential_resolver import get_brk_credentials, BrkCredentials, CredentialNotConfigured`
  - `from app.services.quota_service import record_brk_lookup`
  - `from app.government_apis.brk_bevragen import build_brk_client`
- 30-day cache hot path (`get_latest_for_parcel`) has the partial composite index it needs — Postgres can satisfy `WHERE org_id = ? AND parcel_id = ? AND soft_deleted_at IS NULL ORDER BY fetched_at DESC LIMIT 1` via index-only scan
- Channel-separation rule is now load-bearing in the client docstring; Plan 02-02 service-layer gating in `brk_persistence_service.persist_record` (M050/S01) remains the only place enforcing FF + DPA + AVG strip
- D14 IRON RULE regression test in Plan 02-03 can lift the signature assertion from this SUMMARY verbatim

---
*Phase: 02-brk-fetch-persist-endpoint*
*Completed: 2026-05-18*
