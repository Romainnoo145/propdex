# Propdex -- Roadmap

## Milestones

- **v6.0 Meldingen Intelligence** -- Phases 47-51 (in progress)
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

### v6.0 Meldingen Intelligence

**Milestone Goal:** Transform the meldingen feed from a passive notification list into an actionable intelligence tool -- reliable parcel matching via geocoding, direct melding-to-map-to-report flow, server-side per-change read tracking, and a meldingen page worth visiting every day.

- [x] **Phase 47: Address Intelligence** - Extract clean, validated Dutch addresses from SRU bekendmaking titles with full test coverage (shipped 2026-02-23)
- [x] **Phase 48: Parcel Matching** - Geocode extracted addresses via PDOK Locatieserver, store matched parcel IDs, and retro-match existing changes (shipped 2026-02-23)
- [x] **Phase 49: Read Tracking** - Replace localStorage read state with server-side per-change read tracking and unread count badges (shipped 2026-02-23)
- [x] **Phase 50: Melding-to-Map Flow** - User clicks a matched melding parcel, flies to map, sees an amber marker, and can generate a report (shipped 2026-02-23)
- [ ] **Phase 51: Meldingen UX** - Gemeente filter, clear action states per melding, shared read-tracking hook, and pagination

## Phase Details

### Phase 47: Address Intelligence
**Goal**: SRU bekendmaking titles yield clean, validated Dutch addresses -- the raw input quality on which all parcel matching depends
**Depends on**: Nothing (foundational data quality improvement)
**Requirements**: ADDR-01, ADDR-02, ADDR-03
**Success Criteria** (what must be TRUE):
  1. Address extractor correctly parses all common Dutch bekendmaking title formats (straatnaam + huisnummer, with and without postcode, with and without additions) -- verified by a test suite against real SRU examples
  2. Extracted addresses include both postcode and huisnummer when present in the source title, giving the matcher enough precision to reach a single parcel
  3. Each change record displays a human-readable Dutch category label (e.g. "Omgevingsvergunning aangevraagd", "Bestemmingsplan gewijzigd") instead of a raw type code
**Plans**: 2 plans

Plans:
- [x] 47-01-PLAN.md -- TDD: Refactor address extractor into standalone module with comprehensive regex and test suite on real SRU titles
- [x] 47-02-PLAN.md -- Category label classifier and frontend wiring (API schema + ChangeTimeline + meldingen.tsx)

### Phase 48: Parcel Matching
**Goal**: Every bekendmaking with an extractable address gets a matched parcel ID stored in the database -- and existing unmatched changes get a second chance whenever new scan data arrives
**Depends on**: Phase 47 (clean address extraction is the input to geocoding)
**Requirements**: MATCH-01, MATCH-02, MATCH-03
**Success Criteria** (what must be TRUE):
  1. When a change record has an extractable address but no parcel match, the system geocodes it via PDOK Locatieserver and attempts a spatial lookup against ParcelCache -- a matched parcel_id is stored on the ChangeRecord row
  2. Matched parcel IDs survive application restarts and API calls -- they are persisted on the ChangeRecord model, not recomputed on every request
  3. After a wijk scan completes and new ParcelCache entries exist, previously unmatched ChangeRecords for that gemeente are re-checked and matched where possible
**Plans**: 3 plans

Plans:
- [x] 48-01-PLAN.md -- TDD: PDOK Locatieserver geocode_address() and find_parcel_at_point() spatial lookup
- [x] 48-02-PLAN.md -- Alembic migration (matched_parcel_id column), model/schema update, wire geocoding into change_monitor.py
- [x] 48-03-PLAN.md -- Post-scan retro-matching: retro_match_changes_for_gemeente() + area_scan_job Phase 6 integration

### Phase 49: Read Tracking
**Goal**: Users can mark individual changes as read or unread, and that state persists in the database -- unread badges everywhere reflect actual per-change state, not a project-level last-seen timestamp
**Depends on**: Nothing (independent of matching and flow, can ship in parallel)
**Requirements**: READ-01, READ-02, READ-03, READ-04
**Success Criteria** (what must be TRUE):
  1. User can click any change in the meldingen feed to toggle its read/unread state -- the change immediately updates its visual treatment (read = dimmed, unread = bold)
  2. After toggling read state on one device, opening the app on a different browser or device shows the same read/unread state -- localStorage is no longer the source of truth
  3. Unread count badges on gemeente cards, wijk cards, and the SideRailNav icon reflect per-change read state -- reading a change decrements the badge count in real time
  4. A "Markeer alles als gelezen" action marks all currently visible changes as read in a single API call -- unread badges reset to zero
