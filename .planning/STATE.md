# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** Area -> Opportunity Intelligence
**Current focus:** v3.0 Area Intelligence -- Phase 18 complete, Phase 19 next

---

## Current Position

**Milestone:** v3.0 Area Intelligence (Phases 18-22)
**Phase:** 20 of 22 (Area Scanner REST API)
**Plan:** 4 of 6
**Status:** In Progress

**Last activity:** 2026-02-10 -- 20-04 Area Scan Background Job complete (2 tasks, 2 commits)

**Progress:** [██████████] 97%

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

Phase 19 implementation decisions:
- **19-01:** Use dual-layer rate limiting (semaphore for concurrency, token bucket for time-based)
- **19-01:** Conservative BRK limits (2 concurrent, 200/hour) as it's a paid API
- **19-02:** Rate limit each WFS page request individually (not just the initial request) to prevent quota exhaustion during long-running pagination
- **19-02:** Use numberMatched vs numberReturned comparison for truncation detection (not just feature count < PAGE_SIZE)
- **19-03:** Use TypedDict for BekendmakingRecord instead of Pydantic model (no validation needed for read-only API responses)
- **19-03:** Defensive field extraction with default='' fallback for all XML fields (SRU namespaces vary between response types)
- **19-03:** Return tuple (records, total_count) from query_by_municipality to enable pagination decisions by caller
- **19-04:** Create separate httpx.AsyncClient for BRK with mTLS SSLContext (not shared app client)
- **19-04:** Gracefully disable BRK client in dev without certificates (logs warning, allows app startup)

Phase 20 implementation decisions:
- **20-01:** Use CQL_FILTER for CBS WFS queries (simpler than XML Filter)
- **20-01:** Use 2024 CBS WFS endpoint (latest stable, 2026 may not exist)
- **20-02:** Fixed scoring formula for all organizations (per-org weights deferred to future phase)
- **20-02:** Protocol-based parcel_data parameter (not ORM model) for improved testability
- **20-02:** Four-factor weighted model (vacant_land 30, size_optimal 25, zoning_residential 25, recent_permits 20)
- **20-04:** Skip DSO bestemming queries during bulk scan (add as on-demand Tier 2)
- **20-04:** Process BAG WFS features as buildings with has_pand=True (MVP approach)

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

**Last Session:** 2026-02-10T15:04:06.048Z
**Stopped At:** Completed 20-04-PLAN.md
**Resume File:** None

---

*Last updated: 2026-02-10 (Phase 20 Area Scanner REST API in progress - 4/6 plans)*
