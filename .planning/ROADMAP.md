# Propdex -- Roadmap

## Milestones

- 📋 **v9.0 Professional Marketplace** -- Phases 67-71 (planned)
- 🚧 **v8.0 Client Demo Readiness** -- Phases 62-66 (in progress)
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

### v8.0 Client Demo Readiness (Phases 62-66)

**Milestone Goal:** Make Venlo the showcase gemeente with complete, correct scan data and polished presentation across map, reports, and results — ready for client PVP demonstration.

- [x] **Phase 62: Scan Pipeline Reliability** — Fix silent BAG WFS failure, add coverage validation, enable --force-all backfill (completed 2026-02-28)
- [ ] **Phase 63: Venlo Data Completeness** — Re-run all 21 Venlo wijken, validate bouwjaar + address + pand_status coverage
- [ ] **Phase 64: Map Visualization** — BAG building footprints layer, accurate score colors, map clarity improvements
- [ ] **Phase 65: Report Polish** — Layout refinement, v7.x section rendering, PDF export audit, Actie vereist section
- [ ] **Phase 66: Results Table Noise Reduction** — Filter noise from results, default sort to high-value parcels

### v9.0 Professional Marketplace (Phases 67-71)

**Milestone Goal:** Transform Propdex from data analysis tool into a lead generation platform by connecting property intelligence to professional services — starting with kwaliteitsborgers (Wkb) as the first vertical.

- [ ] **Phase 67: Wkb Classification Engine** — Gevolgklasse determination, asbest risk indicator, verbouwing/monument exclusions
- [ ] **Phase 68: Bodemloket Integration** — Soil contamination data at parcel level with spike-first API discovery
- [ ] **Phase 69: Risicobeoordeling Dossier** — PDF generator aggregating all risk data into kwaliteitsborger intake document
- [ ] **Phase 70: Professional Directory** — Platform-wide kwaliteitsborger profiles with NULL org_id RLS pattern
- [ ] **Phase 71: Lead Capture + AVG Consent** — "Vraag kwaliteitsborger aan" CTA, lead form, email routing, consent logging

## Phase Details

### Phase 62: Scan Pipeline Reliability
**Goal**: Users can trust that area scans produce complete, correct data with no silent data loss
**Depends on**: Nothing (prerequisite for all other v8.0 phases)
**Requirements**: SCAN-01, SCAN-02, SCAN-03
**Success Criteria** (what must be TRUE):
  1. Running a wijk scan where BAG WFS fails causes a retried fetch with backoff, not silent continuation with empty building data
  2. After a scan completes, a warning is visible in logs/scan output when more than 90% of parcels have has_pand=false (suspiciously low coverage)
  3. Re-running a wijk scan with --force-all overwrites existing ScanResult rows and repopulates bouwjaar, address, and pand_status fields correctly
**Plans**: 2 plans (Wave 1 parallel)

Plans:
- [x] 62-01-PLAN.md — BAG WFS per-page retry + coverage ratio validation + Alembic migration (SCAN-01, SCAN-02)
- [x] 62-02-PLAN.md — --force-all clean-slate backfill + end-of-run summary table (SCAN-03)

### Phase 63: Venlo Data Completeness
**Goal**: Venlo gemeente has complete, validated scan data across all 21 wijken ready for demo
**Depends on**: Phase 62 (pipeline must produce correct data before re-running)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. All 21 Venlo wijken appear in the scan history with parcel counts matching expected Venlo density
  2. Parcels that contain BAG buildings show bouwjaar populated (not null) for all scanned Venlo wijken
  3. Parcels with buildings show a resolved Dutch address via PDOK reverse geocoding, not just perceel ID
  4. Parcel opportunity scores reflect actual BAG pand_status (in_gebruik parcels score lower, leeg/buiten_gebruik score higher)
**Plans**: 2 plans (Wave 1 + Wave 2 sequential)

Plans:
- [ ] 63-01-PLAN.md — Formalize parcel_addressing.py + create validate_scan_data.py CLI tool + unit tests (DATA-01, DATA-02, DATA-03)
- [ ] 63-02-PLAN.md — Execute Venlo 21-wijk re-scan + address backfill + validation + UI verification (DATA-01, DATA-02, DATA-03)

### Phase 64: Map Visualization
**Goal**: The map gives users a clear, accurate spatial picture of Venlo's development opportunities
**Depends on**: Phase 63 (score colors must reflect corrected data)
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. A "BAG Panden" toggle appears in the map layer catalog and, when enabled, draws building footprint outlines over parcels
  2. Parcel score colors on the map accurately reflect opportunity level using the corrected post-backfill data (vacant land is green/amber, occupied buildings are grey)
  3. Map labels are readable at default zoom for Venlo wijken with no overlapping text or element clutter
**Plans**: TBD

