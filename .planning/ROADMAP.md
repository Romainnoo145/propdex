# Propdex -- Roadmap

## Milestones

- 🚧 **v13.0 Juridisch Klimaat Intelligence** -- Phases 82-86 (in progress)
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

### 🚧 v13.0 Juridisch Klimaat Intelligence (In Progress)

**Milestone Goal:** Make jurisprudentie actually useful for vastgoedontwikkelaars -- from random search dump to a real due diligence tool that answers "wat is het juridisch klimaat voor vergunningen in deze gemeente?" with location-matched, filterable court rulings.

**Phase Numbering:**
- Integer phases (82-86): Planned milestone work
- Decimal phases (e.g., 82.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 82: Ruling Cache + ECLI Court Mapping** - Persistent ruling storage with gemeente-to-rechtbank mapping and ECLI-scoped ingestion pipeline (completed 2026-03-07)
- [x] **Phase 83: Geo-Contextualization + Gemeente Feed** - Extract gemeente from ruling text and expose auto-populated chronological feed per gemeente (completed 2026-03-07)
- [ ] **Phase 84: AI Analysis Upgrade + Doorlooptijd** - Filtered AI analysis on location-relevant rulings with vergunningstype classification and procedure duration calculation
- [ ] **Phase 85: Explorer UI** - Two-tab layout with multi-filter search, pagination, and progressive filtering
- [ ] **Phase 86: Trend & Statistics** - Rolling klimaat score trends and aggregated statistics with CSS-only visualization

## Phase Details

### Phase 82: Ruling Cache + ECLI Court Mapping
**Goal**: Court rulings are persistently cached with correct geographic scoping so all downstream features operate on relevant, local data instead of garbage national results
**Depends on**: Nothing (foundation for all v13.0 work)
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06
**Success Criteria** (what must be TRUE):
  1. Opening a gemeente detail view triggers background ingestion of 50+ court rulings for the relevant arrondissement, visible as cached results on subsequent page loads
  2. Cached rulings persist across sessions in a dedicated ruling_cache table with ECLI as primary key (not in generic cached_api_responses)
  3. Repeated views of the same gemeente load rulings from cache instantly (no Rechtspraak API calls) within the 7-day TTL window
  4. RechtspraakClient scopes search results to the correct court region using ECLI court-code prefix filtering, not national free-text search
  5. Date range filtering works -- user can restrict results to last 2, 5, or 10 years
**Plans:** 2/2 plans complete

Plans:
- [x] 82-01: EcliRegistry + RulingCache model + Alembic migration
- [x] 82-02: RechtspraakClient refactor + ARQ ingestion job

### Phase 83: Geo-Contextualization + Gemeente Feed
**Goal**: Users see an auto-populated chronological feed of court rulings relevant to their gemeente, with rulings sorted by geographic relevance (gemeente-matched first, then arrondissement-level)
**Depends on**: Phase 82 (requires cached rulings to extract location from)
**Requirements**: GEO-01, GEO-02, GEO-03, GEO-04, FEED-01, FEED-02, FEED-03
**Success Criteria** (what must be TRUE):
  1. Gemeente detail view shows a chronological list of court rulings without requiring manual search -- the feed auto-populates based on the selected gemeente
  2. Rulings mentioning the specific gemeente (extracted from ruling text) appear above arrondissement-level rulings
  3. RVS (Raad van State) rulings are geo-tagged via text extraction and appear in relevant gemeente feeds despite having no geographic ECLI indicator
  4. Win/loss ratio is displayed as aggregate outcome percentages (toegewezen/afgewezen/gedeeltelijk) at the top of the feed
**Plans:** 2/2 plans complete

Plans:
- [ ] 83-01-PLAN.md -- GeoContextualizer service + RulingCache migration + ingestion integration
- [ ] 83-02-PLAN.md -- Feed endpoint with geo-relevance sorting + frontend feed rewrite

### Phase 84: AI Analysis Upgrade + Doorlooptijd
**Goal**: AI analysis produces meaningful juridisch klimaat scores because it operates on filtered, location-relevant rulings with vergunningstype classification, and users can see average procedure durations per gemeente
**Depends on**: Phase 83 (requires geo-contextualized, location-relevant rulings as AI input)
**Requirements**: AI-01, AI-02, AI-03, AI-04, DOOR-01, DOOR-02, DOOR-03
**Success Criteria** (what must be TRUE):
  1. AI analysis runs only on rulings that are geo-matched to the selected gemeente or arrondissement -- never on unfiltered national results
  2. Each ruling gets a vergunningstype classification (dakopbouw, nieuwbouw, bestemmingswijziging, etc.) visible as a label
  3. Changing filters does not trigger re-analysis of previously analyzed rulings (per-ruling caching, not per-batch)
  4. Average doorlooptijd per gemeente per vergunningstype is displayed as a statistic, with "onvoldoende data" shown when filing dates are unavailable
**Plans**: TBD

Plans:
- [ ] 84-01: Enhanced AI analysis with per-ruling caching + vergunningstype extraction
- [ ] 84-02: DoorlooptijdService + doorlooptijd display

### Phase 85: Explorer UI
**Goal**: Users can filter and explore court rulings across multiple dimensions (scope, vergunningstype, uitkomst, tijdsperiode) with a responsive interface that prevents empty-result frustration
**Depends on**: Phase 84 (needs vergunningstype classification and doorlooptijd data for filter dimensions)
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05
**Success Criteria** (what must be TRUE):
  1. Jurisprudentie section has two tabs: Overzicht (chronological feed from Phase 83) and Explorer (multi-filter search)
  2. Explorer shows a filter sidebar with scope, vergunningstype, uitkomst, and tijdsperiode filters, each showing result counts before applying
  3. Large result sets paginate smoothly via infinite scroll (useInfiniteQuery pattern)
  4. When results are fewer than 3, the UI suggests broadening the search ("Verbreed uw zoekopdracht" with actionable suggestions)
**Plans**: TBD

Plans:
- [ ] 85-01: Two-tab layout + filter sidebar with counts
- [ ] 85-02: Pagination + empty state suggestions

### Phase 86: Trend & Statistics
**Goal**: Users can assess how the juridisch klimaat in a gemeente has evolved over time and see aggregated key statistics at a glance
**Depends on**: Phase 85 (UI structure for displaying trends alongside feed/explorer)
**Requirements**: TREND-01, TREND-02, TREND-03
**Success Criteria** (what must be TRUE):
  1. A rolling 12-month klimaat score trend is visible per gemeente showing whether conditions are improving or deteriorating
  2. An aggregated statistics bar shows totaal uitspraken, gemiddelde doorlooptijd, and succespercentage
  3. Trend visualization renders as CSS-only timeline (no chart library dependency) and degrades gracefully with fewer than 3 data points
**Plans**: TBD

Plans:
- [ ] 86-01: Trend calculation + statistics aggregation endpoint
- [ ] 86-02: CSS-only timeline + statistics bar frontend

## Progress

**Execution Order:**
Phases execute in numeric order: 82 -> 83 -> 84 -> 85 -> 86

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 82. Ruling Cache + ECLI Court Mapping | 2/2 | Complete    | 2026-03-07 |
| 83. Geo-Contextualization + Gemeente Feed | 2/2 | Complete    | 2026-03-07 |
| 84. AI Analysis Upgrade + Doorlooptijd | 0/2 | Not started | - |
| 85. Explorer UI | 0/2 | Not started | - |
| 86. Trend & Statistics | 0/2 | Not started | - |

---

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

*Last updated: 2026-03-07 -- Phase 83 plans created*
