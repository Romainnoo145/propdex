# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v6.0 Meldingen Intelligence

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-23 — Milestone v6.0 Meldingen Intelligence started

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
- GemeenteCard is stateless: receives pre-computed svgData and totalUnread as props — parent fetches GeoJSON once, avoids redundant WFS requests per card
- geoJsonToSvgPath uses Math.min(drawW/lonRange, drawH/latRange) uniform scale — preserves aspect ratio for irregular gemeente shapes
- **WijkCard mirrors GemeenteCard pattern but omits gemeente_code subtitle** — wijk projects have no meaningful code to display
- **WijkCardGrid reuses GemeenteCardGrid/GemeenteCardGridSkeleton wrappers** — no new grid CSS needed for wijk layer
- **CBS WFS statnaam matching**: use `f.properties.statnaam === wijk.wijk_naam` (not statcode) — statnaam is reliable across CBS WFS years
- **renderCard render prop in WijkCardGrid**: enables per-card useProjectScans hook calls in WijkCardWithNav sub-component without hooks-in-loop React violation
- **URL state via TanStack Router validateSearch**: gemeente_id/wijk_id in URL search params, same proven pattern as resultaten.tsx
- **DrilldownBreadcrumb reads from useSearch**: returns null at top level, 2-level for gemeente, 3-level for wijk
- **Project counter shows regularProjects.length**: excludes monitoring gemeente/wijk container projects from the count
- **GemeenteDetailView stat bar**: derived from props (wijkProjects.length, sum of report_count, sum of unread counts) — zero API calls
- **Wijk card click targets wijk detail view**: `/projecten?gemeente_id=X&wijk_id=Y` instead of directly to `/resultaten`
- **WijkDetailView: scan summary, ChangeTimeline, ReportCard grid**: all use existing hooks with project_id filter, zero backend changes

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
**Stopped At:** v6.0 milestone initialization — defining requirements
**Resume File:** None

**Next Action:** Define requirements, create roadmap, then `/gsd:plan-phase 47`

---

*State updated: 2026-02-23 -- v6.0 Meldingen Intelligence milestone started*
