# Propdex -- Roadmap

## Milestones

- [ ] **v15.0 Aura** -- Phases 91-97 (paused, resumes after v16.0)
- [ ] **v16.0 Score Intelligence** -- Phases 99-101 (next up)
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

## Phases

### v16.0 Score Intelligence (Phases 99-101)

- [x] **Phase 99: Scan Pipeline Enrichment** - Move energielabel (EP-Online), WOZ (Waardeloket), vergunningen (SRU), bodem (Bodemloket/BRO), funderingsrisico (PDOK WFS) from on-demand to scan pipeline pre-cache (completed 2026-03-10)
- [ ] **Phase 100: Score v3.0 Engine** - Complete scoring overhaul: Potentie subscore (8 factoren, 80pt) + Risico subscore (9 factoren, 67pt), template-based narratieven per factor (toelichting_kort + toelichting_lang + data_bronnen), normalisatie, gewichtsherverdeling bij ontbrekende data
- [ ] **Phase 101: Score Backfill & Migration** - Re-score all existing parcels with v3.0, migrate score_breakdown schema, update frontend types for potentie_score + risico_score + expanded breakdown

### v15.0 Aura (Phases 91-97, resumes after v16.0)

- [x] **Phase 91: Aura Design System Foundation** - Tokens, font, glass primitives, micro-interactions, remove dark mode, performance fallbacks (completed 2026-03-09)
- [x] **Phase 92: Viewport Layout & Navigation** - Background mesh, floating rounded map, Plus Jakarta Sans, SideRailNav left-6, split command center (REPLANNED) (completed 2026-03-10)
- [x] **Phase 93: Parcel Detail Panel** - LEFT-side floating panel, Framer Motion animations, satellite hero, bento pods, click-through layers (REPLANNED) (completed 2026-03-10)
- [ ] **Phase 94: Wijk & Gemeente Views** - Bottom bento sheet, 4-column layout, wijk glow, gemeente wijk boundaries
- [ ] **Phase 95: Results Table** - /resultaten Aura treatment preserving TanStack Table functionality
- [ ] **Phase 96: Jurisprudentie & Meldingen** - Wizard, explorer, and feed redesigned in Aura style
- [ ] **Phase 97: Settings** - Settings page Aura update
- [ ] **Phase 103: Potentie & Risico Dashboard** - No-scroll investor dashboards for Potentie (+ kansen) and Risico (- waarschuwingen) tabs, score breakdown per factor with narratieven. Depends on v16.0
- [ ] **Phase 104: Rapport v2.0** - Rapport rewrite as pure template render on pre-cached scan data + score narratieven, no on-demand API calls. Depends on v16.0
- [ ] **Phase 105: BRK Eigendom Modal** - Popup modal behind "pand in gebruik" button with on-demand BRK ownership fetch (no caching, Kadaster compliance)

## Phase Details

### Phase 91: Aura Design System Foundation
**Goal**: Every component in the app draws from Aura tokens and primitives -- the visual DNA is established before any view is rebuilt
**Depends on**: Nothing (first phase of v15.0)
**Requirements**: DS-01, DS-02, DS-03, DS-04, DS-05, DS-06
**Success Criteria** (what must be TRUE):
  1. Opening the app shows Satoshi font everywhere (no Inter/system font remnants)
  2. All color usage traces back to Aura CSS variables (Morning Mist canvas, Deep Obsidian text, Warm Amber accents)
  3. GlassPanel, BentoPod, and PillBadge components render correctly with the specified blur/translucency rules
  4. Hovering interactive elements shows scale-105 + glow micro-interaction
  5. Dark mode toggle is gone -- no dark theme code remains in the bundle
**Plans**: 2 plans

Plans:
- [ ] 91-01: Aura tokens + Satoshi font + dark mode removal
- [ ] 91-02: Glass primitives + micro-interactions + performance fallbacks

