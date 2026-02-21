# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v5.1 Data Presentation Overhaul -- Phase 42 Theme Consistency

---

## Current Position

Phase: 42 of 45 (Theme Consistency)
Plan: 0 of 1 in current phase
Status: Ready to plan
Last activity: 2026-02-21 -- Roadmap created for v5.1 (4 phases, 15 requirements)

Progress: [░░░░░░░░░░] 0%

---

## Performance Metrics

**v5.0 Scan Intelligence (Shipped: 2026-02-20)**
- 5 phases (37-41), 11 plans, 51 commits, 65 files changed (+9,264/-2,326)
- Phase 37: 12 min, Phase 38: 6 min, Phase 39: 8 min, Phase 40: 7 min, Phase 41: 5 min

**v4.0 UX Redesign (Shipped: 2026-02-18)**
- 10 phases (27-36), 31 plans, 129 commits, ~16,234 LOC TypeScript/React

**v3.1 Smart Area Intelligence (Shipped: 2026-02-15)**
- 5 phases (22-26), 22 plans, 97 commits, ~27,200 LOC

---

## Accumulated Context

### Key Patterns (carry forward)

- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- parcel_cache.geometry is EPSG:28992; always ST_Transform(geometry, 4326) before GeoJSON
- 404 not 403 for cross-org access (prevents enumeration)
- ProjectEditModal/ProjectCreateModal use intentional light-theme gray-* (white card on dark backdrop)
- CBS WFS already integrated for gemeente/wijk boundaries on map page -- reuse for SVG silhouettes
- Change monitoring with unread tracking per project already implemented -- reuse for notification badges
- ThemeProvider at src/lib/theme/ with localStorage persistence already exists

### Ongoing TODOs

- Production deployment: Create app_role (sql/setup_app_role.sql)
- Production deployment: Update Docker container to postgis/postgis:16-3.5
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-02-21
**Stopped At:** Roadmap created for v5.1 milestone
**Resume File:** None

**Next Action:** `/gsd:plan-phase 42`

---

*State updated: 2026-02-21 -- v5.1 roadmap created*
