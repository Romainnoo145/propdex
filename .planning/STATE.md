# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v3.1 Smart Area Intelligence -- Phase 24 complete, Phase 25 next

---

## Current Position

**Milestone:** v3.1 Smart Area Intelligence
**Phase:** 26 of 26 (Change Monitoring) — IN PROGRESS
**Plan:** 4/5 plans complete
**Status:** Phase 26 in progress (Frontend Notification UI)

**Last activity:** 2026-02-15 — Completed 26-04-PLAN.md (Frontend Notification UI)

**Progress:** [██████████] 98%

---

## Performance Metrics

**v3.1 Smart Area Intelligence (In Progress)**
- 5 phases (22-26), ~15-20 plans estimated, 16 requirements
- Built on v3.0 infrastructure (PostGIS, API clients, scan pipeline, map)

**v3.0 Spatial Foundation (Shipped: 2026-02-11)**
- 4 phases (18-21), 20 plans, 14 requirements
- PostGIS, government API clients, scan pipeline, map visualization

**v2.0 Frontend (Shipped: 2026-02-09)**
- 5 phases (13-17), 24 plans, 9 requirements
- 8,804 LOC TypeScript/React, 117 commits

**v1.1 Production Hardening (Shipped: 2026-02-08)**
- 7 phases (6-12), 19 plans, 15 requirements
- 275 tests, 15,947 LOC Python

**v1.0 Core Intelligence Engine (Shipped: 2026-02-07)**
- 5 phases (1-5), 17 plans, 14 requirements
- 8,281 LOC Python

---

## Accumulated Context

### Key Decisions

See `.planning/PROJECT.md` Key Decisions table.

**v3.1 architecture approach (from roadmap):**
- ADDITIVE extension of existing scan pipeline (no core rewrites)
- Zero new dependencies (httpx, lxml, shapely, ARQ, MapLibre, terradraw, turf all present)
- Direct PDOK WMS from frontend (CORS-enabled, no backend proxy)
- Ruimtelijkeplannen.nl REST API v4 (NOT deprecated WFS from July 2024)
- Bestemmingsplan-first workflow (show zones, let user select areas, scan on-demand)

**Phase 26 decisions:**
- Self-referential Project relationships for gemeente/wijk hierarchy (26-01)
- JSONB metadata_json field mapped to change_metadata column to avoid SQLAlchemy collision (26-01)
- Unique constraint on (change_type, external_id, gemeente_naam) prevents duplicate change records (26-01)
- Naive UTC datetimes (not timezone-aware) following project convention (26-01)

**Phase 25 decisions:**
- Collapsed prop pattern to prevent MapView re-mount when showing results panel (25-01)
- 45/55 default split (results/map) - balances visibility with map dominance (25-01)
- Glassmorphism placeholder styling (bg-black/40 backdrop-blur-xl) consistent with Propdex aesthetic (25-01)
- Panel sizes persist in localStorage via autoSaveId="propdex-results" (25-01)
- Default sort: score descending (most promising parcels first) (25-02)
- 50 results per page (balance overview vs performance) (25-02)
- ScoreBadge as inline component (co-located with columns for clarity) (25-02)
- Bestemming column shows first type only, truncated to 25 chars (25-02)
- 500ms debounce on area input (prevent excessive API calls while typing) (25-03)
- Reset pagination to page 0 when filters change (avoid empty page state) (25-03)
- Clear button preserves sort/pagination (filters distinct from view settings) (25-03)
- SVBP2012 hoofdgroepen for bestemming dropdown (matches PDOK layer data) (25-03)
- Track selection source (table vs map) with ref to prevent infinite loops (25-04)
- Selected state separate from hover state for clarity (25-04)
- Always scrollIntoView on selection change (simpler, no edge cases) (25-04)
- FlyTo with Math.max(currentZoom, 16) to preserve user context (25-04)
- On-demand enrichment (not pre-loaded) - fetch only when user opens detail modal (25-05)
- 7-day cache for vergunningen enrichment (balances freshness vs API load) (25-05)
- Postcode extraction from address via regex (no separate field needed) (25-05)
- Native details/summary for expandable sections (accessible, performant) (25-05)
- Double-click to open modal (single-click already used for selection) (25-05)

