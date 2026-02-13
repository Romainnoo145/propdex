# Propdex -- Roadmap

## Milestones

- 🚧 **v3.1 Smart Area Intelligence** -- Phases 22-26 (in progress)
- ✅ **v3.0 Spatial Foundation** -- Phases 18-21 (shipped 2026-02-11)
- ✅ **v2.0 Frontend** -- Phases 13-17 (shipped 2026-02-09)
- ✅ **v1.1 Production Hardening** -- Phases 6-12 (shipped 2026-02-08)
- ✅ **v1.0 Core Intelligence Engine** -- Phases 1-5 (shipped 2026-02-07)

## Phases

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

### 🚧 v3.1 Smart Area Intelligence (Phases 22-26)

**Milestone Goal:** Transform from address-first to area-first intelligence with bestemmingsplan base layer visualization, focused area deep-dive scanning via user-drawn bbox, zoning-aware opportunity scoring, and change monitoring for permits and zoning updates.

**Built on v3.0 infrastructure:** PostGIS spatial DB (Phase 18), government API clients (Phase 19), scan pipeline + scoring (Phase 20), map gemeente boundaries + MVT tiles (Phase 21)

**Architecture Approach:**
- ADDITIVE extension of existing scan pipeline (AreaScan model, ARQ worker, progress tracking)
- Zero new backend dependencies (httpx, lxml, shapely, ARQ all present)
- Zero new frontend dependencies (MapLibre, @watergis/maplibre-gl-terradraw, @turf/turf all present from v3.0)
- Direct PDOK WMS from frontend (CORS-enabled, no backend proxy)
- Ruimtelijkeplannen.nl REST API v4 (NOT deprecated WFS from July 2024)

**Dependency Chain:**
```
Phase 23 (Working Gemeente Scan) --> Phase 24 (Progressive Scan UX) --> Phase 25 (Results Interface)
                                                                                    |
                                                                          Phase 26 (Change Monitoring)
```

---

## Phase Details

### Phase 22: Bestemmingsplan Base Layer
**Goal**: User can visualize zoning plans as colored zones on the map and understand plan context
**Depends on**: Phase 21 (Map visualization infrastructure)
**Requirements**: ZONE-01, ZONE-02, ZONE-03
**Success Criteria** (what must be TRUE):
  1. User can toggle a bestemmingsplan layer showing colored zones per SVBP2012 standard (wonen, bedrijven, agrarisch, groen)
  2. User can click a zoning area to see plan name, bestemming type, and link to official document
  3. User can view bestemmingsplan layer simultaneously with aerial imagery and kadaster parcels
  4. Layer legend displays hoofdgroepen with color key matching SVBP2012 standard
**Plans**: 3 plans

Plans:
- [x] 22-01-PLAN.md -- WMS layer + SVBP2012 colors + LayerToggle integration
- [x] 22-02-PLAN.md -- GetFeatureInfo click handler + zone info popup
- [x] 22-03-PLAN.md -- SVBP2012 legend component + visual verification

---

### Phase 23: Working Gemeente Scan (REVISED)
**Goal**: User clicks a gemeente, triggers a full scan, and gets results with bestemmingsplan-enriched scores
**Depends on**: Phase 22 (Bestemmingsplan visualization)
**Requirements**: DIVE-01, DIVE-02, DIVE-03, DIVE-04, SCORE-01
**Success Criteria** (what must be TRUE):
  1. User can click a gemeente boundary to trigger a full-municipality scan (no 10 km² limit)
  2. Scan fetches BAG buildings AND bestemmingsplan polygons via PDOK PLU WFS
  3. PostGIS spatial join assigns bestemmingen to each parcel during scan
  4. Opportunity scores are meaningful (zoning factor produces 0 or 25 based on actual bestemming data)
  5. Colored parcels appear on map via existing MVT tile infrastructure after scan completes
  6. Results API filtering by bestemming_type works with real data
**Plans**: 4 plans

Plans:
- [x] 23-01-PLAN.md -- Bbox extraction utilities + ScanAreaHighlightLayer (DONE, being revised)
- [x] 23-02-PLAN.md -- Backend bbox scan support with coordinate conversion (DONE)
- [ ] 23-03-PLAN.md -- Wire click-to-scan flow
- [ ] 23-04-PLAN.md -- PDOK PLU WFS client + bestemmingsplan enrichment in scan job

