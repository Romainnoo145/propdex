# Project Milestones: Propdex

## v3.1 Smart Area Intelligence (Shipped: 2026-02-15)

**Delivered:** Area-first intelligence platform with bestemmingsplan visualization, wijk-based area selection, zoning-enriched opportunity scoring, split-panel results browsing, and automated change monitoring — transforming Propdex from address-level lookups to municipality-scale opportunity scanning.

**Phases completed:** 22-26 (22 plans total)

**Key accomplishments:**
- Bestemmingsplan visualization with PDOK WMS raster tiles, SVBP2012 colored zones, GetFeatureInfo click popup, and interactive legend
- End-to-end scan pipeline: BAG WFS with pagination fix, WMS bestemmingsplan enrichment (99%+ success rate), CBS gemeente bbox with OGC XML FILTER
- Wijk-based area selection: CBS gebiedsindelingen WFS integration, gemeente context navigation, click-to-scan flow, viewport scan button
- Results interface: split-panel layout (react-resizable-panels), TanStack Table with sorting/filtering/pagination, map-table bidirectional linking, parcel detail modal with on-demand SRU enrichment
- Change monitoring: hierarchical project model (gemeente→wijk), SRU Bekendmakingen + PLU WMS delta detection, ARQ daily cron (03:00 UTC), notification badges with unread tracking, monitored wijk overlay

**Stats:**
- 121 files created/modified
- ~27,200 lines (13,756 Python + 13,444 TypeScript)
- 5 phases, 22 plans, 97 commits
- 4 days (2026-02-11 → 2026-02-15)

**Git range:** `bd6e30c` (docs: start milestone v3.1) → `fe4b580` (docs(phase-26): complete phase execution)

**Tech debt (from audit):**
- Phase 23 missing VERIFICATION.md (documentation gap, code verified via downstream phases)
- PLU WMS change detection needs live data validation (MON-02)
- Unused `uuid` import in change_monitor.py

**What's next:** TBD — run `/gsd:new-milestone`

---

## v3.0 Spatial Foundation (Shipped: 2026-02-11)

**Delivered:** Spatial database infrastructure, government API clients, area scan pipeline with opportunity scoring, and map visualization with CBS gemeente boundaries and vector tiles — laying the foundation for area-first intelligence.

**Phases completed:** 18-21 (20 plans total)

**Key accomplishments:**
- PostGIS spatial database with GeoAlchemy2, parcel cache, spatial join queries, and tenant-aware RLS
- Government API clients: BAG WFS, SRU Bekendmakingen, BRK Bevragen stub, with rate limiting
- Area scan pipeline: ARQ background job, parcel scoring algorithm, Excel export, REST API
- Map visualization: CBS gemeente boundaries (WFS), MapLibre vector tiles (MVT endpoint), scan progress overlay

**Stats:**
- 106 files created/modified
- 20 plans, 14 requirements, 72 commits
- 2 days (2026-02-10 → 2026-02-11)

**Git range:** `3201f52` (docs: start milestone v3.0) → `bd6e30c^` (before v3.1 start)

**What's next:** v3.1 Smart Area Intelligence

---

## v2.0 Frontend (Shipped: 2026-02-09)

**Delivered:** Comprehensive test suite (275 tests), row-level security enforcement, and configuration cleanup — making the v1.0 backend production-ready with verified multi-tenant isolation at every layer.

**Phases completed:** 6-12 (19 plans total)

**Key accomplishments:**
- 275-test automated suite covering all 5 backend modules (104 unit + 171 integration), 74% overall coverage with all core business logic >80%
- Row-level security enforcement with fail-closed NULLIF policies on all 7 tenant tables, app_role deployment ready
- Multi-tenant isolation verified at 4 layers (HTTP, service, cache, database) with 11 dedicated tests
- Configuration cleanup: single .env, per-org freshness thresholds, production .env.example
- 4 complete E2E flows tested: address-to-report, report-to-PDF, auth lifecycle, multi-tenant isolation
- Formal verification of all 7 phases with evidence-based VERIFICATION.md documents

**Stats:**
- 123 files created/modified
- 15,947 lines of Python (7,060 in tests)
- 7 phases, 19 plans, 71 commits
- 2 days from v1.0 to v1.1

**Git range:** `9933395` (docs: start milestone v1.1) → `ce97eac` (docs(12): complete phase documentation)

**What's next:** v2.0 Frontend — SvelteKit dashboard with address lookup, interactive maps, and report management UI

---

## v1.0 Core Intelligence Engine (Shipped: 2026-02-07)

**Delivered:** Backend API for instant Dutch property intelligence — enter any address, get kadaster data, zoning rules, monument status, and AI-parsed bestemmingsplan data in one parallel request.

**Phases completed:** 1-5 (17 plans total)

