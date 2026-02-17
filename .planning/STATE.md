# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v4.0 UX Redesign — Industrial Amber design system, navigation restructure, flow polish

---

## Current Position

**Milestone:** v4.0 UX Redesign
**Phase:** Phase 31 complete (Plan 04 complete)
**Plan:** 31-04 complete — all 14 remaining glassmorphism files migrated (PropertySection, PropertySummary, InspectorPanel, FreshnessIndicator, ParcelEnrichmentCard, ReportCard, ReportSearch, PDFExportModal, EmptyState, RecentViewed, ProjectEditModal, ProjectCreateModal, resultaten.tsx, map.tsx)
**Status:** Phase 31 glassmorphism migration complete — all 29 components now using Industrial Amber design tokens

**Progress:** [████░░░░░░] 40% (4/10 phases complete, Phase 31 in progress)

**Last activity:** 2026-02-18 — Phase 31 Plan 04 executed (14 remaining glassmorphism files: property, layout, results, reports, projects, routes)

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
- Phase 31 Plan 01: ~179s, 2 tasks, 2 commits, 4 files
- Modal, Drawer, SideRailNav, ReportSidebar migrated from glassmorphism to Industrial Amber solid tokens
- Phase 31 Plan 02: ~195s, 2 tasks, 2 commits, 4 files
- ResultsLayout, ResultsTable, ResultsFilterPanel, ParcelDetailModal migrated; Select + Badge primitives replace raw styled elements
- Phase 31 Plan 03: ~5min, 2 tasks, 2 commits, 7 files
- PropertyDetailPanel, PropertyDetailDrawer (773 lines), PropertyQuickCard, LayerToggle (DS-04 blur), AddressSearch, dashboard, instellingen migrated
- Phase 31 Plan 04: ~4min, 2 tasks, 2 commits, 14 files
- All 14 remaining glassmorphism files migrated; MIG-02 and visual consistency gaps closed

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

**Phase 31-01 (Glassmorphism Migration — Modal/Drawer/SideRailNav/ReportSidebar):**
- DS-04 rule applied: navigation chrome + data panels = solid bg-grey-900; floating map cards keep backdrop-blur
- Active nav items use bg-grey-800 text-grey-100 (neutral) not amber-accent — persistent nav indicators should not use accent color (Pitfall 7)
- Tooltip style updated to include border-grey-800 for crisper edge on solid dark bg-grey-950 background
- ReportSidebar close button migrated to Button ghost variant + X lucide-react icon; raw select → Select primitive
- Text hierarchy established: text-grey-100 (primary), text-grey-400 (secondary), text-grey-600 (muted)

**Phase 31-02 (Glassmorphism Migration — results/ components):**
- Amber-accent used for selected table row ring (ring-amber-accent/30) — data-layer selection uses accent, not neutral
- Score circle gradient kept semantic green (score indicator not glassmorphism); border softened from /30 to /20
- Badge variant="teal" replaces inline blue glassmorphism chips for bestemmingen tags (teal = zoning/land-use semantic)
- Filter panel background bg-grey-850 (slightly lighter than bg-grey-900 main panel) creates visual separation without glassmorphism
- Loading skeletons: bg-grey-800 animate-pulse (was bg-white/5 animate-pulse)

**Phase 31-03 (Glassmorphism Migration — property/ + map controls + placeholder pages):**
- PropertyDetailPanel and PropertyDetailDrawer use solid bg-grey-900 (data panels, not map-floating) — no backdrop-blur per DS-04
- LayerToggle active tab uses bg-amber-accent text-grey-950 (accent on interactive map controls is correct; persistent nav indicators use neutral per Phase 31-01)
- AddressSearch dropdown uses solid bg-grey-950 without backdrop-blur — dropdown is UI layer, not rendered over map canvas
- PropertyDetailDrawer file splitting deferred — 773-line file exceeds 300-line limit but glassmorphism migration prioritized first
- Semantic amber/green monument badges (bg-amber-500/N, bg-green-500/N) preserved unchanged in PropertyQuickCard and PropertyDetailPanel/Drawer

**Phase 31-04 (Glassmorphism Gap Closure — 14 remaining files):**
- FreshnessIndicator tooltip: bg-black/90 backdrop-blur-xl → bg-grey-950 (tooltip is UI layer, not map-floating)
- map.tsx floating controls: kept bg-grey-900/90 backdrop-blur-md per DS-04, only border-white/10 → border-grey-800
- ProjectEditModal/CreateModal: light-theme white card content preserved; only dark overlay backdrop migrated (bg-black/20 → bg-grey-950/80)
- ReportCard freshness dot: bg-white/30 → bg-grey-800 (non-stale indicator is neutral grey, not white opacity)
- cmdk data-[selected=true] states: bg-white/10 → bg-grey-800, text-white → text-grey-100

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
**Stopped At:** Completed 31-04-PLAN.md (glassmorphism gap closure — 14 remaining files, Phase 31 complete)
**Resume File:** None

**Next Action:** Phase 31 complete — proceed to Phase 32 (Feedback Systems)

---

*State updated: 2026-02-18 — Phase 31 Plan 04 complete (glassmorphism gap closure: 14 remaining files, Phase 31 complete)*
