# Roadmap: Propdex M049 — Data Sources per Gemeente hub

## Overview

M049 consolideert het admin-landschap: M045/S05 PDF-upload-flow + ActionItems pagina + nieuwe per-gemeente data-source dashboard fuseren tot één route `/instellingen/data-bronnen/{gemeente_code}`. Admin ziet alle 27+ scoring-bronnen (3 bron-types: A cascade-uploads, B open APIs, C paid integrations) in één overzicht met status-pills, action-buttons en encrypted credential-configuratie voor M051/M052/M053 placeholders.

**Source of truth:** `~/.gstack/projects/Romainnoo145-propdex/complete-milestone-landscape-20260418.md` §M049.

**Karakter:** Admin-architectuur refactor. Bouwt op M045/S05 patterns + introduceert encrypted credential storage als fundament voor latere integratie-milestones.

**Phase / Slice naming:** GSD-CLI gebruikt integer phase-numbers (1-6). In commits + conversatie gebruiken we Propdex slice-aliassen (S01..S06). Phase 1 ≡ S01, Phase 2 ≡ S02, etc.

## Phases

- [ ] **Phase 1: Datamodel & Source-Key Catalog** (S01) — `DataSourceStatus` model + Alembic migratie + nieuwe data-source-key catalog (27+ bronnen in 3 types)
- [ ] **Phase 2: Admin API Layer** (S02) — 3 GET endpoints + 1 POST refresh, superuser-gated (vendor-only access)
- [ ] **Phase 3: Data Sources UX** (S03) — Nieuwe TanStack Router route + 3-secties layout + status-pills + DataSourceRow component met Aura tokens
- [ ] **Phase 4: M045 Upload-flow Integratie** (S04) — UploadDocumentModal + VersionHistoryPanel hergebruik vanuit nieuwe hub + legacy-route redirect-banner
- [ ] **Phase 5: Encrypted Credentials** (S05) — Fernet-encrypted `IntegrationCredential` model + API endpoints + "Configureer credential" modal voor type-C bronnen
- [ ] **Phase 6: ActionItems Deprecation** (S06) — Content migratie naar Data-bronnen action-buttons + 301 redirect + verificatie geen broken links
- [ ] **Phase 7: Visual QA & Aura Conformance Sweep** (GAP-CLOSURE) — Browser-session smokes voor S03/S04/S05 + non-superuser redirect check + INT-03 banner deeplink polish
- [ ] **Phase 8: S04.2 Verifier Backfill** (GAP-CLOSURE) — Run gsd-verifier op inserted security-hardening phase; produceer VERIFICATION.md zodat audit-trail compleet is

## Phase Details

### Phase 1: Datamodel & Source-Key Catalog (S01)
**Goal:** SQLAlchemy infrastructuur klaar voor vendor-managed admin API + frontend kan data-source-key catalog renderen zonder backend roundtrip.

**Requirements:** DATA-01, DATA-02, DATA-03, TEST-01

**Eng-review beslissingen locked-in 2026-05-14:**
- Vendor-managed model (geen TenantMixin) — Propdex BV maintains catalog centraal voor alle klant-orgs
- Aparte data_source_keys.py + frontend mirror (NIET source_keys.py extenden — naming-confusion-risk)
- `DataSourceStatus` als klassenaam, `data_source_status` als tabel (korter dan gemeente_*-prefix)
- `configuratie: JSONB` houdt non-secret state (refresh-interval, last_synced_doc_id); secrets in Phase 5

**Success criteria:**
1. `DataSourceStatus` model query'baar zonder org-filter (vendor-managed); unique constraint op (gemeente_code, source_key) voorkomt dubbele rows
2. Alembic migratie draait clean op propdex_test + propdex zonder data-loss; lege tabel, geen backfill
3. Data-source-key catalog bevat 27+ entries verdeeld in 3 bron-types (A cascade-uploads / B open APIs / C paid integrations); Python + TypeScript mirror sync via shared definition pattern (hand-maintained twin, zoals M045/S05)
4. Superuser-RBAC test bewijst: regular user→403, superuser→200 op admin/data-sources route
5. M445 PolicyDocument-tier (tenant-scoped uploads) blijft onveranderd — backward-compat verified

**Depends on:** Nothing (eerste phase)

### Phase 2: Admin API Layer (S02)
**Goal:** Backend API kan alle data-source informatie voor één gemeente in één payload retourneren + superuser-gated mutatie endpoints werken.

**Requirements:** API-01, API-02, API-03, API-05, TEST-02

