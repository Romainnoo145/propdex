# Project Research Summary

**Project:** Propdex v6.0 — Premium Data Presentation
**Domain:** Dutch PropTech SaaS — data presentation overhaul for property intelligence platform
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

Propdex v6.0 is a presentation-layer overhaul of an existing, production-grade Dutch property intelligence platform (~40K LOC, React 19 + MapLibre 5.x + TanStack Stack). The goal is to transform a functional tool into a premium data experience that establishes a UX benchmark in the NL PropTech market. Research across all four areas is consistent: the existing architecture is sound and most new capabilities can be delivered with targeted additions rather than structural changes. Zero new backend work is required; seven new frontend packages cover all capability gaps. The recommended approach is to build depth-first — primitives before features, map infrastructure before comparison views, theme audits before polish.

The most important strategic finding is that no NL PropTech competitor (Funda Zakelijk, Brainbay, DataLand) offers the combination of score transparency, property comparison, and map filtering in a single cohesive product. The opportunity is real, and the implementation risk is low because the data and API infrastructure already exists. What is missing is purely the presentation layer: scoring visualizations, tabbed report layouts, a comparison route, map filter controls, and static mini-maps in reports. All of these can be built against the existing `PropertyReportResponse`, `ScanResultsResponse`, and MapLibre vector tile data already in the system.

The primary risk area is MapLibre/WebGL context management. The existing architecture correctly isolates one persistent MapLibre instance. This constraint must be strictly maintained: mini-maps in reports must use static tile images (`<img>` tags), not additional MapLibre instances. A second high-priority risk is the theme system — MapLibre paint properties do not read CSS custom properties, so a `MAP_THEME_COLORS` hex constant file is required to keep light/dark mode consistent on map layers. Both risks are well-understood and have clear prevention patterns documented in PITFALLS.md.

---

## Key Findings

### Recommended Stack

The existing stack (React 19, Vite 7, TypeScript strict, Tailwind v4, MapLibre GL JS 5.x, TanStack Query v5, TanStack Router, TanStack Table v8) requires no structural changes. Seven new frontend packages are required; zero new backend packages are needed.

**New dependencies (install all at once):**
```bash
pnpm add recharts @radix-ui/react-tabs @radix-ui/react-slider @radix-ui/react-collapsible @radix-ui/react-tooltip @radix-ui/react-popover @tanstack/react-virtual
```

**Core new technologies:**
- `recharts 3.7.0`: Score gauge, factor bars, sparklines — SVG-based, CSS variables apply natively, React 19 explicit support verified via npm
- `@radix-ui/react-tabs 1.1.13`: Comparison view tab navigation — headless, WAI-ARIA accessible, React 19 explicit support
- `@radix-ui/react-slider 1.3.6`: Score range filter slider with dual-thumb support — replaces native `<input type="range">` limitations
- `@radix-ui/react-collapsible 1.1.12`: Report section expand/collapse — accessible `aria-expanded`, no animation library needed
- `@radix-ui/react-tooltip 1.2.8`: Score factor label tooltips — replaces hand-rolled `group-hover` pattern, portal-rendered above MapLibre z-index
- `@radix-ui/react-popover 1.1.15`: Map filter panel anchor — replaces custom outside-click detection logic in `LayerToggle.tsx`
- `@tanstack/react-virtual 3.13.18`: Row virtualization for 500+ result sets — official TanStack Table v8 pairing, headless

**What NOT to add:**
- `chart.js` / `react-chartjs-2` — canvas-based; CSS oklch variables do not apply to canvas fills
- `victory` — last major release 2023, React 19 compatibility unclear
- `maplibregl-minimap` npm package — README explicitly states "not yet ready for production use"
- `framer-motion` / `react-spring` — ~150KB for effects achievable with Tailwind transitions
- `shadcn/ui` CLI install — conflicts with Tailwind v4's CSS-first `@theme` (no `tailwind.config.js` in v4)
- `react-window` / `react-virtualized` — unmaintained; `@tanstack/react-virtual` is the modern replacement

See `.planning/research/STACK.md` for full decision rationale and the complete alternatives rejection table.

