# Propdex -- Roadmap

## Milestones

- 🚧 **v17.0 Projecten Portfolio** -- Phases 109-113 (in progress)
- [ ] **v16.0 Score Intelligence** -- Phases 99-101
- [ ] **v15.0 Aura** -- Phases 91-93 done, 103 done, 94-97 reskin batch, 104-106 features
- ✅ **v14.0 Fysiek Risicoprofiel** -- Phases 87-90 (shipped 2026-03-10)
- ✅ **v13.0 Juridisch Klimaat Intelligence** -- Phases 82-86 (shipped 2026-03-09)
- ✅ **v12.0 Omgevings- & Leefbaarheids-Scorer** -- Phases 78-80 (shipped 2026-03-07)
- ✅ **v11.0 Open Data Intelligence** -- Phases 75-77 (shipped 2026-03-07)
- ✅ **v10.0 UX Polish** -- Phases 72-74 (shipped 2026-03-03)
- ✅ **v9.0 Risk Intelligence** -- Phases 67-69 (shipped 2026-03-02)
- ✅ **v8.0 Client Demo Readiness** -- Phases 62-66 (shipped 2026-03-02)
- ✅ **v7.2 Developer Dossier Intelligence** -- Phases 59-61 (shipped 2026-02-27)
- ✅ **v7.1 Workspace Productization** -- Phase 58 (shipped 2026-02-27)
- ✅ **v7.05 Codebase Globalization** -- Phase 57 (shipped 2026-02-26)
- ✅ **v7.0 Deep Property Data** -- Phases 52-56 (shipped 2026-02-25)
- ✅ **v6.0 Meldingen Intelligence** -- Phases 47-51 (shipped 2026-02-23)
- ✅ **v5.1 Data Presentation Overhaul** -- Phases 42-46 (shipped 2026-02-22)
- ✅ **v5.0 Scan Intelligence** -- Phases 37-41 (shipped 2026-02-20)
- ✅ **v4.0 UX Redesign** -- Phases 27-36 (shipped 2026-02-18)
- ✅ **v3.1 Smart Area Intelligence** -- Phases 22-26 (shipped 2026-02-15)
- ✅ **v3.0 Spatial Foundation** -- Phases 18-21 (shipped 2026-02-11)
- ✅ **v2.0 Frontend** -- Phases 13-17 (shipped 2026-02-09)
- ✅ **v1.1 Production Hardening** -- Phases 6-12 (shipped 2026-02-08)
- ✅ **v1.0 Core Intelligence Engine** -- Phases 1-5 (shipped 2026-02-07)

---

## Execution Order

```
NOW:   109 Backend Foundation      → ParcelFavorite + PipelineStage models + API
       110 Refactor + HeartButton   → ProjectList.tsx sub-components + heart button
       111 Portfolio Navigation     → Provincie → gemeente → wijk → parcel drill-down
       112 Pipeline Stages          → Stage pills, filtering, Afgerond reason capture
       113 Map Markers              → Favorited parcel markers on map tiles
LATER: 94-97 Aura Reskin           → cosmetische updates overige pagina's (lage prio)
```

---

## Phases

### v17.0 Projecten Portfolio

- [x] **Phase 109: Backend Foundation** - ParcelFavorite + PipelineStage models, CRUD API, bulk portfolio endpoint (completed 2026-03-15)
- [x] **Phase 110: ProjectList Refactor + HeartButton** - Extract ProjectList.tsx sub-components, add heart button to parcel detail panel (completed 2026-03-15)
- [ ] **Phase 111: Portfolio Navigation** - Full provincie → gemeente → wijk → parcel drill-down with Aura cards
- [ ] **Phase 112: Pipeline Stages** - Per-parcel pipeline stage tracking, stage selector, cross-wijk filtering
- [ ] **Phase 113: Map Markers** - Favorited parcel map markers + wijk/gemeente count badges

---

## Phase Details

### Phase 109: Backend Foundation
**Goal**: Users can favorite parcels server-side and the backend can serve a grouped portfolio view — all database models, API routes, and migrations in place
**Depends on**: Phase 108 (established codebase patterns)
**Requirements**: BACK-01, BACK-02, BACK-03, BACK-04
**Success Criteria** (what must be TRUE):
  1. `POST /api/parcels/favorites` saves a parcel favorite scoped to org + user, returns the created favorite
  2. `DELETE /api/parcels/favorites/{parcel_id}` removes a favorite; subsequent GET no longer lists it
  3. `PATCH /api/parcels/favorites/{parcel_id}/pipeline` updates the pipeline stage; 400 returned for invalid stage values
  4. `GET /api/portfolio` returns all favorites grouped by gemeente/wijk with per-level counts in a single query (no N+1); provincie grouping is derived by the frontend from gemeente_code using CBS GeoJSON
