# Propdex -- Roadmap

## Milestones

- 🚧 **v3.0 Area Intelligence** -- Phases 18-22 (in progress)
- ✅ **v2.0 Frontend** -- Phases 13-17 (shipped 2026-02-09)
- ✅ **v1.1 Production Hardening** -- Phases 6-12 (shipped 2026-02-08)
- ✅ **v1.0 Core Intelligence Engine** -- Phases 1-5 (shipped 2026-02-07)

## Phases

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

### 🚧 v3.0 Area Intelligence (Phases 18-22)

**Milestone Goal:** Transform Propdex from address-based property lookup to area-based opportunity discovery. Users select a gemeente, the system scans all parcels via government APIs, cross-references with buildings and zoning, and surfaces qualified development leads -- from municipality scan to actionable parcel list in minutes instead of weeks.

**Architecture Decisions:**
- PostGIS for spatial joins (not Python Shapely)
- ARQ for batch processing with progress polling (not WebSockets)
- PDOK vector tiles for base parcel layer + Martin for custom score overlay
- Three-tier cache: DB pre-scan (Tier 1) / JSONB on-demand (Tier 2) / BRK never-store (Tier 3)
- CBS gemeente boundaries for area selection
- EPSG:28992 storage, EPSG:4326 for GeoJSON responses

**Dependency Chain:**
```
Phase 18 (Spatial Foundation) --> Phase 19 (API Clients) --> Phase 20 (Scanner + REST API)
                                                                       |
                                                          Phase 21 (Map) --> Phase 22 (List + Detail)
```

---

## Phase Details