**Plans**: 2 plans

Plans:
- [x] 49-01-PLAN.md -- ChangeReadState model, Alembic migration, API endpoints (mark read/unread, mark all read, updated unread counts)
- [x] 49-02-PLAN.md -- Frontend read tracking: replace localStorage with server state, toggle UI, badge updates, mark-all action

### Phase 50: Melding-to-Map Flow
**Goal**: A user who sees an interesting melding with a matched parcel can click once to fly to that parcel on the map, see an amber marker with address and action button, and generate a full report -- the complete intelligence workflow in three clicks
**Depends on**: Phase 48 (matched parcel IDs must exist for navigation to work)
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04
**Success Criteria** (what must be TRUE):
  1. Clicking "Bekijk op kaart" on a matched melding opens the map route and flies the viewport to the parcel's coordinates
  2. An amber marker appears at the parcel location showing the bekendmaking address and a "Genereer rapport" button -- visible without any additional clicks
  3. Clicking "Genereer rapport" from the map marker generates a property report using the verified parcel ID from the ChangeRecord -- the report uses real kadaster/BAG data, not a free-form address guess
  4. If the parcel has no wijk project yet, the wijk project hierarchy (gemeente container + wijk container) is auto-created before the report is saved -- the report lands in the correct project without user setup
**Plans**: 1 plan

Plans:
- [x] 50-01-PLAN.md -- Wire matched_parcel_id through ChangeRecord type, meldingen.tsx, and ChangeTimeline.tsx for parcel-ID-based map navigation and report generation

### Phase 51: Meldingen UX
**Goal**: The meldingen page is the user's daily intelligence briefing -- filterable by gemeente, each entry clearly shows what action is available, read tracking is consistent across the app, and the feed scales gracefully as data grows
**Depends on**: Phase 49 (read tracking must be server-side), Phase 50 (matched/unmatched action states must exist)
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. User can filter the meldingen feed by gemeente using a dropdown -- selecting a gemeente shows only changes from monitored wijken in that gemeente
  2. Each melding entry clearly communicates its action state: matched parcels show a "Bekijk op kaart" or "Genereer rapport" button; unmatched entries show "Geen perceel gevonden" with a kaart-only fallback if coordinates exist; genuinely unknown entries show a neutral state
  3. The useReadTracking hook is imported by both meldingen.tsx and ChangeTimeline.tsx -- read/unread logic lives in exactly one place in the codebase
  4. The meldingen feed loads incrementally -- the user sees the first entries quickly and can scroll or page through a growing history without a full-page reload
**Plans**: 2 plans

Plans:
- [ ] 51-01-PLAN.md -- Gemeente filter dropdown, backend gemeente_naam filter, shared useReadTracking hook extraction
- [ ] 51-02-PLAN.md -- Per-melding action state badges (matched/unmatched/unknown) and infinite scroll pagination

---

<details>
<summary>✅ v5.1 Data Presentation Overhaul (Phases 42-46) -- SHIPPED 2026-02-22</summary>

- [x] Phase 42: Theme Consistency (2/2 plans) -- on-accent token, FOUC prevention, semantic token sweep
- [x] Phase 43: Gemeente Card Navigation (2/2 plans) -- SVG boundary silhouettes, GeoJSON projection, card grid
- [x] Phase 44: Wijk Cards and Drill-Down (2/2 plans) -- WijkCard, WijkCardGrid, gemeente→wijk navigation
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

## Progress

**Execution Order:** 47 -> 48 -> 49 -> 50 -> 51

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 47. Address Intelligence | v6.0 | 2/2 | ✓ Complete | 2026-02-23 |
| 48. Parcel Matching | v6.0 | 3/3 | ✓ Complete | 2026-02-23 |
| 49. Read Tracking | v6.0 | 2/2 | ✓ Complete | 2026-02-23 |
| 50. Melding-to-Map Flow | v6.0 | 1/1 | ✓ Complete | 2026-02-23 |
| 51. Meldingen UX | v6.0 | 0/TBD | Not started | - |

---

*Last updated: 2026-02-23 (Phase 50 Melding-to-Map Flow shipped -- 1 plan, 4 commits)*