**Plans**: 2 plans (2 waves)

Plans:
- [ ] 109-01-PLAN.md -- ParcelFavorite model + Alembic migration with RLS + Pydantic schemas (wave 1)
- [ ] 109-02-PLAN.md -- Favorites CRUD router + portfolio grouped endpoint + main.py registration (wave 2)

### Phase 110: ProjectList Refactor + HeartButton
**Goal**: Users can heart a parcel from the detail panel to add it to their portfolio; the Projecten page is split into maintainable sub-components before v17 features are added
**Depends on**: Phase 109
**Requirements**: BACK-05, FAV-01, FAV-02
**Success Criteria** (what must be TRUE):
  1. ProjectList.tsx is split into sub-components (ProjectenPage, ProvincieView, GemeenteView, WijkView, ParcelPortfolioView) — no single file exceeds 300 lines
  2. Heart button appears next to the close button on the parcel detail panel with correct alignment
  3. Clicking the heart button toggles favorite state immediately (optimistic update) and persists server-side
  4. Heart button reflects correct filled/unfilled state when the same parcel is reopened in a new session
**Plans**: 2 plans (1 wave)

Plans:
- [ ] 110-01-PLAN.md -- ProjectList.tsx extraction into sub-components (wave 1)
- [ ] 110-02-PLAN.md -- HeartButton component + useFavorites hook + portfolio type definitions (wave 1)

### Phase 111: Portfolio Navigation
**Goal**: Users can navigate their saved parcels geographically — from a provincie overview down to individual favorited parcel cards — without leaving the Projecten page
**Depends on**: Phase 110
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06, PORT-07, PORT-08, FAV-04
**Success Criteria** (what must be TRUE):
  1. Projecten page shows full-page Aura card layout (not bento) — 12 provincie cards, only those with favorites are highlighted/navigable
  2. Clicking a provincie shows gemeente cards for that provincie; only gemeenten with favorited parcels are shown
  3. Clicking a gemeente shows wijk cards for that gemeente; only wijken with favorites shown; each wijk card displays "N parcelen opgeslagen" badge
  4. Clicking a wijk shows individual favorited parcel cards with address, score, and pipeline stage
  5. Breadcrumb (Projecten → Limburg → Venlo → Wijk 01) is visible at every level and each segment is clickable
  6. Ghost button at each level opens the corresponding detail view (map / scan / parcel panel)
**Plans**: TBD

Plans:
- [ ] 111-01-PLAN.md -- Provincie + gemeente + wijk card views with drill-down navigation + breadcrumb
- [ ] 111-02-PLAN.md -- Wijk parcel card grid (FavoritedParcelCard + PipelineStagePill) + FAV-04 count badges

### Phase 112: Pipeline Stages
**Goal**: Users can track the acquisition status of each favorited parcel through the 5-stage Dutch pipeline and filter their portfolio by stage
**Depends on**: Phase 111
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05
**Success Criteria** (what must be TRUE):
  1. Each favorited parcel card shows its current pipeline stage pill (Gesignaleerd / Onderzoek / Contact / Besluit / Afgerond)
  2. Clicking the stage pill opens a selector; selecting a new stage updates it immediately (optimistic) and persists
  3. A newly favorited parcel defaults to "Gesignaleerd" without any user action
  4. A filter control on the portfolio page lets users show only parcels in a chosen stage; selecting "Onderzoek" hides all other stages across all wijken
  5. Setting stage to "Afgerond" prompts for reason (Gekocht or Afgewezen) with optional note field; reason is shown on the card
**Plans**: TBD

Plans:
- [ ] 112-01-PLAN.md -- Pipeline stage selector UI + cross-wijk filter + Afgerond reason capture

### Phase 113: Map Markers
**Goal**: Favorited parcels are visually distinguishable on the map so users can see their portfolio spatially while scanning
**Depends on**: Phase 110
**Requirements**: FAV-03
**Success Criteria** (what must be TRUE):
  1. Favorited parcels render a distinct marker or color on the map tile layer (different from standard score-based coloring)
  2. Map markers update when a parcel is favorited or unfavorited without requiring a page reload
**Plans**: TBD

Plans:
- [ ] 113-01-PLAN.md -- Favorite marker tile layer + real-time marker sync

---

## Progress

