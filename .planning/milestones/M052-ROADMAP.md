# Roadmap: Propdex M052 — Hauzer Engagement-Demo

## Overview

M052 maakt de sprong van System-of-Record (data) → System-of-Engagement (dagelijkse werkplek). De engagement-laag — kernproduct verkoopbaar aan elke makelaar — wordt **in productie** gebouwd op echte Venlo-data, met dunne demo-shims voor de Hauzer-pitch (beoogde launching-partner, demo-first, nog niet gepitcht).

**Core value:** Propdex als dagelijkse acquisitie-hub: makelaar opent 's ochtends het Dashboard (Inbox + Pipeline Kanban), klikt een perceel door naar de 4-fase acquisitie-cockpit, ziet in Contact een echte BRK-eigenaar + brief-preview, doorloopt in Haalbaarheid een echte bouwmethode-checklist — grotendeels op echte data.

**Approach (LOCKED 2026-05-21):** In productie, geen wegwerp-demo. ~80% = echt kernproduct. Demo-isolatie via demo-org seed + `HAUZER_DEMO` feature-flag. Alleen Hauzer-API-features (Realworks/nieuwbouw-matcher) blijven puur mock tot post-deal.

**Source of truth:**
- `~/.gstack/projects/Romainnoo145-propdex/klarifai-main-design-20260521-135656.md` (office-hours strategie + deal-structuur)
- `docs/superpowers/specs/2026-05-21-hauzer-engagement-ia-demo-design.md` (IA + real-vs-mock + component-touchpoints, codebase-geverifieerd)
- `.planning/REQUIREMENTS.md` (23 reqs)

**Depends on (already shipped):**
- M050: opgeslagen-cockpit + LifecycleSideRailNav shell + `ParcelFavorite` + `pipeline_stage` CRUD + BRK-lookup (`GET /api/parcels/{id}/brk`) + `document_generator` eigenaar_brief-template
- M047: projecttype-scoring-settings (FUND-02 consumeert dit)
- M020/M022: `checklists.py` 4 use-cases + `ChecklistProgress`

**Slice ordering:** `S01 → (S02 ∥ S03 ∥ S04 ∥ S05) → S06`. S01 is foundation (projecttype + `HAUZER_DEMO`-flag); S02-S05 parallel-eligible; S06 seedt + verifieert het geheel.

**Proces (CLAUDE.md drie-laags):** office-hours deed de milestone-besluitlaag. Per slice vóór `/gsd:plan-phase`: `/plan-eng-review` (architectuur lock-in) + `/plan-design-review` (UI-zwaar — geldt voor S02/S03/S04/S05). Brainstorm vóór elk nieuw component.

## Phases

- [ ] **Phase 1: Fundament + Demo-flag** (M052/S01) — `projecttype` op `ParcelFavorite` + opslaan-op-zoekmethode UI + scoring-wiring · `HAUZER_DEMO` feature-flag infra · DESIGN.md makelaars-correctie
- [ ] **Phase 2: Per-perceel Acquisitie-arc** (M052/S02) — `Haalbaarheid` als 9e fase + `HaalbaarheidPhaseView` + checklist-verhuizing (projecttype-driven) + configureerbare `LifecycleSideRailNav` (Hauzer 4-fase set) + Bod mock-light
- [ ] **Phase 3: Dashboard Cockpit** (M052/S03) — Dashboard-landing + Pipeline Kanban (echt, `pipeline_stage` + drag) + Daily Acquisitie Inbox (mock)
- [ ] **Phase 4: Contact Brief-teaser** (M052/S04) — brief-preview uit echte BRK-eigenaar-data + gefakete verzend-bevestiging
- [ ] **Phase 5: Discovery Surfaces** (M052/S05) — built-to-suit kavelzoeker-filter (echt) + Nieuwbouw-verkoop matcher (mock surface)
- [ ] **Phase 6: Demo-org Seed + Verificatie** (M052/S06) — Hauzer demo-org seed (favorites in stages + projecttype + mock inbox) + productie-bar verificatie

## Phase Details

