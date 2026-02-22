# Propdex -- Roadmap

## Milestones

- **v5.1 Data Presentation Overhaul** -- Phases 42-45 (in progress)
- ✅ **v5.0 Scan Intelligence** -- Phases 37-41 (shipped 2026-02-20)
- ✅ **v4.0 UX Redesign** -- Phases 27-36 (shipped 2026-02-18)
- ✅ **v3.1 Smart Area Intelligence** -- Phases 22-26 (shipped 2026-02-15)
- ✅ **v3.0 Spatial Foundation** -- Phases 18-21 (shipped 2026-02-11)
- ✅ **v2.0 Frontend** -- Phases 13-17 (shipped 2026-02-09)
- ✅ **v1.1 Production Hardening** -- Phases 6-12 (shipped 2026-02-08)
- ✅ **v1.0 Core Intelligence Engine** -- Phases 1-5 (shipped 2026-02-07)

---

## Phases

### v5.1 Data Presentation Overhaul

**Milestone Goal:** Card-based drill-down navigation from gemeente to wijk to results, with theme consistency across light and dark modes.

- [x] **Phase 42: Theme Consistency** - Audit and fix all hardcoded color classes so new components are built on correct patterns
- [x] **Phase 43: Gemeente Card Navigation** - Projecten page shows gemeente cards with SVG boundary silhouettes, names, and notification badges
- [ ] **Phase 44: Wijk Cards and Drill-Down** - Click a gemeente card to see its wijk cards, click a wijk card to see filtered results
- [ ] **Phase 45: Breadcrumb and URL State** - Breadcrumb navigation and deep-linkable URL state reflecting drill-down level

## Phase Details

### Phase 42: Theme Consistency
**Goal**: Dark and light modes are visually consistent -- all accent colors flow through CSS variables, no hardcoded Tailwind color classes bypass the theme system
**Depends on**: Nothing (audit/cleanup phase, establishes patterns for new components)
**Requirements**: THEME-01, THEME-02, THEME-03
**Success Criteria** (what must be TRUE):
  1. User can toggle between dark and light mode and every component renders with correct contrast -- no white-on-white, no invisible text, no broken backgrounds
  2. Searching the frontend source for `amber-` Tailwind classes returns zero results outside of CSS variable definitions -- all accent color usage goes through `--color-amber-accent`
  3. Theme toggle persists across browser sessions -- user closes browser, reopens, and the previously selected theme is active without flash of wrong theme
**Plans**: 2 plans

Plans:
- [x] 42-01: Add on-accent CSS token, FOUC prevention script, fix amber button contrast
- [x] 42-02: Semantic token sweep -- replace raw Tailwind palette colors and fix undefined grey values

### Phase 43: Gemeente Card Navigation
**Goal**: Users see their scanned gemeenten as visual cards on the Projecten page -- each card shows the municipality boundary shape, name, and a badge when there are unread changes
**Depends on**: Phase 42 (theme patterns established, new components will follow them)
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-07, NAV-01
**Success Criteria** (what must be TRUE):
  1. Projecten page displays gemeente cards in a 3-column grid on desktop, 2 columns on tablet, and 1 column on mobile
  2. Each gemeente card shows a recognizable SVG silhouette of the municipality boundary (sourced from CBS WFS data already used on the map page)
  3. Each gemeente card displays the gemeente name prominently and a notification badge showing the count of unread change records for that gemeente
  4. Cards maintain consistent visual appearance across breakpoints -- no layout breaking, no truncated content, no overflow
**Plans**: 2 plans

Plans:
- [x] 43-01: GeoJSON-to-SVG projection utility, GemeenteCard component, and responsive card grid wrapper
- [x] 43-02: Integrate card grid into ProjectList replacing monitoring accordion with visual gemeente cards

### Phase 44: Wijk Cards and Drill-Down
**Goal**: Users can click a gemeente card to see its wijken as visual cards, and click a wijk card to land on the results table filtered to that wijk's scan data
**Depends on**: Phase 43 (gemeente cards and card grid component exist)
**Requirements**: CARD-04, CARD-05, CARD-06, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. Clicking a gemeente card navigates to a view showing that gemeente's wijk cards in the same responsive grid layout
  2. Each wijk card shows the wijk boundary SVG silhouette, the wijk name, and a notification badge for unread changes in that specific wijk
  3. Clicking a wijk card navigates to the /resultaten route with filters pre-set to show only that wijk's scan results
  4. User can navigate back from wijk view to gemeente view without losing state
**Plans**: 2 plans

Plans:
- [ ] 44-01-PLAN.md -- WijkCard component, WijkCardGrid container, and useWijkGeoJSON hook
- [ ] 44-02-PLAN.md -- Drill-down navigation integration into ProjectList (gemeente -> wijk -> resultaten)

### Phase 45: Breadcrumb and URL State
**Goal**: Users always know where they are in the drill-down hierarchy and can share or bookmark any navigation level
**Depends on**: Phase 44 (full drill-down navigation works)
**Requirements**: NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. Breadcrumb bar shows the current path (Projecten > Gemeente Name > Wijk Name) with each segment clickable for back-navigation
  2. URL reflects the current navigation level -- copying the URL and opening it in a new tab restores the exact same view (gemeente cards, wijk cards, or filtered results)
  3. Browser back/forward buttons navigate the drill-down levels correctly
**Plans**: TBD

Plans:
- [ ] 45-01: Breadcrumb component and URL state synchronization

---

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

**Execution Order:** 42 -> 43 -> 44 -> 45

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 42. Theme Consistency | v5.1 | 2/2 | ✓ Complete | 2026-02-21 |
| 43. Gemeente Card Navigation | v5.1 | 2/2 | ✓ Complete | 2026-02-22 |
| 44. Wijk Cards and Drill-Down | v5.1 | 0/2 | Not started | - |
| 45. Breadcrumb and URL State | v5.1 | 0/1 | Not started | - |

---

*Last updated: 2026-02-22 (Phase 44 planned -- 2 plans in 2 waves)*