**Success criteria:**
1. `GET /api/admin/data-sources/{gemeente_code}` retourneert 200 met 3-secties payload (cascade_uploads / open_apis / paid_integrations) in <300ms
2. `GET /api/admin/data-sources/gemeenten` retourneert gesorteerde gemeente-lijst met aggregate counts
3. `POST .../{source_key}/refresh` is idempotent: 2 calls produceren zelfde status zonder externe API spam
4. Non-superuser krijgt 403; vendor-managed access bewezen via test suite

**Depends on:** Phase 1 (model + catalog)

### Phase 3: Data Sources UX (S03)
**Goal:** Admin opent `/instellingen/data-bronnen/{gemeente_code}` en ziet Aura-conform dashboard met 3 secties, status-pills, action-buttons. Geen integratie met M045 of credentials nog (placeholders only).

**Requirements:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, TEST-04

**Success criteria:**
1. Route mount + gemeente-picker werkt; default gemeente uit org-config
2. 3 secties renderen 27+ rijen met juiste status-pill kleuren (Vitality Green / red / amber / neutraal)
3. SettingsTabNav heeft 5e pill "Data-bronnen" zichtbaar voor superuser, verborgen voor reguliere users
4. Empty-state toont CTA wanneer gemeente nog 0 actieve bronnen heeft
5. Storybook plays dekken alle 4 status-states voor DataSourceRow
6. Visual smoke tegen DESIGN.md (Morning Mist / Pure Glass / Plus Jakarta Sans) — handmatige check

**Depends on:** Phase 1 (catalog), Phase 2 (API)

### Phase 4: M045 Upload-flow Integratie (S04)
**Goal:** Upload-button op data-source rij opent existing M045/S05 modal; legacy beleid-beheer route geeft redirect banner.

**Requirements:** INT-01, INT-02, INT-03, INT-04, TEST-06

**Plans:** 5 plans

Plans:
- [ ] 04-01-PLAN.md — UploadDocumentModal prop extension (initialGemeente/initialSourceKey/onSuccess)
- [ ] 04-02-PLAN.md — VersionHistoryPanel modal-overlay mode (open/onClose/gemeenteCode props)
- [ ] 04-03-PLAN.md — Beleid-beheer redirect banner (amber info banner + deeplink)
- [ ] 04-04-PLAN.md — Detail-route modal-mount + DataSourceRow callback wiring + INT-04 probe trigger + TEST-06
- [ ] 04-05-PLAN.md — Backend opportunistic probe-on-load for pre-existing Type A missing rows (INT-04 materialisatie)

**Success criteria:**
1. Click op "Upload" action bij beleidsdocument rij opent `UploadDocumentModal` met source_key pre-filled
2. "Bekijk versies" action opent `VersionHistoryPanel` met juiste document context
3. Bestaande document-uploads (uit M045/S05 era) zijn automatisch zichtbaar in nieuwe hub — geen handmatige migratie nodig
4. `/instellingen/beleid-beheer` toont banner met deeplink naar nieuwe hub; oude routes blijven werken (geen 404)
5. M445 regression-test suite blijft groen

**Depends on:** Phase 3 (UI shell aanwezig om upload-modal in te plugin)

### Phase 04.2: Security Hardening — Strip Scoring Internals from Public API (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 4
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 04.2 to break down)

### Phase 04.1: Manual Upload Rescore Wire-up (INSERTED)

**Goal:** Wire `rescore_parcels_for_document` ARQ enqueue into de manual PolicyDocument upload path zodat admin-uploads via M049/S04 hub cascade re-scoring triggeren (parity met weekly auto-ingest cron). Sluit de INT-04 gap waar uploaded docs `status='live'` flippen maar niet doorpropageren naar `scan_results` tot de wekelijkse cron draait.

**Scope:**
- Enqueue `rescore_parcels_for_document` na de AI summary job in `policy_documents/router.py` upload route
- Source_key-agnostic gate: no-op voor source_keys zonder geregistreerde extractor; auto-picks up M050+ extractors zodra die landen
- Dezelfde enqueue vanuit `data_source_probe_orchestrator` op `missing → live` transition (zodat opportunistic probe-on-load ook scoring materialiseert)

**Requirements**: INT-04 (re-open — materialise rescore, not just UI flip)
**Depends on:** Phase 4
**Plans:** 2/2 plans complete

Plans:
- [ ] 04.1-01-PLAN.md — CASCADE_RESCORE_SOURCE_KEYS constant + upload route wire + probe orchestrator wire + 6 integration tests (T1–T6)

### Phase 5: Encrypted Credentials (S05)
**Goal:** Type-C bronnen (BRK/Vindsubsidies/NVM) hebben "Configureer credential" UX die encrypted-at-rest opslaat via Fernet. M051/M052/M053 kunnen straks credential ophalen via standaard pattern.

