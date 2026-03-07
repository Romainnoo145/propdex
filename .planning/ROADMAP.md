# Propdex -- Roadmap

## Milestones

- 📋 **v13.0 Historisch Risicoprofiel** -- Phases TBD (planned)
- 🚧 **v12.0 Omgevings- & Leefbaarheids-Scorer** -- Phases 78-84 (in progress)
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

### 🚧 v12.0 Omgevings- & Leefbaarheids-Scorer (In Progress)

**Milestone Goal:** Transform Propdex from property-level "stenen en regels" intelligence into a platform that quantifies location-level commercial potential -- answering "Is het slim om hier te bouwen?" with data-driven context.

**Phase Numbering:**
- Integer phases (78, 79, 80, 81, 82, 83, 84): Planned milestone work
- Decimal phases (e.g., 77.1): Structural prerequisites (marked with INSERTED)

- [ ] **Phase 77.1: UX Architectuur & Component Refactor** *(INSERTED)* - Tabbed section containers, scorecard shell, ReportDetailPage decomposition (<300 LOC per file), progressive disclosure infrastructure
- [x] **Phase 78: Extended CBS Demographics & Income** - Extend existing CBS client with 14 new measure codes for age, household, income display and derived doelgroep classification (completed 2026-03-07)
- [x] **Phase 79: Voorzieningen Nabijheid** - CBS Nabijheid dataset (86134NED) integration for facility proximity distances per wijk (completed 2026-03-07)
- [ ] **Phase 80: Criminaliteitsdata** - OData v3 client for dataderden.cbs.nl crime statistics per wijk
- [ ] **Phase 81: Locatie-Score & Investeringsprofiel** - Weighted composite location score aggregating all prior data dimensions
- [ ] **Phase 82: SRU-Rechtspraak Correlatie** - Auto-link permit announcements to court cases by address/postcode for "was this permit challenged?" intelligence
- [ ] **Phase 83: Parcel-Level Juridisch Klimaat** - Surface jurisprudence scores in ParcelDetailModal and enrich permit_precedent_benchmark with court outcome data
- [ ] **Phase 84: Jurisprudentie Test Coverage** - Unit + integration tests for rechtspraak client, AI analysis, endpoints, and background jobs

## Phase Details

### Phase 77.1: UX Architectuur & Component Refactor *(INSERTED)*
**Goal**: Establish the hybrid scorecard + tabs UI structure and decompose oversized components so all subsequent v12.0/v13.0 data phases slot into a scalable, navigable layout instead of endless scrolling
**Depends on**: Nothing (structural prerequisite for all data phases)
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. WijkDetailView uses a tabbed layout with tabs: Overzicht | Demografie & Inkomen | Leefbaarheid | Juridisch | Rapporten
  2. WijkDetailView Overzicht tab contains a LocationScoreCard shell (empty/placeholder scores) with per-dimension traffic-light indicators that expand on click
  3. ParcelDetailModal uses collapsible sections grouped as: Overzicht | Bouwpotentie | Risico's (with Juridisch ready as future tab)
  4. WijkMapPanel uses the same tab structure as WijkDetailView (compact variant for side panel)
  5. All new containers accept child components via composition (slot pattern) so v12.0 data phases just drop in new cards
**Plans**: 2 plans

Plans:
- [ ] 77.1-01-PLAN.md — Primitives + ParcelDetailModal decomposition� Primitives + ParcelDetailModal decomposition
- [ ] 77.1-02-PLAN.md — WijkDetailView tabs + LocationScoreCard + WijkMapPanel� WijkDetailView tabs + LocationScoreCard + WijkMapPanel

### Phase 78: Extended CBS Demographics & Income
**Goal**: Users can assess neighborhood demographic profile and income dynamics to validate target audience fit for residential development
**Depends on**: Phase 77.1 (data cards slot into tabbed layout)
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06, DEMO-07
**Success Criteria** (what must be TRUE):
  1. Wijk detail view shows age distribution breakdown (0-14, 15-24, 25-44, 45-64, 65+) with visual bars or chart
  2. Wijk detail view shows household composition (eenpersoons, zonder kinderen, met kinderen) and average household size
  3. Wijk detail view shows income metrics (gemiddeld inkomen, inkomensverdeling percentages) and a WOZ/inkomen ratio indicator
  4. Wijk detail view shows a directional vergrijzing/verjonging indicator derived from age group proportions
  5. Wijk detail view shows a doelgroep classification label ("studentenwijk" / "gezinswijk" / "vergrijzend" / "gemengd") derived from demographic data
