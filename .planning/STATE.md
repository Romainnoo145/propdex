# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v6.0 Deep Property Data

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v6.0
Last activity: 2026-02-21 — Milestone v6.0 started

---

## Performance Metrics

**v5.0 Scan Intelligence (Shipped: 2026-02-20)**
- 5 phases (37-41), 11 plans, 51 commits, 65 files changed (+9,264/-2,326)
- Phase 37: 12 min, Phase 38: 6 min, Phase 39: 8 min, Phase 40: 7 min, Phase 41: 5 min

**v4.0 UX Redesign (Shipped: 2026-02-18)**
- 10 phases (27-36), 31 plans, 129 commits, ~16,234 LOC TypeScript/React

**v3.1 Smart Area Intelligence (Shipped: 2026-02-15)**
- 5 phases (22-26), 22 plans, 97 commits, ~27,200 LOC

**v3.0 Spatial Foundation (Shipped: 2026-02-11)**
- 4 phases (18-21), 20 plans, 72 commits

**v2.0 Frontend (Shipped: 2026-02-09)**
- 5 phases (13-17), 24 plans, 117 commits, 8,804 LOC TypeScript/React

**v1.1 Production Hardening (Shipped: 2026-02-08)**
- 7 phases (6-12), 19 plans, 71 commits, 275 tests, 15,947 LOC Python

**v1.0 Core Intelligence Engine (Shipped: 2026-02-07)**
- 5 phases (1-5), 17 plans, 79 commits, 8,281 LOC Python

---

## Accumulated Context

### Key Patterns (carry forward)

- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- parcel_cache.geometry is EPSG:28992; always ST_Transform(geometry, 4326) before GeoJSON
- 404 not 403 for cross-org access (prevents enumeration)
- Static sub-paths before parameterized paths in FastAPI routing
- pg_insert().on_conflict_do_nothing() for idempotent bulk inserts
- ProjectEditModal/ProjectCreateModal use intentional light-theme gray-* (white card on dark backdrop)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 3 | Commit the bekendmaking matching implementation | 2026-02-20 | 257041e | [3-commit-the-bekendmaking-matching-impleme](./quick/3-commit-the-bekendmaking-matching-impleme/) |

### Ongoing TODOs

- Production deployment: Create app_role (sql/setup_app_role.sql)
- Production deployment: Update Docker container to postgis/postgis:16-3.5
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)

---

## Session Continuity

**Last Session:** 2026-02-21
**Stopped At:** Milestone v6.0 initialized, defining requirements
**Resume File:** None

**Next Action:** Define requirements and create roadmap

---

*State updated: 2026-02-21 — Milestone v6.0 Deep Property Data started*
