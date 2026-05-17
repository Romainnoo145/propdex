---
phase: 05-encrypted-credentials
plan: "05-01"
subsystem: security
tags: [fernet, multifernet, cryptography, alembic, sqlalchemy, pydantic-settings, audit-log]

# Dependency graph
requires:
  - phase: 01-datamodel-source-key-catalog
    provides: vendor-managed model pattern (no TenantMixin) inherited by IntegrationCredential
  - phase: 04.2-security-hardening-strip-scoring-internals-from-public-api
    provides: alembic head b2a4f6c8e1d3 (current down-revision target for new chain)
provides:
  - integration_credentials table (vendor-managed encrypted secret store, UQ source_key+credential_name)
  - audit_logs table (generic action/target_type/target_id schema, JSONB metadata)
  - credential_crypto.encrypt/decrypt module-level helpers (Fernet + MultiFernet rotation)
  - INTEGRATION_CREDENTIAL_KEY + INTEGRATION_CREDENTIAL_KEY_OLD settings with startup validator
  - cryptography>=44.0 explicit pin in pyproject.toml
affects: [05-02-admin-api, 05-03-frontend-modal, M051-brk, M052-vindsubsidies, M053-nvm]

# Tech tracking
tech-stack:
  added: [cryptography>=44.0 (explicit pin; was transitive via pyjwt)]
  patterns:
    - "Lazy module-level MultiFernet built on first encrypt/decrypt call; tests override via monkeypatch + reset_cache()"
    - "Generic audit_log schema (action/target_type/target_id) designed for cross-cutting reuse"
    - "Startup validator mirrors _reject_default_secret_key for Fernet keys (urlsafe-b64 -> 32-byte check)"
    - "DeclarativeBase 'metadata' collision avoided by mapping Python attr event_metadata -> DB column 'metadata'"

key-files:
  created:
    - backend/app/models/audit_log.py
    - backend/app/models/integration_credential.py
    - backend/app/services/credential_crypto.py
    - backend/alembic/versions/za_m049_s05_create_audit_log.py
    - backend/alembic/versions/zb_m049_s05_create_integration_credentials.py
    - backend/tests/unit/test_credential_crypto.py
    - backend/tests/unit/test_config_credential_key.py
  modified:
    - backend/pyproject.toml
    - backend/app/core/config.py
    - backend/app/models/__init__.py
    - backend/.env.example

key-decisions:
  - "down_revision = b2a4f6c8e1d3 (current head from Phase 04.2), not stale 657143b79099 referenced in plan"
  - "Lazy MultiFernet build + reset_cache() helper so test monkeypatch works on first call"
  - "AuditLog Python attr event_metadata maps to DB column 'metadata' (DeclarativeBase reserves the bare attr name)"
  - "INTEGRATION_CREDENTIAL_KEY validator rejects empty / 'changeme' / 'default' / 'CHANGE_ME_IN_PRODUCTION' / non-urlsafe-b64 / non-32-byte"

patterns-established:
  - "MultiFernet lazy-init: module-level _multifernet built on first _get() call; reset_cache() for test mutation"
  - "Generic audit_log table: future emitters add new action/target_type strings, no DDL"
  - "Fernet startup validator: same shape as _reject_default_secret_key but stricter (base64 + length check)"

requirements-completed: [DATA-04, DATA-05, CRED-02, TEST-03]

# Metrics
duration: 6min
completed: 2026-05-16
---

# Phase 05 Plan 01: Encrypted Credentials Foundation Summary

**Vendor-managed encrypted-credential infrastructure with MultiFernet rotation, generic audit_log table, and startup-validated INTEGRATION_CREDENTIAL_KEY**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-16T10:51:13Z
- **Completed:** 2026-05-16T10:57:35Z
- **Tasks:** 3 (all TDD: RED + GREEN per task)
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments
- Two vendor-managed SQLAlchemy models compiled + migrate clean (audit_logs, integration_credentials)
- `credential_crypto.encrypt/decrypt` MultiFernet wrapper with rolling rotation proven by 4 unit tests
- Settings startup-validator rejects bad keys at boot (7 unit tests cover missing/sentinel/empty/short/valid/rotation/bad-OLD)
- Alembic head advanced: `b2a4f6c8e1d3` → `ad5af9028eb1` (audit_log) → `79117298d1ad` (integration_credentials)
- Single head confirmed after upgrade; downgrade -2 + upgrade head round-trips clean
- `cryptography>=44.0` explicitly pinned (was transitive via pyjwt[crypto])