### Expected Features

This is a presentation overhaul, not a data addition milestone. All data exists in the backend — what is missing is the rendering layer.

**Must have (P1 — table stakes for premium feel):**
- Column visibility toggle — standard in every enterprise data tool (Airtable, CRE platforms); immediately premium
- Density control (compact/regular/relaxed rows) — essential for scanning 500+ parcel result sets
- Column pinning (address + score sticky left) — fixes usability when scrolling right to see more columns
- Save filter state to localStorage — removes friction on return visits; same pattern as existing theme persistence
- Score factor breakdown bars in detail drawer — makes scoring transparent; highest user trust impact
- Heatmap column formatting (area, bouwjaar conditional color) — high visual impact, low implementation cost
- Score legend / scale explanation — amber badge alone is not self-explanatory to new users

**Should have (P2 — competitive differentiators):**
- Mini-map in report page — premium PropTech UX standard (Reonomy-style), keeps spatial context without navigation
- Map layer toggle panel — users need to turn off bestemmingsplan zones when examining physical parcels
- Property comparison view (up to 4 parcels) — no NL competitor offers this; forces deliberate selection workflow
- Insight card expansion (more Dutch developer reasoning) — extend existing `STATUS_EXPLANATIONS` vocabulary
- Print/PDF-optimized report layout — enterprise sales requirement for client-deliverable reports

**Defer to v7+:**
- Score trend indicator — requires new backend historical score storage model (new DB table + migration)
- Table column reordering (drag) — high complexity (dnd-kit), moderate value; validate user demand first
- Saved scan comparison (diff two scan runs) — requires backend diff logic; not enough production data yet

**Anti-features (do not build — commonly requested, demonstrably problematic):**
- Real-time score updates mid-session — confuses users comparing parcels; scan is a point-in-time snapshot
- Infinite scroll — breaks bulk selection and "I was on page 3" mental model; browser memory issues at 500+ rows
- Per-user custom color themes — conflicts with semantic CSS variable system; amber is the brand signal
- Drag-to-draw map selection — municipality granularity is correct for Dutch cadastral data model

See `.planning/research/FEATURES.md` for the full prioritization matrix and NL/global competitor analysis.

### Architecture Approach

The architectural principle for v6.0 is extension, not rewrite. The existing component tree, data flow layers, `MapContext`, and three-tier property disclosure pattern are all unchanged. New features layer on top of established infrastructure using established patterns.

**Critical constraint — single MapLibre instance:** The MapLibre instance is initialized once in `_authenticated.tsx` and never unmounts. Mini-maps in reports must use static CARTO tile `<img>` tags via `StaticMapImage` component — not additional MapLibre instances. Browser WebGL context limit is ~8; the persistent main map uses one and must not be competed with.

**Major new components:**

1. `src/components/primitives/ScoreRing.tsx` + `ScoreBar.tsx` + `ScoreGauge.tsx` — pure SVG/CSS scoring visualizations, zero dependencies, CSS variable–aware via `stroke="var(--color-amber-accent)"`
2. `src/components/primitives/Tabs.tsx` — headless compound component (Root/List/Tab/Panel), CSS `hidden` for inactive panels (NOT conditional unmounting — panels must stay mounted)
3. `src/lib/staticMap.ts` + `src/components/map/StaticMapImage.tsx` — pure tile URL math utility + `<img>` wrapper; zero WebGL contexts consumed
4. `src/components/map/MapFilterPanel.tsx` — score/status/bestemming filter UI; wires to `map.setFilter()` via `useEffect` in `map.tsx`; no API calls (vector tiles already carry filter-eligible properties)
5. `src/components/comparison/` directory — `ComparisonView`, `ComparisonColumn`, `ComparisonHeader`, `ComparisonMetricRow`, `ComparisonEmptySlot`
6. `src/hooks/useComparison.ts` — `useQueries` for parallel fetching of N reports; reuses existing `['report', id]` cache keys automatically
7. `src/routes/_authenticated/vergelijken.tsx` — new route; state via URL search params (`?ids=uuid1,uuid2`), not React context or Zustand store