**Phase 24 decisions:**
- Use CBS WFS 2024 (not 2026) for wijk data - 2026 incomplete
- OGC XML FILTER with PropertyIsLike for wijk lookup (CQL_FILTER ignored)
- Return full GeoJSON FeatureCollection wrapper (frontend needs it)
- EPSG:4326 output for direct MapLibre consumption
- Emerald green (#10b981) for wijken distinct from gemeente blue (#3b82f6)
- Labels visible at minzoom 12 (gemeente detail level, not NL overview)
- Insert wijken before gemeente-fill layer (smaller areas render on top)
- Cache GeoJSON at module level for full geometry lookup (not from rendered features)
- Gemeente click no longer triggers scan directly — now loads wijken for user selection (24-03)
- Wijken toggle defaults to visible when gemeente becomes active (24-03)
- Use refs for activeScanId, activeGemeente, wijkGeojson to avoid stale closure in click handlers (24-03)
- Gemeente context header at top-center with close button (24-03)

**Phase 23 decisions:**
- REVERTED: Drawing tools (terra-draw) removed — not natural UX for real estate developers
- PIVOT: Click-based area selection using existing map features (bestemmingsplan zones, gemeente boundaries)
- KEPT: Backend bbox support (23-02) — coordinate conversion, area validation, 10 km² limit
- Server-side coordinate conversion (no frontend proj4 dependency)
- Plan 23-01: Imperative layer management pattern for ScanAreaHighlightLayer (consistent with PropertyGeometryLayer)
- Plan 23-01: Client-side bbox calculation from GeoJSON geometry (not available in CBS WFS properties)

**Phase 22 decisions:**
- Minzoom 10 for bestemmingsplan layer (gemeente overview context, not parcel-only)
- WMS raster tiles for enkelbestemming (PDOK vector tiles not available)
- Opacity 0.6 for zone overlay (balance visibility with basemap coexistence)

**v3.0 foundations (still valid):**
- PostGIS for spatial joins (not Python Shapely)
- ARQ for batch processing with polling (not WebSockets)
- Three-tier cache (DB pre-scan / JSONB on-demand / BRK never-store)
- EPSG:28992 storage, EPSG:4326 for GeoJSON responses

### Active TODOs

From STATE.md before v3.1:
- [ ] Fix backend register endpoint 500 error
- [ ] Production deployment: Create app_role
- [ ] Production deployment: Update Docker container to postgis/postgis:16-3.5
- [ ] Test Claude API with real bestemmingsplan PDFs
- [ ] BAG API key aanvragen (gratis)
- [ ] DSO API key aanvragen (gratis)
- [ ] ProjectList live mode: fetch reports per expanded project card
- [ ] Kadaster BRK Bevragen API toegang regelen (betaald)

**New for v3.1:**
- [ ] Ruimtelijkeplannen.nl REST API v4 key (needed for Phase 26)

### Blockers

**Phase 26 (Change Monitoring):**
- Ruimtelijkeplannen.nl REST API v4 requires API key — request from Informatiehuis Ruimte before Phase 26 planning
- IMRO vs STOP/TPOD format fragmentation — requires dual parser support (TAM-IMRO ends January 1, 2026)

### Known Issues

From v3.0:
- Backend register endpoint returns 500 (needs investigation)
- Kadaster eigendomsdata requires paid API
- Monument restrictions are generic boilerplate (not property-specific)
- Mobile navigation: Side-rail hidden on mobile, no replacement navigation exists yet
- Parcel count pre-check disabled (CRS mismatch between CBS bbox and BAG WFS)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 2 | Redesign scoring, add qualification filter, and resolve addresses | 2026-02-15 | 265aa49 | [2-redesign-scoring-add-qualification-filte](./quick/2-redesign-scoring-add-qualification-filte/) |

---

**Phase 26 Plan Execution Metrics:**

| Plan | Duration (s) | Tasks | Files |
|------|--------------|-------|-------|
| P01  | -            | -     | -     |
| P02  | 250          | 2     | 4     |
| P03  | 83           | 2     | 2     |
| P04  | 257          | 2     | 7     |

## Session Continuity

**Last Session:** 2026-02-15T13:40:31Z
**Stopped At:** Completed 26-04-PLAN.md
**Resume File:** .planning/phases/26-change-monitoring/26-04-SUMMARY.md

**Next Action:** `/gsd:execute-plan 26 05` — Execute Plan 26-05 (final plan in phase)

---

*State updated: 2026-02-15 — Completed 26-04-PLAN.md (Frontend Notification UI)*
