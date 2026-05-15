# Requirements: Propdex M049 — Data Sources per Gemeente hub

**Defined:** 2026-05-14
**Core Value:** From grondpositie to first spade in one cockpit — admins moeten per gemeente in één overzicht weten welke data-bronnen actief, broken, of niet-geconfigureerd zijn.

## M049 Requirements

### Data Model

- [x] **DATA-01**: `DataSourceStatus` SQLAlchemy model met velden (gemeente_code: String(6), source_key: String(64), status: Literal["live"/"broken"/"missing"/"not_applicable"], last_checked: datetime, error_message: nullable, configuratie: JSONB nullable, managed_by_user_id: FK Users — vendor superuser die regel beheert). **GEEN TenantMixin** — vendor-managed catalog (Propdex BV maintains centraal). Unique constraint op (gemeente_code, source_key). Eng-review locked 2026-05-14.
- [x] **DATA-02**: Alembic migratie creëert `data_source_status` tabel + indices op (gemeente_code) + UQ composite (gemeente_code, source_key). Lege tabel, geen data-backfill.
- [x] **DATA-03**: Nieuwe data-source-type catalog in `backend/app/policy_documents/data_source_keys.py` + frontend mirror `frontend/src/lib/constants/dataSourceKeys.ts` — 27+ bronnen verdeeld in 3 types: A (cascade-uploads), B (open APIs), C (paid integrations). **APART** van bestaande `source_keys.py` (M045 cascade-level keys) om naming-confusion te voorkomen. Eng-review locked 2026-05-14.
- [ ] **DATA-04**: `IntegrationCredential` SQLAlchemy model voor encrypted credential storage (source_key, credential_name, encrypted_value via Fernet, created_by_user_id, last_rotated_at). **GEEN TenantMixin** — vendor-managed (Propdex BV brengt eigen BRK/NVM/Vindsubsidies subscriptions; klant-orgs zien deze data shared via vendor-credentials). Unique constraint op (source_key, credential_name).
- [ ] **DATA-05**: Alembic migratie voor `integration_credentials` + Fernet key configuratie in settings (read from `INTEGRATION_CREDENTIAL_KEY` env, validation faalt bij ontbrekende/zwakke key op app-startup)

### API Endpoints

- [x] **API-01**: `GET /api/admin/data-sources/{gemeente_code}` retourneert alle bronnen voor één gemeente, gestructureerd in 3 secties (cascade_uploads / open_apis / paid_integrations). Per rij: source_key, label, type, status, last_checked, error_message, available_actions
- [x] **API-02**: `GET /api/admin/data-sources/gemeenten` retourneert lijst van gemeenten met aggregate status (counts per status), gesorteerd op activiteit
- [x] **API-03**: `POST /api/admin/data-sources/{gemeente_code}/{source_key}/refresh` triggert herevaluatie van bron-status (probe API, recount documents, etc.), idempotent
- [ ] **API-04**: `POST /api/admin/integration-credentials` slaat encrypted credential op; `DELETE /api/admin/integration-credentials/{id}` roteert/verwijdert; alleen superuser
- [x] **API-05**: Alle nieuwe admin endpoints zijn superuser-gated (vendor-only access). **GEEN organization_id-scoping** — `data_source_status` en `integration_credentials` zijn vendor-managed tabellen. Regular klant-org users krijgen 403 op alle admin/data-sources endpoints. M045/S05 PolicyDocument-tier (waar klant-orgs eigen overrides uploaden) blijft onveranderd TenantMixin.

### Frontend UX

- [x] **UX-01**: Nieuwe TanStack Router route `/instellingen/data-bronnen` met gemeente-picker (default: eerste gemeente uit org)
- [x] **UX-02**: Route `/instellingen/data-bronnen/{gemeente_code}` toont 3 secties (Beleidsdocumenten / Open APIs / Betaalde integraties) met status-pills (live/broken/missing/N.V.T.) en Aura-conform design (Pure Glass cards, Morning Mist canvas, Plus Jakarta Sans)
- [x] **UX-03**: Status-pill kleurcodes: live=Vitality Green, broken=red, missing=amber, N.V.T.=neutraal grijs — match Aura tokens
- [x] **UX-04**: Per data-source rij: label + bron-type badge + status-pill + last_checked relative ("2 dagen geleden") + action-buttons (Upload / Refresh / Configureer credential)
- [x] **UX-05**: SettingsTabNav krijgt nieuwe pill "Data-bronnen" (5e tab naast beleid-beheer); superuser-gated visibility match M045/S05 pattern
- [x] **UX-06**: Empty-state per gemeente: "Nog geen bronnen geactiveerd voor deze gemeente" met onboarding-CTA

### Upload Flow Integration

- [x] **INT-01**: M045/S05 `UploadDocumentModal` wordt aangeroepen vanuit nieuwe data-source rij action "Upload"; document landt automatisch in juiste cascade-slot (gemeente + source_key)
- [ ] **INT-02**: M045/S05 `VersionHistoryPanel` opent in nieuwe hub via "Bekijk versies" action op rijen met bestaand document
- [x] **INT-03**: M045/S05 `/instellingen/beleid-beheer` route blijft beschikbaar maar krijgt redirect-banner: "Beheer is verhuisd naar Data-bronnen — bekijk hier"
- [ ] **INT-04**: Bestaande document-uploads worden automatisch zichtbaar in nieuwe hub via `gemeente_data_source_status` row-by-row materialisatie