**Requirements:** DATA-04, DATA-05, API-04, CRED-01, CRED-02, CRED-03, CRED-04, TEST-03

**Eng-review beslissing locked-in 2026-05-14:**
- Vendor-managed credentials (geen TenantMixin) — Propdex BV brengt eigen subscriptions, klant-orgs profiteren via shared vendor-credentials. Match pricing-tier model uit partner-briefing 2026-05-13 (€299/€699/€1.249 zonder BYOK-friction). BYOK voor enterprise-tier wordt future-feature (niet MVP).
- `IntegrationCredential` als klassenaam, `integration_credentials` als tabel
- UQ op (source_key, credential_name)

**Success criteria:**
1. Fernet encryption roundtrip getest: stored value is base64 niet-leesbaar; decrypt levert origineel terug
2. `INTEGRATION_CREDENTIAL_KEY` env-variable validation faalt bij ontbrekende/zwakke key op app-startup
3. GET endpoints retourneren `configured: true` / `configured_at: <date>` — NOOIT decrypted waarden
4. Credential-rotatie UX werkt: oude entry verwijderd, nieuwe entry geschreven, audit-log entry zichtbaar
5. Superuser-only RBAC constraint getest (vendor-managed access)

**Depends on:** Phase 1 (model pattern), Phase 2 (API pattern), Phase 3 (UI pattern)

**Plans:** 3 plans (sequential: wave 1 -> wave 2 -> wave 3)

Plans:
- [ ] 05-01-PLAN.md — Crypto fundament: cryptography pin, settings validator, AuditLog + IntegrationCredential models, 2 Alembic migrations, credential_crypto service, TEST-03a + TEST-03d unit tests
- [ ] 05-02-PLAN.md — Admin API: CREDENTIAL_FIELDS registry, Pydantic schemas, /api/admin/integration-credentials router (GET list/per-source, POST, DELETE) with audit emission, TEST-03b + TEST-03c + TEST-03e integration tests
- [ ] 05-03-PLAN.md — Frontend: TS types + CREDENTIAL_FIELDS mirror + TanStack hooks + CredentialConfigModal (Aura) + wire onConfigureCredential through DataSourceRow + page mount

### Phase 6: ActionItems Deprecation (S06)
**Goal:** Oude ActionItems pagina is dood; alle content beschikbaar via Data-bronnen rijen; geen broken links elders in app.

**Requirements:** MIG-01, MIG-02, MIG-03, TEST-05

**Success criteria:**
1. ActionItem cards uit oude pagina zijn terug te vinden als "Bekijk action item" action-buttons in Data-bronnen
2. `/instellingen/action-items` route returns HTTP 301 → `/instellingen/data-bronnen/{user_default_gemeente_code}`
3. Grep door codebase vindt geen interne links naar `/action-items` meer
4. ActionItem entity blijft bestaan in DB; alleen UI-paden zijn verdwenen
5. E2E smoke: admin doorloopt complete flow (upload → status flip → "live") zonder regression

**Depends on:** Phase 3 (Data-bronnen UI), Phase 4 (upload-flow integratie)

### Phase 7: Visual QA & Aura Conformance Sweep (GAP-CLOSURE)
**Goal:** Sluit alle deferred visual-smoke items uit S03/S04/S05 in één browser-sessie + polish de INT-03 banner deeplink zodat hij naar de actieve gemeente verwijst i.p.v. de index.

**Closes gaps (from `M049-MILESTONE-AUDIT.md`):**
- S03: Aura visual smoke (Morning Mist / Pure Glass / Plus Jakarta Sans / status-pill colors / SettingsTabNav active state)
- S03: Non-superuser session → Data-bronnen pill hidden + direct nav redirect
- S04: Upload e2e (modal pre-fill + post-upload status flip)
- S04: Bekijk versies modal (backdrop click, version list render)
- S04: Beleid-beheer banner visueel + link werkt
- S05: CredentialConfigModal Aura tokens
- S05: Three-state UX (empty → filled → rotating) toast + transition
- S05: DESIGN.md token conformance check
- INT-03 (partial): banner Link target wordt gemeente-aware (`/instellingen/data-bronnen/{currentGemeenteCode}` i.p.v. index)

**Requirements affected:** Geen unsatisfied — alle 33 requirements blijven Complete; INT-03 wordt van `partial` naar `wired` gepromoot na deeplink-fix.

