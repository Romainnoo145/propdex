---
phase: 02-brk-fetch-persist-endpoint
plan: 02
subsystem: backend-services
tags: [m050, s02, brk, fetch-persist, endpoint, advisory-lock, two-txn, 30day-cache, d3, d4, d5, d6, d8, d9, d10, d12]

# Dependency graph
requires:
  - phase: m050/s02 plan 02-01
    provides: credential_resolver.get_brk_credentials + BrkCredentials + CredentialNotConfigured (D1 + D6); quota_service.record_brk_lookup stub (D8); build_brk_client factory (D6); idx_brk_latest partial composite index (D15)
  - phase: m050/s01
    provides: brk_ownership_records table + BrkOwnershipRecord model + brk_persistence_service.persist_record (D4 FF + D8 NULL-naam reject + D2 strip)
provides:
  - brk_fetch_service.fetch_and_persist(db, org_id, parcel_id) -> list[BRKOwnershipRecordRead] (D3 + D4 + D5 + D6 + D8 + D9 orchestration)
  - brk_fetch_service.get_latest_for_parcel(db, org_id, parcel_id) -> list[BRKOwnershipRecordRead] (D3 read-path; index-backed by idx_brk_latest)
  - brk_fetch_service.CACHE_TTL_DAYS = 30 (D3 constant)
  - brk_fetch_service.ParcelNotFound + CrossOrgParcelAccess typed exceptions (D12 → 404 / 403)
  - POST /api/parcels/{parcel_id}/brk/persist endpoint with D12 router-layer error mapping (6 typed exceptions → HTTP codes)