### v17.0 Projecten Portfolio

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 109. Backend Foundation | 2/2 | Complete    | 2026-03-15 |
| 110. ProjectList Refactor + HeartButton | 2/2 | Complete   | 2026-03-15 |
| 111. Portfolio Navigation | 0/2 | Not started | - |
| 112. Pipeline Stages | 0/1 | Not started | - |
| 113. Map Markers | 0/1 | Not started | - |

### v16.0 Score Intelligence

| Phase | Status | Completed |
|-------|--------|-----------|
| 99. Scan Pipeline Enrichment | Complete | 2026-03-10 |
| 100. Score v3.0 Engine | Complete | 2026-03-11 |
| 101. Score Backfill & Migration | Complete | 2026-03-11 |
| 101.1. Enrichment Backfill Venlo | Complete | 2026-03-11 |

### v15.0 Aura

| Phase | Status | Completed |
|-------|--------|-----------|
| 91. Design System Foundation | Complete | 2026-03-09 |
| 92. Viewport Layout & Nav | Complete | 2026-03-10 |
| 93. Parcel Detail Panel + Tabs | Complete | 2026-03-11 |
| 103. Potentie & Risico Dashboard | Complete | 2026-03-11 |
| 106. Dossier Upload | Complete | 2026-03-11 |
| 104. Due Diligence Dossier | Complete | 2026-03-12 |
| 105. BRK Eigendom Modal | Complete | 2026-03-11 |
| 107. Due Diligence Dashboard | Complete | 2026-03-12 |
| 108. Score Customization | Complete | 2026-03-15 |
| 94. Wijk & Gemeente Reskin | Backlog | - |
| 95. Results Table Reskin | Backlog | - |
| 96. Jurisprudentie Reskin | Backlog | - |
| 97. Settings Reskin | Complete | 2026-03-14 |

---

<details>
<summary>Phase details for completed phases (v15.0 + v16.0)</summary>

### Phase 101: Score Backfill & Migration
**Goal**: Re-score all existing parcels with v3.0 engine so the new Potentie/Risico dashboards show real data
**Depends on**: Phase 100
**Success Criteria**:
  1. Backfill tool re-scores all parcels in all completed scans
  2. Tile endpoints serve potentie_score + risico_score
  3. Old v2.1 score_breakdown gracefully handled (backwards compatible)
**Plans**: 2 plans

Plans:
- [x] 101-01-PLAN.md -- v3.0 score backfill CLI tool
- [x] 101-02-PLAN.md -- API + tile proxy v3.0 score serving

### Phase 101.1: Enrichment Backfill Venlo (INSERTED)

**Goal:** Backfill all 10 Phase 99 enrichment data sources for every parcel in Venlo, then re-score with v3.0 engine so Potentie/Risico dashboards show real enriched data
**Depends on:** Phase 101
**Success Criteria**:
  1. CLI backfill tool fetches coordinate-based data (Natura2000, overstromingsrisico, geluid, luchtkwaliteit) for all 137k parcel_cache rows with geometry
  2. CLI backfill tool fetches address-based data (EP-Online, WOZ, bekendmakingen, funderingsrisico) for all ~51k parcels with address
  3. Enrichment data merged into scan_results.flags JSONB (not parcel_cache.enrichment_data)
  4. Re-score all scan_results with v3.0 engine using enriched data -- risk factors no longer blind
  5. Rate limiting / deduplication to avoid hammering external APIs (50m coordinate dedup, postcode dedup)
**Plans**: 1 plan

Plans:
- [x] 101.1-01-PLAN.md -- Enrichment backfill CLI tool + re-score

### Phase 106: Perceel Dossier Upload
**Goal**: Vastgoedontwikkelaars can upload and manage documents per parcel in the Dossiers tab
**Depends on**: Phase 93 (Dossiers tab UI exists)
**Requirements:** [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05]
**Success Criteria**:
  1. `parcel_documents` table with parcel_id, org_id, document_type, filename, file_data (LargeBinary), uploaded_at
  2. Upload endpoint (POST) with PostgreSQL LargeBinary storage (matching PDFDocument pattern)
  3. Download/preview endpoint (GET) with streaming Response
  4. Each Dossiers tab card shows upload button + uploaded document status
  5. Multi-tenant isolation: documents scoped to organization_id
**Plans**: 2 plans

Plans:
- [x] 106-01-PLAN.md -- Backend model, migration, CRUD endpoints
- [x] 106-02-PLAN.md -- Frontend types, hooks, BronnenLayer upload UI