## Task Commits

1. **Task 1 RED: failing tests for INTEGRATION_CREDENTIAL_KEY validator** — `a39eacce` (test)
2. **Task 1 GREEN: pin cryptography + settings + validator** — `205f4450` (feat)
3. **Task 2: AuditLog + IntegrationCredential models + 2 Alembic migrations** — `994eb47a` (feat)
4. **Task 3 RED: failing tests for credential_crypto roundtrip + rotation** — `9ef5c6aa` (test)
5. **Task 3 GREEN: credential_crypto MultiFernet service** — `28c5b3d5` (feat)

## Alembic Revision IDs

- **REV_ZA** = `ad5af9028eb1` (m049_s05_create_audit_log, down_revision `b2a4f6c8e1d3`)
- **REV_ZB** = `79117298d1ad` (m049_s05_create_integration_credentials, down_revision `ad5af9028eb1`)
- **`alembic heads` output (post-upgrade):** `79117298d1ad (head)` — single head confirmed

## Verification Results

- `pytest tests/unit/test_credential_crypto.py tests/unit/test_config_credential_key.py -q` → **11 passed** (4 + 7)
- `alembic heads` → single head `79117298d1ad`
- `alembic downgrade -2 && alembic upgrade head` → round-trip succeeds
- `ruff check` on all new/modified files → all checks passed
- `mypy app/services/credential_crypto.py` → success, no issues
- `mypy app/models/audit_log.py` / `mypy app/models/integration_credential.py` → no new errors (pre-existing transitive errors unrelated to plan scope)

## Files Created/Modified

**Created:**
- `backend/app/models/audit_log.py` — generic AuditLog SQLAlchemy model
- `backend/app/models/integration_credential.py` — vendor-managed IntegrationCredential model
- `backend/app/services/credential_crypto.py` — Fernet/MultiFernet encrypt/decrypt helpers + reset_cache test hook
- `backend/alembic/versions/za_m049_s05_create_audit_log.py` — audit_logs migration
- `backend/alembic/versions/zb_m049_s05_create_integration_credentials.py` — integration_credentials migration
- `backend/tests/unit/test_credential_crypto.py` — TEST-03a (4 tests)
- `backend/tests/unit/test_config_credential_key.py` — TEST-03d (7 tests)

**Modified:**
- `backend/pyproject.toml` — pinned `cryptography>=44.0`
- `backend/app/core/config.py` — added INTEGRATION_CREDENTIAL_KEY + INTEGRATION_CREDENTIAL_KEY_OLD settings + `_validate_integration_credential_key` model_validator
- `backend/app/models/__init__.py` — re-exports AuditLog + IntegrationCredential for autogen discovery
- `backend/.env.example` — documented credential-key fields with placeholders
- `backend/.env` (gitignored, local-only) — populated with fresh Fernet key so existing modules booting `settings = Settings()` survive the new validator

## uv.lock

`uv.lock` re-resolved after `cryptography>=44.0` pin; lockfile change is included in the Task 1 GREEN commit (`205f4450`). No version bumps required — cryptography was already resolved transitively at a compatible version.

## .env Setup Confirmation

