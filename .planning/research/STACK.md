# Stack Research — v6.0 Premium Data Presentation

**Project:** Propdex v6.0
**Domain:** Dutch property intelligence SaaS — premium data presentation, scoring visualizations, comparison views, mini-maps, map filtering UI, theme polish
**Researched:** 2026-02-21
**Confidence:** HIGH
**Focus:** Additions ONLY — existing stack (React 19, Vite 7, TypeScript strict, Tailwind v4, MapLibre GL JS 5.x, TanStack Query v5, TanStack Router, TanStack Table v8, Industrial Amber design system) is validated and unchanged.

---

## Context: What This Milestone Adds

Six new capability areas, each with distinct library needs:

1. **Scoring visualizations** — radial gauges, factor bar charts, score trend lines in detail panels and reports
2. **Data-dense table UX** — column pinning, row virtualization for 500+ result sets, sticky headers
3. **Property comparison views** — side-by-side parcel comparison with tabbed sections, diff highlights
4. **Map filter controls** — range slider for score threshold, pill-toggle filters wired to MapLibre `setFilter()`
5. **Mini-maps in reports** — static location thumbnail embedded in `ReportDetailPage`, live overview control in scan view
6. **Theme system polish** — chart colors, map overlay colors, MapLibre popup styles wired to CSS variables for `html.light` / dark switch

---

## New Dependencies: Decision Table

| Library | Version | Area | Decision | Confidence |
|---------|---------|------|----------|------------|
| `recharts` | 3.7.0 | Scoring charts | ADD — only charting library needed | HIGH |
| `@radix-ui/react-tabs` | 1.1.13 | Comparison views | ADD — headless, accessible, React 19 explicit support | HIGH |
| `@radix-ui/react-slider` | 1.3.6 | Map filter controls | ADD — range slider for score threshold, accessible | HIGH |
| `@radix-ui/react-collapsible` | 1.1.12 | Report sections | ADD — accordion-style expand/collapse for data sections | HIGH |
| `@radix-ui/react-tooltip` | 1.2.8 | Score factor labels | ADD — accessible tooltip for score breakdown labels | HIGH |
| `@radix-ui/react-popover` | 1.1.15 | Filter panel popup | ADD — filter panel anchored to map button | HIGH |
| `@tanstack/react-virtual` | 3.13.18 | Table virtualization | ADD — row virtualization for 500+ parcel result sets | HIGH |

**Zero new backend dependencies.**

---

## Capability Area 1: Scoring Visualizations

### Decision: recharts 3.7.0

**Why recharts over alternatives:**

- React 19 explicit peer dependency support: `"react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"` — verified via `npm info recharts@3.7.0` (HIGH confidence).
- Recharts 3.0 rewrote internal state management — smaller, faster, fewer re-renders than 2.x. Version 3.7.0 is the current stable (`npm info recharts version` returns `3.7.0`).
- Renders to SVG — inherits CSS variables for colors. Chart `fill` and `stroke` can be `var(--color-amber-accent)` which automatically switches with `html.light`.
- No additional charting dependency needed — recharts covers all required chart types: `RadialBarChart` for score gauge, `BarChart` + `Cell` for factor breakdown, `LineChart` for trend sparklines.
- Bundle: ~150KB minified (acceptable for a data-dense SaaS — already shipping MapLibre at ~600KB).

**Why NOT alternatives:**
- **Chart.js / react-chartjs-2** — Canvas-based. CSS variables do not apply to canvas fills — each color must be extracted via `getComputedStyle()` at render time. Makes light/dark theme switching significantly more complex. Rejected.
- **Victory** — React 19 support is unclear, last major release was 2023. LOW confidence on compatibility.
- **D3 direct** — No React component abstraction; requires imperative DOM manipulation in `useEffect`. Conflicts with React 19's concurrent rendering model. More than 10x the implementation effort for equivalent charts.
- **Tremor** — Component library (not headless). Imposes its own design tokens that conflict with the existing Industrial Amber CSS variable system. Rejected.