**Plans**: 2 plans

Plans:
- [ ] 78-01-PLAN.md — Extend CBS client with 14 measure codes + update TypeScript types
- [ ] 78-02-PLAN.md — Demographic card components + derived indicators in WijkDetailView

### Phase 79: Voorzieningen Nabijheid
**Goal**: Users can evaluate facility accessibility of a neighborhood to assess livability and attractiveness for residents
**Depends on**: Phase 78 (shared CBS client refactoring)
**Requirements**: VOORZ-01, VOORZ-02, VOORZ-03
**Success Criteria** (what must be TRUE):
  1. CBS Nabijheid client fetches proximity data from dataset 86134NED using the same OData v4 patterns as the existing CBS client
  2. Wijk detail view shows distances to supermarkt, huisarts, school, kinderdagverblijf, treinstation, and OV-halte
  3. Nabijheid data is persisted in the neighborhood_metrics JSONB column under the "nabijheid" key and survives page refreshes
**Plans**: 2 plans

Plans:
- [ ] 79-01-PLAN.md — CBS Nabijheid client (86134NED) + scan job integration
- [ ] 79-02-PLAN.md — NabijheidCard frontend component + WijkDetailView integration

### Phase 80: Criminaliteitsdata
**Goal**: Users can assess neighborhood safety levels to factor crime risk into investment decisions
**Depends on**: Nothing (independent track, can run parallel to Phase 79)
**Requirements**: CRIME-01, CRIME-02, CRIME-03
**Success Criteria** (what must be TRUE):
  1. OData v3 client successfully fetches crime data from dataderden.cbs.nl (47018NED) with rate limiting and retry handling
  2. Wijk detail view shows total misdrijven per 1000 inwoners plus category breakdown (vermogensdelicten, vernieling, geweld)
  3. Crime data is persisted in the neighborhood_metrics JSONB column under the "criminaliteit" key and survives page refreshes
**Plans**: 2 plans

Plans:
- [ ] 80-01: TBD
- [ ] 80-02: TBD

### Phase 81: Locatie-Score & Investeringsprofiel
**Goal**: Users can instantly evaluate investment attractiveness of a neighborhood via a single composite score with transparent sub-dimension breakdown
**Depends on**: Phase 78, Phase 79, Phase 80 (aggregates all data sources)
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04
**Success Criteria** (what must be TRUE):
  1. LocationScoreService computes a 0-10 investeerbaarheid score per wijk using percentile-rank normalization across all scanned wijken
  2. Score includes per-dimension breakdown (demografie, inkomen, voorzieningen, veiligheid) each with a confidence indicator reflecting data completeness
  3. Wijk detail view shows an investeringsprofiel card with traffic-light indicators (groen/oranje/rood) per dimension and composite score
  4. Location score is stored in a separate location_score JSONB column (via Alembic migration), independent from source data
**Plans**: 2 plans

Plans:
- [ ] 81-01: TBD
- [ ] 81-02: TBD

### Phase 82: SRU-Rechtspraak Correlatie
**Goal**: Automatically correlate permit announcements (SRU bekendmakingen) with court cases (Rechtspraak) so users see which nearby permits were legally challenged without manual searching
**Depends on**: Nothing (builds on existing SRU + Rechtspraak clients from v11.0)
**Requirements**: JURIS-01, JURIS-02, JURIS-03
**Success Criteria** (what must be TRUE):
  1. When a permit is found via SRU, the system automatically searches Rechtspraak for related court cases using address/postcode/zaaknummer correlation
  2. Correlated court cases are stored alongside permit data (in ChangeRecord or linked table) and survive page refreshes
  3. Wijk detail view shows a "Aangevochten vergunningen" indicator on permits that have associated court rulings