**Modified (not rewritten):**
- `ReportDetailPage.tsx` — wrap sections in Tabs; add `StaticMapImage` + `ScoreGauge` above tab bar
- `ParcelDetailModal.tsx` — replace inline score circle with `ScoreGauge`; replace factor bars with `ScoreBar`
- `LayerToggle.tsx` — add "Filters" pill + `MapFilterPanel`; replace hand-rolled outside-click detection with Radix Popover
- `map.tsx` — add `mapFilters` state + `useEffect` for `map.setFilter()`
- `rapporten.tsx` — add report selection checkboxes + "Vergelijk" button navigating to `/vergelijken?ids=...`

**Unchanged:** `MapView.tsx`, `_authenticated.tsx`, `MapContext.tsx`, all existing Section components (`GebouwSection`, `KadasterSection`, etc.), all TanStack Query hooks except new `useComparisonReports`, `ResultsFilterPanel.tsx`, `ThemeContext.tsx`.

**Build order (dependency-ordered):**
- Phase A: Primitives (`ScoreRing`, `ScoreBar`, `ScoreGauge`, `Tabs`, `staticMap.ts`) — zero external deps, build and test in isolation
- Phase B: Map enhancements (`StaticMapImage`, `MapFilterPanel`, `LayerToggle` extension, `map.tsx` filter effect)
- Phase C: Report enhancements (`ReportDetailPage` tabs + mini-map, `ParcelDetailModal` score gauge, `InspectorPanel` score gauge)
- Phase D: Comparison feature (hooks, components, route, `rapporten.tsx` selection)
- Phase E: Theme polish (gray-\* audit, `MAP_THEME_COLORS` hex constants, CSS variable additions, `@tanstack/react-virtual` in `ResultsTable`)

See `.planning/research/ARCHITECTURE.md` for full component boundaries map, data flow diagrams, anti-patterns, and scalability assessment.

### Critical Pitfalls

1. **MapLibre initialized at zero container dimensions** — a mini-map inside a modal/drawer initializes with `height: 0` if CSS animation hasn't completed when `useEffect` fires. Use `ResizeObserver` on the container and delay `new maplibregl.Map()` until `offsetHeight > 0`. Relevant to any phase touching mini-maps in drawers. (Moot for v6.0 if static tile images are used as recommended — but captures risk if any developer attempts a live MapLibre mini-map.)

2. **WebGL context budget exceeded** — browsers limit ~8 simultaneous WebGL contexts. Hard cap comparison view at 2 simultaneous mini-maps; destroy on close. Never add per-row thumbnail maps in scrollable lists. Static tile `<img>` consumes zero WebGL contexts — the recommended architecture sidesteps this risk entirely.

3. **Tab panels conditionally rendered causing state loss** — `{activeTab === 'x' && <Component />}` unmounts panels on tab switch, triggering re-fetches, scroll position loss, and flash on return. All `TabPanel` children must stay mounted; use Tailwind `hidden` class (`display: none`) for inactive panels.

4. **Map filter state desync with URL/table filters** — adding map-level filter controls creates a second write path to URL state. All filter changes (map or table) must call the same `navigate()` handler. No local component state for filter values — read from URL, write to URL via the shared handler.

5. **Legacy `gray-*` Tailwind classes break light mode** — `ProjectEditModal.tsx` and `ProjectCreateModal.tsx` use hardcoded `gray-*` / `bg-white` classes that look correct in dark mode by accident but break in light mode. Full grep audit before starting any theme work: `grep -r "gray-\|bg-white\|text-white" src/components`. Replace with semantic `grey-*` equivalents.

6. **MapLibre paint properties reject `oklch()` colors** — `getComputedStyle` returns `oklch(...)` strings from CSS variables, which MapLibre's GL color parser does not support (predates `oklch` adoption). Define `MAP_THEME_COLORS` in `lib/map-theme.ts` as hex constants with documentation mapping each to its CSS variable equivalent. Never pass `getComputedStyle` output directly to MapLibre.

See `.planning/research/PITFALLS.md` for all 13 pitfalls with detection guidance and the phase-specific warning table.

---

## Implications for Roadmap

