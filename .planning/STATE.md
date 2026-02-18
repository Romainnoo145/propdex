# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v4.0 UX Redesign — Industrial Amber design system, navigation restructure, flow polish

---

## Current Position

**Milestone:** Phase 36 — Polish & Performance
**Phase:** Phase 36 — Polish & Performance (plan 04 of 04 complete)
**Plan:** 36-04 shipped (6 Storybook layout stories: SideRailNav, BottomTabNav, MapShell, ResultsShell, InspectorPanel, ReportSidebar)
**Status:** Phase 36 complete — all 4 plans shipped

**Progress:** [██████████] 100%

**Last activity:** 2026-02-18 — Phase 36 Plan 04 shipped (6 layout shell Storybook stories, RouterProvider + AuthContext + QueryClient decorator patterns, 2 tasks, 6 files)

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
- Phase 32 Plan 01: ~1min, 1 task, 1 commit, 3 files
- Skeleton, EmptyState, ErrorState feedback primitives; Industrial Amber tokens; lucide-react AlertTriangle; Button CVA integration
- Phase 32 Plan 02: ~3min, 2 tasks, 2 commits, 5 files
- Feedback primitives adopted in 5 components: skeleton loading, ErrorState retry, EmptyState with icons, toast.info on filter changes (FB-01 to FB-04 closed)
- Phase 32 Plan 03: ~2min, 1 task, 1 commit, 1 file
- ScanProgressOverlay redesign: three-step stepper (Kadaster/BAG/Bestemmingen), Industrial Amber tokens, real-time sublabels (FB-05 + FB-06)
- Phase 33 Plan 01: ~179s, 2 tasks, 2 commits, 3 files
- URL search params for sort/filter/page in /resultaten, multi-column sort indicators in ResultsTable
- Phase 33 Plan 02: ~2min, 1 task, 1 commit, 2 files
- ScanProgressOverlay CTA button (SCAN-01), step-specific running labels (SCAN-02), navigatedRef double-nav guard
- Phase 33 Plan 03: ~4min, 2 tasks, 2 commits, 6 files
- Checkbox row selection (UUID-keyed RowSelectionState), BulkActionBar, backend export/selection endpoint (DT-03)
- Phase 33 Plan 04: ~2min, 2 tasks, 2 commits, 4 files
- Category-grouped collapsible filter panel (Oppervlak/Bestemming/Score), max_area_m2 exposed, table-to-map hover sync via setFeatureState
- Phase 34 Plan 01: TBD (Phase 34-01 plan not yet executed via this session)
- Phase 34 Plan 02: ~2min, 2 tasks, 2 commits, 2 files
- InspectorPanel responsive bottom sheet (mobile fixed/slide-up, desktop absolute/slide-right), scan buttons hidden on mobile, "(alleen lezen)" label, "Gebruik desktop voor scannen" banner
- Phase 34 Plan 03: ~3min, 2 tasks, 2 commits, 4 files
- ParcelCard (72px touch target, address/score/area/bestemming), ResultsTable mobile card branch via useIsMobile(), filter panel flex-col mobile layout, read-only banner + BulkActionBar hidden on mobile
- Phase 34 Plan 04: ~2min, 2 tasks, 1 commit, 1 file
- ProjectList MOB-03 touch targets (5 accordion+report buttons), full mobile layout verification (map viewport/ResultsShell clearance/BottomTabNav fixed), Phase 34 complete
- Phase 35 Plan 01: 117s, 2 tasks, 2 commits, 6 files
- preferences JSONB migration (b7a8c9d0e1f2), users module (schemas + router), 4 endpoints: PATCH /me, PUT /me/password, GET+PATCH /me/preferences
- Phase 35 Plan 02: 98s, 2 tasks, 2 commits, 4 files
- settings.ts types, useSettings.ts hooks (4 TanStack Query hooks), AuthContext.updateUser callback
- Phase 35 Plan 03: ~8min, 2 tasks, 2 commits, 5 files
- AccountSection (name/email form, updateUser sync), PasswordSection (auth_provider guard, eye toggle), NotificationsSection (instant-save toggle), AppearanceSection (card selector), /instellingen wired
- Phase 36 Plan 04: 21min, 2 tasks, 2 commits, 6 files
- 6 layout shell Storybook stories (SideRailNav/BottomTabNav with RouterProvider+AuthContext+QueryClient, MapShell/ResultsShell/InspectorPanel/ReportSidebar), SC-04 Storybook documentation goal complete

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

