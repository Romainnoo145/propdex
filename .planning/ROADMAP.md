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
Phase 22 (Visual Foundation) --> Phase 23 (Area Selection) --> Phase 24 (Zone-Enriched Scanning)
                                                                           |
                                                              Phase 25 (Results Interface)
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

### Phase 23: Area Selection Tools
**Goal**: User can select areas on the map via click interaction to define scan boundaries
**Depends on**: Phase 22 (Visual context for selection)
**Requirements**: DIVE-01, DIVE-02, DIVE-03
**Success Criteria** (what must be TRUE):
  1. User can click on a bestemmingsplan zone or gemeente boundary to select a scan area
  2. User can trigger a focused BAG scan on the selected area (hundreds of parcels, not full gemeente)
  3. User sees scan progress with phase indicator and percentage during area deep-dive
  4. Selected area is highlighted on the map for visual confirmation before scanning
**Plans**: 3 plans

Plans:
- [ ] 23-01-PLAN.md -- Bbox extraction utilities + ScanAreaHighlightLayer component
- [x] 23-02-PLAN.md -- Backend bbox scan support with area validation + coordinate conversion (DONE)
- [ ] 23-03-PLAN.md -- Wire click-to-scan flow with confirmation UX + visual verification

---

### Phase 24: Zone-Enriched Scanning
**Goal**: Scan results include bestemmingsplan context and zoning-aware scoring
**Depends on**: Phase 23 (Area selection triggers scans)
**Requirements**: DIVE-04, SCORE-01
**Success Criteria** (what must be TRUE):
  1. Scan results include bestemmingsplan hoofdgroep per parcel from zoning context
  2. Opportunity score factors in bestemmingsplan type (wonen = high, agrarisch = medium for residential developers)
  3. Scoring weights are configurable and visible to users
**Plans**: TBD (estimated 2-3 plans)

Plans:
- [ ] 24-01: TBD (Extend scan pipeline with zone lookup)
- [ ] 24-02: TBD (Zoning-aware scoring)
- [ ] 24-03: TBD (Scoring weight configuration)

---

### Phase 25: Results Interface
**Goal**: User can browse, filter, and explore scan results with zone intelligence
**Depends on**: Phase 24 (Zone-enriched scan data)
**Requirements**: LIST-01, LIST-02, LIST-03, SCORE-02
**Success Criteria** (what must be TRUE):
  1. User can view scan results in a sortable table (address, size, zone type, score)
  2. User can filter results by bestemmingsplan type, has_pand status, and minimum score
  3. User can click a parcel in list or on map to see detail modal with expandable source cards
  4. Scan results are colored on the map by score (green/yellow/red gradient)
**Plans**: TBD (estimated 4-5 plans)

Plans:
- [ ] 25-01: TBD (Parcel list table)
- [ ] 25-02: TBD (Filter controls)
- [ ] 25-03: TBD (Score-based map coloring)
- [ ] 25-04: TBD (Parcel detail modal)
- [ ] 25-05: TBD (Expandable source cards)

---

### Phase 26: Change Monitoring
**Goal**: User stays informed of new permits and zoning changes in watched areas
**Depends on**: Phase 25 (Complete scan workflow to establish monitoring baseline)
**Requirements**: MON-01, MON-02, MON-03, MON-04
**Success Criteria** (what must be TRUE):
  1. System checks daily for new omgevingsvergunningen in user's watched gemeentes via SRU Bekendmakingen
  2. System checks daily for bestemmingsplan changes in watched gemeentes via Ruimtelijkeplannen.nl REST API v4
  3. User sees in-app notification badges for new changes since last visit
  4. User can save scan areas for ongoing monitoring
  5. User can view change history for monitored areas
**Plans**: TBD (estimated 4-5 plans)

Plans:
- [ ] 26-01: TBD (Ruimtelijkeplannen.nl REST API client)
- [ ] 26-02: TBD (ARQ cron jobs for daily checks)
- [ ] 26-03: TBD (Change tracking tables + service)
- [ ] 26-04: TBD (Save scan areas for monitoring)
- [ ] 26-05: TBD (Notification UI + badges)

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
| 23. Area Selection Tools | v3.1 | 1/3 | In progress | - |
| 24. Zone-Enriched Scanning | v3.1 | 0/? | Not started | - |
| 25. Results Interface | v3.1 | 0/? | Not started | - |
| 26. Change Monitoring | v3.1 | 0/? | Not started | - |

---

*Roadmap created for v3.1: 2026-02-11*
*Last updated: 2026-02-11 (Phase 22 complete)*