**Required chart types:**

| Chart | Component | Use Case |
|-------|-----------|----------|
| Score gauge | `RadialBarChart` + `PolarAngleAxis` | 0-100 score ring in detail modal / report header |
| Factor bars | `BarChart` + `Cell` + `LabelList` | Score breakdown (Pandstatus, Bouwjaar, etc.) |
| Trend sparkline | `LineChart` + `ReferenceLine` | Score history across re-scans (future) |

**CSS variable integration pattern (critical for theme):**

```typescript
// Chart colors use CSS variables — switch automatically with html.light
const chartConfig = {
  score: { color: 'var(--color-amber-accent)' },
  success: { color: 'var(--color-success)' },
  error: { color: 'var(--color-error)' },
}

// RadialBarChart gauge for 0-100 score
<RadialBarChart
  width={120} height={120}
  innerRadius="70%" outerRadius="90%"
  startAngle={180} endAngle={-180}
  data={[{ value: score, fill: 'var(--color-amber-accent)' }]}
>
  <RadialBar dataKey="value" background={{ fill: 'var(--color-grey-800)' }} />
</RadialBarChart>

// BarChart for factor breakdown
<BarChart data={factors} layout="vertical">
  <Bar dataKey="value">
    {factors.map((f) => (
      <Cell key={f.key} fill={`var(--color-${f.color})`} />
    ))}
  </Bar>
</BarChart>
```

**Confidence:** HIGH — recharts 3.7.0 explicitly supports React 19, CSS variable fills confirmed in recharts docs, SVG rendering verified.

---

## Capability Area 2: Data-Dense Table UX

### Decision: @tanstack/react-virtual 3.13.18

**Why:**
- TanStack Table v8 (already installed) has no built-in row virtualization. For scan result sets of 500+ parcels, rendering all rows causes visible lag.
- `@tanstack/react-virtual` is the official TanStack companion — designed to compose with `useReactTable()` row models. The integration is documented in TanStack Table's own examples.
- React 19 peer dependency explicitly supported: `"react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"` — verified via npm.
- Headless — uses the same `styled div` approach as the existing `ResultsTable.tsx`. No style conflicts.
- ~15KB. No DOM overhead when virtualization threshold is not reached (renders normally under ~100 rows).

**Integration pattern with existing ResultsTable:**

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

// In ResultsTable.tsx — add to existing useReactTable setup:
const { rows } = table.getRowModel()
const parentRef = useRef<HTMLDivElement>(null)

const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 40,       // row height matches existing compact density
  overscan: 10,
})

const virtualRows = rowVirtualizer.getVirtualItems()
const totalSize = rowVirtualizer.getTotalSize()
```

**Column pinning (no new library needed):**
TanStack Table v8 has built-in column pinning via `columnPinning` state and `getLeftLeafColumns()` / `getRightLeafColumns()`. Sticky positioning is pure CSS: `position: sticky; left: 0`. This is already documented in TanStack Table v8 and requires zero new dependencies.

**Confidence:** HIGH — official TanStack pairing, React 19 explicitly supported, pattern verified in TanStack Table sticky pinning docs.

---

## Capability Area 3: Property Comparison Views

### Decision: @radix-ui/react-tabs 1.1.13

**Why:**
- The comparison view is a side-by-side panel with tabbed sections (Overview / Locatie / Bestemmingen / Vergunningen). Tabs are the correct primitive — not accordion, not routing.
- Radix UI Tabs: accessible (WAI-ARIA), keyboard navigable, zero styling imposed. Integrates with Tailwind CSS variables.
- React 19 explicit peer dependency: `"react": "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc"` — verified via npm.
- Already familiar pattern — `cmdk` (already installed) uses Radix primitives under the hood.

**Why NOT routing-based tabs:**
TanStack Router tabs would force URL changes per tab switch in the comparison view, which is not desired (comparison is modal/panel state, not a navigable page).

**Comparison view structure:**

```tsx
// Side-by-side comparison — two columns, one tab set controls both
<Tabs.Root defaultValue="overview">
  <Tabs.List>
    <Tabs.Trigger value="overview">Overzicht</Tabs.Trigger>
    <Tabs.Trigger value="locatie">Locatie</Tabs.Trigger>
    <Tabs.Trigger value="bestemmingen">Bestemmingen</Tabs.Trigger>
  </Tabs.List>

  <div className="grid grid-cols-2 gap-4">
    {[parcelA, parcelB].map((parcel) => (
      <div key={parcel.id}>
        <Tabs.Content value="overview"><OverviewSection parcel={parcel} /></Tabs.Content>
        <Tabs.Content value="locatie"><LocatieSection parcel={parcel} /></Tabs.Content>
        <Tabs.Content value="bestemmingen"><BestemmingSection parcel={parcel} /></Tabs.Content>
      </div>
    ))}
  </div>