Research suggests a 5-phase structure ordered by dependency graph: primitives before features, infrastructure before UI, audit before polish. All phases follow well-documented patterns — no phase requires a `/gsd:research-phase` call.

### Phase 1: Scoring Primitives and Table UX Foundation

**Rationale:** All other features depend on the scoring visualization primitives (`ScoreRing`, `ScoreBar`, `ScoreGauge`) and the `Tabs` component. Building these first with zero external dependencies means Phase 1 can ship and validate before any complex feature work begins. The P1 table features (column visibility, density, pinning, filter persistence) deliver immediate premium feel with low implementation risk and no new library requirements — TanStack Table v8 already supports all of them.

**Delivers:** Reusable `ScoreRing`, `ScoreBar`, `ScoreGauge` SVG primitives; headless `Tabs` compound component; `ResultsTable` column visibility toggle, density control, column pinning (sticky CSS), localStorage filter persistence; heatmap column conditional formatting; score legend in table header or filter panel.

**Features from FEATURES.md:** Column visibility (P1), density control (P1), column pinning (P1), save filter state (P1), heatmap formatting (P1), score legend (P1), score factor breakdown bars in detail drawer (P1).

**Avoids:** Pitfall 9 (scoring visualization scroll jank) — CSS-only techniques in table rows (`conic-gradient`, not SVG animations); SVG ring only in detail panels where one instance renders.

**Research flag:** No research phase needed — TanStack Table v8 column visibility/pinning/density are fully documented in official docs with live examples. SVG `stroke-dasharray` gauge pattern is well-established.

### Phase 2: Report Enhancement — Tabs, Mini-Map, Score Gauge Integration

**Rationale:** With Phase 1 primitives validated, integrate them into `ReportDetailPage` and `ParcelDetailModal`. The tab layout converts the long-scroll report into a sectioned view — high visibility, users see it immediately. The static mini-map (`StaticMapImage`) slots into the report header area. This phase has zero backend dependencies and directly consumes Phase 1 outputs.

**Delivers:** Tab-wrapped `ReportDetailPage` with named sections (Gebouw, Kadaster, Bestemming, Monument, AI Analyse, Bronnen) — sections unchanged, `TabPanel` wrappers added; `StaticMapImage` component and `buildStaticMapUrl` Mercator math utility; `ScoreGauge` replacing inline score circles in `ParcelDetailModal` and `InspectorPanel`; `STATUS_EXPLANATIONS` vocabulary expansion for Dutch developer reasoning.

**Features from FEATURES.md:** Mini-map in report page (P2); insight card expansion (P2).

**Stack from STACK.md:** Static CARTO tile URL (zero new dependency); `Tabs` from Phase 1.

**Avoids:** Pitfall 1 (MapLibre at zero dimensions) — static `<img>` not MapLibre; Pitfall 2 (WebGL context budget) — static `<img>` consumes no WebGL; Pitfall 3 (tab panel state loss) — CSS `hidden`, panels stay mounted; Pitfall 5 (file size) — existing Section components unchanged, no file growth.

**Research flag:** No research phase needed — static tile URL approach is standard Mercator math; Tabs pattern established in Phase 1.

### Phase 3: Map Filter Controls

**Rationale:** Map filtering (`MapFilterPanel`, score range slider, `LayerToggle` extension, `map.setFilter()` wiring) is self-contained and does not depend on the comparison view. Building it in Phase 3 allows the filter state architecture to be validated in isolation before comparison adds its own URL state in Phase 4. This is the phase most likely to surface the filter state desync pitfall (Pitfall 4).

**Delivers:** `MapFilterPanel` component with Radix Slider (score range) and category pills; `LayerToggle.tsx` extended with "Filters" pill + active filter count badge; `map.tsx` extended with `mapFilters` state and `useEffect` for `map.setFilter()` expressions; Radix Popover anchoring the panel above the map.

**Features from FEATURES.md:** Map layer toggle panel (P2); interactive map filter controls.

**Stack from STACK.md:** `@radix-ui/react-slider 1.3.6`, `@radix-ui/react-popover 1.1.15`.