### Phase 92: Viewport Layout & Navigation
**Goal**: The map floats on a warm ambient canvas with glass controls — Plus Jakarta Sans font, background mesh, rounded map, SideRailNav at left-6, split command center with Framer Motion
**Depends on**: Phase 91
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. Plus Jakarta Sans is the global font, Morning Mist background with blurred color blobs behind rounded map canvas
  2. SideRailNav floats at left-6 (24px) with glass material
  3. Search pill sits top-left at left-[112px] with glass pill shape
  4. Toggle pill at top-center with 3 sections (Base Layer | View Level | Intelligence Layer) and Framer Motion layoutId
**Plans**: 2 plans

Plans:
- [ ] 92-01-PLAN.md -- Plus Jakarta Sans font + background mesh + floating map canvas + SideRailNav left-6
- [ ] 92-02-PLAN.md -- Install framer-motion + search pill position + toggle pill with 3 sections + layoutId

### Phase 93: Parcel Detail Panel
**Goal**: Clicking a parcel opens a LEFT-side floating glass panel with Framer Motion animations, satellite hero, Deep Obsidian score badge, zero-scroll bento overview, and slide-up detail layers
**Depends on**: Phase 92
**Requirements**: PRC-01, PRC-02, PRC-03, PRC-04, PRC-05, PRC-06, PRC-07, API-01
**Success Criteria** (what must be TRUE):
  1. Clicking a parcel opens a LEFT-side panel (left-[112px], 420px) with Framer Motion spring slide-in
  2. Satellite hero (180px) with Deep Obsidian score badge circle + sticky address header
  3. 4 category pods in 2x2 bento grid without scrolling, bestemming in Juridisch pod
  4. Clicking a pod triggers Framer Motion slide-up transition to detail layer (hero + address persist)
  5. "Genereer Rapport" pinned at bottom in sticky footer across all views
**Plans**: 3 plans

Plans:
- [ ] 93-01-PLAN.md -- Backend aerial crop API endpoint + frontend useAerialCrop hook
- [ ] 93-02-PLAN.md -- LEFT-side panel shell + Framer Motion + satellite hero + bento pods + map integration
- [ ] 93-03-PLAN.md -- Detail layers with Framer Motion slide-up + vergunningen accordion + rapport button

### Phase 99: Scan Pipeline Enrichment
**Goal**: Move 5 on-demand data sources into the scan pipeline so all property data is pre-cached during wijk scans — no API calls needed when browsing the map or generating reports
**Depends on**: None
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, SCAN-07
**Success Criteria** (what must be TRUE):
  1. Energielabel (EP-Online) fetched and stored per VBO during scan
  2. WOZ waarde (Waardeloket) fetched and stored per nummeraanduiding during scan
  3. Vergunningen (SRU Bekendmakingen) fetched and stored per address during scan
  4. Bodem/bodemtype (Bodemloket + BRO WMS) fetched and stored per coordinate during scan
  5. Funderingsrisico (PDOK WFS) fetched and stored per postcode during scan
  6. All data accessible via existing parcel endpoints without additional API calls
  7. Scan duration remains reasonable (concurrency, batching)
**Plans**: 3 plans

Plans:
- [ ] 99-01-PLAN.md — Coordinate-based scan enrichment (bodem + BRO in Phase 3)
- [ ] 99-02-PLAN.md — Address-based scan enrichment (EP-Online + WOZ + SRU + funderingsrisico in Phase 5b)
- [ ] 99-03-PLAN.md — Backend flags-first endpoints + frontend types + hooks integration