**Plans**: 2 plans

Plans:
- [ ] 82-01: TBD
- [ ] 82-02: TBD

### Phase 83: Parcel-Level Juridisch Klimaat
**Goal**: Surface legal climate intelligence at the parcel level (ParcelDetailModal) and enrich the permit precedent benchmark with court outcome data, enabling strategic acquisition decisions
**Depends on**: Phase 82 (needs correlation data)
**Requirements**: JURIS-04, JURIS-05, JURIS-06
**Success Criteria** (what must be TRUE):
  1. ParcelDetailModal shows a juridisch klimaat summary card with the wijk-level score + any parcel-specific court case references
  2. permit_precedent_benchmark incorporates court ruling outcomes to compute a "juridisch risico" indicator per building type per gemeente
  3. Per-building-type risk flags appear when court data shows consistent rejection patterns (e.g., "dakopbouwen in deze wijk: hoog bezwaarrisico")
**Plans**: 2 plans

Plans:
- [ ] 83-01: TBD
- [ ] 83-02: TBD

### Phase 84: Jurisprudentie Test Coverage
**Goal**: Achieve production-grade test coverage for the entire jurisprudence pipeline (currently 0 tests)
**Depends on**: Phase 83 (tests cover all jurisprudence features including new ones)
**Requirements**: JURIS-07
**Success Criteria** (what must be TRUE):
  1. Unit tests cover RechtspraakClient (search, document fetch, ECLI validation, XML parsing edge cases)
  2. Integration tests cover all 4 jurisprudence API endpoints (search, doc, analyze trigger, analyze poll) with tenant isolation verification
  3. Job tests cover jurisprudence_analysis_job (happy path, partial failures, cache hit/miss, error handling)
  4. AI analysis tests cover Claude prompt construction, response parsing, and score computation
**Plans**: 2 plans

Plans:
- [ ] 84-01: TBD
- [ ] 84-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 77.1 -> 78 -> 79 -> 80 -> 81 -> 82 -> 83 -> 84

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 77.1 UX Architectuur & Component Refactor | 0/? | Not started | - |
| 78. Extended CBS Demographics & Income | 2/2 | Complete    | 2026-03-07 |
| 79. Voorzieningen Nabijheid | 2/2 | Complete   | 2026-03-07 |
| 80. Criminaliteitsdata | 0/? | Not started | - |
| 81. Locatie-Score & Investeringsprofiel | 0/? | Not started | - |
| 82. SRU-Rechtspraak Correlatie | 0/? | Not started | - |
| 83. Parcel-Level Juridisch Klimaat | 0/? | Not started | - |
| 84. Jurisprudentie Test Coverage | 0/? | Not started | - |

---

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

- [x] Phase 62: Scan Pipeline Reliability (2/2 plans) -- BAG WFS retry + coverage validation + force-all backfill
- [x] Phase 63: Venlo Data Completeness (2/2 plans) -- 21-wijk re-scan, 108,789 parcels, 100% coverage
- [x] Phase 64: Map Visualization (2/2 plans) -- BAG footprints layer, grey-to-green gradient, progressive labels
- [x] Phase 65: Report Polish (3/3 plans) -- section reorder, empty states, @media print PDF, ActieVereistSection
- [x] Phase 66: Results Table Noise Reduction (1/1 plan) -- score threshold filter, nulls_last sort, top-kansen toggle

**10 plans, 8 requirements**

</details>

<details>
<summary>✅ v7.2 Developer Dossier Intelligence (Phases 59-61) -- SHIPPED 2026-02-27</summary>

- [x] Phase 59: Bouwruimte Delta (1/1 plan) -- buildability envelope per perceel, confidence, missing-data reasons
- [x] Phase 60: Wkb Startdossier Precheck (1/1 plan) -- Layer A auto-precheck, Layer B optional refinement contract
- [x] Phase 61: Vergunning Precedenten Benchmark (1/1 plan) -- municipality-level precedent outcomes and expected timelines

**3 plans, 3 requirements, 3 commits**
**Archive:** `.planning/milestones/v7.2-ROADMAP.md`

</details>