</Tabs.Root>
```

**Diff highlights:** CSS only — compare field values, apply `bg-amber-accent/10 text-amber-accent` to cells that differ. No library needed.

**Confidence:** HIGH — Radix Tabs 1.1.13, React 19 explicitly supported, accessible ARIA roles included.

---

## Capability Area 4: Map Filter Controls

### Decision: @radix-ui/react-slider 1.3.6

**Why:**
- The map filter panel requires a range slider for score threshold (0–100). Native `<input type="range">` cannot be styled consistently across browsers and lacks dual-thumb (min/max range) support.
- Radix Slider: accessible, dual-thumb range support, keyboard navigable. React 19 peer dep: `"react": "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc"`.
- The existing `ResultsFilterPanel.tsx` uses custom `FilterPill` and native `<select>` — adding Radix Slider extends this pattern without imposing a full component framework.

**MapLibre setFilter wiring pattern:**

```typescript
// Score range slider → MapLibre layer filter
const [scoreRange, setScoreRange] = useState([0, 100])

const handleScoreChange = (values: number[]) => {
  setScoreRange(values)
  map.setFilter('parcel-scores-fill', [
    'all',
    ['>=', ['get', 'score'], values[0]],
    ['<=', ['get', 'score'], values[1]],
  ])
}

<Slider.Root
  min={0} max={100} step={5}
  value={scoreRange}
  onValueChange={handleScoreChange}
>
  <Slider.Track className="h-1 bg-grey-800 rounded-full relative">
    <Slider.Range className="absolute h-full bg-amber-accent rounded-full" />
  </Slider.Track>
  <Slider.Thumb className="block w-4 h-4 bg-amber-accent rounded-full shadow-md" />
  <Slider.Thumb className="block w-4 h-4 bg-amber-accent rounded-full shadow-md" />
