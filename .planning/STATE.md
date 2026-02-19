# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v5.0 Scan Intelligence -- Phase 37: Scan History Backend

---

## Current Position

Phase: 37 of 41 (Scan History Backend)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-19 -- Plan 37-01 complete: GET /api/scans paginated endpoint

Progress: [█░░░░░░░░░] 8% (1/12 plans complete)

---

## Performance Metrics

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

### Decisions

- [v5.0 roadmap]: No new dependencies required -- scan history reuses AreaScan table, MVT tiles extended via LEFT JOIN, report-from-parcel reuses existing property_aggregator
- [v5.0 roadmap]: Lead pipeline deferred to future milestone -- not in v5.0 scope
- [v5.0 roadmap]: Bug fixes grouped into Phase 41 for clean milestone close; they are parallel-safe but batched at end
- [v4.0]: Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()` -- causes transaction already begun)
- [v4.0]: parcel_cache.geometry is EPSG:28992; always use ST_Transform(geometry, 4326) before GeoJSON serialization
- [37-01]: Use COUNT(scan_results) not parcels_total for parcel_count in scan history -- parcels_total reflects discovered parcels, scan_results count is actual qualifying results
- [37-01]: list_scans() accepts optional project_id so Plan 37-02 can reuse without changes

### Known Issues (v5.0 scope)

- Backend register endpoint returns 500 -- FIX-01 (Phase 41)
- ARQ worker re-runs create duplicate ScanResult rows -- FIX-02 (Phase 41)
- react-resizable-panels unused in package.json -- FIX-03 (Phase 41)
- ChangeTimeline.tsx and ProjectEditModal.tsx have legacy gray-* classes -- FIX-03 (Phase 41)

### Ongoing TODOs (post-v5.0)

- Production deployment: Create app_role (sql/setup_app_role.sql)
- Production deployment: Update Docker container to postgis/postgis:16-3.5
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)

---

## Session Continuity

**Last Session:** 2026-02-19
**Stopped At:** Completed 37-01-PLAN.md -- GET /api/scans endpoint shipped
**Resume File:** None

**Next Action:** `/gsd:execute-phase 37` -- Execute Plan 37-02 (project-scoped scan filter)

---

*State updated: 2026-02-19 -- Plan 37-01 complete*