### Phase 1: Fundament + Demo-flag (M052/S01)
**Goal:** De data-foundation (projecttype) + isolatie-infra (`HAUZER_DEMO`) waar alle andere slices op bouwen.

**Requirements:** FUND-01, FUND-02, DEMO-01, DEMO-03

**Success criteria:**
1. Gebruiker kiest bij opslaan een zoekmethode (optoppen/nieuwbouw/transformatie/splitsen); `projecttype` persisteert op `ParcelFavorite` (migratie + org-scoped)
2. Gekozen projecttype voedt de bestaande M047 projecttype-scoring (score reflecteert de aanpak)
3. `HAUZER_DEMO` feature-flag gate aanwezig + getest: off → mock-surfaces onzichtbaar, on → zichtbaar (env + per-org)
4. DESIGN.md gecorrigeerd: makelaars zijn wél onze markt (achterhaalde "makelaars NIET"-regel weg)
5. `npm run check` + `ruff check . && mypy .` groen

**Depends on:** M050 (`ParcelFavorite`), M047 (projecttype-settings)
**Blocks:** S02 (projecttype), S03/S04/S05 (`HAUZER_DEMO`-flag)

---

### Phase 2: Per-perceel Acquisitie-arc (M052/S02)
**Goal:** De 4-fase acquisitie-cockpit (Onderzoek → Contact → Haalbaarheid → Bod) met de checklist verhuisd naar Haalbaarheid, projecttype-gedreven.

**Requirements:** FUND-03, NAV-01, NAV-02, NAV-03, NAV-04, HAAL-01, HAAL-02, HAAL-03

**Success criteria:**
1. `Haalbaarheid` toegevoegd aan `LIFECYCLE_PHASES` (tussen Contact en Bod); 8-fase Tranche-2-model blijft intact (additief, geen verwijdering) — regression test pint dit
2. `LifecycleSideRailNav` configureerbaar: Hauzer-tenant toont [Onderzoek, Contact, Haalbaarheid, Bod]; ontwikkelaar-tenant ongewijzigd
3. Route `$phase='haalbaarheid'` rendert `HaalbaarheidPhaseView` met de juiste checklist op basis van parcel-`projecttype` (FUND-03)
4. `ChecklistProgress`-tracking werkt in nieuwe locatie; oude ingang weg uit workspace-header/Onderzoek; rapport-ingang (`ReportHeader`) blijft secundair pad
5. Bod-fase toont status/notitie (mock-light op `ParcelFavorite.notitie`)
6. `npm run check` groen; M050-cockpit + sidebar-scope regression-free

**Depends on:** S01 (projecttype)
**Demo-status:** ECHT (NAV-04 mock-light)

---

### Phase 3: Dashboard Cockpit (M052/S03)
**Goal:** Dashboard-first landing (werkdag-cockpit) met echte Pipeline Kanban + mock Daily Inbox.

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04

**Success criteria:**
1. Dashboard is de landing-surface (niet map-first); SideRailNav-entry "Dashboard"
2. Pipeline Kanban toont org-favorites in `pipeline_stage`-kolommen (Gesignaleerd/Onderzoek/Contact/Besluit/Afgerond) op echte data
3. Drag-and-drop tussen kolommen persisteert via `update_pipeline` (optimistic UI + backend-write)
4. Daily Acquisitie Inbox toont 3-5 actie-items achter `HAUZER_DEMO`; off → geen inbox-leak naar andere tenants
5. `npm run check` groen

**Depends on:** S01 (`HAUZER_DEMO` voor Inbox). Kanban-deel onafhankelijk.
**Demo-status:** Kanban ECHT · Inbox MOCK (upgradebaar)

---

### Phase 4: Contact Brief-teaser (M052/S04)
**Goal:** De Hauzer-pré — brief-preview op echte BRK-eigenaar-data met een geloofwaardige gefakete send. Volledige PostNL-pijplijn = M051 (post-deal).

**Requirements:** CONTACT-01, CONTACT-02