**Success criteria:**
1. Screenshot-set in `.planning/phases/07-visual-qa-aura-conformance/screenshots/` met before/after voor elk van S03, S04, S05 smokes — match DESIGN.md tokens verifieerbaar
2. Non-superuser login bewijst Data-bronnen pill onzichtbaar + direct `/instellingen/data-bronnen` → `/instellingen` redirect
3. `beleid-beheer.tsx` banner gebruikt `useCurrentGemeenteCode()` (of equivalent context) om `<Link to="/instellingen/data-bronnen/$gemeenteCode" params={...}>` te renderen wanneer een actieve gemeente bekend is; valt terug naar index wanneer geen context
4. Lichte regression sweep: M049 backend test corpus blijft groen; geen Storybook regressions
5. Audit-file `M049-MILESTONE-AUDIT.md` wordt bijgewerkt — S03/S04/S05 verifications flippen van `human_needed`/`partial` naar `passed`; INT-03 wordt `wired`

**Depends on:** M049 phases 03/04/05 (compleet)

**Plans:** 2 plans

Plans:
- [x] 07-01-PLAN.md — INT-03 deeplink gemeente-aware fix (BeleidBeheerWithBanner wrapper + Storybook play for both Link branches) — shipped 2026-05-16 (commits 7ba5feac, 9d6c7103)
- [ ] 07-02-PLAN.md — Visual QA sweep + audit closure (10 screenshots S03/S04/S05/non-superuser, DESIGN.md token grep, regression sweep, M049-MILESTONE-AUDIT.md update)

### Phase 8: S04.2 Verifier Backfill (GAP-CLOSURE)
**Goal:** Produceer een formele `04.2-VERIFICATION.md` voor de inserted security-hardening phase zodat audit-trail compleet is. Phase 04.2 stond buiten de oorspronkelijke M049 REQUIREMENTS-traceability maar advanced de Alembic-chain en heeft 42/42 tests + alembic upgrade gedocumenteerd in SUMMARY-only — verifier sign-off ontbreekt.

**Closes gaps (from `M049-MILESTONE-AUDIT.md`):**
- S04.2: Geen VERIFICATION.md (alleen SUMMARY.md)

**Requirements affected:** Geen M049-REQ — phase 04.2 is een security-insertion buiten M049 scope. Optioneel: voeg `SEC-01` (score-internals-redaction) toe aan REQUIREMENTS.md als post-hoc requirement zodat traceability klopt.

**Success criteria:**
1. `.planning/phases/04.2-security-hardening-strip-scoring-internals-from-public-api/04.2-VERIFICATION.md` aangemaakt met goal-backward analysis tegen het SUMMARY (5 truths, key-link wiring, requirements-coverage, anti-pattern grep)
2. Live re-run: `pytest tests/unit/test_score_breakdown_redaction.py tests/integration/test_m049_s04_2_score_internals_redaction.py tests/integration/test_alembic_m049_migration.py -v` returned green
3. `alembic heads` blijft single (`79117298d1ad`) — chain integrity bewezen na inspectie
4. Beslissing genoteerd: of `SEC-01` post-hoc requirement toevoegen aan REQUIREMENTS.md, of expliciet documenteren dat S04.2 buiten M049 scope blijft (architectural-debt entry)

**Depends on:** Niet — kan parallel met Phase 7

## Phase Order

Dependencies dicteren een grotendeels sequentiële volgorde, maar Phase 5 en Phase 6 zijn parallelliseerbaar met elkaar:

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 04.1 → (Phase 5 ∥ Phase 6) → (Phase 7 ∥ Phase 8)
```

Estimated duur: 3-4 weken (in lijn met landscape doc schatting).

## Parallel Tracks

**Geen parallel tracks tijdens M049.** I-01a mailserver (uit pre-M046 beslissingen) blijft beschikbaar tussen phases voor losse fixes.

## Progress

| Phase | Slice | Goal | Requirements | Status | Completed |
|-------|-------|------|--------------|--------|-----------|
| 1 | S01 | Datamodel & Source-Key Catalog | 4 | 4/5 | In Progress|  | 2 | S02 | Admin API Layer | 5 | Not started | — |
| 3 | 3/4 | In Progress|  | Not started | — |
| 4 | S04 | M045 Upload-flow Integratie | 5 | Not started | — |
| 04.1 | 2/2 | Complete    | 2026-05-16 | Not started | — |
| 5 | S05 | Encrypted Credentials | 8 | Not started | — |
| 6 | S06 | ActionItems Deprecation | 4 | Complete (3/3 plans) | 2026-05-16 |
| 7 | GAP-CLOSURE | Visual QA & Aura Conformance Sweep | 0 (gap closure) | Not started | — |
| 8 | GAP-CLOSURE | S04.2 Verifier Backfill | 0 (gap closure) | Not started | — |

**Coverage:** 33/33 requirements mapped ✓ · Phase 7-8 zijn gap-closure (geen nieuwe REQs)

---
*Roadmap created: 2026-05-14*
*Source: complete-milestone-landscape-20260418.md §M049*
