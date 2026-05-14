# Roadmap: Propdex M049 — Data Sources per Gemeente hub

## Overview

M049 consolideert het admin-landschap: M045/S05 PDF-upload-flow + ActionItems pagina + nieuwe per-gemeente data-source dashboard fuseren tot één route `/instellingen/data-bronnen/{gemeente_code}`. Admin ziet alle 27+ scoring-bronnen (3 bron-types: A cascade-uploads, B open APIs, C paid integrations) in één overzicht met status-pills, action-buttons en encrypted credential-configuratie voor M051/M052/M053 placeholders.

**Source of truth:** `~/.gstack/projects/Romainnoo145-propdex/complete-milestone-landscape-20260418.md` §M049.

**Karakter:** Admin-architectuur refactor. Bouwt op M045/S05 patterns + introduceert encrypted credential storage als fundament voor latere integratie-milestones.

## Phases

**Phase Numbering:** Slice-based (S01-S06) — geen integer phases zoals M048 wegens kleiner totale scope (admin-only refactor).

- [ ] **S01: Datamodel & Source-Key Catalog** — `gemeente_data_source_status` model + Alembic migratie + uitgebreide source_keys catalog (27+ bronnen in 3 types)
- [ ] **S02: Admin API Layer** — 3 GET endpoints + 1 POST refresh, allemaal superuser-gated + org-scoped via TenantMixin
- [ ] **S03: Data Sources UX** — Nieuwe TanStack Router route + 3-secties layout + status-pills + DataSourceRow component met Aura tokens
- [ ] **S04: M045 Upload-flow Integratie** — UploadDocumentModal + VersionHistoryPanel hergebruik vanuit nieuwe hub + legacy-route redirect-banner
- [ ] **S05: Encrypted Credentials** — Fernet-encrypted `organization_integration_credentials` model + API endpoints + "Configureer credential" modal voor type-C bronnen
- [ ] **S06: ActionItems Deprecation** — Content migratie naar Data-bronnen action-buttons + 301 redirect + verificatie geen broken links

## Slice Details

### S01: Datamodel & Source-Key Catalog
**Goal:** SQLAlchemy infrastructuur klaar voor vendor-managed admin API + frontend kan data-source-key catalog renderen zonder backend roundtrip.

**Requirements:** DATA-01, DATA-02, DATA-03, TEST-01

**Eng-review beslissingen locked-in 2026-05-14:**
- Vendor-managed model (geen TenantMixin) — Propdex BV maintains catalog centraal voor alle klant-orgs
- Aparte data_source_keys.py + frontend mirror (NIET source_keys.py extenden — naming-confusion-risk)
- `DataSourceStatus` als klassenaam, `data_source_status` als tabel (korter dan gemeente_*-prefix)
- `configuratie: JSONB` houdt non-secret state (refresh-interval, last_synced_doc_id); secrets in S05

**Success criteria:**
1. `DataSourceStatus` model query'baar zonder org-filter (vendor-managed); unique constraint op (gemeente_code, source_key) voorkomt dubbele rows
2. Alembic migratie draait clean op propdex_test + propdex zonder data-loss; lege tabel, geen backfill
3. Data-source-key catalog bevat 27+ entries verdeeld in 3 bron-types (A cascade-uploads / B open APIs / C paid integrations); Python + TypeScript mirror sync via shared definition pattern (hand-maintained twin, zoals M045/S05)
4. Superuser-RBAC test bewijst: regular user→403, superuser→200 op admin/data-sources route
5. M045 PolicyDocument-tier (tenant-scoped uploads) blijft onveranderd — backward-compat verified

**Depends on:** Nothing (eerste slice)

### S02: Admin API Layer
**Goal:** Backend API kan alle data-source informatie voor één gemeente in één payload retourneren + superuser-gated mutatie endpoints werken.

**Requirements:** API-01, API-02, API-03, API-05, TEST-02

**Success criteria:**
1. `GET /api/admin/data-sources/{gemeente_code}` retourneert 200 met 3-secties payload (cascade_uploads / open_apis / paid_integrations) in <300ms
2. `GET /api/admin/data-sources/gemeenten` retourneert gesorteerde gemeente-lijst met aggregate counts
3. `POST .../{source_key}/refresh` is idempotent: 2 calls produceren zelfde status zonder externe API spam
4. Non-superuser krijgt 403; multi-tenant isolation getest via test suite

