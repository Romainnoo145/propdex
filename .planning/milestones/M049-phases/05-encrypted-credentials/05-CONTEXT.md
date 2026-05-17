# Phase 5: Encrypted Credentials - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning
**Source:** Eng-review locked 2026-05-14 + 2026-05-16 (see .planning/MILESTONES.md M049 entry)

<domain>
## Phase Boundary

Phase 5 delivers vendor-managed encrypted-credential infrastructure for Type-C data sources (BRK, Vindsubsidies, NVM) within the M049 Data Sources per Gemeente hub. Output is end-to-end:

1. **Backend datamodel:** `integration_credentials` table (vendor-managed, no TenantMixin) + generic `audit_log` table (Phase 5 = first emitter, designed for cross-cutting reuse).
2. **Crypto layer:** `MultiFernet` wrapper supporting rolling key rotation (NEW key + optional OLD key for decrypt-fallback) with startup-validation of `INTEGRATION_CREDENTIAL_KEY`.
3. **Admin API:** superuser-only POST/DELETE/GET endpoints. GET response shape `{configured: bool, configured_at: date}` — NEVER leaks plaintext. DELETE flow rotates (remove + reinsert).
4. **UI:** `CredentialConfigModal` rendert form fields from `CREDENTIAL_FIELDS` registry per source_key; integrated into existing Type-C data-bronnen rows from Phase 3.

M051/M052/M053 (future cascade integrations) consume credentials via standard pattern; this phase establishes that pattern.

**NOT in scope (deferred):**
- BYOK per-org credentials (future enterprise-tier feature)
- Vault / external KMS integration (env-var key acceptable for current threat model)
- Credential expiry monitoring (presence-based status only)
- Live consumption by BRK/Vindsubsidies/NVM clients (those land in M051+)

</domain>

<decisions>
## Implementation Decisions

### Datamodel (locked-in 2026-05-14 + 2026-05-16)

- `IntegrationCredential` SQLAlchemy model, table `integration_credentials`
- **GEEN TenantMixin** (vendor-managed; Propdex BV brengt eigen subscriptions)
- Columns: `id`, `source_key`, `credential_name`, `encrypted_value`, `created_by_user_id`, `last_rotated_at`, `created_at`
- Unique constraint: `(source_key, credential_name)`
- Alembic head verifiëren vóór nieuwe migratie (M049/S04-keten — Phase 04.1 was de laatste rev)

### Audit Log (locked-in 2026-05-16)

- Generic `AuditLog` SQLAlchemy model, table `audit_logs`
- Columns: `id`, `actor_user_id`, `action` (str), `target_type` (str), `target_id` (str — UUID/int → str voor generieke FK-loosheid), `metadata` (JSONB), `created_at`
- First emitter: credential rotation event
  - `action="credential_rotated"`
  - `target_type="integration_credential"`
  - `target_id=str(credential.id)`
  - `metadata={"source_key": "...", "credential_name": "..."}`
- Designed for cross-cutting reuse — toekomstige features kunnen action/target_type uitbreiden zonder schema-wijziging

### Encryption (locked-in 2026-05-16)

- Library: `cryptography>=44.0` (explicit pin in `pyproject.toml`)
- Pattern: `MultiFernet([Fernet(NEW), Fernet(OLD)] if OLD else [Fernet(NEW)])`
- **Encrypt** altijd met NEW key
- **Decrypt** probeert NEW first, fallback naar OLD (MultiFernet doet dit automatisch)
- Rotation flow: ops set `INTEGRATION_CREDENTIAL_KEY_OLD` = current key, generate new key, set `INTEGRATION_CREDENTIAL_KEY` = new. Rolling deploy → background re-encrypt script → unset OLD.

### Configuratie & Startup Validation (locked-in 2026-05-16)

- Settings (in `backend/app/core/config.py`):
  - `INTEGRATION_CREDENTIAL_KEY: str` (required)
  - `INTEGRATION_CREDENTIAL_KEY_OLD: str | None = None` (optional)
- Startup validator (analoog aan bestaande `_reject_default_secret_key` pattern op regel 253):
  - Faalt bij ontbreken
  - Faalt bij default sentinel `"changeme"` / `"default"` / lege string
  - Faalt bij key die niet base64-decodet naar 32 bytes (Fernet vereiste)
- Hetzelfde validation pattern voor `_OLD` als deze gezet is

### Credential Field Registry (locked-in 2026-05-16)

`credential_name` is een vast enum per `source_key`, NIET vrije user-string. Registry in `backend/app/services/credential_fields.py` (of inline in router):