</Slider.Root>
```

**Why NOT custom slider:** Keyboard accessibility for range sliders (Arrow keys, Home/End) requires significant ARIA implementation. Radix handles this correctly out of the box.

### Decision: @radix-ui/react-popover 1.1.15

**Why:**
- The map filter panel is triggered by a button in `LayerToggle.tsx` and floats over the map. This is a popover pattern — anchored, dismissible on outside click, focus-trapped.
- Radix Popover: correct semantic role, portal-rendered (above MapLibre z-index), accessible. React 19 peer dep: explicitly supported.
- The existing `LayerToggle.tsx` is a hand-rolled positioned `<div>`. Replacing with Radix Popover eliminates the custom outside-click detection logic (currently in a `useEffect` with a document listener).

**Confidence:** HIGH — Radix Slider 1.3.6 and Popover 1.1.15, React 19 explicitly supported, MapLibre `setFilter` integration is standard API.

---

## Capability Area 5: Mini-Maps in Reports

### Decision: Native MapLibre GL JS — No New Library

**Two distinct mini-map use cases require different approaches:**

**5a. Static location thumbnail in ReportDetailPage (property centroid)**

Implementation: `new maplibregl.Map({ container, preserveDrawingBuffer: true })` rendered into a small fixed-size `<div>` (e.g. 280px × 180px). Center on parcel centroid. Add `NavigationControl` disabled for interaction. Capture static image via `map.getCanvas().toDataURL('image/png')` after the `idle` event.

Note: `preserveDrawingBuffer: true` has a GPU cost (prevents frame buffer reuse). Acceptable for a single mini-map in a detail page. Do NOT use it on the primary scan map.

**5b. Overview "where-am-I" control in scan view**

The `maplibregl-minimap` npm package (v1.0.3) exists on MapLibre's official plugins page. However, the package description states it is "currently in development and not yet ready for production use." Using an unstable plugin on the primary scan map carries unacceptable risk.

**Decision: Implement the overview mini-map as a custom MapLibre `IControl`.** Pattern:
- Create a small second `maplibregl.Map` instance inside a custom `IControl`'s `onAdd()` method.
- Sync the overview map's center/zoom to the primary map via `map.on('move', ...)`.
- This is the same approach MapLibre's own plugin uses internally — avoids dependency risk.
- Estimated implementation: ~80 lines in `MinimapControl.ts`.

**Why NOT react-mapbox-minimap (npm: `react-mapbox-minimap` by gilles-mastropasqua):**
- Peer dependency requires `mapbox-gl ^3.7.0` — incompatible with this project's `maplibre-gl 5.x`. Rejected.

**Why NOT a full additional MapLibre instance as React state:**
- MapLibre instances are imperative and DOM-attached. Two Map instances managed via React state causes double mount/teardown on StrictMode and `suspense`. The `IControl` lifecycle (`onAdd` / `onRemove`) is the correct imperative container.

**Confidence:** HIGH — `preserveDrawingBuffer` approach is MapLibre official recommendation for screenshots. Custom `IControl` for overview is the pattern MapLibre's plugin ecosystem uses.

---

## Capability Area 6: Theme System Polish

### Decision: No New Libraries — CSS Variable Extension Only

The theme system is already correct architecture (`html.light` selector on `<html>`, CSS variables in `@theme`, `ThemeContext.tsx` with localStorage). The gaps are color token coverage, not structural.

**Required CSS variable additions to `index.css`:**

```css
@theme {
  /* Chart palette — oklch for P3 gamut vibrancy */
  --color-chart-1: oklch(0.78 0.15 85.87);   /* amber — matches amber-accent */
  --color-chart-2: oklch(0.65 0.18 145);      /* green — matches success */
  --color-chart-3: oklch(0.60 0.22 25);       /* red — matches error */
  --color-chart-4: oklch(0.62 0.18 250);      /* blue — matches info */
  --color-chart-5: oklch(0.59 0.12 192.47);   /* teal — matches teal-accent */

  /* Score tier tokens */
  --color-score-high: oklch(0.65 0.18 145);   /* >= 70: green */
  --color-score-mid: oklch(0.78 0.15 85.87);  /* 40-69: amber */
  --color-score-low: oklch(0.60 0.22 25);     /* < 40: red */
}