**Depends on:** S01 (model + catalog)

### S03: Data Sources UX
**Goal:** Admin opent `/instellingen/data-bronnen/{gemeente_code}` en ziet Aura-conform dashboard met 3 secties, status-pills, action-buttons. Geen integratie met M045 of credentials nog (placeholders only).

**Requirements:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, TEST-04

**Success criteria:**
1. Route mount + gemeente-picker werkt; default gemeente uit org-config
2. 3 secties renderen 27+ rijen met juiste status-pill kleuren (Vitality Green / red / amber / neutraal)
3. SettingsTabNav heeft 5e pill "Data-bronnen" zichtbaar voor superuser, verborgen voor reguliere users
4. Empty-state toont CTA wanneer gemeente nog 0 actieve bronnen heeft
5. Storybook plays dekken alle 4 status-states voor DataSourceRow
6. Visual smoke tegen DESIGN.md (Morning Mist / Pure Glass / Plus Jakarta Sans) — handmatige check

**Depends on:** S01 (catalog), S02 (API)

### S04: M045 Upload-flow Integratie
**Goal:** Upload-button op data-source rij opent existing M045/S05 modal; legacy beleid-beheer route geeft redirect banner.

**Requirements:** INT-01, INT-02, INT-03, INT-04, TEST-06

**Success criteria:**
1. Click op "Upload" action bij beleidsdocument rij opent `UploadDocumentModal` met source_key pre-filled
2. "Bekijk versies" action opent `VersionHistoryPanel` met juiste document context
3. Bestaande document-uploads (uit M045/S05 era) zijn automatisch zichtbaar in nieuwe hub — geen handmatige migratie nodig
4. `/instellingen/beleid-beheer` toont banner met deeplink naar nieuwe hub; oude routes blijven werken (geen 404)
5. M045 regression-test suite blijft groen

**Depends on:** S03 (UI shell aanwezig om upload-modal in te plugin)

### S05: Encrypted Credentials
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

**Depends on:** S01 (model pattern), S02 (API pattern), S03 (UI pattern)

### S06: ActionItems Deprecation
**Goal:** Oude ActionItems pagina is dood; alle content beschikbaar via Data-bronnen rijen; geen broken links elders in app.

**Requirements:** MIG-01, MIG-02, MIG-03, TEST-05

**Success criteria:**
1. ActionItem cards uit oude pagina zijn terug te vinden als "Bekijk action item" action-buttons in Data-bronnen
2. `/instellingen/action-items` route returns HTTP 301 → `/instellingen/data-bronnen/{user_default_gemeente_code}`
3. Grep door codebase vindt geen interne links naar `/action-items` meer
4. ActionItem entity blijft bestaan in DB; alleen UI-paden zijn verdwenen
5. E2E smoke: admin doorloopt complete flow (upload → status flip → "live") zonder regression

**Depends on:** S03 (Data-bronnen UI), S04 (upload-flow integratie)

## Slice Order

Dependencies dicteren een grotendeels sequentiële volgorde, maar S05 en S06 zijn parallelliseerbaar met elkaar:

```
S01 → S02 → S03 → S04 → (S05 ∥ S06)
```

Estimated duur: 3-4 weken (in lijn met landscape doc schatting).

## Parallel Tracks

**Geen parallel tracks tijdens M049.** I-01a mailserver (uit pre-M046 beslissingen) blijft beschikbaar tussen slices voor losse fixes.

## Progress

| Slice | Goal | Requirements | Status | Completed |
|-------|------|--------------|--------|-----------|
| S01 | Datamodel & Source-Key Catalog | 4 | Not started | — |
| S02 | Admin API Layer | 5 | Not started | — |
| S03 | Data Sources UX | 7 | Not started | — |
| S04 | M045 Upload-flow Integratie | 5 | Not started | — |
| S05 | Encrypted Credentials | 8 | Not started | — |
| S06 | ActionItems Deprecation | 4 | Not started | — |

**Coverage:** 33/33 requirements mapped ✓

---
*Roadmap created: 2026-05-14*
*Source: complete-milestone-landscape-20260418.md §M049*
