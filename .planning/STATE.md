# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v4.0 UX Redesign — Industrial Amber design system, navigation restructure, flow polish

---

## Current Position

**Milestone:** v4.0 UX Redesign
**Phase:** Phase 30 complete, Phase 31 next
**Plan:** Phase 30 verified and complete
**Status:** View separation shipped — /resultaten route, scan_id bidirectional navigation, overlay removed

**Progress:** [████░░░░░░] 40% (4/10 phases complete)

**Last activity:** 2026-02-18 — Phase 30 verified and marked complete

---

## Performance Metrics

**v4.0 UX Redesign (In Progress)**
- Phase 27 Plan 01: 256s, 3 tasks, 3 commits, 5 files
- Industrial Amber design tokens, Inter/JetBrains Mono fonts, cn() utility
- Phase 27 Plan 02: 329s, 2 tasks, 2 commits, 6 files
- Core UI primitives (Button, Card, Badge, Input, Select) with CVA variants
- Phase 27 Plan 03: ~1276s, 2 tasks, 1 commit, 8 files, 21 stories
- Storybook documentation for all 5 primitives, user-verified Industrial Amber design system
- Phase 28 Plan 01: 368s, 2 tasks, 2 commits, 4 files
- MapView hoisted to _authenticated.tsx, MapContext created, ResultsLayout refactored to overlay
- Phase 28 Plan 02: 250s, 2 tasks, 2 commits, 3 files
- SideRailNav three-view nav (Kaart/Resultaten/Projecten), lucide-react icons, InspectorPanel slide-over
- Phase 29 Plan 01: 61s, 2 tasks, 2 commits, 3 files
- Silver raster paint on CartoDB Positron, MapShell + ResultsShell layout components
- Phase 29 Plan 02: ~146s, 2 tasks, 2 commits, 6 files
- All routes on MapShell/ResultsShell, floating map cards dark glassmorphism, AppLayout re-export
- Phase 30 Plan 01: ~166s, 2 tasks, 2 commits, 4 files
- /resultaten route (standalone results page), ResultsShell fullWidth prop, SideRailNav pointing to /resultaten
- Phase 30 Plan 02: ~153s, 1 task, 1 commit, 2 files
- scan_id in MapSearchParams, navigate to /resultaten on scan completion (4 paths), urlScanId restoration effect, Toon Lijst button, ResultsLayout overlay removed

**v3.1 Smart Area Intelligence (Shipped: 2026-02-15)**
- 5 phases (22-26), 22 plans, 16 requirements, 97 commits
- Bestemmingsplan visualization, wijk selection, results interface, change monitoring
- ~27,200 LOC (13,756 Python + 13,444 TypeScript)

**v3.0 Spatial Foundation (Shipped: 2026-02-11)**
- 4 phases (18-21), 20 plans, 14 requirements, 72 commits
- PostGIS, government API clients, scan pipeline, map visualization

**v2.0 Frontend (Shipped: 2026-02-09)**
- 5 phases (13-17), 24 plans, 9 requirements, 117 commits
- 8,804 LOC TypeScript/React

**v1.1 Production Hardening (Shipped: 2026-02-08)**
- 7 phases (6-12), 19 plans, 15 requirements, 71 commits
- 275 tests, 15,947 LOC Python

**v1.0 Core Intelligence Engine (Shipped: 2026-02-07)**
- 5 phases (1-5), 17 plans, 14 requirements, 79 commits
- 8,281 LOC Python

---

## Accumulated Context

### Decisions Made

