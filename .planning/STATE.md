# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** Area -> Opportunity Intelligence
**Current focus:** v3.0 Area Intelligence -- Phase 18 complete, Phase 19 next

---

## Current Position

**Milestone:** v3.0 Area Intelligence (Phases 18-22)
**Phase:** 18 of 22 (Spatial Foundation)
**Plan:** 4 of 4 complete
**Status:** Phase complete

**Last activity:** 2026-02-10 -- 18-04 RLS Multi-Tenant Spatial Isolation complete (2 tasks, 2 commits)

**Progress:** [██████████] 100%

---

## Performance Metrics

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

v3.0 architecture decisions:
- PostGIS for spatial joins (not Python Shapely)
- ARQ for batch processing with polling (not WebSockets)
- PDOK vector tiles + Martin tile server for map rendering
- Three-tier cache (DB pre-scan / JSONB on-demand / BRK never-store)
- CBS gemeente boundaries for area selection

Phase 18 implementation decisions:
- **18-01:** Use postgis/postgis:16-3.5 Docker image (Alpine's PostGIS is PostgreSQL 18-only)
- **18-01:** Create GIST spatial index via raw SQL in migration (Alembic doesn't auto-detect geometry indexes)
- **18-03:** Use func.ST_* pattern for PostGIS function access instead of direct geoalchemy2.functions imports
- **18-03:** Module-level pyproj Transformer singletons for 100x coordinate transformation speedup
- **18-04:** Test RLS via policy existence checks and organization_id filtering (test DB uses superuser which bypasses RLS)

### Active TODOs

- [ ] Fix backend register endpoint 500 error
- [ ] Production deployment: Create app_role
- [ ] Production deployment: Update Docker container to postgis/postgis:16-3.5
- [ ] Test Claude API with real bestemmingsplan PDFs
- [ ] BAG API key aanvragen (gratis)
- [ ] DSO API key aanvragen (gratis)
- [ ] ProjectList live mode: fetch reports per expanded project card
- [ ] Kadaster BRK Bevragen API toegang regelen (betaald)

### Blockers

(None)

### Known Issues

- Backend register endpoint returns 500 (needs investigation)
- Kadaster eigendomsdata requires paid API
- Monument restrictions are generic boilerplate (not property-specific)
- Parcel click/highlight not possible with WMS raster tiles (v3.0 Phase 21 addresses this)
- Mobile navigation: Side-rail hidden on mobile, no replacement navigation exists yet

---

## Session Continuity

**Last Session:** 2026-02-10
**Stopped At:** Phase 18 complete — verified 5/5 must-haves. Phase 19 ready to plan.
**Resume File:** None

---

*Last updated: 2026-02-10 (Phase 18 Spatial Foundation complete - 4/4 plans)*

**18-02 decisions:**
- Use join table (ScanResult) instead of JSONB array for scan results to maintain FK integrity
- Store bounding box as 4 floats for EPSG:28992 coordinates
