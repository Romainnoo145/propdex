# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v5.1 Data Presentation Overhaul -- Phase 43 Gemeente Card Navigation

---

## Current Position

Phase: 43 of 45 (Gemeente Card Navigation)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-02-21 -- Phase 42 Theme Consistency complete (2/2 plans, 6 commits, verified 8/8 must-haves)

Progress: [██░░░░░░░░] 25%

---

## Performance Metrics

**v5.1 Theme Consistency (In Progress)**
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
- CBS WFS already integrated for gemeente/wijk boundaries on map page -- reuse for SVG silhouettes
- Change monitoring with unread tracking per project already implemented -- reuse for notification badges
- ThemeProvider at src/lib/theme/ with localStorage persistence already exists
- **text-on-accent**: all amber/accent-background elements use this utility — never text-grey-950/900/white
- **--color-on-accent**: defined only in @theme, NOT overridden in html.light (amber stays golden in both modes)
- **FOUC pattern**: inline `<script>` before `<link>` tags reads 'propdex-theme', applies .light class synchronously
- **Semantic token mapping**: error=bg-error/10 text-error, success=bg-success/10 text-success, info=bg-info/10 text-info, warning=bg-warning/15 text-warning
- **Defined grey scale**: only 100, 300, 400, 600, 700, 800, 850, 900, 950 — use 300 not 200, 600 not 500
- **purple exception**: gebieds_aanduidingen in ReportDetailPage uses purple-500 (distinct from functie_aanduidingen info/blue per SVBP2012)

### Decisions Made

- `--color-on-accent: oklch(0.12 0.005 270)` — fixed dark color for text on amber, identical value to dark-mode grey-950 but separate token that does NOT invert in light mode
- FOUC script placed as very first child of `<head>` before icon/font/stylesheet links to guarantee class applied before any resource loads
- `grey-500` -> `grey-600` throughout: grey-500 not defined in @theme, grey-600 is next defined muted value
- `grey-200` -> `grey-300` throughout: grey-200 not defined, grey-300 is next defined lighter text value
- purple-500 `gebieds_aanduidingen` badges retained in ReportDetailPage as documented exception (visually distinct from `functie_aanduidingen` info/blue per SVBP2012 zoning law)
- ConfidenceBadge MEDIUM uses `warning` token (not `info`): medium confidence is cautionary, not informational

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
**Stopped At:** Phase 42 complete, verified 8/8 must-haves
**Resume File:** None

**Next Action:** `/gsd:plan-phase 43`

---

*State updated: 2026-02-21 -- Phase 42 complete, advancing to Phase 43*
