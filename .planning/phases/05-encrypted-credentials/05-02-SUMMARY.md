---
phase: 05-encrypted-credentials
plan: "05-02"
subsystem: admin-api
tags: [fastapi, admin-rbac, credentials, audit-log, pydantic-v2, integration-test]

# Dependency graph
requires:
  - phase: 05-encrypted-credentials
    plan: "05-01"
    provides: IntegrationCredential model, AuditLog model, credential_crypto.encrypt/decrypt, INTEGRATION_CREDENTIAL_KEY validator
provides:
  - "/api/admin/integration-credentials router (4 verbs: GET list, GET per-source_key, POST, DELETE)"
  - CREDENTIAL_FIELDS registry (brk, vindsubsidies, nvm)
  - Pydantic CredentialEntryRead + CredentialCreate schemas (no plaintext/ciphertext leak)
  - First AuditLog emitter (action=credential_rotated)
affects: [05-03-frontend-modal, M051-brk, M052-vindsubsidies, M053-nvm]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vendor-managed admin router pattern (mirror of admin/data_sources_router) — Depends(get_current_superuser) on every endpoint, no TenantMixin"
    - "CREDENTIAL_FIELDS registry as frozen-dataclass list per source_key — backend POST validator + future frontend TS-sync source of truth"
    - "GET response shape NEVER includes encrypted_value/value (TEST-03c regression assertion)"
    - "Audit emission inside DELETE handler — AuditLog row added BEFORE db.delete() so commit groups both operations atomically"
    - "POST IntegrityError → 409 with explicit DELETE-then-POST rotate hint (matches eng-review locked contract)"

key-files:
  created:
    - backend/app/services/credential_fields.py
    - backend/app/admin/integration_credentials_schemas.py
    - backend/app/admin/integration_credentials_router.py
    - backend/tests/integration/test_integration_credentials_router.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Router prefix /api/admin/integration-credentials registered AFTER admin_data_sources_router in main.py (alphabetical-ish ordering matches existing admin sub-namespace cluster)"
  - "CredentialCreate.model_config(extra='forbid') — rejects unknown JSON keys at the boundary; aligns with DataSourceStatusCreate precedent"
  - "_to_read helper centralises the secret-stripped projection so any future GET (per-id, paginated) reuses the same shape — single source of truth for TEST-03c regression"
  - "DELETE uses db.get(IntegrationCredential, id) then db.add(audit) + db.delete(row) before single db.commit() — atomic audit+delete, no orphan audit on rollback"
  - "Source-key path Annotated[str, Path(min_length=1, max_length=64)] not a regex — keeps validation in CREDENTIAL_FIELDS membership check (single source of truth)"

requirements-completed: [API-04, CRED-03, CRED-04, TEST-03]

# Metrics
duration: 4min
completed: 2026-05-16
---

# Phase 05 Plan 02: Admin API for Encrypted Credentials Summary

**Vendor-managed admin API for integration credentials (GET/POST/DELETE) with first AuditLog emitter and regression-critical secret-stripping GET contract**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-16T11:00:17Z
- **Completed:** 2026-05-16T11:05:08Z
- **Tasks:** 2 (TDD: RED tests committed first; GREEN implementation passed all 9 integration tests first try)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- CREDENTIAL_FIELDS registry (3 source_keys × 2 fields = 6 entries) with valid_names_for() helper
- 2 Pydantic schemas: CredentialEntryRead (6 fields, no secrets) + CredentialCreate (3 fields, extra=forbid)
- FastAPI router with 4 verbs at /api/admin/integration-credentials, all superuser-gated
- 9 integration tests covering RBAC (4) + GET shape regression (1) + audit emission (1) + contract validation (3)
- Combined backend test count for Phase 05: 11 unit (05-01) + 9 integration (05-02) = **20 tests, all green**
- Encrypt() called only inside POST handler; DELETE emits audit row BEFORE removing the credential
- Backend is now GA for the credential lifecycle — only frontend modal (05-03) remains

## Task Commits

1. **Task 2 RED: failing tests for /api/admin/integration-credentials** — `6e3fa8e1` (test)
2. **Task 1 GREEN: registry + schemas + router + main wire** — `c253959a` (feat)

## Final Route List

```
GET    /api/admin/integration-credentials                 → list[CredentialEntryRead]
GET    /api/admin/integration-credentials/{source_key}    → list[CredentialEntryRead] (filtered)
POST   /api/admin/integration-credentials                 → 201 CredentialEntryRead
DELETE /api/admin/integration-credentials/{credential_id} → 204
```

All 4 verbs behind `Depends(get_current_superuser)`. Non-superusers receive 403.

## Verification Results