```python
CREDENTIAL_FIELDS: dict[str, list[CredentialField]] = {
    "brk": [
        CredentialField(name="api_key", label="API Key", input_type="password"),
        CredentialField(name="client_cert", label="Client Certificate (PEM)", input_type="textarea"),
    ],
    "vindsubsidies": [
        CredentialField(name="api_key", label="API Key", input_type="password"),
        CredentialField(name="endpoint_url", label="Endpoint URL", input_type="url"),
    ],
    "nvm": [
        CredentialField(name="client_secret", label="Client Secret", input_type="password"),
        CredentialField(name="endpoint_url", label="Endpoint URL", input_type="url"),
    ],
}
```

- Backend valideert `credential_name in CREDENTIAL_FIELDS[source_key]` bij POST → 422 anders
- Frontend rendert form fields uit registry (single source of truth)
- Frontend TS-sync van CREDENTIAL_FIELDS via bestaande Phase 1 TS-sync pattern (zie 01-datamodel-source-key-catalog: kebab-case regex + `parents[3]` resolution)

### API Endpoints (locked-in 2026-05-16)

Router: `backend/app/admin/integration_credentials_router.py`. Alle endpoints `Depends(get_current_superuser)` (bestaand dep op `backend/app/auth/dependencies.py:103`).

- `GET /api/admin/integration-credentials` — lijst alle credential-entries
  - Response item shape: `{id, source_key, credential_name, configured: bool, configured_at: date | null, last_rotated_at: date | null}`
  - **NEVER `encrypted_value`, NEVER decrypted plaintext**