Plans:
- [ ] 64-01: BAG building footprints map layer (toggleable)
- [ ] 64-02: Score color accuracy verification + map clarity improvements

### Phase 65: Report Polish
**Goal**: Reports are presentable for client demonstration with clean layout and working PDF export
**Depends on**: Phase 63 (report data must be correct before polishing presentation)
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04
**Success Criteria** (what must be TRUE):
  1. Opening a property report shows all sections in a consistent, visually clean layout with no rendering artifacts or layout breaks in the v7.x sections (WOZ, energielabel, BRK, buildability, Wkb, permit precedents)
  2. Clicking "Download PDF" generates a PDF that contains all report sections in readable format with correct Dutch typography
  3. Reports for Wkb-plichtige properties show an "Actie vereist" section listing concrete warnings (e.g., Wkb-plichtig, asbestrisico bij bouwjaar <1994, vergunningsstatus)
  4. The "Actie vereist" section is absent (or empty) for parcels with no actionable warnings, keeping clean reports clean
**Plans**: TBD

Plans:
- [ ] 65-01: Report layout audit + v7.x section rendering fixes
- [ ] 65-02: PDF export audit + fix
- [ ] 65-03: Actie vereist section (actionable warnings from existing data)

### Phase 66: Results Table Noise Reduction
**Goal**: The results table surfaces genuine development opportunities, not the full undifferentiated parcel list
**Depends on**: Phase 63 (results must reflect corrected data)
**Requirements**: RES-01, RES-02
**Success Criteria** (what must be TRUE):
  1. The default results view shows parcels pre-filtered to likely development opportunities (residential zoning, no recent permits, has vacant land or old buildings), not all parcels from the scan
  2. Results are sorted by opportunity score descending by default, so the highest-value parcels appear at the top without user interaction
**Plans**: TBD

Plans:
- [ ] 66-01: Default filter preset + default sort order for results table

### Phase 67: Wkb Classification Engine
**Goal**: Users can see trustworthy, clearly-labelled Wkb gevolgklasse and asbest risk in every property report, with correct exclusions for monuments and verbouwingen
**Depends on**: Phase 66 (v8.0 must ship before v9.0 begins)
**Requirements**: WKB-01, WKB-02, WKB-03, WKB-04
**Success Criteria** (what must be TRUE):
  1. Opening a property report shows a "Wkb Classificatie" section with gevolgklasse (GK1 or "Niet van toepassing") labeled as "Indicatief"
  2. A property with bouwjaar between 1963 and 1993 shows asbest risk "Hoog" with NEN 2991 reference; post-1993 shows "Geen asbest risico"
  3. A property flagged as verbouwing (December 2024 ruling) shows "Wkb niet van toepassing — verbouwingen zijn uitgesloten" instead of a gevolgklasse
  4. A rijksmonument property shows "Wkb niet van toepassing — rijksmonumenten zijn vrijgesteld" and the CTA is absent
  5. The wkb_applicable boolean in the report schema is false whenever an exclusion applies, so downstream CTA logic has a single source of truth
**Plans**: TBD

Plans:
- [ ] 67-01: wkb_classifier.py + asbest_indicator.py services + PropertyReportResponse schema extension
- [ ] 67-02: WkbSection + AsbstSection frontend components in ReportDetailPage

### Phase 68: Bodemloket Integration
**Goal**: Users can see soil contamination status at parcel level, with honest coverage framing when Bodemloket data is absent
**Depends on**: Phase 67 (can run in parallel, but shares dossier dependency with Phase 69)
**Requirements**: BODEM-01, BODEM-02, BODEM-03
**Success Criteria** (what must be TRUE):
  1. A property report includes a "Bodemkwaliteit" section showing either WBB dossier references (if Bodemloket has records) or "Geen geregistreerde verontreiniging gevonden" (if no records)
  2. The "Geen geregistreerde verontreiniging gevonden" message is always accompanied by a disclaimer that Bodemloket data is incomplete and absence is not a soil clearance certificate
  3. Bodemloket data is cached for 30 days per parcel — opening the same report twice within 30 days does not trigger a second API call
  4. The Bodemloket spike at phase start documents the actual viable query method (WMS GetFeatureInfo vs ArcGIS REST) and live response field names before integration code is written
**Plans**: TBD

Plans:
- [ ] 68-01: Bodemloket spike — verify WMS vs REST, document live response format for WBB_locaties
- [ ] 68-02: bodemloket_wms.py API client + BodemData schema + 30-day JSONB cache + aggregator wiring
- [ ] 68-03: BodemSection frontend component in ReportDetailPage