### Phase 104: Locatie Due Diligence Dossier
**Goal**: Transform "Genereer Rapport" from API-call aggregation into a structured Locatie Due Diligence Dossier assembled from pre-cached scan data, organized by vergunning-relevance for vastgoedontwikkelaars
**Depends on**: Phase 101, Phase 99
**Requirements:** [DD-01, DD-02, DD-03, DD-04, DD-05, DD-06, DD-07]
**Success Criteria**:
  1. "Genereer Rapport" reads from scan_results.flags (pre-cached) -- zero external API calls (except BRK on-demand)
  2. PDF export contains structured dossier sections: Locatie, Kadaster, Bestemmingsplan, Bouwmogelijkheden, Risicoprofiel (bodem/fundering/asbest/geluid/lucht/natura2000/overstroming), Scores + Narratieven, Bronvermelding
  3. Each section shows bron, datum opgehaald, betrouwbaarheid
  4. Report includes potentie_score + risico_score with per-factor breakdown and toelichting_lang narratieven
  5. PDF is professional A4 format suitable for forwarding to adviesbureau or municipality
  6. Existing Rapporten tab + wijk folder organization continues to work
**Plans**: 2 plans

Plans:
- [x] 104-01-PLAN.md -- Backend schema extension + flags assembler + from-parcel rewire
- [x] 104-02-PLAN.md -- Due diligence PDF template + export function

### Phase 105: BRK Eigendom Modal
**Goal**: On-demand BRK ownership data in a modal on the parcel detail panel with adaptive framing and rapport conversion teasers
**Depends on**: Phase 93
**Requirements:** [BRK-01, BRK-02, BRK-03]
**Success Criteria**:
  1. Clicking status indicator on parcel detail opens eigendom modal
  2. Confirmation dialog before BRK API call ("Kost 1 credit")
  3. Modal fetches BRK ownership on-demand (no caching, Kadaster Tier 3)
  4. Adaptive framing: grondpositie (leeg) vs herontwikkeling (in-gebruik)
  5. Displays eigenaar type, zakelijk gerechtigden, erfpacht/eigendom type with routing tips
  6. Teaser sections with blurred content and "Genereer Rapport" CTA
**Plans**: 2 plans

Plans:
- [x] 105-01-PLAN.md -- Backend eigendom endpoint (PDOK resolution + BRK fetch)
- [x] 105-02-PLAN.md -- Frontend EigendomModal with confirmation, adaptive framing, teasers

### Phase 107: Due Diligence Dashboard
**Goal**: Rebuild ReportDetailPage als interactief due diligence werkdashboard met 7 dossier-secties uit Phase 104. Primaire werkscherm voor vastgoedontwikkelaars -- per sectie data bekijken, aanvullen met notities/uploads, en exporteren als PDF.
**Depends on**: Phase 104
**Requirements:** [DD107-01, DD107-02, DD107-03, DD107-04, DD107-05, DD107-06, DD107-07]
**Success Criteria**:
  1. 7-section nav dashboard replaces 2197-line ReportDetailPage monolith
  2. Each section renders data from PropertyReportResponse with completeness badge
  3. Per-section notes saved as JSON in report.notes field (zero backend changes)
  4. Per-section document upload integrated via Phase 106 infrastructure
  5. PDF export triggers due diligence dossier PDF (Phase 104 template)
  6. URL-synced section navigation with browser back/forward support
  7. All files under 300-line limit
**Plans**: 3 plans (2 waves)

Plans:
- [x] 107-01-PLAN.md -- Dashboard shell + section nav + notes hook + route rewire (wave 1)
- [x] 107-02-PLAN.md -- Sections 1-4: Locatiegegevens, Kadaster, Bestemmingsplan, Risicoprofiel (wave 2)
- [x] 107-03-PLAN.md -- Sections 5-7: Potentie & Risico, Vergunningen, Bronvermelding + final wiring (wave 2)

### Phase 108: Score Customization
**Goal**: Extend Score v3.0 engine with 4 environmental risk factors (natura2000, overstromingsrisico, geluid, luchtkwaliteit -> 9->13 risicofactoren), fix overall formula to discount model, and add per-organization score weight customization via /instellingen/score settings
**Depends on**: Phase 100, Phase 99
**Requirements:** [SC-01, SC-02, SC-03, SC-04, SC-05, SC-06, SC-07, SC-08, SC-09, SC-10]
**Success Criteria**:
  1. 4 environmental factors scored in score_v3_factors.py with proper normalization and narratieven
  2. Overall formula = potentie × (1 - risico_discount) with 50% max cap, 70/30 default balance
  3. Per-organization score_weights stored as JSONB on organizations table
  4. /instellingen/score sub-route with preset cards, balance slider, factor tables
  5. Score engine uses custom weights when available, falls back to defaults
  6. Background re-score job re-applies weights without re-computing factors
**Plans**: 4 plans (3 waves)