**Key accomplishments:**
- Multi-tenant authentication with JWT refresh rotation, Argon2id, email verification, Google OAuth, and rate limiting
- Dutch government API integration (PDOK, BAG, DSO, RCE) with parallel fetching via asyncio.gather
- Intelligent PostgreSQL JSONB caching with source-specific TTLs, force refresh, and freshness detection
- AI bestemmingsplan parsing via Claude API with confidence scoring, async ARQ worker, and progress polling
- Report management with save/list/search, project folders, professional PDF export via WeasyPrint
- Complete property intelligence pipeline: address resolution → parallel data aggregation → report generation

**Stats:**
- 139 files created/modified
- 8,281 lines of Python
- 5 phases, 17 plans, 79 commits
- 1 day from start to ship

**Git range:** `af14fd7` (docs: initialize project) → `c1a702e` (docs: complete Report Management phase)

**What's next:** v1.1 Production Hardening (tests, RLS, config cleanup)

---

## v2.0 Frontend (Shipped: 2026-02-09)

**Delivered:** Map-first web interface for Dutch property intelligence — full-page MapLibre map with PDOK aerial/topographic tiles, floating address search with autocomplete, three-tier progressive disclosure property panels, report management sidebar, project folders, and responsive mobile support.

**Phases completed:** 13-17 (24 plans total)

**Key accomplishments:**
- Full-page MapLibre map with PDOK aerial imagery, topographic tiles, layer toggle, and kadaster parcel boundary overlay (WMS)
- JWT authentication with httpOnly refresh cookies, silent token refresh, protected routes, and backend cookie endpoint
- Floating address search with PDOK Locatieserver autocomplete, keyboard navigation, and fly-to-location
- Three-tier progressive disclosure (QuickCard → Drawer → Modal) with property geometry rendering and freshness indicators
- Report management sidebar with cmdk search, save/export flows, PDF modal, and recent viewed tracking
- Project folders with CRUD operations, report-to-project assignment, and sidebar filtering
- Responsive Drawer (desktop right panel, mobile bottom sheet), confidence badges, force refresh, and full detail report page

**Stats:**
- 149 files created/modified
- 8,804 lines of TypeScript/React
- 5 phases, 24 plans, 117 commits
- 2 days (2026-02-08 → 2026-02-09)

**Stack:** React 19, Vite 7, TypeScript strict, MapLibre GL JS 4.x, TanStack Query v5, TanStack Router, Tailwind v4, pnpm

**Git range:** v1.1 → v2.0

**What's next:** TBD — run `/gsd:new-milestone`

---


## v4.0 UX Redesign (Shipped: 2026-02-18)

**Delivered:** Complete frontend redesign from functional prototype to polished PropTech tool — Industrial Amber design system, persistent map navigation, mobile responsiveness, comprehensive feedback systems, data table polish, settings page, and performance optimization.

**Phases completed:** 27-36 (31 plans total)

**Key accomplishments:**
- Industrial Amber design system: oklch color tokens, Inter/JetBrains Mono fonts, 5 UI primitives (Button, Card, Badge, Input, Select) with CVA variants, 11 Storybook stories
- Persistent MapView architecture: MapLibre instance never unmounts, SideRailNav icon sidebar, InspectorPanel slide-over, /resultaten as separate route with scan_id URL bridge
- Full glassmorphism→Industrial Amber migration: 40+ components migrated, DS-04 rule (solid panels, glass map floats), responsive mobile glassmorphism disable
- Data table polish: URL-persisted filters, multi-column sort, checkbox selection with bulk export, category-grouped filter panel, table-to-map hover sync
- Mobile responsiveness: BottomTabNav, InspectorPanel bottom sheet, ParcelCard layout, 44px touch targets, read-only mode with "Gebruik desktop" banners
- Settings page: backend users API (profile/password/preferences), TanStack Query hooks, AccountSection/PasswordSection/NotificationsSection/AppearanceSection
- Bundle splitting: 1,813KB monolith → 4 vendor chunks + 15 route chunks via autoCodeSplitting + manualChunks

**Stats:**
- 202 files created/modified
- ~16,234 lines TypeScript/React (frontend), ~23,621 lines Python (backend total)
- 10 phases, 31 plans, 129 commits
- 3 days (2026-02-16 → 2026-02-18)

**Git range:** v3.1 → v4.0

**Tech debt:**
- Lighthouse >90 not achievable for pure SPA without SSR (score: 57 on dev server)
- react-resizable-panels still in package.json (unused since Phase 28)
- ChangeTimeline.tsx and ProjectEditModal.tsx still have legacy gray-* classes
- PropertyDetailDrawer.tsx at 773 lines (exceeds 300-line guideline)

**What's next:** TBD — run `/gsd:new-milestone`

---


## v5.0 Scan Intelligence (Shipped: 2026-02-20)

**Delivered:** Scan results persist and are browsable, map shows scanned wijken with amber overlays and score-colored parcels, one-click report generation from scan results, and production hardening (auth test cookie fix, ARQ idempotency, tech debt cleanup).

**Phases completed:** 37-41 (11 plans total)