### Phase 100: Score v3.0 Engine
**Goal**: Replace `compute_opportunity_score()` v2.1 with a dual-subscore model: Potentie (8 factoren, 80pt) + Risico (9 factoren, 67pt), each with template-based narratieven
**Depends on**: Phase 99
**Requirements**: SCORE-V3-01, SCORE-V3-02, SCORE-V3-03, SCORE-V3-04, SCORE-V3-05, SCORE-V3-06
**Success Criteria** (what must be TRUE):
  1. `potentie_score` (0-100) computed from: vrije grond (12), bestemming (12), perceelgrootte (12), vergunningssucceskans (13), optoppotentie (10), leegstand (8), demografie (8), Funda-frictie (5)
  2. `risico_score` (0-100) computed from: funderingsrisico (15), bestemmingswijziging (8), juridisch klimaat (8), constructieve staat (7), bodem (7), asbest (6), criminaliteit (6), monument (5), max hoogte bereikt (5)
  3. `overall` score = potentie - risico (normalized to 0-100)
  4. `score_breakdown` per factor includes: waarde, genormaliseerde_score, gewicht, bijdrage, categorie, toelichting_kort, toelichting_lang, data_bronnen
  5. Missing data: neutral score default, light penalty for critical risk factors, weight redistribution when >20% factors missing
  6. Template-based narratieven (no AI calls) — deterministic, instant text generation
**Plans**: 3 plans

Plans:
- [ ] 100-01-PLAN.md — Score v3.0 engine core: 17 factor functions + normalization + missing data + narratives + tests (TDD)
- [ ] 100-02-PLAN.md — Pipeline integration: reorder area_scan.py scoring to final phase, wire enrichment + wijk data
- [ ] 100-03-PLAN.md — Frontend type updates: ScanResultItem dual-score types, score.ts v3.0 utilities, PotentieLayer v3.0/v2.1 compat

### Phase 101: Score Backfill & Migration
**Goal**: Re-score all existing parcels with v3.0 engine and update frontend types
**Depends on**: Phase 100
**Success Criteria** (what must be TRUE):
  1. Backfill tool re-scores all parcels in all completed scans
  2. Frontend TypeScript types updated: ScanResultItem includes potentie_score, risico_score, expanded score_breakdown
  3. Existing tile endpoints serve new score data
  4. Old v2.1 score_breakdown gracefully handled (backwards compatible during migration)
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 101 to break down)



### Phase 94: Wijk & Gemeente Views
**Goal**: Selecting a wijk or gemeente delivers spatial context through fly-up bento sheets and luminous map overlays -- users explore areas without leaving the map
**Depends on**: Phase 92
**Requirements**: WIJK-01, WIJK-02, WIJK-03, WIJK-04, GEM-01, GEM-02
**Success Criteria** (what must be TRUE):
  1. Clicking a wijk triggers a bottom bento sheet (30-40% height) with fly-up animation and drag handle
  2. Wijk sheet shows 4-column bento layout (identity, bestemming bar, stats grid, kansen glow-cards)
  3. Selected wijk has an outer glow effect on the map
  4. Clicking a gemeente shows wijk boundaries with luminous white borders -- no bottom sheet needed
  5. Wijk pods support click-through to deeper data without scroll
**Plans**: TBD

Plans:
- [ ] 94-01: Bottom bento sheet + wijk 4-column layout
- [ ] 94-02: Gemeente map view + wijk glow + click-through

### Phase 95: Results Table
**Goal**: The /resultaten route feels like part of Aura while preserving all existing data table power
**Depends on**: Phase 91
**Requirements**: RES-01, RES-02
**Success Criteria** (what must be TRUE):
  1. /resultaten route renders with glass container, bento filter bar, Satoshi font, and rounded elements
  2. All existing TanStack Table functionality works unchanged (sorting, filtering, bulk export, pagination)
**Plans**: TBD

Plans:
- [ ] 95-01: Results table Aura reskin

### Phase 96: Jurisprudentie & Meldingen
**Goal**: Legal intelligence and meldingen views feel native to Aura -- glass panels, bento cards, pill badges throughout
**Depends on**: Phase 91
**Requirements**: JUR-01, JUR-02, MELD-01, MELD-02
**Success Criteria** (what must be TRUE):
  1. Jurisprudentie wizard uses glass panels, bento step indicators, and Satoshi font
  2. Explorer shows results in glass containers with bento cards and pill filters
  3. Meldingen feed uses bento cards with pill action-state badges
  4. Gemeente filter and infinite scroll still work in the meldingen feed
**Plans**: TBD

Plans:
- [ ] 96-01: Jurisprudentie wizard + explorer Aura reskin
- [ ] 96-02: Meldingen feed Aura reskin