Plans:
- [x] 108-01-PLAN.md -- Score engine: 4 env factors + formula fix + custom weights param
- [x] 108-02-PLAN.md -- Org weight storage + API endpoints + re-score background job
- [x] 108-03-PLAN.md -- Settings UI: /instellingen/score with presets, slider, factor tables
- [x] 108-04-PLAN.md -- Custom profile badge + backfill tool update

### Phase 94: Wijk & Gemeente Views (Aura Reskin)
**Goal**: Aura styling for wijk/gemeente panels -- existing functionality preserved
**Depends on**: Phase 91
**Plans**: TBD

### Phase 95: Results Table (Aura Reskin)
**Goal**: /resultaten route in Aura style, TanStack Table unchanged
**Depends on**: Phase 91
**Plans**: TBD

### Phase 96: Jurisprudentie & Meldingen (Aura Reskin)
**Goal**: Wizard, explorer, meldingen feed in Aura style
**Depends on**: Phase 91
**Plans**: TBD

### Phase 97: Settings (Aura Reskin)
**Goal**: Settings page Aura styling -- BentoPod sections, glass header bars, Aura accent colors, FactorTable row styling
**Depends on**: Phase 91
**Requirements:** [SET-01]
**Plans**: 1 plan

Plans:
- [x] 97-01-PLAN.md -- BentoPod sections, glass headers, SettingsTabNav + FactorTable Aura treatment

</details>

---

<details>
<summary>✅ v14.0 Fysiek Risicoprofiel (Phases 87-90) -- SHIPPED 2026-03-10</summary>

- [x] Phase 87: Soil Data Integration (1/1 plan) -- BRO Bodemkaart WMS + PDOK Funderingsrisico WFS
- [x] Phase 88: Foundation Risk Engine (1/1 plan) -- bouwjaar x bodemtype heuristic, KCAF cost ranges
- [x] Phase 89: Asbestos v2 Refinement (1/1 plan) -- gebruiksdoel-aware additive uplift
- [x] Phase 90: Frontend Fysiek Risicoprofiel (2/2 plans) -- risk section + map tile overlay

**5 plans, 10 requirements**
**Archive:** `.planning/milestones/v14.0-ROADMAP.md`

</details>

<details>
<summary>✅ v13.0 Juridisch Klimaat Intelligence (Phases 82-86) -- SHIPPED 2026-03-09</summary>

- [x] Phase 82: Ruling Cache + ECLI Court Mapping (2/2 plans)
- [x] Phase 83: Geo-Contextualization + Gemeente Feed (2/2 plans)
- [x] Phase 84: AI Analysis Upgrade + Doorlooptijd (2/2 plans)
- [x] Phase 85: Explorer UI (2/2 plans)
- [x] Phase 86: Trend & Statistics (2/2 plans)

**10 plans, 5 phases**

</details>

<details>
<summary>✅ v12.0 and earlier -- see milestone archives</summary>

- ✅ v12.0 Omgevings- & Leefbaarheids-Scorer (78-80) shipped 2026-03-07
- ✅ v11.0 Open Data Intelligence (75-77) shipped 2026-03-07
- ✅ v10.0 UX Polish (72-74) shipped 2026-03-03
- ✅ v9.0 Risk Intelligence (67-69) shipped 2026-03-02
- ✅ v8.0 Client Demo Readiness (62-66) shipped 2026-03-02
- ✅ v7.2 Developer Dossier Intelligence (59-61) shipped 2026-02-27
- ✅ v7.1 Workspace Productization (58) shipped 2026-02-27
- ✅ v7.05 Codebase Globalization (57) shipped 2026-02-26
- ✅ v7.0 Deep Property Data (52-56) shipped 2026-02-25
- ✅ v6.0 Meldingen Intelligence (47-51) shipped 2026-02-23
- ✅ v5.1 Data Presentation Overhaul (42-46) shipped 2026-02-22
- ✅ v5.0 Scan Intelligence (37-41) shipped 2026-02-20
- ✅ v4.0 UX Redesign (27-36) shipped 2026-02-18
- ✅ v3.1 Smart Area Intelligence (22-26) shipped 2026-02-15
- ✅ v3.0 Spatial Foundation (18-21) shipped 2026-02-11
- ✅ v2.0 Frontend (13-17) shipped 2026-02-09
- ✅ v1.1 Production Hardening (6-12) shipped 2026-02-08
- ✅ v1.0 Core Intelligence Engine (1-5) shipped 2026-02-07

</details>

---

*Last updated: 2026-03-15 -- v17.0 Projecten Portfolio roadmap created (phases 109-113)*