- `pytest tests/integration/test_integration_credentials_router.py -q` → **9 passed**
- `pytest tests/integration/test_integration_credentials_router.py tests/unit/test_credential_crypto.py tests/unit/test_config_credential_key.py -q` → **20 passed** (combined 05-01 + 05-02)
- Route registration verified: `from app.main import app` shows 3 path entries under `/api/admin/integration-credentials` (list+POST share the empty path, plus `/{source_key}` and `/{credential_id}`)
- `ruff check app/services/credential_fields.py app/admin/integration_credentials_schemas.py app/admin/integration_credentials_router.py app/main.py` → **All checks passed**
- `ruff check tests/integration/test_integration_credentials_router.py` → **All checks passed**
- `mypy app/services/credential_fields.py app/admin/integration_credentials_schemas.py app/admin/integration_credentials_router.py` → **0 errors in the 3 new files** (28 pre-existing transitive errors in unrelated app/models/*, app/auth/* — out of scope per CLAUDE.md scope boundary)
- Acceptance criteria greps:
  - `CREDENTIAL_FIELDS` count in `credential_fields.py`: 3 ≥ 1 ✓
  - `class CredentialEntryRead` count in `integration_credentials_schemas.py`: 1 ✓
  - `get_current_superuser` count in router: 6 ≥ 4 ✓
  - `credential_rotated` count in router: 1 ≥ 1 ✓
  - `from app.services.credential_crypto import encrypt` count in router: 1 ✓
  - `integration_credentials_router` count in `main.py`: 3 ≥ 2 ✓

## Files Created/Modified

**Created:**
- `backend/app/services/credential_fields.py` — frozen-dataclass CredentialField + CREDENTIAL_FIELDS dict + valid_names_for() helper
- `backend/app/admin/integration_credentials_schemas.py` — CredentialEntryRead (secret-free shape) + CredentialCreate (extra=forbid)
- `backend/app/admin/integration_credentials_router.py` — 4-verb router with _to_read() projection helper
- `backend/tests/integration/test_integration_credentials_router.py` — 9 pytest-asyncio integration tests

**Modified:**
- `backend/app/main.py` — added `from app.admin.integration_credentials_router import router as integration_credentials_router` and `app.include_router(integration_credentials_router)` after `admin_data_sources_router`

## Decisions Made

- **Router prefix order in main.py:** registered immediately after `admin_data_sources_router` to keep the admin sub-namespace cluster together; matches the natural read order of admin routes.
- **`_to_read()` helper:** centralised secret-stripping in one place so future paginated/per-id GET endpoints reuse the same projection — defends TEST-03c regression long-term.
- **DELETE atomicity:** `db.add(audit) + db.delete(row) + db.commit()` so the audit row and the credential removal commit together. If commit fails, neither lands — no orphan audit, no silent deletion.
- **Source-key path validation:** kept loose at `Annotated[str, Path(min_length=1, max_length=64)]` rather than a strict regex; CREDENTIAL_FIELDS membership is the single source of truth and rejects unknown keys with 404 (GET) / 422 (POST).
- **`configured` boolean derivation:** computed as `bool(row.encrypted_value)` — non-empty string is truthy; if a future migration ever writes empty ciphertext rows, they correctly report `configured=False`.

## Deviations from Plan

None. Plan executed exactly as written:
- RED tests committed before GREEN implementation (TDD discipline preserved)
- All 9 integration tests passed first GREEN run, no fixes needed
- ruff + mypy clean on every new file
- No architectural changes, no auth gates, no blocking dependencies

## Issues Encountered

- None.
- Pre-existing baseline noise in `ruff check .` (149 errors across the backend) and `mypy app/` (28 errors in app/models/* + app/auth/*) is fully out of scope per CLAUDE.md scope boundary and was logged-not-fixed. None of those touch the 3 new files.

## Self-Check: PASSED

- `backend/app/services/credential_fields.py` — FOUND
- `backend/app/admin/integration_credentials_schemas.py` — FOUND
- `backend/app/admin/integration_credentials_router.py` — FOUND
- `backend/tests/integration/test_integration_credentials_router.py` — FOUND
- commit `6e3fa8e1` (RED) — FOUND
- commit `c253959a` (GREEN) — FOUND

## Next Phase Readiness

- **05-03 (frontend modal)** unblocked: backend API contract is locked, response shapes documented, CREDENTIAL_FIELDS registry available for TS-sync (kebab-case parents[3] resolution pattern from Phase 01-datamodel TS-sync).
- **M051/M052/M053 integration clients** can fetch credentials via service-layer accessor: `credential_crypto.decrypt(row.encrypted_value)` after looking up via `(source_key, credential_name)` UQ tuple.

---
*Phase: 05-encrypted-credentials*
*Completed: 2026-05-16*
