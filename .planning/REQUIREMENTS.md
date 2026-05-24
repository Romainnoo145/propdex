# Requirements: M052 Hauzer Engagement-Demo

**Defined:** 2026-05-21
**Core Value:** System-of-Engagement — Propdex als dagelijkse werkplek (kaart+data = magneet, workflows+acties = lijm). Engagement-laag = kernproduct verkoopbaar aan elke makelaar.

**Approach (LOCKED 2026-05-21):** In productie bouwen, geen wegwerp-demo. Echt kernproduct landt achter feature-flags; demo-isolatie via demo-org seed + `HAUZER_DEMO`-flag; alleen Hauzer-API-features (Realworks/nieuwbouw-matcher) blijven puur mock tot post-deal.

**Demo real-vs-mock:** 4 schermen volledig echt · 1 echt-data-fake-write (Contact) · 3 mock (1 upgradebaar). Mock-oppervlak bewust klein (NAV-04, DASH-04, MATCH-01, CONTACT-02).

**Bronnen:**
- `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260521-135656.md` (office-hours strategie)
- `docs/superpowers/specs/2026-05-21-hauzer-engagement-ia-demo-design.md` (IA + real-vs-mock + component-touchpoints, codebase-geverifieerd)

## v1 Requirements

### Fundament

- [x] **FUND-01**: Gebruiker kiest bij opslaan van een perceel een zoekmethode (optoppen/nieuwbouw/transformatie/splitsen), opgeslagen als `projecttype` op `ParcelFavorite` · ECHT
- [x] **FUND-02**: Gekozen projecttype stuurt de scoring via bestaande M047 projecttype-settings · ECHT
- [ ] **FUND-03**: Gekozen projecttype bepaalt welke Haalbaarheid-checklist verschijnt · ECHT

### Per-perceel acquisitie-arc

- [ ] **NAV-01**: `Haalbaarheid` toegevoegd als fase in `phases.ts` (additief, tussen Contact en Bod; 8-fase Tranche-2-visie blijft intact) · ECHT
- [ ] **NAV-02**: `LifecycleSideRailNav` configureerbaar — Hauzer-tenant ziet 4-fase set (Onderzoek/Contact/Haalbaarheid/Bod) · ECHT
- [ ] **NAV-03**: Route `$phase='haalbaarheid'` rendert `HaalbaarheidPhaseView` · ECHT
- [ ] **NAV-04**: Bod-fase toont status/notitie · MOCK-light (leunt op `ParcelFavorite.notitie`)

### Haalbaarheid

- [ ] **HAAL-01**: Checklist verhuist van Onderzoek-context naar `HaalbaarheidPhaseView`, gedreven door parcel-`projecttype` i.p.v. report_id-koppeling · ECHT
- [ ] **HAAL-02**: `ChecklistProgress`-tracking blijft werken in de nieuwe locatie · ECHT
- [ ] **HAAL-03**: Oude checklist-ingang weg uit workspace-header/Onderzoek; rapport-ingang (`ReportHeader`) blijft als secundair pad · ECHT

### Dashboard (landing)

- [ ] **DASH-01**: Dashboard is de landing-surface (werkdag-cockpit), niet map-first · ECHT
- [ ] **DASH-02**: Pipeline Kanban toont favorites in `pipeline_stage`-kolommen · ECHT
- [ ] **DASH-03**: Drag tussen kolommen update `pipeline_stage` via `update_pipeline` · ECHT
- [ ] **DASH-04**: Daily Acquisitie Inbox toont actiegerichte items · MOCK (achter `HAUZER_DEMO`, upgradebaar via change_monitor + Venlo policy-docs)

### Kaart & matcher

- [ ] **KAART-01**: Built-to-suit kavelzoeker-filter (>10.000m² + Logistiek/Industrie + leeg) toont kandidaten op echte `ParcelCache`-data · ECHT
- [ ] **MATCH-01**: Nieuwbouw-verkoop top-level surface (kandidaten ↔ bouwnummers) · MOCK (achter `HAUZER_DEMO`, gated op Realworks Nieuwbouw-API post-deal)

### Contact (Brief-teaser)

