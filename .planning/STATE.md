# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Area -> Opportunity Intelligence
**Current focus:** v3.1 Smart Area Intelligence -- Defining requirements

---

## Current Position

**Milestone:** v3.1 Smart Area Intelligence
**Phase:** Not started (defining requirements)
**Plan:** —
**Status:** Defining requirements

**Last activity:** 2026-02-11 — Milestone v3.1 started

---

## Performance Metrics

**v3.0 Infrastructure (Shipped: 2026-02-11)**
- 4 phases (18-21), ~20 plans, infrastructure for area intelligence
- PostGIS, government API clients, scan pipeline, map visualization
- Pivoted: "scan all panden" approach replaced by bestemmingsplan-first

**v2.0 Shipped:** 2026-02-09
- 5 phases (13-17), 24 plans, 9 requirements
- 8,804 LOC TypeScript/React, 117 commits

**v1.1 Shipped:** 2026-02-08
- 7 phases (6-12), 19 plans, 15 requirements
- 275 tests, 15,947 LOC Python

**v1.0 Shipped:** 2026-02-07
- 5 phases (1-5), 17 plans, 14 requirements
- 8,281 LOC Python

---

## Accumulated Context

### Key Decisions

See `.planning/PROJECT.md` Key Decisions table.

v3.0 architecture decisions (still valid):
- PostGIS for spatial joins (not Python Shapely)
- ARQ for batch processing with polling (not WebSockets)
- Three-tier cache (DB pre-scan / JSONB on-demand / BRK never-store)
- CBS gemeente boundaries for area selection
- EPSG:28992 storage, EPSG:4326 for GeoJSON responses

v3.1 pivot decisions:
- Bestemmingsplan as base layer (not all panden) — developers need zoning view first
- Area deep-dive on user-selected bbox (not whole gemeente) — manageable parcel counts
- Change monitoring as ongoing value (not one-time scan) — the recurring revenue feature
- CBS WFS uses gebiedsindelingen:gemeente_gegeneraliseerd typeName with statcode filter
- BAG WFS resultType=hits returns XML (not JSON) — need XML parsing for count pre-checks
- MapLibre WebGL doesn't support CSS variables in paint properties — use hex colors

### Active TODOs

- [ ] Fix backend register endpoint 500 error
- [ ] Production deployment: Create app_role
- [ ] Production deployment: Update Docker container to postgis/postgis:16-3.5
- [ ] Test Claude API with real bestemmingsplan PDFs
- [ ] BAG API key aanvragen (gratis)
- [ ] DSO API key aanvragen (gratis)
- [ ] ProjectList live mode: fetch reports per expanded project card
- [ ] Kadaster BRK Bevragen API toegang regelen (betaald)
- [ ] Fix parcel count pre-check CRS mismatch (CBS bbox EPSG:28992 vs BAG WFS EPSG:4326)

### Blockers

(None)

### Known Issues

- Backend register endpoint returns 500 (needs investigation)
- Kadaster eigendomsdata requires paid API
- Monument restrictions are generic boilerplate (not property-specific)
- Mobile navigation: Side-rail hidden on mobile, no replacement navigation exists yet
- Parcel count pre-check disabled (CRS mismatch between CBS bbox and BAG WFS)
- BAG WFS pagination limit of 1000 features per request

---

## Session Continuity

**Last Session:** 2026-02-11
**Stopped At:** Starting v3.1 milestone
**Resume File:** None

---

*Last updated: 2026-02-11 (Milestone v3.1 Smart Area Intelligence started)*