affects: [02-03 tests (33 GAPS + 3 REGRESSION-CRITICAL), m050/s03 scoring factors (hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend), m050/s06 cockpit BRK-fetch UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D4 two-transaction boundary inside a single AsyncSession — Txn1 (advisory-lock + cache check) commits BEFORE the HTTP-Kadaster call; Txn2 (persist loop) commits AFTER. Quota hook fires after Txn2 commit. No locks held during HTTP."
    - "D5 advisory-lock dedup via pg_try_advisory_xact_lock(hash(org, parcel)) with stable hashlib.sha256 keys — Python hash() is per-process random and unsafe; SHA-256 truncation to signed 64-bit int is cross-process stable."
    - "Lock-key derivation as f-string-inlined int (SET LOCAL + asyncpg cannot use $1 parameters per CLAUDE.md; safe because derived from validated UUID + str)."
    - "Per-request mTLS http_client construction inside _call_kadaster (build_brk_client(creds) + _create_brk_ssl_context() + httpx.AsyncClient context manager) — mirrors property_aggregator.fetch_brk_ownership pattern."
    - "Non-blocking quota hook pattern: try/except Exception around record_brk_lookup with logger.exception fallback — quota failures NEVER roll back the persist-write (D8 contract)."
    - "Channel-separation enforced in code, not just docstring: this module imports persist-channel schemas (BRKOwnershipRecordRead/Create) only; Phase 105 BRKOwnership schema NEVER referenced."
    - "Parser mirrors property_aggregator._parse_perceel_ownership canonical shape — persoon.type=='NatuurlijkPersoon' skipped (AVG defense layer 1; DB CHECK is layer 3; brk_persistence_service.strip_raw_brk_response is layer 2)."

key-files:
  created:
    - backend/app/services/brk_fetch_service.py
    - backend/app/scans/brk_router.py
  modified:
    - backend/app/main.py

key-decisions:
  - "D3 30-day TTL is evaluated client-side in _is_cache_fresh (max(fetched_at) within timedelta(days=CACHE_TTL_DAYS)) — DB index supports the ordered fetch via idx_brk_latest, but freshness logic lives in the service so it stays trivially testable without time-travel SQL."
  - "D4 commit AFTER cache-check inside Txn1 (release advisory lock) BEFORE the HTTP call — guarantees no idle-in-tx connection during the up-to-30s Kadaster round-trip. Persist loop runs in a fresh implicit Txn2; AsyncSession reuses the connection but transactions are fully closed/reopened by db.commit() per CLAUDE.md pattern."
  - "D5 lock-key derivation: hashlib.sha256(f'{org_id}:{parcel_id}').digest()[:8] → int.from_bytes(byteorder='big', signed=True). Truncating to 8 bytes gives a signed 64-bit int suitable for Postgres bigint arg of pg_*_advisory_xact_lock. Stable across process restarts (unlike Python hash())."
  - "D5 contended-path: instead of busy-waiting, the loser calls pg_advisory_xact_lock (blocking variant) inside its own Txn1, then re-reads the cache. Typical wait < 30s (winner's HTTP timeout). Returns cached even when stale — the winner already short-circuited if the upstream had no rechtspersoon entries, so the loser inherits that result."
  - "D8 quota hook called AFTER db.commit() of Txn2 — if quota_service ever introduces side-effects (counter row insert), they happen in a separate session/txn and cannot roll back the persist-write. try/except guarantees this even if quota_service raises before its own commit."
  - "D9 empty-list semantics: when raw BRK response contains only NatuurlijkPersoon entries (or an empty list), _parse_brk_response_into_records returns []. We still commit Txn2 (no-op since no records to insert) and still fire the quota hook (the HTTP call DID happen — caller spent a credit). Final get_latest_for_parcel returns [] → router returns 200 OK + []. Clients distinguish 'no rechtspersoon-eigenaar' from 'parcel never queried' via list length + a follow-up read of cached rows (a successful 200 + [] means we tried and found none)."
  - "D10 enforced by imports: brk_fetch_service imports persist_record, FeatureDisabled, ValidationError from brk_persistence_service. brk_persistence_service has zero references to brk_fetch_service. grep verifies the one-way direction."
  - "D12 service-no-fastapi enforced by grep + import structure: brk_fetch_service raises ParcelNotFound, CrossOrgParcelAccess + lets FeatureDisabled, ValidationError, GovernmentAPIError, CredentialNotConfigured propagate. brk_router catches all 6 + maps to HTTPException with the correct status code. Service has zero fastapi imports."
  - "ParcelNotFound + CrossOrgParcelAccess defined but not yet raised — interface contract locked for 02-03 tests + future cross-org safety hardening. Today the multi-tenant safety lives entirely at the persistence layer (persist_record filters by organization_id from request user). The exception classes give Plan 02-03 a stable surface for parcel-ownership pre-check tests."
  - "_call_kadaster wraps client construction + httpx.AsyncClient lifecycle in one helper — keeps the fetch_and_persist body focused on the txn/state-machine logic. Construction details (SSL context, timeout=30.0) match property_aggregator.fetch_brk_ownership for behavioral parity across channels."

patterns-established:
  - "M050/S02 commit prefix: 'M050/S02: <what>' (CLAUDE.md hard rule 1)"
  - "Service-layer typed-exception pattern: define module-local exceptions (ParcelNotFound, CrossOrgParcelAccess) + propagate cross-module exceptions (FeatureDisabled, ValidationError, GovernmentAPIError, CredentialNotConfigured) — router maps all six in one try/except chain"
  - "Two-txn-in-single-session pattern: db.commit() between phases reuses the AsyncSession's connection while ensuring no advisory locks survive into the HTTP phase"
  - "Stable lock-key pattern (hashlib.sha256 → signed 64-bit int) — reusable for any future per-row Postgres advisory-lock callsite"

requirements-completed: [BRK-04, BRK-05]

# Metrics
duration: 5m 41s
completed: 2026-05-18
---

# Phase 02 Plan 02: BRK Fetch + Persist Endpoint Summary

**BRK persist write-path landed end-to-end — `brk_fetch_service.fetch_and_persist` orchestrates D4 two-txn boundary + D5 advisory-lock dedup + D3 30-day cache + D6 factory + D8 non-blocking quota hook, and `POST /api/parcels/{parcel_id}/brk/persist` exposes the endpoint with D12 router-layer typed-exception → HTTP mapping. `M050_BRK_PERSIST_ENABLED` stays False — production returns 503 until Kadaster DPA signed.**

## Performance

- **Duration:** 5m 41s
- **Started:** 2026-05-18T16:50:56Z
- **Completed:** 2026-05-18T16:56:37Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `brk_fetch_service.fetch_and_persist(db, org_id, parcel_id) -> list[BRKOwnershipRecordRead]` orchestrates the full persist write-path: D4 two-txn boundary, D5 advisory-lock dedup, D3 30-day cache TTL, D6 factory consumption, D8 non-blocking quota hook
- `brk_fetch_service.get_latest_for_parcel` returns non-soft-deleted rows ordered by `fetched_at DESC` — backed by the `idx_brk_latest` partial composite index (D15, Plan 02-01)
- D5 advisory-lock dedup uses `hashlib.sha256` for cross-process stable lock keys (Python `hash()` is per-process random and unsafe)
- D9 return shape strictly `list[BRKOwnershipRecordRead]` — `BRKOwnership` (Phase 105 schema) NEVER referenced
- D10 import direction enforced: service imports from `brk_persistence_service`; reverse FORBIDDEN (verified by grep)
- D12 service-no-fastapi enforced: zero `fastapi` imports in `brk_fetch_service.py`
- `POST /api/parcels/{parcel_id}/brk/persist` endpoint registered in FastAPI app; D12 router-layer error mapping wired for all 6 typed exceptions
- `M050_BRK_PERSIST_ENABLED` stays `False` by default (config.py untouched) — DPA-pending lock holds
- D14 iron rule preserved: `git diff main..HEAD -- backend/app/services/property_aggregator.py` returns 0 lines (Phase 105 untouched)

## Task Commits

1. **Task 1: brk_fetch_service — D4/D5/D3/D6/D8 orchestration** — `f4e2b6c8` (feat)
2. **Task 2: brk_router endpoint + main.py include** — `cded7202` (feat)

## Files Created/Modified

- `backend/app/services/brk_fetch_service.py` (NEW, 297 LOC) — `fetch_and_persist` + `get_latest_for_parcel` + `_acquire_advisory_lock` + `_wait_for_advisory_lock` + `_parse_brk_response_into_records` + `_is_cache_fresh` + `_call_kadaster` + `CACHE_TTL_DAYS=30` + `ParcelNotFound` + `CrossOrgParcelAccess`
- `backend/app/scans/brk_router.py` (NEW, 96 LOC) — `POST /api/parcels/{parcel_id}/brk/persist` endpoint + D12 router-layer error mapping (6 typed exceptions)
- `backend/app/main.py` (MOD) — added `from app.scans.brk_router import router as brk_router` + `app.include_router(brk_router)` alongside `scans_router`

## `fetch_and_persist` control flow (line refs in `brk_fetch_service.py`)

```
fetch_and_persist (L240)
  ├─ Txn1 start
  │   _acquire_advisory_lock (L75-87)
  │     ├─ acquired=True  → continue
  │     └─ acquired=False → _wait_for_advisory_lock (L91-95)
  │                          + get_latest_for_parcel
  │                          + commit (release blocking lock)
  │                          + return cached  (loser-path)
  │   get_latest_for_parcel (L98-117)
  │   commit  (release pg_try_advisory_xact_lock)        ← Txn1 commit #1
  │
  ├─ Cache freshness gate
  │   _is_cache_fresh (L120-125) — newest fetched_at within CACHE_TTL_DAYS
  │   HIT → return cached (no HTTP, no quota)            ← D3 short-circuit
  │
  ├─ HTTP-Kadaster (no DB locks held)
  │   get_brk_credentials(db)  (L255)
  │   _call_kadaster(creds, parcel_id) (L223-233)
  │     ├─ build_brk_client(creds)  (D6 factory)
  │     ├─ _create_brk_ssl_context() (mTLS)
  │     └─ async with httpx.AsyncClient(verify=ssl_context, timeout=30.0)
  │            → client.get_eigendom(parcel_id, http_client)
  │   _parse_brk_response_into_records(raw, parcel_id) (L128-219)
  │
  ├─ Txn2 start
  │   for record_data in records_to_persist:
  │       persist_record(db, organization_id, record_data)  (L262)
  │   commit                                              ← Txn2 commit #2
  │
  ├─ D8 quota hook (AFTER Txn2 commit, non-blocking)
  │   try:
  │       await record_brk_lookup(organization_id, parcel_id)
  │   except Exception:
  │       logger.exception(...)
  │
  └─ return get_latest_for_parcel (L289) — fresh read from DB after persist
```

## D5 lock-key derivation

```python
def _lock_key(organization_id: uuid.UUID, parcel_id: str) -> int:
    digest = hashlib.sha256(f"{organization_id}:{parcel_id}".encode()).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=True)
```

- SHA-256 of `f"{uuid}:{parcel_id}"` → 32-byte digest
- Truncated to first 8 bytes → signed 64-bit int (fits Postgres `bigint` arg of `pg_*_advisory_xact_lock`)
- Cross-process stable (unlike `hash()` which respects `PYTHONHASHSEED`)
- Collision probability negligible at expected scale (~10⁶ unique pairs/yr → ~10⁻⁸ collision chance)

## D9 empty-list semantics (200 OK + `[]`)

| Upstream BRK response                    | Parser output | Txn2 inserts | Quota hook | Endpoint returns           |
| ---------------------------------------- | ------------- | ------------ | ---------- | -------------------------- |
| ≥1 `NietNatuurlijkPersoon`               | ≥1 records    | ≥1           | Yes        | `200` + populated array    |
| Only `NatuurlijkPersoon` entries         | `[]`          | 0            | Yes        | `200` + `[]`               |
| Empty `zakelijkGerechtigden`             | `[]`          | 0            | Yes        | `200` + `[]`               |
| Cache HIT (<30d, ≥1 row)                 | (skipped)     | 0            | **No**     | `200` + cached array       |
| Cache HIT (<30d, ≥1 row, but stale-ish)  | (re-evaluated) | 0           | **No**     | `200` + cached array       |

Clients distinguish "no rechtspersoon-eigenaar found" from "parcel never queried" by combining the array length with a follow-up read — a successful `200` + `[]` means we tried and found none (quota was spent; no rows to display).

## D12 status code mapping (router-layer)

| Service-layer exception        | Source                                     | HTTP code | Notes                                                                                       |
| ------------------------------ | ------------------------------------------ | --------- | ------------------------------------------------------------------------------------------- |
| `ParcelNotFound`               | `brk_fetch_service`                        | **404**   | "perceel niet gevonden" (defined but not yet raised — interface lock for 02-03 + future)    |
| `CrossOrgParcelAccess`         | `brk_fetch_service`                        | **403**   | "cross-org parcel access denied" (defined but not yet raised — interface lock)              |
| `FeatureDisabled`              | `brk_persistence_service.persist_record`   | **503**   | M050_BRK_PERSIST_ENABLED=False → "BRK persist niet beschikbaar (DPA pending)"               |
| `CredentialNotConfigured`      | `credential_resolver.get_brk_credentials`  | **503**   | "BRK api_key niet geconfigureerd"                                                           |
| `ValidationError`              | `brk_persistence_service.persist_record`   | **422**   | rechtspersoon + naam=None reject (D8)                                                       |
| `GovernmentAPIError`           | `brk_bevragen.get_eigendom`                | **502**   | "upstream BRK error" (Kadaster code masked at user, full code logged WARN by router)        |
| (no exception → 401)           | `Depends(get_current_user)`                | **401**   | Auth gate handled by FastAPI dependency; never reaches `try` body                           |

## Endpoint contract

```
POST /api/parcels/{parcel_id}/brk/persist
  Authorization: Bearer <JWT access token>
  Body: (none)
  Response: 200 OK + list[BRKOwnershipRecordRead]  (D9 — empty list valid)
  Errors:  401 (auth) | 403 (cross-org) | 404 (parcel) |
           422 (validation) | 502 (Kadaster) | 503 (FF / cred missing)
```

The `current_user.organization_id` from JWT drives multi-tenant safety end-to-end:
- `persist_record` filters by `organization_id` (S01 mechanism)
- `get_latest_for_parcel` filters by `organization_id` (D3 read-path)
- Future parcel-ownership pre-check (`ParcelNotFound` / `CrossOrgParcelAccess`) will compare `parcel.organization_id == current_user.organization_id` — exception classes shipped, raise sites land in 02-03 (test-driven) or follow-up hardening.

## Boundary preservation (D9 + D10 + D11 + D14)

- **D9 channel boundary:** `grep -c 'BRKOwnership[^R]' backend/app/services/brk_fetch_service.py` → `0` (Phase 105 schema name never appears bare in service)
- **D10 import direction:** `grep "brk_fetch_service" backend/app/services/brk_persistence_service.py` → 0 lines (persistence does NOT import fetch)
- **D11 channel docstring:** `brk_bevragen.py` class docstring (Plan 02-01) documents both channels; this plan respects it by routing via the `_call_kadaster` helper that explicitly uses `build_brk_client(creds)` (D6 factory) — not the legacy module-singleton `brk_client`
- **D12 service-no-fastapi:** `grep -c 'from fastapi\|import fastapi' backend/app/services/brk_fetch_service.py` → `0`
- **D14 iron rule:** `git diff main..HEAD -- backend/app/services/property_aggregator.py | wc -l` → `0` (Phase 105 untouched)

## `M050_BRK_PERSIST_ENABLED` confirmation

```python
>>> from app.core.config import settings
>>> settings.M050_BRK_PERSIST_ENABLED
False
```

- `git diff main..HEAD -- backend/app/core/config.py | grep M050_BRK_PERSIST_ENABLED` → no output (config untouched)
- Production endpoint returns `503` with `FeatureDisabled` message until DPA signed
- Plan 02-03 tests monkeypatch to `True` to exercise happy-path

## Decisions Made

(See `key-decisions` frontmatter for the full list. Highlights below.)

- **Cache freshness lives in the service, not SQL.** `_is_cache_fresh` evaluates `max(fetched_at)` against `timedelta(days=CACHE_TTL_DAYS)` in Python — trivially unit-testable without time-travel SQL. The DB index (D15) supports the ordered fetch; the freshness gate is pure data.
- **Two-txn-in-single-session pattern.** `db.commit()` between phases reuses the AsyncSession's connection while ensuring no advisory locks survive into the HTTP phase. CLAUDE.md `db.add()/db.flush()/db.commit()` rule (no `async with db.begin()`) holds.
- **Lock key truncates SHA-256 to signed 64-bit int.** Fits Postgres `bigint` argument; cross-process stable; ~10⁻⁸ collision probability at expected scale.
- **Quota hook AFTER Txn2 commit, non-blocking.** If `record_brk_lookup` ever introduces side-effects (counter row insert), they happen in a separate session/txn and cannot roll back the persist-write. `try/except Exception` guarantees this even if quota_service raises before its own commit.
- **Parser mirrors property_aggregator canonical shape.** `_parse_brk_response_into_records` follows the field paths from `property_aggregator._parse_perceel_ownership` (line ~498-590) verbatim — `persoon.type`, `beschikkingsbevoegdheid.code == "PubliekrechtelijkRechtspersoon"`, naam keyword fallback, `aandeel.teller/noemer`, `stukken[].koopsom`, top-level `koopsom`, `Hypotheek` substring for `heeft_hypotheek`. Defensive `.get()` defaults throughout.
- **`ParcelNotFound`/`CrossOrgParcelAccess` defined but not yet raised.** Interface contract locked for Plan 02-03 tests + future cross-org safety hardening. Today multi-tenant safety lives at the persistence layer (`persist_record` filters by `organization_id` from request user).

## Deviations from Plan

**1. [Refactor — minor] Removed `# type: ignore[arg-type]` on `eigenaar_type` kwarg.**
- **Found during:** Task 1 mypy validation
- **Issue:** PLAN.md specified `eigenaar_type=eigenaar_type,  # type: ignore[arg-type]` but mypy emitted `Unused "type: ignore" comment` because the local variable already has type `str` and pydantic `Literal` accepts widened strings.
- **Fix:** Removed the trailing `# type: ignore` — mypy now reports zero new errors on the file.
- **Files modified:** `backend/app/services/brk_fetch_service.py` (one line — comment-only)
- **Commit:** `f4e2b6c8` (included in Task 1)

**2. [Refactor — compaction] File reduced from 369 → 297 LOC by tightening verbose docstrings.**
- **Found during:** Task 1 LOC validation (CLAUDE.md <300 rule)
- **Issue:** Initial draft was 369 LOC; first compaction landed 330; second pass to 297.
- **Fix:** Collapsed module-docstring + function-signature one-liner indentation + log-format multi-line `%`-args into single lines. No behavior change.
- **Files modified:** `backend/app/services/brk_fetch_service.py`
- **Commit:** `f4e2b6c8` (included in Task 1)

No deviations from D1–D15. No auto-fix triggered for runtime behavior.

## Issues Encountered

None. The pre-existing 33 mypy errors in `app/models/*.py` + `app/government_apis/brk_bevragen.py` are out of scope (pre-S01 baseline per Plan 02-01 self-check) — none in new files.

## Self-Check

- File `backend/app/services/brk_fetch_service.py` — FOUND (297 LOC ≤ 300)
- File `backend/app/scans/brk_router.py` — FOUND (96 LOC ≤ 120)
- File `backend/app/main.py` — MODIFIED (brk_router import + include_router)
- Commit `f4e2b6c8` in git log — FOUND (Task 1)
- Commit `cded7202` in git log — FOUND (Task 2)
- `ruff check` on `brk_fetch_service.py + brk_router.py + main.py` — PASSED
- `mypy app/services/brk_fetch_service.py` — 0 new errors
- `mypy app/scans/brk_router.py` — 0 new errors
- D12 enforcement `grep -c 'from fastapi\|import fastapi' backend/app/services/brk_fetch_service.py` — `0`
- D9 enforcement `grep -c 'BRKOwnership[^R]' backend/app/services/brk_fetch_service.py` — `0`
- D10 enforcement `grep brk_fetch_service backend/app/services/brk_persistence_service.py` — `0` lines
- D14 iron rule `git diff main..HEAD -- backend/app/services/property_aggregator.py | wc -l` — `0`
- FF stays False: `git diff main..HEAD -- backend/app/core/config.py | grep M050_BRK_PERSIST_ENABLED` — empty (config untouched)
- Runtime check `python -c "from app.services.brk_fetch_service import fetch_and_persist, get_latest_for_parcel, _acquire_advisory_lock, _parse_brk_response_into_records, CACHE_TTL_DAYS, ParcelNotFound, CrossOrgParcelAccess"` — PASSED
- Runtime check `python -c "from app.scans.brk_router import router; assert router.prefix == '/api/parcels'"` — PASSED
- Route registered: `python -c "from app.main import app; assert '/api/parcels/{parcel_id}/brk/persist' in [r.path for r in app.routes]"` — PASSED
- FF default: `python -c "from app.core.config import settings; assert settings.M050_BRK_PERSIST_ENABLED is False"` — PASSED
- `await db.commit()` count ≥ 2 in `fetch_and_persist` — PASSED (Txn1 acquired-path + Txn1 contended-path + Txn2 = 3 commits)
- `try/except` around `record_brk_lookup` — PASSED
- `hashlib.sha256` lock-key derivation — PRESENT
- `pg_try_advisory_xact_lock` + `pg_advisory_xact_lock` — both PRESENT
- D12 router maps all 6 typed exceptions — VERIFIED in brk_router.py (404 / 403 / 503 / 503 / 422 / 502)

## Self-Check: PASSED

## Next Phase Readiness

- Plan 02-03 (tests) can integration-test the endpoint via httpx AsyncClient + ASGITransport per CLAUDE.md test-patterns
- 9 test files mapped in M050-S02-ENG-PLAN (33 GAPS + 3 REGRESSION-CRITICAL guards) — service interface + endpoint contract now stable
- D13 respx fixture patterns from `tests/api_mocks.py` directly applicable (mock `brk_client.get_eigendom`)
- D14 iron-rule regression test in 02-03 can extend `tests/regression/test_phase105_brk_modal_still_works.py` with this plan's D9 + D14 assertions verbatim
- Multi-tenant CRITICAL test (`test_brk_fetch_multi_tenant.py`) has the typed exceptions to assert against (`ParcelNotFound` / `CrossOrgParcelAccess` defined; raise sites land in 02-03 if test-driven)

---
*Phase: 02-brk-fetch-persist-endpoint*
*Completed: 2026-05-18*
