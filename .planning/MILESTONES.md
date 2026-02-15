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