**Phase 32-01 (Feedback Primitives):**
- Skeleton is minimal single-div wrapper — className prop enables full shape control at call site
- EmptyState uses Button primitive with variant=primary for CTA (consistent with design system)
- ErrorState uses AlertTriangle from lucide-react (already installed), not custom SVG
- Default error message is Dutch: 'Er is iets misgegaan.' per project language standard

**Phase 32-02 (Feedback Primitives Adoption — 5 components):**
- toast.info added to Select dropdowns (bestemming/status/score) and handleClearFilters only — NOT to debounced area input timer (too noisy, fires 500ms after every keystroke)
- refetch destructured from useProjectChanges and useScanResults for ErrorState retry actions — TanStack Query useQuery always returns refetch
- ProjectList skeleton uses border-grey-800 bg-grey-900 (dark tokens) in loading branch even though rest of file uses legacy text-gray-* — only loading branch was in scope

**Phase 32-03 (ScanProgressOverlay Redesign):**
- SCAN_STEPS array defined inline in ScanProgressOverlay.tsx, not extracted to separate config — keeps scan-specific stepper data co-located
- Running state shows stepper + progress bar; completed/failed states hide stepper and show single semantic icon only
- text-warning token used for parcels_failed count (was raw text-amber-600) — warning is correct semantic for partial scan failure
- Queued state (current_phase=null) shows all steps pending with 'Scan starten...' label
- [Phase 33-01]: Only primary sort sent to backend API — secondary multi-sort columns are visual-only indicators (server is paginated)
- [Phase 33-01]: navigate uses functional (prev) => ({...prev, ...changes}) to preserve scan_id across all URL state changes

**Phase 33-02 (ScanProgressOverlay CTA + Labels):**
- navigatedRef.current = false reset tied to [activeScanId] — ensures fresh navigation guard per scan, not per render
- Overlay condition changed from status !== 'completed' to status !== 'cancelled' — shows CTA while user decides before auto-nav fires
- Scan completion useEffect deps simplified to [scanStatus.data?.status] — prevents stale closures without unnecessary re-runs
- Pre-existing TS2532 fixed: SCAN_STEPS[index - 1] possibly undefined via safe prevStep variable

**Phase 33-03 (Multi-Select Checkboxes + Bulk Export):**
- getRowId keyed by parcel_id UUID (not row index) — essential for paginated tables so selection persists across page changes
- selectionKey counter pattern: parent increments key to force-clear table RowSelectionState — without this, Deselecteren only resets parent array but checkboxes remain visually checked
- Column definitions moved inside component (not module-level const) to access table API methods in header checkbox
- window.open on GET export endpoint — works because export/selection is GET returning a file attachment
- BulkActionBar returns null when selectedCount===0 (not CSS hidden) — prevents empty bar layout shift
- Toevoegen aan project disabled with cursor-not-allowed opacity-60 — no parcel-to-project data model yet

**Phase 33-04 (Filter Groups + Hover Sync):**
- FILTER_GROUPS omits Locatie group — no location filters in scope, empty group avoided
- All 3 filter groups default to open (all groups in initial openGroups Set)
- Map-to-table hover deferred — table-to-map only in Phase 33 (ROADMAP updated); map-to-table needs mousemove handler in ResultsLayout
- Use numeric MVT feature ID for setFeatureState, not string UUID parcel_id (querySourceFeatures returns numeric id)
- hoveredParcelRef cleanup runs on collapsed change via useEffect dependency
- features[0] extracted to local variable to satisfy TypeScript TS2532 undefined narrowing
- [Phase 34-01]: BottomTabNav active state uses text-amber-accent (accent for transient tab selection, not persistent nav)
- [Phase 34-01]: --z-bottom-nav: 250 same as --z-side-rail since they never coexist on the same viewport width
- [Phase 34-01]: useIsMobile: useState initializer reads matchMedia synchronously (SSR-safe, no flicker), useEffect adds addEventListener 'change'

**Phase 34-02 (InspectorPanel Bottom Sheet + Mobile Map Controls):**
- InspectorPanel uses fixed (not absolute) on mobile so it overlays the full viewport regardless of MapShell parent constraints
- Scan buttons wrapped in hidden md:inline-flex spans (not conditional render) to preserve DOM structure and event handlers
- Zone info card uses hidden md:block / md:hidden pair — scan button desktop only, amber "Gebruik desktop" banner mobile only
- Gemeente X button given min-h-[44px] min-w-[44px] flex items-center justify-center for MOB-03 touch target compliance
- Bottom sheet animation: translate-y-full (closed mobile) / translate-y-0 (open mobile), translate-x-full (closed desktop) / md:translate-x-0 (open desktop)