### Phase 97: Settings
**Goal**: Settings page adopts Aura styling
**Depends on**: Phase 91
**Requirements**: SET-01
**Success Criteria** (what must be TRUE):
  1. Settings page shows Aura glass/bento styling on all existing sections (account, password, notifications, appearance)
**Plans**: TBD

Plans:
- [ ] 97-01: Settings Aura update

### Phase 103: Potentie & Risico Dashboard
**Goal**: No-scroll investor dashboards — Potentie tab shows all + factors (kansen, groei, headroom), Risico tab shows all - factors (funderingsrisico, asbest, juridisch klimaat). Score breakdown is transparent per factor.
**Depends on**: Phase 101 (v16.0)
**Success Criteria** (what must be TRUE):
  1. Potentie tab shows potentie_score + per-factor breakdown cards for all opportunity signals
  2. Risico tab shows risico_score + per-factor breakdown cards for all warning signals
  3. Each factor card shows contribution to subscore + toelichting_kort narrative
  4. No scroll needed on 1080p+ for either tab
  5. Score breakdown is transparent — user sees WHY each factor contributes what it does
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 103 to break down)

### Phase 104: Rapport v2.0
**Goal**: Rewrite rapport generation as pure template render on pre-cached scan data + score v3.0 narratieven — no on-demand API calls, no aggregate_property_data()
**Depends on**: Phase 101 (v16.0)
**Success Criteria** (what must be TRUE):
  1. "Genereer Rapport" assembles report from pre-cached scan data (no external API calls)
  2. Report includes all factor toelichting_lang narratieven as "Analyse" chapter
  3. Report includes potentie_score + risico_score with per-factor breakdown
  4. BRK ownership section fetched on-demand (Kadaster compliance) — only exception
  5. Report bento layout with Aura styling
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 104 to break down)

### Phase 105: BRK Eigendom Modal
**Goal**: Popup modal behind "pand in gebruik" button on parcel detail panel with fresh BRK ownership fetch
**Depends on**: Phase 93
**Success Criteria** (what must be TRUE):
  1. "Pand in gebruik" button on parcel detail opens modal
  2. Modal fetches BRK ownership data on-demand (no caching, Kadaster compliance)
  3. Modal displays eigenaar, zakelijk gerechtigden, erfpacht/eigendom type
  4. Loading state while BRK API responds
**Plans**: TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 105 to break down)

## Progress

**Execution Order:** v16.0 first (99 → 100 → 101), then v15.0 resumes (94-97 can parallelize, 103-105 depend on v16.0)

### v16.0 Score Intelligence

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 99. Scan Pipeline Enrichment | 3/3 | Complete   | 2026-03-10 |
| 100. Score v3.0 Engine | 2/3 | In Progress|  |
| 101. Score Backfill & Migration | 0/? | Not started | - |

### v15.0 Aura

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 91. Aura Design System Foundation | 2/2 | Complete | 2026-03-09 |
| 92. Viewport Layout & Navigation | 2/2 | Complete | 2026-03-10 |
| 93. Parcel Detail Panel | 3/3 | Complete | 2026-03-10 |
| 94. Wijk & Gemeente Views | 0/2 | Not started | - |
| 95. Results Table | 0/1 | Not started | - |
| 96. Jurisprudentie & Meldingen | 0/2 | Not started | - |
| 97. Settings | 0/1 | Not started | - |
| 103. Potentie & Risico Dashboard | 0/? | Blocked (v16.0) | - |
| 104. Rapport v2.0 | 0/? | Blocked (v16.0) | - |
| 105. BRK Eigendom Modal | 0/? | Not started | - |
| 98. Gemeente Bouwregels | 0/? | Not started | - |

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

