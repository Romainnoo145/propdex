# Propdex -- Roadmap

## Milestones

- ✅ **v3.1 Smart Area Intelligence** -- Phases 22-26 (shipped 2026-02-15)
- ✅ **v3.0 Spatial Foundation** -- Phases 18-21 (shipped 2026-02-11)
- ✅ **v2.0 Frontend** -- Phases 13-17 (shipped 2026-02-09)
- ✅ **v1.1 Production Hardening** -- Phases 6-12 (shipped 2026-02-08)
- ✅ **v1.0 Core Intelligence Engine** -- Phases 1-5 (shipped 2026-02-07)

## Phases

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

*Last updated: 2026-02-15 (v3.1 shipped)*