html.light {
  /* Chart palette — same hues, adjusted L for white surfaces */
  --color-chart-1: oklch(0.70 0.15 85.87);
  --color-chart-2: oklch(0.50 0.18 145);
  --color-chart-3: oklch(0.52 0.22 25);
  --color-chart-4: oklch(0.52 0.18 250);
  --color-chart-5: oklch(0.48 0.12 192.47);

  --color-score-high: oklch(0.50 0.18 145);
  --color-score-mid: oklch(0.70 0.15 85.87);
  --color-score-low: oklch(0.52 0.22 25);
}
```

**MapLibre light mode map tiles:**
The existing map uses CartoDB Dark Matter tiles. In `html.light` mode, switch to CartoDB Positron (light tile variant). Pattern: `ThemeContext` change triggers `map.setStyle()` in `MapView.tsx`. This is pure logic — no new dependency.

**MapLibre popup light mode:**
Already handled in `index.css` via `html.light .propdex-property-popup .maplibregl-popup-content` selectors (confirmed in existing code). Extend same pattern for any new popups.

**Recharts tooltip theming:**
Recharts `<Tooltip>` renders into a `<div>` inside the SVG container. Style via CSS:
```css
.recharts-tooltip-wrapper .recharts-default-tooltip {
  background: var(--color-grey-900) !important;
  border: 1px solid color-mix(in oklch, var(--color-overlay) 8%, transparent) !important;
  color: var(--color-grey-100) !important;
}
```

**Confidence:** HIGH — existing architecture is correct, gaps are additive token coverage only.

---

## Supporting Radix Primitives: Tooltip and Collapsible

### @radix-ui/react-tooltip 1.2.8

**Why:** Score factor labels in `ParcelDetailModal.tsx` currently use a hand-rolled `group-hover:opacity-100` tooltip (lines 128–134 of existing code). Radix Tooltip provides correct ARIA `role="tooltip"`, keyboard accessibility (focus shows tooltip), and portal rendering (prevents z-index conflicts inside scroll containers). React 19: explicitly supported.

**Migration:** Replace the existing `<div className="group relative">` pattern with `<Tooltip.Root>` — backward compatible slot-based API.

### @radix-ui/react-collapsible 1.1.12

**Why:** Report detail sections (Vergunningen, Ruimtelijke Plannen, RCE Monumenten) currently render all data unconditionally. For parcels with many plan documents, this creates long single-scroll pages. Radix Collapsible provides accessible expand/collapse with `aria-expanded` — no animation library needed, just `data-[state=open]:animate-*` with Tailwind.

React 19: explicitly supported.

---

## Full New Dependency Table

| Library | Version | Purpose | pnpm install command |
|---------|---------|---------|---------------------|
| `recharts` | `^3.7.0` | Score gauge, factor bars, sparklines | `pnpm add recharts` |
| `@radix-ui/react-tabs` | `^1.1.13` | Comparison view tab navigation | `pnpm add @radix-ui/react-tabs` |
| `@radix-ui/react-slider` | `^1.3.6` | Score range filter slider | `pnpm add @radix-ui/react-slider` |
| `@radix-ui/react-collapsible` | `^1.1.12` | Report section expand/collapse | `pnpm add @radix-ui/react-collapsible` |
| `@radix-ui/react-tooltip` | `^1.2.8` | Score factor label tooltips | `pnpm add @radix-ui/react-tooltip` |
| `@radix-ui/react-popover` | `^1.1.15` | Map filter panel anchor | `pnpm add @radix-ui/react-popover` |
| `@tanstack/react-virtual` | `^3.13.18` | Row virtualization for 500+ results | `pnpm add @tanstack/react-virtual` |

**Installation (all at once):**
```bash
pnpm add recharts @radix-ui/react-tabs @radix-ui/react-slider @radix-ui/react-collapsible @radix-ui/react-tooltip @radix-ui/react-popover @tanstack/react-virtual
```

**No new dev dependencies.** All type declarations are bundled in the packages themselves.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `chart.js` / `react-chartjs-2` | Canvas-based — CSS variables (oklch tokens) don't apply to canvas. Light/dark theme switching requires `getComputedStyle()` hacks at render time | `recharts` (SVG, CSS variables apply natively) |
| `victory` (FormidableLabs) | Last major release 2023, React 19 compatibility unclear, LOW confidence | `recharts 3.7.0` |
| `d3` direct | Imperative DOM manipulation conflicts with React 19 concurrent rendering; 10x implementation effort for equivalent charts | `recharts` (wraps d3 internally) |
| `tremor` | Component library with its own design tokens — conflicts with Industrial Amber CSS variable system | `recharts` + Radix primitives + Tailwind |
| `maplibregl-minimap` npm package | Package README states "not yet ready for production use" (development status) | Custom `IControl` implementation (~80 lines) |
| `react-mapbox-minimap` | Peer dependency requires `mapbox-gl ^3.7.0` — incompatible with `maplibre-gl 5.x` | Custom `IControl` implementation |
| `@radix-ui/react-accordion` | Adds indirection over `@radix-ui/react-collapsible` which is the lower-level primitive we need | `@radix-ui/react-collapsible` directly |
| `framer-motion` | ~150KB animation library for effects achievable with Tailwind's `transition-*` utilities and CSS `@keyframes` | Tailwind transitions + `@keyframes` in `index.css` |
| `react-spring` | Same concern as framer-motion — heavy for what's needed | CSS transitions only |
| `next-themes` | Next.js-specific theme provider — incompatible with the existing `ThemeContext.tsx` + localStorage pattern | Existing `ThemeProvider` in `src/lib/theme/` |
| `react-window` | Older virtualization library; `@tanstack/react-virtual` is the modern replacement with React 19 support | `@tanstack/react-virtual` |
| `react-virtualized` | Unmaintained. Last release 2019. No React 17+ support | `@tanstack/react-virtual` |
| `shadcn/ui` CLI install | Conflicts with Tailwind v4's CSS-first `@theme` approach — CLI modifies `tailwind.config.js` which doesn't exist in v4 | Copy-paste individual patterns manually (shadcn is source, not runtime dependency) |

---

## Integration Points

### recharts ↔ Theme System

```
index.css: --color-chart-1..5, --color-score-high/mid/low defined in @theme + html.light overrides
  ↓ recharts SVG fills use var(--color-chart-1) etc.
  ↓ ThemeContext toggles html.light class
  ↓ CSS variables update automatically — no JS re-render needed for chart colors
