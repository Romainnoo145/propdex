# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v3.1 Smart Area Intelligence -- Area Selection Tools (Phase 23)

---

## Current Position

**Milestone:** v3.1 Smart Area Intelligence
**Phase:** 23 of 26 (Area Selection Tools)
**Plan:** 2 of 3
**Status:** In progress

**Last activity:** 2026-02-11 — Plan 23-02 complete (backend bbox acceptance with validation)

**Progress:** [██████████] 96%

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

**Phase 23 decisions:**
- Server-side coordinate conversion (no frontend proj4 dependency)
- 10 km² area limit enforced in RD New (conformal projection)

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

---

## Session Continuity

**Last Session:** 2026-02-11T09:17:03.863Z
**Stopped At:** Completed 23-02-PLAN.md
**Resume File:** None

**Next Action:** `/gsd:execute-plan 23 03` to implement frontend draw tools

---

*State updated: 2026-02-11 (Plan 23-02 complete)*