**Success criteria:**
1. Contact-fase genereert een brief-preview uit echte BRK-eigenaar-data via `document_generator` eigenaar_brief-template (perceel-context ingevuld)
2. "Verstuur"-actie toont een gefakete verzend-bevestiging ("verzonden") achter `HAUZER_DEMO`; geen echte PostNL-call, duidelijk als demo-shim geïsoleerd
3. Pad is zo gebouwd dat M051 de fake-send 1-op-1 kan vervangen door echte dispatch (geen rework)
4. `npm run check` groen

**Depends on:** S01 (`HAUZER_DEMO`); M050 (BRK-data + Contact-fase + `document_generator`)
**Demo-status:** ECHTE DATA + FAKE-WRITE

---

### Phase 5: Discovery Surfaces (M052/S05)
**Goal:** De sourcing-surfaces — echte built-to-suit kavelzoeker + mock nieuwbouw-matcher.

**Requirements:** KAART-01, MATCH-01

**Success criteria:**
1. Kaart-filter "built-to-suit kavelzoeker": >10.000m² + Logistiek/Industrie-bestemming + leeg (geen `has_pand`) → toont ~20-50 echte Venlo-kandidaten uit `ParcelCache`
2. Nieuwbouw-verkoop top-level surface (kandidaten ↔ bouwnummers) achter `HAUZER_DEMO` — mock-data, duidelijk als post-deal-feature gemarkeerd
3. Filter werkt org-scoped + performant op 137k percelen
4. `npm run check` groen

**Depends on:** S01 (`HAUZER_DEMO` voor matcher). Kavelzoeker-deel onafhankelijk.
**Demo-status:** Kavelzoeker ECHT · Nieuwbouw-matcher MOCK

---

### Phase 6: Demo-org Seed + Verificatie (M052/S06)
**Goal:** Een pitchbare Hauzer demo-org op echte data + volledige productie-bar verificatie van het geheel.

**Requirements:** DEMO-02, QUAL-01

**Success criteria:**
1. Hauzer demo-org geseed: 5-7 favorites verdeeld over pipeline-stages, elk met een `projecttype` + bijbehorende Haalbaarheid-checklist-state; 3-5 mock inbox-items met echte Venlo-adressen — alles org-scoped (geen cross-tenant lek)
2. End-to-end demo-walkthrough klopt: Dashboard (Inbox+Kanban) → perceel doorklikken → 4-fase cockpit → Contact (echte BRK + brief-preview) → Haalbaarheid (echte checklist) — zonder dode klikken
3. Productie-bar: `npm run check` + `ruff check . && mypy .` groen; multi-tenant-isolatie regression tests groen; M050/M048-regressies vrij
4. `HAUZER_DEMO` off → applicatie toont geen mock-surfaces voor niet-Hauzer-tenants (clean toggle)

**Depends on:** S02, S03, S04, S05 (seedt + verifieert alle surfaces)
**Demo-status:** ECHT

---

## Setup-deliverable (klaar tijdens milestone-init, geen build-slice)

- **RECON-01**: Forward-roadmap reconciliatie-doc — 3 sporen (scoring-depth/cascade · engagement/Hauzer · Tranche-2 M060-M110) + her-genummerde verschoven cascade-batches. Zie `.planning/FORWARD-ROADMAP-RECONCILIATION.md`.

## Out of Scope (M052)

- Echte PostNL-dispatch + AI-personalisatie + quota + branding → **M051** (gated op Kadaster-DPA + PostNL legal)
- Echte Realworks-koppeling + nieuwbouw-matcher-logica → post-deal (€16.6k consulting)
- Erfpacht-einddatum-radar → manueel/partnership-registry later (BRK Bevragen overheid-only)
- Volledige tier-gating → **M050.5** (M052 gebruikt `HAUZER_DEMO`-flags)
- Tranche-2-fases (Vergunning→Exit) + Verhuur-surface → M060-M110
- Fix woonvisie cascade-testfouten → pre-existing known-issue, los van M052

---

*Created: 2026-05-21 — `/gsd:new-milestone` M052. Bouwt op M050 (geshipt) + M047 + M020/M022. Demo-first hybride, in productie.*