```

### @tanstack/react-virtual ↔ ResultsTable

```
ResultsTable.tsx (existing TanStack Table v8)
  ↓ add useVirtualizer() from @tanstack/react-virtual
  ↓ render virtualRows instead of all rows
  ↓ add paddingTop/paddingBottom spacers to maintain scroll position
  ↓ existing sort/filter/selection state unaffected
```

### @radix-ui/react-slider ↔ MapLibre setFilter

```
LayerToggle.tsx → opens @radix-ui/react-popover
  ↓ Popover content: score range Slider + category pills
  ↓ onValueChange → map.setFilter('parcel-scores-fill', [...expression...])
  ↓ map.setFilter('parcel-scores-line', [...expression...]) — same expression
  ↓ ParcelScoreLayer.tsx setFilter call — paint stays; features filtered
```

### Custom MinimapControl ↔ MapLibre Map

```
MinimapControl.ts (new IControl class, ~80 lines)
  ↓ onAdd(map): creates second maplibregl.Map in a container div
  ↓ map.on('move', syncOverview) — syncs center/zoom with offset
  ↓ Renders viewport rect as GeoJSON on overview map
  ↓ Added to primary map: map.addControl(new MinimapControl(), 'bottom-right')
  ↓ No React state — pure MapLibre imperative API