**Phase 34-03 (Mobile Results Table + Filter Panel):**
- ScoreBadge copied into ParcelCard.tsx as local function to avoid cross-file coupling for a small display component
- Mobile card list omits checkboxes intentionally — selection/export is desktop-only per MOB-01 read-only mode
- BulkActionBar hidden on mobile via `{!isMobile && <BulkActionBar />}` (conditional render, not CSS hidden) since no checkboxes in card view
- Filter controls container: flex-col gap-2 on mobile, md:flex-row md:flex-wrap md:items-center md:gap-3 on desktop
- Toon Kaart button text hidden on mobile via `hidden md:inline` span — icon-only saves space on narrow screens

**Phase 34-04 (Final Mobile Sweep):**
- Task 2 required no code changes: map/main/ResultsShell layout was already correctly set up by Plans 01-03
- ProjectList accordion toggle buttons (py-4 ~52px) and report buttons (py-3 ~44px) given explicit min-h-[44px] for MOB-03 compliance
- Bottom nav clearance architecture: ResultsShell pb-14 md:pb-0 (not on <main>) ensures MapView fills full viewport while non-map routes clear 56px BottomTabNav
- [Phase 35-02]: useUpdateProfile does not auto-call updateUser — caller pattern avoids circular dependency (hook -> AuthContext -> hook)
- [Phase 35-02]: useUpdatePreferences uses setQueryData (not invalidateQueries) for optimistic UX — PATCH response is final state
- [Phase 35-02]: AuthContext.updateUser is useCallback([]) — stable reference wrapping setUser, no API round-trip
- [Phase 35-01]: Re-export UserResponse/MessageResponse from auth schemas in users schemas to avoid duplication
- [Phase 35-01]: PATCH /me/preferences uses model_dump(exclude_unset=True) for true partial merge of JSONB preferences
- [Phase 35-01]: OAuth users blocked from password change: auth_provider \!= 'email' returns 400 with Dutch error message

**Phase 35-03 (Settings Page UI):**
- useForm defaultValues from useAuth().user at mount — no reactive reset needed since updateUser updates context
- AppearanceSection defaults to 'light' when map_style is undefined (null-safe fallback)
- NotificationsSection toggle uses role=switch + aria-checked for accessibility
- Eye/eye-off toggle on new_password field only (not current_password or confirm_password) per spec
- Settings section pattern: icon + h2 header, description text, form/controls, toast feedback

**Phase 36-04 (Layout Shell Storybook Stories):**
- RouterContext must be provided to createRouter — routeTree uses createRootRouteWithContext<RouterContext>(), so context: { auth: { isAuthenticated, user } } required (TS2345 without it)
- SideRailNav stories need 3 provider layers: QueryClientProvider (useUnreadCounts) + AuthContext.Provider (useAuth/logout) + RouterProvider (useMatchRoute/Link)
- BottomTabNav is zero-prop component — RouterProvider only, no auth/query needed
- InspectorPanel is pure props — no router/auth/query deps, render() pattern with MapWrapper div for absolute positioning context
- ReportSidebar QueryClient: retry:false + staleTime:Infinity prevents network requests, gracefully shows empty state in Storybook
- layout: fullscreen Storybook parameter required for all fixed/absolute positioned layout components

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
- Mobile navigation: RESOLVED in Phase 34 (BottomTabNav + all mobile adaptations complete)
- Parcel count pre-check disabled (CRS mismatch between CBS bbox and BAG WFS)
- PLU WMS change detection needs live data validation

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 2 | Redesign scoring, add qualification filter, and resolve addresses | 2026-02-15 | 265aa49 | [2-redesign-scoring-add-qualification-filte](./quick/2-redesign-scoring-add-qualification-filte/) |

---
| Phase 34-mobile-responsiveness P01 | 98 | 2 tasks | 4 files |
| Phase 35-settings-page P02 | 98 | 2 tasks | 4 files |
| Phase 35-settings-page P01 | 117s | 2 tasks | 6 files |

## Session Continuity

**Last Session:** 2026-02-18
**Stopped At:** Completed 36-04-PLAN.md (layout shell Storybook stories — Phase 36 complete)
**Resume File:** None

**Next Action:** Define next milestone via `/gsd:new-milestone` — Phase 36 polish/performance complete

---

*State updated: 2026-02-18 — Phase 36 Plan 04 complete (6 layout shell Storybook stories, 2 tasks, 2 commits, 6 files). Phase 36 complete.*