- `backend/.env` (local, gitignored): `INTEGRATION_CREDENTIAL_KEY=<fresh Fernet key>` appended at execution time so `Settings()` boots cleanly during the rest of the test suite.
- `backend/.env.example` (committed): empty `INTEGRATION_CREDENTIAL_KEY=` + `INTEGRATION_CREDENTIAL_KEY_OLD=` placeholders with comment block explaining generation + rotation flow.
- **Ops action required for staging/prod**: generate a fresh `INTEGRATION_CREDENTIAL_KEY` per environment via `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and set it in the environment store before deploying anything that imports `settings`.

## Decisions Made

- **down_revision = `b2a4f6c8e1d3` (not `657143b79099`):** plan referenced the M049/S01 head but Phase 04.2 (security hardening / expose_score_internals) advanced the chain by one revision. Used the current head — Rule 3 auto-fix blocking issue.
- **`event_metadata` Python attr → DB column `metadata`:** SQLAlchemy `DeclarativeBase` reserves the bare `metadata` attribute, so we explicitly map a different Python attribute name to keep the DB column predictable and the model clean.
- **Lazy MultiFernet + `reset_cache()` helper:** rather than rebuild on every call (slow) or build at import time (defeats test monkeypatch), build on first use and expose a test-only cache reset so the rotation test can mutate settings mid-test.
- **Docstring wording avoids the literal `TenantMixin` token:** acceptance criteria grep'd for zero occurrences; intent ("no tenant scoping mixin") preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `down_revision` from stale `657143b79099` to current head `b2a4f6c8e1d3`**
- **Found during:** Task 2 (Alembic migration creation)
- **Issue:** Plan said `down_revision = "657143b79099"` (M049/S01 head). Actual current head was `b2a4f6c8e1d3` (M049/S04.2 expose_score_internals). Using the stale value would create a parallel branch and break `alembic heads` single-head invariant.
- **Fix:** Set `down_revision = 'b2a4f6c8e1d3'` in the za migration; chain became `b2a4f6c8e1d3 -> ad5af9028eb1 -> 79117298d1ad`.
- **Files modified:** `backend/alembic/versions/za_m049_s05_create_audit_log.py`
- **Verification:** `alembic upgrade head` succeeds; `alembic heads` shows single head `79117298d1ad`; downgrade -2 + upgrade head round-trips clean.
- **Committed in:** `994eb47a` (Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Mechanical fix — plan was authored against a snapshot before Phase 04.2 closed. No scope change, no architectural shift.

## Issues Encountered
- None. All tests passed first GREEN run after RED; migrations applied first try; ruff + mypy clean on all new files.

## User Setup Required

None for development (local `.env` populated with a fresh Fernet key).
**Staging/prod ops action required before deploy:**
- Generate `INTEGRATION_CREDENTIAL_KEY` per environment with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- Set as env var in environment store
- Do NOT reuse the dev key in any deployed environment
- Leave `INTEGRATION_CREDENTIAL_KEY_OLD` unset until first rotation

## Next Phase Readiness

- **05-02 (admin API + audit emission)** unblocked: router can `from app.services import credential_crypto` for encrypt/decrypt and `from app.models import AuditLog, IntegrationCredential` for persistence. Audit emission on DELETE-then-POST rotate flow has a target table to write to.
- **05-03 (frontend modal)** unblocked once 05-02 lands the API contract; no work in this plan touches frontend.
- **M051/M052/M053 integration clients** can read credentials via the same `credential_crypto.decrypt(token)` pattern once 05-02 surfaces a service-layer accessor.

## Self-Check: PASSED

- `backend/app/models/audit_log.py` — FOUND
- `backend/app/models/integration_credential.py` — FOUND
- `backend/app/services/credential_crypto.py` — FOUND
- `backend/alembic/versions/za_m049_s05_create_audit_log.py` — FOUND
- `backend/alembic/versions/zb_m049_s05_create_integration_credentials.py` — FOUND
- `backend/tests/unit/test_credential_crypto.py` — FOUND
- `backend/tests/unit/test_config_credential_key.py` — FOUND
- commit `a39eacce` — FOUND
- commit `205f4450` — FOUND
- commit `994eb47a` — FOUND
- commit `9ef5c6aa` — FOUND
- commit `28c5b3d5` — FOUND

---
*Phase: 05-encrypted-credentials*
*Completed: 2026-05-16*