- [x] Phase 82: Ruling Cache + ECLI Court Mapping (2/2 plans) -- persistent ruling storage with gemeente-to-rechtbank mapping
- [x] Phase 83: Geo-Contextualization + Gemeente Feed (2/2 plans) -- extract gemeente from ruling text, auto-populated feed
- [x] Phase 84: AI Analysis Upgrade + Doorlooptijd (2/2 plans) -- filtered AI analysis, vergunningstype classification, procedure duration
- [x] Phase 85: Explorer UI (2/2 plans) -- multi-filter search, pagination, progressive filtering
- [x] Phase 86: Trend & Statistics (2/2 plans) -- rolling klimaat score trends, CSS-only visualization

**10 plans, 5 phases**

</details>

<details>
<summary>✅ v12.0 Omgevings- & Leefbaarheids-Scorer (Phases 78-80) -- SHIPPED 2026-03-07</summary>

- [x] Phase 78: Extended CBS Demographics & Income (2/2 plans) -- age, household, income via OData v4
- [x] Phase 79: Voorzieningen Nabijheid (2/2 plans) -- facility proximity distances from CBS 86134NED
- [x] Phase 80: Criminaliteitsdata (2/2 plans) -- OData v3 crime statistics with color-coded indicators

**6 plans, 3 phases**
Phase 81 (Locatie Score Investeringsprofiel) deferred -- depends on all data sources being correct first.

</details>

<details>
<summary>✅ v11.0 Open Data Intelligence (Phases 75-77) -- SHIPPED 2026-03-07</summary>

- [x] Phase 75: CBS Wijkstatistieken (2/2 plans) -- WOZ, stedelijkheid, demographics via OData v4 client
- [x] Phase 76: Rechtspraak Jurisprudentie (2/2 plans) -- court ruling search + inline viewing with omgevingsrecht filter
- [x] Phase 76.1: Map Toggle State Machine (2/2 plans) -- useMapLayerState hook, controlled LayerToggle, stale closure fix
- [x] Phase 77: AI Juridisch Klimaat (2/2 plans) -- Claude per-ruling summaries, klimaat score, vergunnings-succeskans

**8 plans, 11 requirements, 23 commits, 55 files (+6,889/-613)**
**Archive:** `.planning/milestones/v11.0-ROADMAP.md`

</details>

<details>
<summary>✅ v10.0 UX Polish (Phases 72-74) -- SHIPPED 2026-03-03</summary>

- [x] Phase 72: Parcel Detail Panel Redesign (2/2 plans) -- replaced FAR/TAR pillars with Vrije ruimte, Beschikbaarheid, Transformatiepotentie
- [x] Phase 73: DSO Omgevingsplan Bouwregels (2/2 plans) -- max_bouwhoogte + max_bouwlagen from PLU WMS, DSO-path in deriveTransformatiePotentie
- [x] Phase 74: 3D BAG Building Data (3/3 plans) -- actual building height + floors from 3D BAG, headroom-based transformatiepotentie scoring

**7 plans**
**Archive:** `.planning/milestones/v10.0-ROADMAP.md`

</details>

<details>
<summary>✅ v9.0 Risk Intelligence (Phases 67-69) -- SHIPPED 2026-03-02</summary>

- [x] Phase 67: Wkb Classification Engine (2/2 plans) -- gevolgklasse determination, asbest risk indicator, verbouwing/monument exclusions
- [x] Phase 68: Bodemloket Integration (3/3 plans) -- soil contamination data at parcel level with spike-first discovery
- [x] Phase 69: Risicobeoordeling Dossier (2/2 plans) -- PDF generator aggregating all risk data into kwaliteitsborger intake document

**7 plans, 10 requirements**
**Archive:** `.planning/milestones/v9.0-ROADMAP.md`

</details>

<details>
<summary>✅ v8.0 Client Demo Readiness (Phases 62-66) -- SHIPPED 2026-03-02</summary>

- [x] Phase 62: Scan Pipeline Reliability (2/2 plans)
- [x] Phase 63: Venlo Data Completeness (2/2 plans)
- [x] Phase 64: Map Visualization (2/2 plans)
- [x] Phase 65: Report Polish (3/3 plans)
- [x] Phase 66: Results Table Noise Reduction (1/1 plan)

**10 plans, 8 requirements**

</details>

<details>
<summary>✅ v7.2 Developer Dossier Intelligence (Phases 59-61) -- SHIPPED 2026-02-27</summary>