<details>
<summary>✅ v7.1 Workspace Productization (Phase 58) -- SHIPPED 2026-02-27</summary>

- [x] Phase 58: Workspace Productization (5/5 plans) -- role-aware shell, URL-state hardening, operational UX, canonical parcel flow, monitoring handoff

**5 plans**
**Archive:** `.planning/milestones/v7.1-ROADMAP.md`

</details>

<details>
<summary>✅ v7.05 Codebase Globalization (Phase 57) -- SHIPPED 2026-02-26</summary>

- [x] Phase 57: Codebase Globalization (4/4 plans) -- shared geo/map helpers, metric/search primitives, GeoJSON/stats hooks, anti-regression checks

</details>

<details>
<summary>✅ v7.0 Deep Property Data (Phases 52-56) -- SHIPPED 2026-02-25</summary>

- [x] Phase 52: Schema & Config Foundation (2/2 plans) -- Pydantic models, PropertyReportResponse extension, cache TTL entries
- [x] Phase 53: API Clients (3/3 plans) -- EP-Online V5, WOZ Waardeloket, RCE Linked Data, rate limiters + tests
- [x] Phase 54: BRK Wiring & No-Cache Enforcement (2/2 plans) -- BRK aggregator wiring, never-cache constraint, integration tests
- [x] Phase 55: Aggregator Integration (2/2 plans) -- EP-Online + WOZ + RCE in parallel gather, completeness score 6->9
- [x] Phase 56: Frontend Sections (3/3 plans) -- EnergieLabelSection, WOZSection, EigendomSection, enhanced MonumentSection

**12 plans, 21 requirements**
**Archive:** `.planning/milestones/v7.0-ROADMAP.md`

</details>

<details>
<summary>✅ v6.0 Meldingen Intelligence (Phases 47-51) -- SHIPPED 2026-02-23</summary>

- [x] Phase 47: Address Intelligence (2/2 plans) -- multi-strategy Dutch address extraction, category classification
- [x] Phase 48: Parcel Matching (3/3 plans) -- PDOK geocoding, PostGIS spatial lookup, post-scan retro-matching
- [x] Phase 49: Read Tracking (2/2 plans) -- ChangeReadState model, server-backed per-change read/unread
- [x] Phase 50: Melding-to-Map Flow (1/1 plan) -- matched_parcel_id wired through frontend for three-click workflow
- [x] Phase 51: Meldingen UX (2/2 plans) -- gemeente filter, action state badges, infinite scroll pagination

**10 plans, 18 requirements, 39 commits, 56 files changed (+8,818/-292)**
**Archive:** `.planning/milestones/v6.0-ROADMAP.md`

</details>

<details>
<summary>✅ v5.1 Data Presentation Overhaul (Phases 42-46) -- SHIPPED 2026-02-22</summary>

- [x] Phase 42: Theme Consistency (2/2 plans) -- on-accent token, FOUC prevention, semantic token sweep
- [x] Phase 43: Gemeente Card Navigation (2/2 plans) -- SVG boundary silhouettes, GeoJSON projection, card grid
- [x] Phase 44: Wijk Cards and Drill-Down (2/2 plans) -- WijkCard, WijkCardGrid, gemeente->wijk navigation
- [x] Phase 45: URL State + Gemeente Detail View (2/2 plans) -- validateSearch, DrilldownBreadcrumb, GemeenteDetailView
- [x] Phase 46: Wijk Detail View (2/2 plans) -- scan summary, ChangeTimeline, report list, 3-level breadcrumb

**10 plans, 14 requirements, 5 phases**

</details>

<details>
<summary>✅ v5.0 Scan Intelligence (Phases 37-41) -- SHIPPED 2026-02-20</summary>

- [x] Phase 37: Scan History Backend (2/2 plans) -- Paginated scan list API, project sub-resource endpoint
- [x] Phase 38: Scan History Frontend (2/2 plans) -- Real scan data in Projecten, navigation to results/map
- [x] Phase 39: Map Parcel Visualization (2/2 plans) -- Scanned wijk amber overlay, score layer toggle
- [x] Phase 40: Report Integration (2/2 plans) -- POST /from-parcel endpoint, "Genereer rapport" button
- [x] Phase 41: Bug Fixes & Hardening (3/3 plans) -- Auth test cookie fix, ARQ idempotency, tech debt cleanup