```

---

## Version Compatibility Matrix

| Package | Version | React 19 | Tailwind v4 | MapLibre 5.x | Notes |
|---------|---------|-----------|-------------|--------------|-------|
| `recharts` | 3.7.0 | explicit | via CSS vars | N/A | SVG fills inherit CSS variables |
| `@radix-ui/react-tabs` | 1.1.13 | explicit | via className | N/A | No style conflicts |
| `@radix-ui/react-slider` | 1.3.6 | explicit | via className | via setFilter | Thumb/track are unstyled divs |
| `@radix-ui/react-collapsible` | 1.1.12 | explicit | via className | N/A | `data-[state=open]` Tailwind variant |
| `@radix-ui/react-tooltip` | 1.2.8 | explicit | via className | N/A | Portal renders above MapLibre z-index |
| `@radix-ui/react-popover` | 1.1.15 | explicit | via className | N/A | Portal renders above MapLibre z-index |
| `@tanstack/react-virtual` | 3.13.18 | explicit | via className | N/A | Pairs with existing TanStack Table v8 |

All Radix UI packages declare `"react": "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc"` — verified via `npm info` for each package.

---

## Radix UI Portals and MapLibre Z-Index

**Potential conflict:** Radix UI Tooltip, Popover, and other portal-rendered components render into `document.body`. MapLibre renders into a fixed canvas element. The existing `index.css` z-index scale has `--z-modal: 1000` and `--z-toast: 2000`.

**Resolution:** Add explicit z-index to Radix portal containers:

```css
/* In index.css — Radix UI portal z-index */
[data-radix-popper-content-wrapper] {
  z-index: var(--z-dropdown) !important;  /* 400 — above map layers */
}
[data-radix-tooltip-content] {
  z-index: var(--z-dropdown) !important;
}
```

This is the established pattern for Radix + MapLibre coexistence (verified via community discussions). The `!important` is intentional — Radix sets inline `z-index` via Popper positioning that must be overridden.

---

## Sources

- `npm info recharts@3.7.0 peerDependencies` — React 19 explicit support confirmed (HIGH confidence)
- `npm info @radix-ui/react-tabs version peerDependencies` — v1.1.13, React 19 explicit support (HIGH confidence)
- `npm info @radix-ui/react-slider version peerDependencies` — v1.3.6, React 19 explicit support (HIGH confidence)
- `npm info @radix-ui/react-collapsible version peerDependencies` — v1.1.12, React 19 explicit support (HIGH confidence)
- `npm info @radix-ui/react-tooltip version peerDependencies` — v1.2.8, React 19 explicit support (HIGH confidence)
- `npm info @radix-ui/react-popover version peerDependencies` — v1.1.15, React 19 explicit support (HIGH confidence)
- `npm info @tanstack/react-virtual version peerDependencies` — v3.13.18, React 19 explicit support (HIGH confidence)
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) — state management rewrite, CSS variable fill support
- [maplibregl-minimap README](https://github.com/JabSYsEmb/maplibregl-minimap/blob/main/README.md) — "not yet ready for production use" (reason for custom IControl decision)
- [react-mapbox-minimap npm](https://www.npmjs.com/package/react-mapbox-minimap) — peer dep `mapbox-gl ^3.7.0`, incompatible with maplibre-gl 5.x
- [MapLibre GL JS Plugins page](https://maplibre.org/maplibre-gl-js/docs/plugins/) — official plugin ecosystem overview
- [MapLibre setFilter examples](https://maplibre.org/maplibre-gl-js/docs/examples/filter-within-a-layer/) — filter expression API confirmed
- [shadcn/ui charts with CSS variables](https://ui.shadcn.com/docs/components/radix/chart) — recharts + CSS variable pattern (`var(--chart-1)` etc.)
- [TanStack Table column pinning sticky](https://tanstack.com/table/v8/docs/framework/react/examples/column-pinning-sticky) — built-in, no extra library needed
- [TanStack Virtual v3 docs](https://tanstack.com/virtual/latest) — React 19 support, TanStack Table integration pattern
- [Tailwind v4 dark mode docs](https://tailwindcss.com/docs/dark-mode) — `@custom-variant` and class selector approach
- Existing codebase: `frontend/src/styles/index.css` — oklch `@theme` + `html.light` pattern (confirmed architecture)
- Existing codebase: `frontend/src/lib/theme/ThemeContext.tsx` — localStorage + `html.light` toggle (confirmed pattern)
- Existing codebase: `frontend/src/components/results/ParcelDetailModal.tsx` — hand-rolled score bars to be replaced

---

*Stack research for: Propdex v6.0 — Premium Data Presentation*
*Researched: 2026-02-21*