**Key accomplishments:**
- Paginated scan history API and browsable scan list in Projecten view
- Map visualization: scanned wijk amber overlays, individual parcel results with opportunity score coloring via MVT tiles
- POST /from-parcel endpoint for one-click report generation from scan result parcels
- Auth integration tests updated for cookie-based CookieTokenResponse flow
- ARQ worker idempotency via pg_insert().on_conflict_do_nothing() for ScanResult

**Stats:**
- 65 files changed (+9,264/-2,326)
- 5 phases, 11 plans, 51 commits
- 2 days (2026-02-19 → 2026-02-20)

**What's next:** TBD — run `/gsd:new-milestone`

---


## v6.0 Meldingen Intelligence (Shipped: 2026-02-23)

**Delivered:** Actionable meldingen intelligence -- bekendmakingen matched to parcels via PDOK geocoding and PostGIS spatial lookup, server-backed per-change read tracking, melding-to-map-to-report flow in three clicks, and a daily intelligence feed with gemeente filtering, action state badges, and infinite scroll.

**Phases completed:** 47-51 (10 plans total)

**Key accomplishments:**
- Multi-strategy Dutch address extraction from SRU bekendmaking titles with category classification (27 tests, 5 regex strategies)
- PDOK Locatieserver geocoding + PostGIS ST_Contains spatial parcel matching with post-scan retro-matching (19 new tests)
- Server-side per-change read tracking (ChangeReadState model, 3 API endpoints) replacing localStorage hack
- Melding-to-map flow: click matched parcel → fly to amber map marker → generate report from verified parcel data
- Meldingen UX: gemeente filter dropdown, action state badges (Perceel gekoppeld / Alleen adres / Geen perceel gevonden), shared useReadTracking hook, infinite scroll with 25-record pages

**Stats:**
- 56 files created/modified
- +8,818 / -292 lines
- 5 phases, 10 plans, 39 commits
- 1 day (2026-02-23, 09:00 → 11:48)

**Git range:** `a6c6a97` (docs(47): create phase plan) → `e7a19a3` (docs(phase-51): complete phase execution)

**What's next:** TBD — run `/gsd:new-milestone`

---


## v12.0 Omgevings- & Leefbaarheids-Scorer (Shipped: 2026-03-07)

**Delivered:** Location-level intelligence with CBS neighborhood metrics (demographics, income, household composition), crime statistics (OData v3), facility proximity data, and map toggle state machine — answering "Is het slim om hier te bouwen?" with data-driven context.

**Phases completed:** 78-80 (6 plans total). Phase 81 (Locatie Score Investeringsprofiel) deferred — depends on all data sources being correct first.

**Key accomplishments:**
- Extended CBS demographics: age distribution, household composition, income metrics via OData v4
- CBS criminaliteitsdata: OData v3 client for crime statistics with color-coded severity indicators
- CBS voorzieningennabijheid: facility proximity distances (schools, supermarkets, OV)
- Map toggle state machine: centralized useMapLayerState hook, exitGemeenteMode utility
- Gemeente/wijk detail view UX fixes (max-height, overflow control)

**Stats:**
- 3 phases, 6 plans
- 1 day (2026-03-07)

**What's next:** v13.0 Juridisch Klimaat Intelligence

---

## v11.0 Open Data Intelligence (Shipped: 2026-03-07)

**Phases completed:** 75 phases, 213 plans, 34 tasks

**Key accomplishments:**
- CBS wijkstatistieken (WOZ, stedelijkheid, demographics) via OData v4 client
- Rechtspraak jurisprudentie search with omgevingsrecht filter and inline document viewing
- AI-powered per-ruling summaries (bezwaargrond, uitkomst, relevantie)
- Aggregated juridisch klimaat score + vergunnings-succeskans
- Map toggle state machine with centralized layer state

---


## v14.0 Fysiek Risicoprofiel (Shipped: 2026-03-10)

**Delivered:** Per-parcel physical risk assessment — foundation risk, asbestos exposure, soil classification, and contamination signals — so developers can see hidden structural costs before acquisition. Amber-only confidence design communicates that these are indicative assessments, not professional inspections.

**Phases completed:** 87-90 (5 plans total)

**Key accomplishments:**
- BRO Bodemkaart WMS + PDOK Funderingsrisicogebieden WFS clients for per-parcel soil type and postcode-level foundation risk context
- Foundation risk engine with bouwjaar x bodemtype heuristic, KCAF cost indication ranges, and worst-of aggregation
- Gebruiksdoel-aware asbestos risk assessment with additive-only NEN 2991 uplift logic (18 unit tests)
- FysiekRisicoprofielSection in ParcelDetailModal with 4 sub-cards (bodem, fundering, asbest, verontreiniging) and amber confidence badges
- Foundation risk overlay on area scan map tiles with bouwjaar-based color coding

**Stats:**
- 47 files changed (+5,800 / -182)
- 4 phases, 5 plans
- 1 day (2026-03-09 → 2026-03-10)
- Git range: `d17e8c4` (feat(87-01)) → `fb9b010` (docs(phase-90))

**What's next:** TBD — run `/gsd:new-milestone`

---