### Phase 69: Risicobeoordeling Dossier
**Goal**: Users can generate a "Risicobeoordeling Startdossier" PDF that gives kwaliteitsborgers the intake information they need, saving them 1-3 hours per project
**Depends on**: Phase 67 (Wkb classification required), Phase 68 (bodem data required — renders "niet beschikbaar" if absent)
**Requirements**: DOSSIER-01, DOSSIER-02, DOSSIER-03
**Success Criteria** (what must be TRUE):
  1. Clicking "Genereer Startdossier" on a property report triggers PDF generation and the user can download it within seconds
  2. The generated PDF contains all required sections: perceelgegevens, bouwjaar, bodemkwaliteit, bestemmingsplan, monumentstatus, energielabel, and Wkb classificatie
  3. Every page of the PDF carries a mandatory disclaimer: data is indicatief, assembled from public sources, and does not constitute a formal Wkb compliance document
  4. A property without Bodemloket data renders "Bodemkwaliteit: geen gegevens beschikbaar" in the dossier rather than "schone grond" or an empty section
**Plans**: TBD

Plans:
- [ ] 69-01: GeneratedDossier model + Alembic migration + POST/GET dossier endpoints
- [ ] 69-02: wkb_kwaliteitsborger.html Jinja2 template + WeasyPrint generation + disclaimer copy
- [ ] 69-03: "Genereer Startdossier" CTA in ReportDetailPage + download flow

### Phase 70: Professional Directory
**Goal**: Admins can manage a platform-wide directory of kwaliteitsborgers that is visible to all tenants and filterable by gemeente and gevolgklasse
**Depends on**: Phase 67 (gevolgklasse filter requires GK values to exist)
**Requirements**: DIR-01, DIR-02, DIR-03, DIR-04
**Success Criteria** (what must be TRUE):
  1. An admin can add a kwaliteitsborger profile with naam, bedrijf, werkgebied (lijst van gemeenten), gevolgklassen, and contact details via the admin API
  2. A tenant user querying professionals for a specific gemeente sees only kwaliteitsborgers whose werkgebied includes that gemeente
  3. Professional profiles are visible across all tenants — a kwaliteitsborger added by admin is visible to organization A and organization B without duplication
  4. Each professional listing card links to their TloKB public register entry for verification by the user
  5. A cross-tenant integration test confirms that professionals with NULL organization_id are returned correctly for any authenticated tenant
**Plans**: TBD

Plans:
- [ ] 70-01: Professional model (NULL org_id, GIN indexes) + Alembic migration + RLS policy + cross-tenant integration test
- [ ] 70-02: GET /api/professionals with gemeente + gevolgklasse filters + pagination + admin CRUD endpoints
- [ ] 70-03: ProfessionalDirectory frontend component (TanStack Table, TloKB link, gemeente filter)

### Phase 71: Lead Capture + AVG Consent
**Goal**: A user can request a kwaliteitsborger for a Wkb-plichtige property, with explicit consent logging and email notification, completing the lead generation loop
**Depends on**: Phase 69 (dossier attached to lead), Phase 70 (professional matching requires directory)
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04, AVG-01, AVG-02, AVG-03
**Success Criteria** (what must be TRUE):
  1. A "Vraag kwaliteitsborger aan" CTA is visible in the report only when wkb_applicable is true AND at least one kwaliteitsborger serves the parcel's gemeente — it is absent otherwise
  2. Clicking the CTA shows a two-step consent screen explaining exactly what data will be shared before the user can submit
  3. After submitting a lead request, the user sees a confirmation and the matched kwaliteitsborger(s) receive an email notification with the generated risicobeoordeling dossier as attachment
  4. The LeadRequest record in the database stores consent_timestamp, consent_text_hash, and consent_given = true before any professional contact data is transmitted
  5. The privacy policy section visible from the lead form explains the data sharing arrangement with professionals
**Plans**: TBD

Plans:
- [ ] 71-01: LeadRequest model (consent fields, org-scoped) + Alembic migration + POST/GET lead endpoints with AVG validation
- [ ] 71-02: Lead notification email (fastapi-mail, dossier attachment) + developer confirmation email
- [ ] 71-03: LeadCaptureForm frontend (auto-fill, two-step consent screen) + WkbSection CTA wiring + privacy policy section

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 62. Scan Pipeline Reliability | 2/2 | Complete | 2026-02-28 |
| 63. Venlo Data Completeness | 1/2 | In Progress|  |
| 64. Map Visualization | 0/2 | Not started | - |
| 65. Report Polish | 0/3 | Not started | - |
| 66. Results Table Noise Reduction | 0/1 | Not started | - |
| 67. Wkb Classification Engine | 0/2 | Not started | - |
| 68. Bodemloket Integration | 0/3 | Not started | - |
| 69. Risicobeoordeling Dossier | 0/3 | Not started | - |
| 70. Professional Directory | 0/3 | Not started | - |
| 71. Lead Capture + AVG Consent | 0/3 | Not started | - |

---

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

*Last updated: 2026-03-01 -- Phase 63 plans finalized (2 plans, Wave 1 + Wave 2)*