- `GET /api/admin/integration-credentials/{source_key}` — filtered per source_key (zelfde shape, voor modal display)
- `POST /api/admin/integration-credentials` — body `{source_key, credential_name, value}` → 201
  - Valideert `credential_name` in registry voor `source_key`
  - Encrypt `value` via crypto service
  - UQ violation `(source_key, credential_name)` → 409 (use existing row's DELETE-then-POST flow)
- `DELETE /api/admin/integration-credentials/{id}` → 204
  - Audit-log emit met `action="credential_rotated"` (used by rotate-flow: client doet DELETE → POST in sequence)

### RBAC (locked-in 2026-05-14)

- Alle endpoints: `Depends(get_current_superuser)` — non-superuser krijgt 403
- Bestaande dep, geen nieuwe code

### Frontend: CredentialConfigModal

- Pad: `frontend/src/components/settings/CredentialConfigModal.tsx`
- Aesthetic: Aura design system (Morning Mist canvas, Plus Jakarta Sans, glass `bg-white/60 backdrop-blur-[24px]`)
- Pattern referentie: bestaande modal patterns in `frontend/src/components/settings/` (UploadDocumentModal, VersionHistoryPanel modal-overlay retrofit uit Phase 4)
- Rendert form fields dynamic uit `CREDENTIAL_FIELDS[source_key]`
- States: empty (configureer), filled (toon status + rotate-button), rotating (DELETE + new modal)
- Integration point: data-bronnen rij voor Type-C source (Phase 3 GemeenteDataSourcesPage)

### Claude's Discretion

- Exacte file-splits van `credential_crypto.py` (encrypt/decrypt helpers vs CredentialCryptoService class) — kies expliciete helpers per code-quality finding "explicit > clever"
- Alembic migration namen (`zX_m049_s05_audit_log.py` / `zY_m049_s05_integration_credentials.py`) — gebruik next-available z-prefix, audit_log eerst (audit_log heeft geen FK naar credential dus geen ordening nodig, maar gemakkelijker voor execution)
- Test file structuur (split per file vs unified test_phase5_credentials.py) — volg bestaande project pattern (één test file per router-module, zie tests/integration/test_admin_*.py)
- Frontend TS interface naming — match bestaande conventies (zie data_sources hooks)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked-in Decisions
- `.planning/MILESTONES.md` — M049 entry (top section) met locked-in 2026-05-14 + 2026-05-16 decisions
- `.planning/ROADMAP.md` — Phase 5 section met goal + 5 success criteria

### Requirements
- `.planning/REQUIREMENTS.md` — Lines 13, 21, 42-45, 57 voor DATA-04, DATA-05, API-04, CRED-01..04, TEST-03 (CRED-02 al gefixt 2026-05-16, commit 2f4534f2)

### Existing Code Patterns (must reuse)
- `backend/app/auth/dependencies.py:103` — `get_current_superuser` dependency
- `backend/app/core/config.py:253` — `_reject_default_secret_key` validator pattern (mirror voor `INTEGRATION_CREDENTIAL_KEY`)
- `backend/app/models/data_source_status.py` — vendor-managed model pattern (geen TenantMixin) uit M049/S01
- `backend/app/admin/data_sources_router.py` — admin router pattern uit M049/S02
- `backend/app/admin/data_sources_helpers.py` — helpers extracted to break circular imports (zelfde pattern voor credentials)
- `backend/alembic/versions/z0_m049_s01_create_data_source_status.py` — M049 migration baseline
- `backend/app/services/` — service module patterns

### Frontend Patterns (must follow)
- `frontend/src/components/settings/` — settings UI patterns
- Phase 3 `GemeenteDataSourcesPage` — Type-C rij integration point (uses `useGemeente(code)` query)
- `frontend/src/lib/queries/` — TanStack Query hooks for admin endpoints
- DESIGN.md — Aura design tokens (Morning Mist canvas, glass surfaces, Plus Jakarta Sans)

### Test Infrastructure
- `tests/api_mocks.py` — `make_mock_response()` / `make_mock_client()` helpers
- `tests/conftest.py` — `propdex_test` DB auto-creation, function-scoped table drop/recreate
- Existing pattern: `backend/tests/integration/test_admin_*.py`

</canonical_refs>

<specifics>
## Specific Ideas

### Test Plan (TEST-03 → 5 sub-tests)

- **TEST-03a (crypto):** `tests/unit/test_credential_crypto.py`
  - Roundtrip equality: `decrypt(encrypt("secret"))` == `"secret"`
  - Tampered ciphertext raises `cryptography.fernet.InvalidToken`
  - MultiFernet old-key path: encrypt met old-key Fernet, then decrypt via MultiFernet(new + old) succeeds
- **TEST-03b (RBAC):** `tests/integration/test_integration_credentials_router.py::test_rbac`
  - Non-superuser POST → 403; non-superuser DELETE → 403
  - Superuser POST → 201 with new resource; superuser DELETE → 204
- **TEST-03c (GET contract — REGRESSION-CRITICAL):** zelfde file
  - Assertion: `assert "encrypted_value" not in response.json()`
  - Assertion: `assert "value" not in response.json()`
  - Assertion: response keys == `{"id", "source_key", "credential_name", "configured", "configured_at", "last_rotated_at"}`
- **TEST-03d (startup):** `tests/unit/test_config_credential_key.py`
  - Missing `INTEGRATION_CREDENTIAL_KEY` → `ValidationError`/startup fails
  - `INTEGRATION_CREDENTIAL_KEY="changeme"` → fails
  - `INTEGRATION_CREDENTIAL_KEY="too-short"` (not 32 bytes base64) → fails
  - Valid 32-byte base64 → loads cleanly
- **TEST-03e (audit):** in integration test file
  - POST creds → DELETE creds → assert `audit_logs` row exists with `actor_user_id=<superuser>`, `action="credential_rotated"`, `target_type="integration_credential"`, `target_id=str(deleted_id)`

### Concrete Routing & DI

- Mount router in `backend/app/main.py` analoog aan `data_sources_router` import
- Service-class hoeft niet — gebruik module-level `encrypt(plaintext: bytes | str) -> str` + `decrypt(token: str) -> bytes` helpers in `credential_crypto.py`
- MultiFernet instance lazily-built via `@lru_cache` or module-level singleton (gebouwd bij eerste decrypt/encrypt call zodat tests `INTEGRATION_CREDENTIAL_KEY` kunnen overschrijven)

### Frontend Modal Behavior

- Open: vanuit GemeenteDataSourcesPage Type-C rij → "Configureer" CTA
- States:
  - Empty: form rendert from `CREDENTIAL_FIELDS[source_key]` — user vult in, submit → POST
  - Filled: toon `{credential_name}: configured ({configured_at})` per field, met "Roteren" button per veld
  - Rotating: bevestiging "Oude credential wordt verwijderd, nieuwe modal opent" → DELETE → form-state opnieuw
- Optimistic UI: na POST direct refetch via TanStack `invalidateQueries(['integrationCredentials', source_key])`

</specifics>

<deferred>
## Deferred Ideas

- **BYOK enterprise tier** — per-org credentials gevangen onder TenantMixin in Mn+ milestone
- **Credential expiry monitoring** — time-based `expired` status (huidige `configured` is presence-only)
- **Generic audit_log UI** — audit-log viewer in admin (alleen DB-emission in Phase 5)
- **Vault / KMS integration** — env-var key acceptable nu
- **Live consumption** — BRK/Vindsubsidies/NVM clients zelf vallen onder M051/M052/M053

</deferred>

---

*Phase: 05-encrypted-credentials*
*Context gathered: 2026-05-16 via eng-review carryover (skip discuss-phase — decisions locked tijdens /plan-eng-review)*