- [ ] **CONTACT-01**: Contact-fase toont brief-preview gegenereerd uit echte BRK-eigenaar-data via `document_generator` eigenaar_brief-template · ECHTE DATA
- [ ] **CONTACT-02**: "Verstuur"-actie toont gefakete verzend-bevestiging (geen echte PostNL) · FAKE-WRITE

### Demo-infra & kwaliteit

- [x] **DEMO-01**: `HAUZER_DEMO` feature-flag gate voor alle mock-surfaces (DASH-04, MATCH-01, NAV-04, CONTACT-02-send) · ECHT
- [ ] **DEMO-02**: Hauzer demo-org geseed met 5-7 favorites in pipeline-stages + projecttype + mock inbox-items, org-scoped (multi-tenant) · ECHT
- [x] **DEMO-03**: DESIGN.md makelaars-correctie — makelaars zijn wél onze markt (Hauzer = full-service developer-adjacent) · DOCS
- [ ] **QUAL-01**: Engagement-laag passeert `npm run check` (frontend) + `ruff check . && mypy .` (backend) + multi-tenant-isolatie regression tests (productie-bar) · ECHT

### Setup-deliverable

- [ ] **RECON-01**: Forward-roadmap reconciliatie-doc — 3 sporen (scoring-depth/cascade · engagement/Hauzer · Tranche-2 M060-M110) + her-genummerde verschoven cascade-batches (M050/M051 hergebruikt voor BRK/Brief; oorspronkelijke Juridisch-klimaat/Subsidies-batches schuiven door, niet geschrapt) · DOCS

## Future Requirements (post-deal / gated)

Niet in M052; vereisen Hauzer-commitment of externe legal-track.

### Brief-Send productie (= M051, gated op Kadaster-DPA + PostNL legal)

- **M051**: echte PostNL Zakelijk dispatch · AI-personalisatie via Claude · quota-counter · partner-branding · AVG-audit-trail

### Hauzer-custom (post-deal, €16.6k consulting)

- **CUST-01**: Realworks Matcher — leest zoekprofielen via Realworks Relatie-API, matcht off-market kavels
- **CUST-02**: Nieuwbouw-matcher echte logica via Realworks Nieuwbouw-API
- **CUST-03**: Logistics erfpacht-registry — manueel/partnership-input (geen auto-radar; BRK Bevragen = overheid-only)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Echte PostNL-dispatch | M051 productie, gated op Kadaster-DPA + PostNL legal-track |
| Echte Realworks-koppeling | Vereist Hauzer's API-toegang, post-deal |
| Erfpacht-einddatum-radar | BRK Bevragen overheid-only, geen bulk-query private SaaS — reframe als manueel registry (later) |
| Tranche-2-fases (Vergunning→Exit) + Verhuur-surface | Buiten Hauzer's voorkant-product (makelaardij/advies/verkoop) |
| Volledige tier-gating (M050.5) | M052 gebruikt `HAUZER_DEMO`-flags; tiering kan later de gating overnemen |
| Fix woonvisie cascade-testfouten | Pre-existing op `main`, los van M052 — known-issue todo |

## Traceability

Wordt ingevuld tijdens roadmap-creatie.

| Requirement | Slice | Status |
|-------------|-------|--------|
| FUND-01 | S01 | Complete |
| FUND-02 | S01 | Complete |
| FUND-03 | S02 | Pending |
| NAV-01 | S02 | Pending |
| NAV-02 | S02 | Pending |
| NAV-03 | S02 | Pending |
| NAV-04 | S02 | Pending |
| HAAL-01 | S02 | Pending |
| HAAL-02 | S02 | Pending |
| HAAL-03 | S02 | Pending |
| DASH-01 | S03 | Pending |
| DASH-02 | S03 | Pending |
| DASH-03 | S03 | Pending |
| DASH-04 | S03 | Pending |
| KAART-01 | S05 | Pending |
| MATCH-01 | S05 | Pending |
| CONTACT-01 | S04 | Pending |
| CONTACT-02 | S04 | Pending |
| DEMO-01 | S01 | Complete |
| DEMO-02 | S06 | Pending |
| DEMO-03 | S01 | Complete |
| QUAL-01 | S06 | Pending |
| RECON-01 | setup (milestone-init) | Done |

**Coverage:**
- v1 requirements: 23 total
- Mapped to slices: 23 ✓ (S01-S06 + RECON-01 setup)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-21*
*Last updated: 2026-05-21 after initial definition*