**Phase 27-01 (Design System Foundation):**
- Used eslint-plugin-tailwindcss v4 beta for Tailwind v4 compatibility
- Set no-arbitrary-value to 'warn' level for gradual migration
- Used oklch color space for P3 gamut vibrancy
- Loaded fonts from Google Fonts CDN (no self-hosting)
- [Phase 27-02]: Used type aliases instead of empty interfaces for InputProps/SelectProps (ESLint compliance)
- [Phase 27-03]: Dark background (#111111) as Storybook default to match production environment
- [Phase 27-03]: viteFinal in main.ts required to resolve @/ path aliases in Storybook stories

**Phase 28-01 (Persistent MapView):**
- CSS display:none toggle (not conditional rendering) to keep MapLibre instance alive across route changes
- React Context (not Zustand) for mapRef sharing — Context sufficient for single map instance
- useEffect to sync accessToken ref instead of render mutation (ESLint react-hooks/refs compliance)
- ResultsLayout converted from react-resizable-panels split-view to CSS transform left-edge overlay
- map.resize() called after 50ms delay post display:block to allow layout recalculation
- [Phase 28-02]: Custom SVG icons replaced with lucide-react imports (Map, ListOrdered, FolderOpen, Bell, FileText, Settings, LogOut)
- [Phase 28-02]: InspectorPanel click handler registered once on mapReady — MapLibre silently ignores clicks on non-existent layers
- [Phase 28-02]: panel search param on /map route enables Resultaten nav link to auto-open results panel

**Phase 29-01 (Silver Map Theme + Layout Shells):**
- Silver map: raster-saturation -0.85, brightness-min 0.08, brightness-max 0.92, contrast -0.05 for desaturated CartoDB Positron
- Paint properties baked into initial style definition — not setPaintProperty() to avoid state management complexity
- MapShell uses div (not main) — AppLayout.tsx uses main; differentiated to avoid duplicate landmark elements before Plan 02 migration

**Phase 29-02 (Route Shell Migration):**
- AppLayout.tsx reduced to single-line re-export of MapShell — backward compatible, can be deleted in future cleanup
- Floating map cards use bg-grey-900/90 backdrop-blur-md (semi-transparent dark glass) — distinct from ResultsShell solid bg-grey-950
- ResultsShell wraps instellingen/dashboard — inner flex centering preserved inside ResultsShell content area
- projecten.tsx max-w-4xl wrapper removed in favor of ResultsShell max-w-5xl for consistency

**Phase 30-01 (/resultaten Route):**
- Toon Kaart button navigates to /map without scan_id — Plan 02 will add scan_id to MapSearchParams and wire passthrough
- routeTree.gen.ts updated manually (tsr generate requires config file not present in project)
- /resultaten route: fullWidth ResultsShell, shows empty state when no scan_id, full results layout when scan_id present

**Phase 30-02 (Map Navigation Wiring):**
- View separation complete: /map shows scan initiation + score layer, /resultaten shows tabular results — no overlay split-panel
- scan_id is the bidirectional URL bridge between /map and /resultaten
- Toon Lijst ghost button (border + amber text) visually differentiated from primary solid scan button
- removeParcelScoreLayer removed from map.tsx — score layer persists for lifetime of activeScanId (not cleared on navigation)

### Active TODOs

- [ ] Fix backend register endpoint 500 error
- [ ] Production deployment: Create app_role
- [ ] Production deployment: Update Docker container to postgis/postgis:16-3.5
- [ ] Test Claude API with real bestemmingsplan PDFs
- [ ] BAG API key aanvragen (gratis)
- [ ] DSO API key aanvragen (gratis)
- [ ] Kadaster BRK Bevragen API toegang regelen (betaald)
- [ ] Ruimtelijkeplannen.nl REST API v4 key aanvragen
- [ ] PLU WMS change detection live validation (MON-02)

### Known Issues

- Backend register endpoint returns 500 (needs investigation)
- Kadaster eigendomsdata requires paid API
- Monument restrictions are generic boilerplate (not property-specific)
- Mobile navigation: Side-rail hidden on mobile, no replacement navigation exists yet (will be addressed in Phase 34)
- Parcel count pre-check disabled (CRS mismatch between CBS bbox and BAG WFS)
- PLU WMS change detection needs live data validation

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 2 | Redesign scoring, add qualification filter, and resolve addresses | 2026-02-15 | 265aa49 | [2-redesign-scoring-add-qualification-filte](./quick/2-redesign-scoring-add-qualification-filte/) |

---

## Session Continuity

**Last Session:** 2026-02-18
**Stopped At:** Phase 30 verified and complete
**Resume File:** None

**Next Action:** Run `/gsd:plan-phase 31` to plan Component Migration (Glassmorphism → Industrial Amber)

---

*State updated: 2026-02-18 — Phase 30 View Separation verified and complete*
