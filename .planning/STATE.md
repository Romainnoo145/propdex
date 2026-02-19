# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v5.0 Scan Intelligence -- Phase 39 Plan 02 complete (score toggle wired)

---

## Current Position

Phase: 39 of 41 (Map Parcel Visualization)
Plan: 02 complete (score toggle)
Status: Active
Last activity: 2026-02-19 -- Phase 39 Plan 02 complete: Perceel Score toggle wired to parcel score layer

Progress: [█████░░░░░] 42% (5/12 plans complete)

---

## Performance Metrics

**v5.0 Scan Intelligence (In Progress)**
- Phase 37: 6 min (37-01) + 6 min (37-02) = 12 min total, 2 plans, 2 files modified
- Phase 38: 2 min (38-01) + 4 min (38-02) = 6 min total, 2 plans, 4 files modified
- Phase 39: 6 min (39-01) + 2 min (39-02) = 8 min total, 2 plans, 4 files modified

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
- [37-02]: 404 not 403 for cross-org projects in sub-resource endpoints -- consistent with get_project, prevents enumeration
- [37-02]: Sub-resource pattern: verify parent ownership (project -> org) first, then query child via service layer
- [38-01]: 5-minute staleTime for scan history hooks -- balances freshness vs network requests for infrequently-changing data
- [38-01]: useProjectScans disabled when projectId is null -- only fetches when wijk row is expanded (consistent with useScanPolling pattern)
- [38-01]: useTriggerScan invalidates both scan-history and project-scans -- new scan appears immediately in all views
- [38-02]: WijkScanList sub-component encapsulates useProjectScans -- hook fires only when row is expanded, not on page load
- [38-02]: Single WijkScanList component handles both monitoring wijks and regular projects -- both provide project.id
- [38-02]: DEMO_REPORTS removed completely -- Projecten view now shows real scan history from backend API
- [39-01]: Amber overlay (rgba(245,158,11,0.25) fill, rgba(245,158,11,0.7) line) -- visually distinct from emerald (unscanned) and blue (monitored wijken)
- [39-01]: Scanned wijk highlight effect placed AFTER monitored wijk overlay effect -- both insert before wijk-fill, order matters for layer stacking
- [39-01]: Score layer restoration fires on [activeScanId, mapReady] -- separate from live scan completion effect on [scanStatus.data] to handle URL restoration path
- [39-02]: showScoreToggle={!!activeScanId} -- toggle appears on scan start or URL restoration (scan_id param), disappears when scan cleared
- [39-02]: showScore defaults to true -- consistent with score layer being added visible on scan completion; reset effect (prevShowScoreToggleRef) resets to visible when scan becomes active

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
**Stopped At:** Completed 39-02-PLAN.md -- Perceel Score toggle button wired to parcel score layer visibility
**Resume File:** None

**Next Action:** Continue Phase 39 plans (39-03+) -- Map Parcel Visualization remaining tasks

---

*State updated: 2026-02-19 -- Phase 39 Plan 01 + 02 complete*
