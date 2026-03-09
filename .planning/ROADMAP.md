# Propdex -- Roadmap

## Milestones

- 🚧 **v14.0 Fysiek Risicoprofiel** -- Phases 87-90 (in progress)
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

### 🚧 v14.0 Fysiek Risicoprofiel (In Progress)

**Milestone Goal:** Per-parcel physical risk assessment -- foundation risk, asbestos exposure, and soil classification -- so developers can see hidden structural costs before spending a cent on acquisition.

**Phase Numbering:**
- Integer phases (87-90): Planned milestone work
- Decimal phases (e.g., 87.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 87: Soil Data Integration** - BRO Bodemkaart WMS client + PDOK Funderingsrisicogebieden WFS client with soil code classification and JSONB caching (completed 2026-03-09)
- [ ] **Phase 88: Foundation Risk Engine** - Bouwjaar x bodemtype heuristic, combined Fysiek Risicoprofiel schema, KCAF cost ranges, aggregator wiring
- [ ] **Phase 89: Asbestos v2 Refinement** - BAG gebruiksdoel-aware asbestos risk with additive-only logic
- [ ] **Phase 90: Frontend Fysiek Risicoprofiel** - ParcelDetailModal risk section, amber confidence badges, area scan tile coloring

## Phase Details

### Phase 87: Soil Data Integration
**Goal**: User can see soil type and foundation risk area context for any parcel location
**Depends on**: Nothing (first phase)
**Requirements**: BODEM-01, BODEM-02
**Success Criteria** (what must be TRUE):
  1. User sees soil type classification (klei/veen/zand/leem/onbekend) when viewing any parcel detail
  2. User sees PDOK funderingsrisicogebied context (percentage pre-1970 buildings, soil region, risk label) for the parcel's postal code area
  3. Soil data is cached in JSONB with 365-day TTL so repeat lookups are instant
  4. Parcels in areas with no BRO coverage show "onbekend" with explanation, never an error
**Plans**: 1 plan
Plans:
- [ ] 87-01-PLAN.md — BRO Bodemkaart WMS + PDOK Funderingsrisico WFS clients, soil classifier, aggregators, PropertyReportResponse wiring

### Phase 88: Foundation Risk Engine
**Goal**: User sees a foundation risk rating with cost indication derived from building age, soil type, and area context
**Depends on**: Phase 87
**Requirements**: FUND-01, FUND-02, FUND-03
**Success Criteria** (what must be TRUE):
  1. User sees foundation risk rating (HOOG/MIDDEL/LAAG/ONBEKEND) derived from bouwjaar x bodemtype heuristic with transparent derivation text
  2. User sees combined Fysiek Risicoprofiel summary that aggregates foundation, soil, asbestos, and contamination signals into one assessment
  3. User sees KCAF reference cost range for foundation repair based on pand footprint and risk level, with prominent "indicatief" disclaimer
  4. PropertyReportResponse includes FysiekRisicoProfiel field populated via asyncio.gather alongside existing API calls
**Plans**: 1 plan
Plans:
- [ ] 88-01-PLAN.md — Foundation risk engine pure functions, KCAF cost ranges, FysiekRisicoProfiel schema, aggregator wiring

### Phase 89: Asbestos v2 Refinement
**Goal**: Asbestos risk assessment accounts for building function so industrial/educational buildings get appropriately higher risk
**Depends on**: Phase 87 (uses soil context as additive signal)
**Requirements**: ASBT-01, ASBT-02
**Success Criteria** (what must be TRUE):
  1. User sees refined asbestos risk that is higher for buildings with industrial or educational BAG gebruiksdoel
  2. Asbestos risk never drops below the bouwjaar-only baseline -- gebruiksdoel is additive only
  3. Asbestos explanation text includes the gebruiksdoel factor when it contributed to the assessment
**Plans**: 1 plan
Plans:
- [ ] 89-01-PLAN.md — Asbestos v2 with BAG gebruiksdoel-aware risk logic

### Phase 90: Frontend Fysiek Risicoprofiel
**Goal**: User sees all physical risk data in a cohesive section in ParcelDetailModal with appropriate confidence indicators
**Depends on**: Phase 87, Phase 88, Phase 89
**Requirements**: FRNT-01, FRNT-02, FRNT-03
**Success Criteria** (what must be TRUE):
  1. User sees Fysiek Risicoprofiel section in ParcelDetailModal with sub-cards for bodem, fundering, asbest, and verontreiniging
  2. All risk indicators display amber confidence badges with source attribution and "indicatief" disclaimers -- never red/definitive
  3. Area scan map tiles color parcels by foundation risk level alongside the existing opportunity score
  4. Risk derivation is transparent -- user can see why a rating was assigned (e.g., "Bouwjaar 1952 + kleigrond = mogelijk houten paalfundering")
**Plans**: 1 plan
Plans:
- [ ] 90-01-PLAN.md — Frontend Fysiek Risicoprofiel section, amber badges, tile coloring

## Progress

**Execution Order:**
Phases execute in numeric order: 87 -> 88 -> 89 -> 90

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 87. Soil Data Integration | 1/1 | Complete    | 2026-03-09 |
| 88. Foundation Risk Engine | 0/TBD | Not started | - |
| 89. Asbestos v2 Refinement | 0/TBD | Not started | - |
| 90. Frontend Fysiek Risicoprofiel | 0/TBD | Not started | - |

---

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

*Last updated: 2026-03-09 -- v14.0 Fysiek Risicoprofiel roadmap created*