**Avoids:** Pitfall 4 (filter state desync) — single `navigate()` handler, no parallel local state for filter values; Pitfall 13 (spurious re-fetches) — `replace: true` on navigate calls, guard page resets; Pitfall 12 (oklch in MapLibre) — `MAP_THEME_COLORS` hex constants established in this phase.

**Research flag:** No research phase needed — MapLibre `setFilter()` expression API is first-class documented. Radix Slider is well-documented. Filter-to-URL sync follows established `resultaten.tsx` pattern.

### Phase 4: Property Comparison View

**Rationale:** Comparison is the most complex feature (new route, parallel queries, N-column grid, header sticky, state management). It requires Phase 1 primitives (ScoreGauge, ScoreBar per column), Phase 2's Section architecture (re-used in `ComparisonColumn`), and validated filter state architecture from Phase 3 (URL-first state pattern is confirmed). Building last avoids early commitment to a comparison architecture that might need adjustment based on Phase 1-3 learnings.

**Delivers:** `/vergelijken` route; `ComparisonView` grid container; `ComparisonColumn` single-property stack re-using Section primitives; `ComparisonHeader` sticky row with names, close, swap buttons; `ComparisonMetricRow` labeled spanning-column rows; `ComparisonEmptySlot` placeholder; `useComparison.ts` parallel query hook via `useQueries`; report selection checkboxes + "Vergelijk" button in `rapporten.tsx`; optional `SideRailNav` link.

**Features from FEATURES.md:** Property comparison view (P2 — high value, highest complexity; this phase IS the validation).

**Stack from STACK.md:** `@radix-ui/react-tabs 1.1.13` for tabbed sections within each comparison column; `useQueries` from TanStack Query v5 (already installed).

**Avoids:** Pitfall 2 (WebGL budget) — `StaticMapImage` (`<img>`) in ComparisonColumn header, not live MapLibre; Pitfall 10 (comparison race conditions) — independent `useQuery` per parcel, independent panel loading/error state; Pitfall 4 (state desync) — URL search params (`?ids=uuid1,uuid2`), not React context or Zustand; Pitfall anti-pattern (prop-drilling mapRef into report/comparison components).

**Research flag:** No research phase needed — `useQueries` for parallel fetching is documented in TanStack Query v5 official docs. CSS grid for comparison layout is standard. URL-as-state is the established Propdex pattern.

### Phase 5: Theme System Polish and Row Virtualization

**Rationale:** Theme polish and virtualization are cross-cutting concerns best addressed last, after all new components exist and can be audited together. Running the `gray-*` grep audit on the full v6.0 component set (including Phases 1-4 additions) catches regressions introduced during development. Row virtualization (`@tanstack/react-virtual`) is additive to `ResultsTable` — it does not change sort/filter/selection state, so it can be added safely after all table features are stable.

**Delivers:** Full `gray-*` / `bg-white` audit and replacement across all components; `lib/map-theme.ts` hex constant module for MapLibre layer theming in dark and light mode; dark/light mode verification for every new component; recharts tooltip CSS overrides tied to CSS variables; `@tanstack/react-virtual` row virtualization in `ResultsTable` for 500+ result sets with `estimateSize: () => 40` matching existing compact density; CSS variable additions in `index.css` (`--color-chart-1..5`, `--color-score-high/mid/low` in `@theme` and `html.light`).

**Features from FEATURES.md:** Theme polish (prerequisite for confident light mode rollout); row virtualization for large datasets.

**Stack from STACK.md:** `@tanstack/react-virtual 3.13.18`; CSS variable extensions in `index.css` (no new npm packages).

**Avoids:** Pitfall 7 (map colors ignore theme) — `MAP_THEME_COLORS` object with `dark` and `light` entries; Pitfall 8 (legacy gray-\* classes) — full grep audit before starting; Pitfall 12 (oklch in MapLibre) — hex equivalents documented alongside their CSS variable counterparts.

**Research flag:** No research phase needed — Tailwind v4 CSS variable theming, `@tanstack/react-virtual` + TanStack Table integration, and recharts CSS variable theming are all documented.

### Phase Ordering Rationale