**11 plans, 12 requirements, 51 commits, 65 files changed (+9,264/-2,326)**
**Archive:** `.planning/milestones/v5.0-ROADMAP.md`

</details>

<details>
<summary>✅ v4.0 UX Redesign (Phases 27-36) -- SHIPPED 2026-02-18</summary>

- [x] Phase 27: Design System Foundation (3/3 plans) -- Industrial Amber tokens, UI primitives, Storybook
- [x] Phase 28: Navigation + Persistent MapView (2/2 plans) -- SideRailNav, MapContext, InspectorPanel
- [x] Phase 29: Silver Map Theme + Layout Shells (2/2 plans) -- Silver raster map, MapShell/ResultsShell
- [x] Phase 30: View Separation (2/2 plans) -- /resultaten route, scan_id URL bridge
- [x] Phase 31: Component Migration (4/4 plans) -- 40+ components from glassmorphism to Industrial Amber
- [x] Phase 32: Feedback Systems (3/3 plans) -- Skeleton, EmptyState, ErrorState, toast, scan stepper
- [x] Phase 33: Data Table Polish (4/4 plans) -- URL filters, multi-sort, bulk export, category groups, hover sync
- [x] Phase 34: Mobile Responsiveness (4/4 plans) -- BottomTabNav, bottom sheet, card layout, touch targets
- [x] Phase 35: Settings Page (3/3 plans) -- Users API, preferences JSONB, 4 settings sections
- [x] Phase 36: Polish + Performance (4/4 plans) -- Bundle splitting, CSS cleanup, mobile blur disable, Storybook stories

**31 plans, 31 requirements, 129 commits, ~16,234 LOC TypeScript/React**
**Archive:** `.planning/milestones/v4.0-ROADMAP.md`

</details>

<details>
<summary>✅ v3.1 Smart Area Intelligence (Phases 22-26) -- SHIPPED 2026-02-15</summary>

- [x] Phase 22: Bestemmingsplan Base Layer (3/3 plans) -- WMS raster tiles, SVBP2012 colors, GetFeatureInfo popup, legend
- [x] Phase 23: Working Scan Pipeline (4/4 plans) -- BAG WFS pagination, WMS enrichment, CBS bbox, scoring fixes
- [x] Phase 24: Wijk-Based Area Selection (4/4 plans) -- CBS wijk WFS, gemeente context, click-to-scan, viewport button
- [x] Phase 25: Results Interface (5/5 plans) -- Split-panel, TanStack Table, filters, map-table linking, detail modal
- [x] Phase 26: Change Monitoring (6/6 plans) -- Hierarchical projects, SRU+PLU detection, ARQ cron, notification UI

**22 plans, 16 requirements, 97 commits, ~27,200 LOC (13,756 Python + 13,444 TypeScript)**
**Archive:** `.planning/milestones/v3.1-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Spatial Foundation (Phases 18-21) -- SHIPPED 2026-02-11</summary>

- [x] Phase 18: Spatial Foundation (4/4 plans) -- PostGIS, parcel cache, spatial queries, RLS
- [x] Phase 19: Government API Clients (5/5 plans) -- BAG WFS, SRU Bekendmakingen, BRK Bevragen, rate limiting
- [x] Phase 20: Area Scanner + REST API (6/6 plans) -- Scan pipeline, ARQ job, scoring, Excel export
- [x] Phase 21: Map Visualization (5/5 plans) -- CBS gemeente layer, vector tiles, MVT endpoint, scan progress overlay

**20 plans, 14 requirements, PostGIS + government API clients + scan pipeline + map visualization**
**Archive:** `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Frontend (Phases 13-17) -- SHIPPED 2026-02-09</summary>