### Credentials Configuration

- [ ] **CRED-01**: "Configureer credential" modal voor type-C bronnen (BRK, Vindsubsidies, NVM placeholders) met velden per source_key: api_key / client_cert / client_secret / endpoint_url
- [ ] **CRED-02**: Encrypted-at-rest in `organization_integration_credentials` (Fernet symmetric, key uit `INTEGRATION_CREDENTIAL_KEY` env)
- [ ] **CRED-03**: UI toont alleen credential-status (configured/missing/expired) — nooit decrypted waarden retourneren in GET responses
- [ ] **CRED-04**: Credential-rotatie: "Roteren" button verwijdert oude entry + opent modal voor nieuwe waarde; audit-log entry op rotatie

### ActionItems Migration

- [ ] **MIG-01**: ActionItems pagina content (per-gemeente ActionItem cards) migreert naar Data-bronnen rijen als action-button "Bekijk action item" voor bronnen met action_required status
- [ ] **MIG-02**: `/instellingen/action-items` route geeft 301 redirect naar `/instellingen/data-bronnen/{user_default_gemeente_code}`
- [ ] **MIG-03**: ActionItem entity in DB blijft bestaan (referentieel werk), maar UI-paden verdwijnen volledig

### Testing

- [x] **TEST-01**: Backend unit tests voor `DataSourceStatus` model: status-enum validation, UQ duplicate-insert IntegrityError, JSONB configuratie roundtrip, catalog completeness (27+ entries, 3 types, no duplicate keys), Alembic up+down clean op `propdex_test`. **Superuser-RBAC** test (geen tenant-isolation want vendor-managed): regular user→403, superuser→200 op admin/data-sources route.
- [x] **TEST-02**: Backend integration tests voor alle 5 nieuwe API endpoints (auth, scoping, status transitions)
- [ ] **TEST-03**: Backend test voor credential encryption roundtrip (Fernet encrypt → DB → decrypt) + key-rotation scenario
- [x] **TEST-04**: Frontend Storybook plays voor DataSourceRow component (live/broken/missing/configured states)
- [ ] **TEST-05**: E2E smoke test: admin opent gemeente → ziet 27 bronnen → uploadt PDF → status flips naar live
- [ ] **TEST-06**: Pre-merge regression: M045/S05 admin-hub paths blijven werken tot redirect-banner is geverifieerd

## Future Requirements

Deferred to post-M049 / latere milestones:

### Bulk Operations

- **BULK-01**: Cross-gemeente bulk-upload (zelfde document voor meerdere gemeenten in één actie) — M050+
- **BULK-02**: Auto-discovery: scan welke bronnen voor welke gemeente nog ontbreken op basis van gemeente-tier — M050+

### Monitoring & Alerting

- **MON-01**: Alerting wanneer bron broken raakt (Slack/email naar superuser) — M050+
- **MON-02**: Health dashboard per organization (aggregate status over alle gemeenten) — M050+

## Out of Scope

| Feature | Reden |
|---------|--------|
| BRK/NVM/Vindsubsidies daadwerkelijke API-integraties | M052/M053/M051 — M049 levert alleen de configuratie-UX |
| Auto-ingest scheduling UI (cron-config in frontend) | M045/S06 weekly cron werkt; geen UI-tijd waard in M049 |
| Per-gebruiker permission-tiers op data-source actions | Superuser-only model is voldoende voor MVP; multi-role audit komt in I-01 phase 2 |
| Public-facing data-bronnen catalog | Admin-only; eindgebruikers zien score-resultaten, niet bron-status |
| Multi-language UI strings | NL-only voor MVP; i18n komt na M058 |
| Source-key custom catalog per organization | Catalog is shared/globaal in M049; per-org overrides niet nodig |

## Traceability

| Requirement | Slice | Status |
|-------------|-------|--------|
| DATA-01 | S01 | Complete |
| DATA-02 | S01 | Complete |
| DATA-03 | S01 | Complete |
| DATA-04 | S05 | Pending |
| DATA-05 | S05 | Pending |
| API-01 | S02 | Complete |
| API-02 | S02 | Complete |
| API-03 | S02 | Complete |
| API-04 | S05 | Pending |
| API-05 | S02 | Complete |
| UX-01 | S03 | Complete |
| UX-02 | S03 | Complete |
| UX-03 | S03 | Complete |
| UX-04 | S03 | Complete |
| UX-05 | S03 | Complete |
| UX-06 | S03 | Complete |
| INT-01 | S04 | Complete |
| INT-02 | S04 | Pending |
| INT-03 | S04 | Complete |
| INT-04 | S04 | Pending |
| CRED-01 | S05 | Pending |
| CRED-02 | S05 | Pending |
| CRED-03 | S05 | Pending |
| CRED-04 | S05 | Pending |
| MIG-01 | S06 | Pending |
| MIG-02 | S06 | Pending |
| MIG-03 | S06 | Pending |
| TEST-01 | S01 | Complete |
| TEST-02 | S02 | Complete |
| TEST-03 | S05 | Pending |
| TEST-04 | S03 | Complete |
| TEST-05 | S06 | Pending |
| TEST-06 | S04 | Pending |

**Coverage:**
- M049 requirements: 33 total
- Mapped to slices: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Source: `~/.gstack/projects/Romainnoo145-propdex/complete-milestone-landscape-20260418.md` §M049*