- **Dependency order enforced:** Primitives (Phase 1) must precede all feature phases. Comparison (Phase 4) must follow Phase 2 because `ComparisonColumn` re-uses Section components. Theme polish (Phase 5) must follow all component creation to audit the full set.
- **Risk-first validation:** The most novel architectural decisions (static mini-map via `<img>`, headless Tabs) are validated in Phase 2 before the most complex feature (comparison) depends on them in Phase 4.
- **Isolation principle:** Map filter controls (Phase 3) are intentionally isolated from comparison (Phase 4) to validate the URL-first filter state architecture before comparison adds its own URL params.
- **Pitfall mitigation embedded in order:** The WebGL context constraint (Pitfall 2) is resolved by the static image decision in Phase 2 — this architectural resolution is confirmed before Phase 4 might tempt a developer to add live mini-maps in comparison columns.
- **Phase 1 delivers immediate user value:** Column visibility, density control, and filter persistence are visible immediately and require no new libraries. Users get premium table UX before any chart or comparison feature ships.

### Research Flags

No phase requires a `/gsd:research-phase` call. All capability areas are covered by official documentation verified during this research cycle:

- **Phase 1:** TanStack Table v8 column features have official docs with live working examples. SVG `stroke-dasharray` gauge is standard SVG technique documented on MDN.
- **Phase 2:** Static tile URL construction is pure Mercator math. CARTO tile endpoint format is documented. Tabs compound component pattern is a foundational React architecture pattern (Martin Fowler).
- **Phase 3:** MapLibre `setFilter()` is a first-class documented API with official examples. Radix Slider is well-documented with Tailwind integration patterns.
- **Phase 4:** `useQueries` for parallel fetching is in TanStack Query v5 official docs. URL-as-state with TanStack Router is the established Propdex pattern (used in `resultaten.tsx`).
- **Phase 5:** Tailwind v4 CSS variable theming is documented. `@tanstack/react-virtual` + TanStack Table v8 integration is documented in TanStack's own examples.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All 7 packages verified via `npm info` for React 19 explicit peer dep. recharts 3.7.0 SVG CSS variable fills confirmed in recharts docs. maplibregl-minimap rejection backed by official repo README. All alternatives evaluated and rejected with documented rationale. |
| Features | HIGH (P1/P2 scope) / MEDIUM (competitor analysis) | P1/P2 features derived from direct codebase analysis — no guessing. Anti-features justified by architectural constraints, not opinion. Competitor UX analysis from marketing pages (MEDIUM confidence) but not decision-critical — the NL market gap is the strategic thesis. |
| Architecture | HIGH | Based on direct ~16K LOC TypeScript/React codebase inspection. Single MapLibre instance constraint verified in `_authenticated.tsx`. Static mini-map approach confirmed against MapLibre WebGL context discussion in official repo. Build order derived from explicit dependency graph analysis of new and modified components. |
| Pitfalls | HIGH | All 4 critical pitfalls backed by official MapLibre/TanStack repo issues and discussions or direct codebase code inspection. `gray-*` legacy class audit grounded in actual file line numbers. oklch MapLibre incompatibility is a known, documented limitation. |

**Overall confidence: HIGH**

### Gaps to Address

- **ComparisonColumn content depth:** Research confirms the architecture (parallel queries, URL state, CSS grid) but the exact data fields to display per column per tab section are not specified. This is a product decision to be made during planning against the `PropertyReportResponse` TypeScript type — not a technical gap.

- **Score legend visual design:** Research confirms the feature is needed (P1) and belongs near the table or filter panel, but the exact visual design (inline scale bar, legend tooltip, separate card?) is not specified. Low-stakes decision for the plan author to make during Phase 1 planning.

- **`MAP_THEME_COLORS` hex values computation:** The pitfall research identifies that MapLibre needs hex equivalents of the OKLCH design tokens and names the file (`lib/map-theme.ts`). The actual hex conversions must be computed from existing `index.css` oklch values during Phase 5 implementation — straightforward arithmetic but requires attention from the implementer.