- [x] Phase 13: Map Foundation & Layout (3/3 plans) -- React/Vite scaffold, full-page MapLibre map, layer toggle
- [x] Phase 14: Authentication & Security (5/5 plans) -- JWT httpOnly cookies, silent refresh, protected routes
- [x] Phase 15: Property Data & Map Interactions (5/5 plans) -- Address search, property lookup, parcel boundaries
- [x] Phase 16: Property Details & Reports (7/7 plans) -- Three-tier disclosure, report sidebar, PDF export
- [x] Phase 17: Projects & Polish (4/4 plans) -- Project CRUD, responsive drawer, force refresh, report detail page

**24 plans, 9 requirements, 8,804 LOC TypeScript/React**
**Archive:** `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Production Hardening (Phases 6-12) -- SHIPPED 2026-02-08</summary>

- [x] Phase 6: Security & Configuration (3/3 plans) -- RLS enforcement, config consolidation, per-org freshness
- [x] Phase 7: Test Infrastructure & Auth Testing (2/2 plans) -- test framework, 51 auth tests, Phase 1 verification
- [x] Phase 8: Data Pipeline Testing (2/2 plans) -- 55 API client + 20 cache manager tests
- [x] Phase 9: Intelligence Testing (3/3 plans) -- 43 aggregator + 14 AI + 9 integration + 3 ARQ tests
- [x] Phase 10: Report & Multi-Tenant Testing (3/3 plans) -- 15 report CRUD + 9 PDF + 9 multi-tenant tests
- [x] Phase 11: Coverage Gap Closure (4/4 plans) -- 42 tests closing audit-identified gaps
- [x] Phase 12: Phase Documentation & Verification (2/2 plans) -- retroactive VERIFICATION.md for all phases

**19 plans, 15 requirements, 275 tests, 15,947 LOC Python**
**Archive:** `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.0 Core Intelligence Engine (Phases 1-5) -- SHIPPED 2026-02-07</summary>

- [x] Phase 1: Foundation & Authentication (3/3 plans) -- JWT auth, multi-tenant RLS, email verification, Google OAuth, rate limiting
- [x] Phase 2: Core Data Pipeline (3/3 plans) -- httpx client, JSONB cache, BAG/PDOK APIs, property aggregator
- [x] Phase 3: Zoning & Monument Intelligence (4/4 plans) -- DSO zoning, RCE monuments, spatial intersection, PropertyReportResponse
- [x] Phase 4: AI Document Parsing (4/4 plans) -- Claude PDF parsing, ARQ worker, job polling, upload fallback
- [x] Phase 5: Report Management (3/3 plans) -- Save/list/search, project folders, PDF export, freshness detection

**17 plans, 14 requirements, 8,281 LOC Python**
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

</details>

---

### 📋 v13.0 Historisch Risicoprofiel (Planned)

**Milestone Goal:** Ontsluiten van historische bouw-, funderings- en asbestdata zodat gebruikers "door de muren en onder de grond" kunnen kijken — verborgen kostenposten zichtbaar maken vóór aankoop.

**Key Capabilities:**
1. **Funderingsrisico** — Archieven.nl / Nationaal Archief koppeling voor historisch funderingstype (houten palen vs beton), KCAF funderingsrisicokaarten
2. **Verfijnde asbestdetectie** — Historische verbouwingsvergunningen scannen (jaren '60-'70 renovaties), AI-analyse van vergunningteksten voor asbest-indicatoren voorbij puur bouwjaar
3. **Historische bouwtekeningen** — OAI-PMH metadata harvesting, directe links naar hi-res scans (JPG/PDF) uit stadsarchieven als bewijslast
4. **Monumentale deelprotectie** — RCE redengevende omschrijving AI-parsing om te bepalen welke specifieke delen beschermd zijn (schouw, balken, gevel)

**Research Flags:**
- API-dekking per gemeente valideren (Amsterdam Stadsarchief vs kleinere gemeenten)
- KCAF data beschikbaarheid en licentie checken
- OCR-kwaliteit van historische handschriften testen
- OAI-PMH protocol compatibiliteit per archiefinstelling

**Phases:** TBD — defined during `/gsd:new-milestone` after v12.0 ships

---

*Last updated: 2026-03-07 -- Phase 77.1 UX architecture inserted, v13.0 planned, v12.0 extended with jurisprudentie phases 82-84*
