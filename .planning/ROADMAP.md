# Propdex -- Roadmap

## Milestones

- 🚧 **v5.0 Scan Intelligence** -- Phases 37-41 (in progress)
- ✅ **v4.0 UX Redesign** -- Phases 27-36 (shipped 2026-02-18)
- ✅ **v3.1 Smart Area Intelligence** -- Phases 22-26 (shipped 2026-02-15)
- ✅ **v3.0 Spatial Foundation** -- Phases 18-21 (shipped 2026-02-11)
- ✅ **v2.0 Frontend** -- Phases 13-17 (shipped 2026-02-09)
- ✅ **v1.1 Production Hardening** -- Phases 6-12 (shipped 2026-02-08)
- ✅ **v1.0 Core Intelligence Engine** -- Phases 1-5 (shipped 2026-02-07)

---

## Phases

### 🚧 v5.0 Scan Intelligence (In Progress)

**Milestone Goal:** Make scan results persistent and actionable -- browsable scan history, map visualization of scanned areas and parcels, property report generation from scan results, and bug fixes.

#### Phase 37: Scan History Backend ✅ (completed 2026-02-19)
**Goal**: Users can retrieve a queryable list of all previous scans with metadata from the API
**Depends on**: Nothing (backend-only phase)
**Requirements**: SCAN-01, SCAN-02, SCAN-03
**Success Criteria** (what must be TRUE):
  1. `GET /api/scans` returns a paginated list of scans with gemeente name, wijk name, date, and parcel count per scan
  2. `GET /api/projects/{id}/scans` returns scans associated with a specific project
  3. Each scan in the list includes a scan_id that can be used to load scan results in the results table
  4. Scan list endpoint enforces multi-tenant isolation -- org A cannot see org B's scans
**Plans**: 2 plans (Wave 1: both parallel)

Plans:
- [x] 37-01-PLAN.md -- Add `GET /api/scans` paginated list endpoint with gemeente/wijk metadata and parcel count
- [x] 37-02-PLAN.md -- Add `GET /api/projects/{id}/scans` sub-resource endpoint

#### Phase 38: Scan History Frontend ✅ (completed 2026-02-19)
**Goal**: Users can browse their scan history in the Projecten view and navigate back to any previous scan's results or map
**Depends on**: Phase 37
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04
**Success Criteria** (what must be TRUE):
  1. Projecten view shows real scans with gemeente, wijk, date, and parcel count (no demo data)
  2. User can click any scan in the list to re-open its results in the /resultaten table
  3. User can navigate from a scan in the list to the map with that scan's parcels loaded
  4. Empty state is shown when no scans exist yet
**Plans**: 2 plans (Wave 1: data layer, Wave 2: UI)

Plans:
- [x] 38-01-PLAN.md -- Add ScanListItem/ScanListResponse types, fetchScanHistory/fetchProjectScans API functions, useScanHistory/useProjectScans hooks, useTriggerScan cache invalidation
- [x] 38-02-PLAN.md -- Replace DEMO_REPORTS with real scan data via WijkScanList component; add "Toon resultaten" and "Toon kaart" navigation actions

#### Phase 39: Map Parcel Visualization ✅ (completed 2026-02-19)
**Goal**: Users can see scanned wijken highlighted on the map and individual scan result parcels colored by opportunity score
**Depends on**: Phase 37 (scan_id available)
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Scanned wijken appear with a distinct highlight color on the map, visually distinct from unscanned wijken
  2. Individual parcels from scan results appear as colored polygons on the map, with color reflecting opportunity score
  3. User can toggle parcel score coloring on and off to return to the default map view
  4. Parcel polygons are rendered via MVT tiles (viewport-aware, performant at 2000+ parcels)
**Plans**: 2 plans (Wave 1: both parallel)

Plans:
- [x] 39-01-PLAN.md -- Add ScannedWijkHighlightLayer (amber overlay for scanned wijken) and fix score layer restoration on URL navigation
- [x] 39-02-PLAN.md -- Add Perceel Score toggle button in LayerToggle and wire to parcel score layer visibility

#### Phase 40: Report Integration ✅ (completed 2026-02-20)
**Goal**: Users can generate and save a full property intelligence report for any parcel appearing in scan results
**Depends on**: Phase 38 (parcels visible and selectable in results)
**Requirements**: RPT-01, RPT-02
**Success Criteria** (what must be TRUE):
  1. User can trigger report generation for any parcel in the scan results table or InspectorPanel
  2. Report generation reuses the existing property aggregator pipeline (BAG, PDOK, DSO, RCE, SRU)
  3. Generated report is saved and appears in the report management system (Rapporten view)
  4. User sees progress feedback while the report is being generated
**Plans**: 2 plans (Wave 1: backend, Wave 2: frontend)

Plans:
- [x] 40-01-PLAN.md -- Add POST /api/reports/from-parcel endpoint with address parsing and property aggregator pipeline
- [x] 40-02-PLAN.md -- Add "Genereer rapport" button to ParcelDetailModal and InspectorPanel with sonner toast feedback

#### Phase 41: Bug Fixes & Hardening
**Goal**: Known bugs are resolved and the codebase is free of identified tech debt
**Depends on**: Nothing (parallel-safe, grouped at end for clean milestone close)
**Requirements**: FIX-01, FIX-02, FIX-03
**Success Criteria** (what must be TRUE):
  1. User can register a new account without receiving a 500 error
  2. ARQ worker re-runs do not create duplicate ScanResult rows (idempotent via ON CONFLICT DO NOTHING)
  3. Unused packages removed from package.json and legacy gray-* classes cleaned from ChangeTimeline.tsx / ProjectEditModal.tsx
**Plans**: TBD

Plans:
- [ ] 41-01: Investigate and fix backend register endpoint 500 error
- [ ] 41-02: Add ON CONFLICT DO NOTHING to ScanResult insert in ARQ scan job; fix ARQ idempotency
- [ ] 41-03: Remove react-resizable-panels from package.json; clean legacy gray-* Tailwind classes; remove unused Python imports

## Progress

**Execution Order:** 37 → 38 → 39 → 40 → 41

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 37. Scan History Backend | v5.0 | 2/2 | ✓ Complete | 2026-02-19 |
| 38. Scan History Frontend | v5.0 | 2/2 | ✓ Complete | 2026-02-19 |
| 39. Map Parcel Visualization | v5.0 | 2/2 | ✓ Complete | 2026-02-19 |
| 40. Report Integration | v5.0 | 2/2 | ✓ Complete | 2026-02-20 |
| 41. Bug Fixes & Hardening | v5.0 | 0/3 | Not started | - |

---

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

*Last updated: 2026-02-20 (Phase 40 complete)*