- **`PropertyDetailDrawer` vs `ParcelDetailModal` naming:** Both names appear across research files. The implementation references `ParcelDetailModal.tsx` in the architecture file component boundaries map. Confirm the correct filename before starting Phase 1 score visualization work — almost certainly `ParcelDetailModal.tsx` based on the majority of architectural references.

---

## Sources

### Primary (HIGH confidence)

- `npm info recharts@3.7.0 peerDependencies` — React 19 explicit peer dep confirmed
- `npm info @radix-ui/react-{tabs,slider,collapsible,tooltip,popover}` — all verified for React 19 explicit support
- `npm info @tanstack/react-virtual` — v3.13.18, React 19 explicit support
- [TanStack Table Column Visibility Guide](https://tanstack.dev/table/latest/docs/guide/column-visibility) — official docs
- [TanStack Table Column Pinning Sticky Example](https://tanstack.com/table/v8/docs/framework/react/examples/column-pinning-sticky) — official docs
- [TanStack Query v5 Parallel Queries](https://tanstack.com/query/v5/docs/framework/react/guides/parallel-queries) — official docs
- [TanStack Virtual v3 Docs](https://tanstack.com/virtual/latest) — official docs
- [MapLibre GL JS Filter Examples](https://maplibre.org/maplibre-gl-js/docs/examples/filter-within-a-layer/) — official docs
- [MapLibre Map does not fit container in modal (Issue #1363)](https://github.com/maplibre/maplibre-gl-js/issues/1363) — official repo, WebGL context at zero dimensions pitfall
- [MapLibre Too many active WebGL contexts (Discussion #3065)](https://github.com/maplibre/maplibre-gl-js/discussions/3065) — official repo, WebGL budget constraint
- [maplibregl-minimap README](https://github.com/JabSYsEmb/maplibregl-minimap/blob/main/README.md) — "not yet ready for production use" (rejection basis)
- [TanStack Router URL as State (Discussion #1249)](https://github.com/TanStack/router/discussions/1249) — official repo, filter state architecture
- [TanStack Router Search Param Propagation (Discussion #3686)](https://github.com/TanStack/router/discussions/3686) — official repo, spurious re-fetch prevention
- [TanStack Router Keep Alive (Discussion #1447)](https://github.com/TanStack/router/discussions/1447) — official repo, CSS `hidden` workaround for tab state
- Direct codebase analysis (HIGH confidence): `_authenticated.tsx`, `MapView.tsx`, `MapContext.tsx`, `ReportDetailPage.tsx`, `ParcelDetailModal.tsx`, `LayerToggle.tsx`, `ParcelScoreLayer.tsx`, `InspectorPanel.tsx`, `ResultsTable.tsx`, `ResultsFilterPanel.tsx`, `Drawer.tsx`, `ProjectEditModal.tsx`, `ChangeTimeline.tsx`, `index.css`, `ThemeContext.tsx`, `frontend/package.json`

### Secondary (MEDIUM confidence)

- [Pencil & Paper Enterprise Data Table UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — density control, column management UX conventions
- [LogRocket Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) — recharts 3.x vs alternatives evaluation
- [Headless Component Pattern — Martin Fowler](https://martinfowler.com/articles/headless-component.html) — Tabs compound component justification
- [SVG Gauge stroke-dasharray Pattern](https://veerasundar.com/blog/building-a-radial-gauge-with-svg-and-react-part-1) — `ScoreRing` implementation technique
- [Map UI Patterns — Attribute Filter](https://mapuipatterns.com/attribute-filter/) — map filter panel UX conventions
- [Reonomy Web Application](https://www.reonomy.com/solutions/web-application/) — mini-map in reports competitor reference
- [PropStream Features](https://www.propstream.com/propstream-features) — competitor table feature comparison
- [Basedash Blog — Light Mode Without Tailwind dark: class](https://www.basedash.com/blog/how-we-built-light-mode-without-tailwind-s-dark-class) — `html.light` class pattern validation

### Tertiary (LOW confidence)

- [HouseCanary AI in Real Estate](https://www.housecanary.com/blog/ai-in-real-estate) — US market; insight card language patterns not directly applicable to Dutch developer UX

---

*Research completed: 2026-02-21*
*Ready for roadmap: yes*