- [x] Phase 59: Bouwruimte Delta (1/1 plan)
- [x] Phase 60: Wkb Startdossier Precheck (1/1 plan)
- [x] Phase 61: Vergunning Precedenten Benchmark (1/1 plan)

**3 plans, 3 requirements**
**Archive:** `.planning/milestones/v7.2-ROADMAP.md`

</details>

<details>
<summary>✅ v7.1 Workspace Productization (Phase 58) -- SHIPPED 2026-02-27</summary>

- [x] Phase 58: Workspace Productization (5/5 plans)

**5 plans**
**Archive:** `.planning/milestones/v7.1-ROADMAP.md`

</details>

<details>
<summary>✅ v7.05 Codebase Globalization (Phase 57) -- SHIPPED 2026-02-26</summary>

- [x] Phase 57: Codebase Globalization (4/4 plans)

</details>

<details>
<summary>✅ v7.0 Deep Property Data (Phases 52-56) -- SHIPPED 2026-02-25</summary>

- [x] Phase 52: Schema & Config Foundation (2/2 plans)
- [x] Phase 53: API Clients (3/3 plans)
- [x] Phase 54: BRK Wiring & No-Cache Enforcement (2/2 plans)
- [x] Phase 55: Aggregator Integration (2/2 plans)
- [x] Phase 56: Frontend Sections (3/3 plans)

**12 plans, 21 requirements**
**Archive:** `.planning/milestones/v7.0-ROADMAP.md`

</details>

<details>
<summary>✅ v6.0 Meldingen Intelligence (Phases 47-51) -- SHIPPED 2026-02-23</summary>

- [x] Phase 47: Address Intelligence (2/2 plans)
- [x] Phase 48: Parcel Matching (3/3 plans)
- [x] Phase 49: Read Tracking (2/2 plans)
- [x] Phase 50: Melding-to-Map Flow (1/1 plan)
- [x] Phase 51: Meldingen UX (2/2 plans)

**10 plans, 18 requirements**
**Archive:** `.planning/milestones/v6.0-ROADMAP.md`

</details>

<details>
<summary>✅ v5.1 Data Presentation Overhaul (Phases 42-46) -- SHIPPED 2026-02-22</summary>

- [x] Phase 42-46: 10 plans, 14 requirements, 5 phases

</details>

<details>
<summary>✅ v5.0 Scan Intelligence (Phases 37-41) -- SHIPPED 2026-02-20</summary>

- [x] Phase 37-41: 11 plans, 12 requirements, 51 commits

**Archive:** `.planning/milestones/v5.0-ROADMAP.md`

</details>

<details>
<summary>✅ v4.0 UX Redesign (Phases 27-36) -- SHIPPED 2026-02-18</summary>

- [x] Phase 27-36: 31 plans, 31 requirements, 129 commits, ~16,234 LOC

**Archive:** `.planning/milestones/v4.0-ROADMAP.md`

</details>

<details>
<summary>✅ v3.1 Smart Area Intelligence (Phases 22-26) -- SHIPPED 2026-02-15</summary>

- [x] Phase 22-26: 22 plans, 16 requirements

**Archive:** `.planning/milestones/v3.1-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Spatial Foundation (Phases 18-21) -- SHIPPED 2026-02-11</summary>

- [x] Phase 18-21: 20 plans, 14 requirements

**Archive:** `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Frontend (Phases 13-17) -- SHIPPED 2026-02-09</summary>

- [x] Phase 13-17: 24 plans, 9 requirements

**Archive:** `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Production Hardening (Phases 6-12) -- SHIPPED 2026-02-08</summary>

- [x] Phase 6-12: 19 plans, 15 requirements, 275 tests

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.0 Core Intelligence Engine (Phases 1-5) -- SHIPPED 2026-02-07</summary>

- [x] Phase 1-5: 17 plans, 14 requirements

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

</details>

---

*Last updated: 2026-03-11 -- v16.0 Score Intelligence milestone created, v15.0 paused*
