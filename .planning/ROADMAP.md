# Propdex -- Roadmap

## Milestones

- [ ] **v15.0 Aura** -- Phases 91-97 (in progress)
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

### v15.0 Aura (Phases 91-97)

- [x] **Phase 91: Aura Design System Foundation** - Tokens, font, glass primitives, micro-interactions, remove dark mode, performance fallbacks (completed 2026-03-09)
- [x] **Phase 92: Viewport Layout & Navigation** - Full-bleed map, floating SideRailNav, search pill, filter/toggle dock (completed 2026-03-09)
- [ ] **Phase 93: Parcel Detail Panel** - Floating right panel with satellite crop hero, bento stats, click-through layers, aerial crop API
- [ ] **Phase 94: Wijk & Gemeente Views** - Bottom bento sheet, 4-column layout, wijk glow, gemeente wijk boundaries
- [ ] **Phase 95: Results Table** - /resultaten Aura treatment preserving TanStack Table functionality
- [ ] **Phase 96: Jurisprudentie & Meldingen** - Wizard, explorer, and feed redesigned in Aura style
- [ ] **Phase 97: Reports & Settings** - Report bento layout, settings Aura update

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
**Goal**: The map owns the entire viewport and all navigation floats on top -- users feel like they are looking at a living map with glass controls
**Depends on**: Phase 91
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. Map fills 100% of the browser viewport with no page-level scroll bars
  2. SideRailNav floats on the left (80px, rounded-[40px], glass blur) with logo, functional icons, and profile/settings at bottom
  3. Search pill sits top-left with PDOK autocomplete working as before
  4. Filter/toggle chips dock at top-center and control gemeente/perceel/layer toggles
**Plans**: 2 plans

Plans:
- [ ] 92-01-PLAN.md -- Viewport-locked layout + floating glass SideRailNav + non-map content offset
- [ ] 92-02-PLAN.md -- Search pill glass styling + top-center filter dock + legend reposition

### Phase 93: Parcel Detail Panel
**Goal**: Clicking a parcel opens a floating glass panel that tells the full property story through visual bento pods and click-through layers -- zero scroll
**Depends on**: Phase 92
**Requirements**: PRC-01, PRC-02, PRC-03, PRC-04, PRC-05, PRC-06, PRC-07, API-01
**Success Criteria** (what must be TRUE):
  1. Clicking a parcel opens a floating right panel with a satellite crop hero image and score badge overlay
  2. Primary stats (oppervlakte, bouwjaar, status, gemeente) appear as a 4-pod bento grid without scrolling
  3. Bestemming shows as a wide horizontal status bar with soft color fill
  4. Clicking any bento pod opens a detail layer replacing the current view (17+ data sections accessible)
  5. "Genereer Rapport" button is always visible pinned at the bottom of the panel
**Plans**: TBD

Plans:
- [ ] 93-01: Backend aerial crop API endpoint
- [ ] 93-02: Floating panel shell + hero + bento stats
- [ ] 93-03: Click-through layers + vergunningen accordion + rapport button

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

### Phase 97: Reports & Settings
**Goal**: The last two views adopt Aura styling -- every page in the app now speaks the same visual language
**Depends on**: Phase 91
**Requirements**: RPT-01, SET-01
**Success Criteria** (what must be TRUE):
  1. Report detail page uses bento layout with click-through sections instead of a scrollable list
  2. Settings page shows Aura glass/bento styling on all existing sections (account, password, notifications, appearance)
**Plans**: TBD

Plans:
- [ ] 97-01: Report bento layout + settings Aura update

## Progress

**Execution Order:** 91 -> 92 -> 93 (depends on 92), 94 (depends on 92), 95-97 (depend on 91, can parallelize after 92)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 91. Aura Design System Foundation | 2/2 | Complete    | 2026-03-09 |
| 92. Viewport Layout & Navigation | 2/2 | Complete    | 2026-03-09 |
| 93. Parcel Detail Panel | 0/3 | Not started | - |
| 94. Wijk & Gemeente Views | 0/2 | Not started | - |
| 95. Results Table | 0/1 | Not started | - |
| 96. Jurisprudentie & Meldingen | 0/2 | Not started | - |
| 97. Reports & Settings | 0/1 | Not started | - |

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

*Last updated: 2026-03-10 -- v15.0 Aura roadmap created*