---

### Phase 24: Progressive Scan UX (REVISED - was Zone-Enriched Scanning)
**Goal**: Scan feels fast and responsive with parcels appearing on map in real-time
**Depends on**: Phase 23 (Working scan with real data)
**Requirements**: DIVE-03 (enhanced), MAP-04 (enhanced)
**Success Criteria** (what must be TRUE):
  1. Parcels appear on the map progressively as they are processed (not all at once after completion)
  2. Live counters show: "327 / 2,145 percelen — 12 hoog, 89 midden, 226 laag"
  3. Score distribution updates in real-time during scan
  4. Scan cancellation remains responsive
**Plans**: TBD (estimated 3 plans)

Plans:
- [ ] 24-01: SSE endpoint + Redis pub/sub for scan progress streaming
- [ ] 24-02: Modify area_scan_job to publish batch events
- [ ] 24-03: Frontend SSE hook, progressive tile refresh, live counters

---

### Phase 25: Results Interface (UNCHANGED scope, now has real data)
**Goal**: User can browse, filter, and explore scan results with zone intelligence
**Depends on**: Phase 24 (Progressive scan UX)
**Requirements**: LIST-01, LIST-02, LIST-03, SCORE-02
**Success Criteria** (what must be TRUE):
  1. Split-panel layout: results table + map side by side
  2. Sortable table (parcel code, address, area, bestemming type, score)
  3. Filter panel: bestemming type, has_pand, area range, score category
  4. Map-table bidirectional linking (click parcel on map highlights row, click row flies to parcel)
  5. Parcel detail modal with Tier 2 on-demand enrichment (vergunningen via SRU)
**Plans**: TBD (estimated 5 plans)

Plans:
- [ ] 25-01: Split-panel layout with resizable table + map
- [ ] 25-02: Results table with sorting, pagination, score badges
- [ ] 25-03: Filter panel (bestemming type, area range, score category)
- [ ] 25-04: Map-table bidirectional linking
- [ ] 25-05: Parcel detail modal with Tier 2 enrichment

---

### Phase 26: Change Monitoring (UNCHANGED, reuses PLU WFS)
**Goal**: User stays informed of new permits and zoning changes in watched areas
**Depends on**: Phase 25 (Complete scan workflow)
**Requirements**: MON-01, MON-02, MON-03, MON-04
**Success Criteria** (what must be TRUE):
  1. System checks daily for new omgevingsvergunningen via SRU Bekendmakingen
  2. System checks daily for bestemmingsplan changes via PDOK PLU WFS (reuses Phase 23 client)
  3. User sees in-app notification badges for changes since last visit
  4. User can save scan areas for ongoing monitoring
  5. User can view change history for monitored areas
**Plans**: TBD (estimated 5 plans)

Plans:
- [ ] 26-01: WatchedArea model + save/list endpoints
- [ ] 26-02: Change detection service (SRU + PLU WFS delta)
- [ ] 26-03: ARQ cron job for daily monitoring
- [ ] 26-04: ChangeNotification model + badge API
- [ ] 26-05: Frontend notification UI (badge, timeline, save-to-watch)

---

## Progress

**Execution Order:** 22 --> 23 --> 24 --> 25 --> 26

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
| 20. Area Scanner + REST API | v3.0 | 6/6 | Complete | 2026-02-10 |
| 21. Map Visualization | v3.0 | 5/5 | Complete | 2026-02-11 |
| 22. Bestemmingsplan Base Layer | v3.1 | 3/3 | Complete | 2026-02-11 |
| 23. Working Gemeente Scan | v3.1 | 2/4 | In progress | - |
| 24. Progressive Scan UX | v3.1 | 0/3 | Not started | - |
| 25. Results Interface | v3.1 | 0/5 | Not started | - |
| 26. Change Monitoring | v3.1 | 0/5 | Not started | - |

---

*Roadmap created for v3.1: 2026-02-11*
*Last updated: 2026-02-14 (Phase 23-26 structure revised)*
