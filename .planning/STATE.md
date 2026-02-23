# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v6.0 Meldingen Intelligence -- Phase 47: Address Intelligence

---

## Current Position

Phase: 47 of 51 (Address Intelligence)
Plan: —
Status: Ready to plan
Last activity: 2026-02-23 -- v6.0 roadmap created (Phases 47-51, 18 requirements)

Progress: [          ] 0%

---

## Performance Metrics

**v5.1 Wijk Detail View (Complete: 2026-02-22)**
- Phase 46 Plan 01: WijkDetailView with scan summary, ChangeTimeline, reports
- Phase 46 Plan 02: Navigation integration -- wijk_id routing, 3-level breadcrumb

**v5.1 URL State + Gemeente Detail View (Complete: 2026-02-22)**
- Phase 45 Plan 01: URL state migration (validateSearch), DrilldownBreadcrumb, counter fix
- Phase 45 Plan 02: GemeenteDetailView with stat bar, ChangeTimeline, WijkCardGrid

**v5.1 Wijk Cards and Drill-Down (Complete: 2026-02-22)**
- Phase 44 Plan 01: 1 min, 2 tasks, 3 files created
- Phase 44 Plan 02: 2 min, 2 tasks, 2 files modified

**v5.1 Gemeente Card Navigation (Complete: 2026-02-22)**
- Phase 43 Plan 01: 2 min, 2 tasks, 3 files created
- Phase 43 Plan 02: 2 min, 1 task, 1 file modified

**v5.1 Theme Consistency (Complete: 2026-02-21)**
- Phase 42 Plan 01: 2 min, 2 tasks, 12 files changed
- Phase 42 Plan 02: 9 min, 2 tasks, 29 files changed

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
- CBS WFS already integrated for gemeente/wijk boundaries -- reuse for SVG silhouettes
- ThemeProvider at src/lib/theme/ with localStorage persistence already exists
- **text-on-accent**: all amber/accent-background elements use this utility
- **Defined grey scale**: only 100, 300, 400, 600, 700, 800, 850, 900, 950
- **SET LOCAL f-string (not params)**: asyncpg doesn't support parameterized SET statements

### Decisions Made

- `--color-on-accent: oklch(0.12 0.005 270)` -- fixed dark color for text on amber, does NOT invert in light mode
- FOUC script placed as very first child of `<head>` before icon/font/stylesheet links
- GemeenteCard is stateless: receives pre-computed svgData and totalUnread as props
- WijkCard mirrors GemeenteCard pattern but omits gemeente_code subtitle
- URL state via TanStack Router validateSearch: gemeente_id/wijk_id in URL search params
- DrilldownBreadcrumb reads from useSearch -- returns null at top level, 2-level for gemeente, 3-level for wijk

### v6.0 Architecture Notes

- **MATCH depends on ADDR**: Geocoding needs clean addresses -- Phase 48 cannot start without Phase 47
- **READ is independent**: ChangeReadState table and server-side read API can be built in parallel with matching (Phases 48+49 can run concurrently)
- **FLOW depends on MATCH**: Fly-to-parcel and map marker need matched_parcel_id on ChangeRecord
- **UX depends on READ+FLOW**: Filter, action states, shared hook, pagination are last because they surface the completed features
- **New model needed**: `ChangeReadState` (change_id FK, user_id FK, read_at timestamp) -- replaces localStorage hack
- **matched_parcel_id migration needed**: New nullable column on ChangeRecord model

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

**Last Session:** 2026-02-23
**Stopped At:** v6.0 roadmap creation -- 5 phases (47-51), 18 requirements mapped, files written
**Resume File:** None

**Next Action:** `/gsd:plan-phase 47`

---

*State updated: 2026-02-23 -- v6.0 Meldingen Intelligence roadmap created*