### Phase 18: Spatial Foundation
**Goal**: PostGIS spatial database is operational with parcel cache, scan tracking, and multi-tenant isolation -- the data layer everything else builds on
**Depends on**: Phase 17 (existing v2.0 codebase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-05, DATA-06, API-05
**Success Criteria** (what must be TRUE):
  1. PostGIS extension is enabled and spatial functions (ST_Contains, ST_Intersects, ST_DWithin, ST_AsGeoJSON) execute successfully against the database
  2. Parcel geometries stored in EPSG:28992 can be inserted, queried by bounding box, and returned as EPSG:4326 GeoJSON via a coordinate transformation helper
  3. Area scan records track status and progress, and scan results link to individual cached parcels (not bulk JSONB blobs)
  4. Dubbele bestemming is stored as a JSONB array per parcel, preserving multiple overlapping zonings without data loss
  5. All new tables enforce multi-tenant isolation via RLS policies matching existing NULLIF fail-closed pattern
**Plans**: 4 plans in 3 waves

Plans:
- [x] 18-01: PostGIS extension + GeoAlchemy2 + parcel cache model with GIST-indexed geometry (Wave 1)
- [x] 18-02: Area scan + scan results tables with progress tracking (Wave 2)
- [x] 18-03: Spatial query helpers -- bbox query, coordinate transformation, geometry validation (Wave 2)
- [x] 18-04: RLS policies + multi-tenant isolation tests for all new tables (Wave 3)

### Phase 19: Government API Clients
**Goal**: All government data sources are accessible as tested async clients with pagination, rate limiting, and error handling -- ready for the scanner to orchestrate
**Depends on**: Phase 18
**Requirements**: API-01, API-02, API-03, API-04, DATA-04
**Success Criteria** (what must be TRUE):
  1. BAG WFS client fetches buildings within a bounding box, correctly paginating past the PDOK 1000-feature limit with count verification
  2. SRU Bekendmakingen client retrieves vergunningen for a given parcel identifier, parsing XML responses into structured data
  3. BRK Bevragen client fetches eigendomsdata with proper authentication (mTLS + API key), respecting the never-store cache tier
  4. Per-API rate limiting prevents exhaustion: concurrent request semaphores and requests-per-hour token buckets are enforced across all clients
  5. All clients transform coordinates at the API boundary (EPSG:28992 internally, EPSG:4326 for external GeoJSON)
**Plans**: 5 plans in 3 waves

Plans:
- [x] 19-01: Per-API rate limiter + new dependencies (lxml, aiolimiter) + BRK config settings (Wave 1)
- [x] 19-02: BAG WFS client with httpx pagination and 1000-feature truncation prevention (Wave 2)
- [x] 19-03: SRU Bekendmakingen client with lxml XML parsing (XXE-safe) (Wave 2)
- [x] 19-04: BRK Bevragen client with mTLS authentication (Wave 2)
- [x] 19-05: Unit tests for all API clients and rate limiter (Wave 3)

### Phase 20: Area Scanner + REST API
**Goal**: A complete scan pipeline runs as a background job -- from gemeente bbox to filtered parcel list -- with REST endpoints for triggering, polling, paginating results, and exporting CSV
**Depends on**: Phase 19
**Requirements**: SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, LIST-02, LIST-03
**Success Criteria** (what must be TRUE):
  1. Starting a scan for a gemeente enqueues an ARQ background job that fetches all parcels in the bbox, cross-references with BAG panden, and queries bestemmingen via DSO
  2. Scan progress is queryable via polling endpoint, showing current phase (fetching parcels / cross-referencing BAG / querying bestemmingen) and percentage complete
  3. Scans exceeding 10,000 parcels are rejected before enqueueing, with a clear error message returned to the caller
  4. Completed scan results are available via paginated API (50 per page) with server-side sorting and filtering by bestemming, has_pand, and parcel size
  5. Filtered scan results can be exported as CSV containing address, size, bestemming, and has_pand (no owner information)
**Plans**: TBD (estimated 5-7 plans)

Plans:
- [ ] 20-01: Area scanner service (gemeente to bbox, scan record creation, ARQ job enqueue)
- [ ] 20-02: Scan pipeline stage 1: bulk parcel fetch with WFS pagination
- [ ] 20-03: Scan pipeline stage 2: BAG cross-reference (has_pand) + DSO bestemming query
- [ ] 20-04: Progress tracking and scan status polling endpoint
- [ ] 20-05: Paginated results endpoint with server-side sort and filter
- [ ] 20-06: CSV export endpoint
- [ ] 20-07: Scan size validation + duplicate scan prevention

### Phase 21: Map Visualization
**Goal**: Users can select a gemeente on the map and see scan results rendered as interactive colored parcels -- the visual entry point for area intelligence
**Depends on**: Phase 20
**Requirements**: SCAN-01, MAP-01, MAP-02, MAP-03, MAP-04
**Success Criteria** (what must be TRUE):
  1. CBS gemeente boundary polygons are rendered as a selectable layer on the map, and clicking a gemeente initiates an area scan
  2. PDOK vector tiles display parcel boundaries with click and hover interaction (replacing WMS raster tiles for scan areas)
  3. Martin tile server serves the parcel_cache table as a vector tile layer with score-based color coding (green/yellow/red gradient)
  4. During an active scan, the map shows a progress bar and phase indicator so the user knows the scan is running and how far along it is
**Plans**: TBD (estimated 5-6 plans)

Plans:
- [ ] 21-01: CBS gemeente boundary layer (fetch, render, click-to-select interaction)
- [ ] 21-02: Gemeente selection triggers scan + connects to polling API
- [ ] 21-03: PDOK vector tile layer for parcel boundaries (replace WMS for scan areas)
- [ ] 21-04: Martin tile server setup + score-based color overlay from parcel_cache
- [ ] 21-05: Scan progress UI (progress bar, phase indicators, completion state)

### Phase 22: Parcel List + Detail
**Goal**: Users can browse, filter, and drill into scan results -- from sortable table to AI-generated detail modal with expandable source cards and BRK owner lookup
**Depends on**: Phase 21
**Requirements**: LIST-01, LIST-04, DETAIL-01, DETAIL-02, DETAIL-03, DETAIL-04
**Success Criteria** (what must be TRUE):
  1. Scan results display in a sortable, paginated table (TanStack Table) with columns for address, size, bestemming, has_pand, and score
  2. Filter controls narrow results by bestemming type, has_pand status, and minimum parcel size, with filters applied server-side
  3. Clicking a parcel in the list or on the map opens a detail modal with an AI-generated summary of the development opportunity
  4. The detail modal contains expandable source cards for Kadaster, Bestemming, and Vergunningen data, each showing structured data from the respective API
  5. BRK eigendomsdata is available in the detail modal behind a legitimate interest confirmation dialog, fetched on-demand and never cached
**Plans**: TBD (estimated 5-6 plans)

Plans:
- [ ] 22-01: Parcel list table (TanStack Table, sortable columns, pagination)
- [ ] 22-02: Filter controls (bestemming type, has_pand toggle, minimum size slider)
- [ ] 22-03: Parcel detail modal with AI-generated summary
- [ ] 22-04: Expandable source cards (Kadaster, Bestemming, Vergunningen)
- [ ] 22-05: BRK eigendomsdata integration with legitimate interest confirmation
- [ ] 22-06: List-to-map and map-to-list bidirectional navigation

---

## Progress

**Execution Order:** 18 --> 19 --> 20 --> 21 --> 22

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation & Authentication | v1.0 | 3/3 | Complete | 2026-02-07 |
| 2. Core Data Pipeline | v1.0 | 3/3 | Complete | 2026-02-07 |
| 3. Zoning & Monument Intelligence | v1.0 | 4/4 | Complete | 2026-02-07 |
| 4. AI Document Parsing | v1.0 | 4/4 | Complete | 2026-02-07 |
| 5. Report Management | v1.0 | 3/3 | Complete | 2026-02-07 |
| 6. Security & Configuration | v1.1 | 3/3 | Complete | 2026-02-07 |
| 7. Test Infrastructure & Auth Testing | v1.1 | 2/2 | Complete | 2026-02-07 |
| 8. Data Pipeline Testing | v1.1 | 2/2 | Complete | 2026-02-07 |
| 9. Intelligence Testing | v1.1 | 3/3 | Complete | 2026-02-08 |
| 10. Report & Multi-Tenant Testing | v1.1 | 3/3 | Complete | 2026-02-08 |
| 11. Coverage Gap Closure | v1.1 | 4/4 | Complete | 2026-02-08 |
| 12. Phase Documentation & Verification | v1.1 | 2/2 | Complete | 2026-02-08 |
| 13. Map Foundation & Layout | v2.0 | 3/3 | Complete | 2026-02-08 |
| 14. Authentication & Security | v2.0 | 5/5 | Complete | 2026-02-08 |
| 15. Property Data & Map Interactions | v2.0 | 5/5 | Complete | 2026-02-09 |
| 16. Property Details & Reports | v2.0 | 7/7 | Complete | 2026-02-09 |
| 17. Projects & Polish | v2.0 | 4/4 | Complete | 2026-02-09 |
| 18. Spatial Foundation | v3.0 | 4/4 | Complete | 2026-02-10 |
| 19. Government API Clients | v3.0 | 5/5 | Complete | 2026-02-10 |
| 20. Area Scanner + REST API | v3.0 | 0/7 | Not started | - |
| 21. Map Visualization | v3.0 | 0/5 | Not started | - |
| 22. Parcel List + Detail | v3.0 | 0/6 | Not started | - |

---

*Last updated: 2026-02-10 (Phase 19 complete)*
