# Phase 29: Silver Map Theme + Layout Shells — Research

**Researched:** 2026-02-18
**Domain:** MapLibre GL JS raster paint properties, CSS glassmorphism, Tailwind v4 layout shell components
**Confidence:** HIGH

---

## Summary

Phase 29 has two parallel concerns: (1) applying a silver/desaturated visual treatment to the map base layer, and (2) introducing reusable layout shell wrappers (MapShell, ResultsShell) that enforce consistent page structure across authenticated routes.

For the silver map, the solution is entirely within MapLibre's existing raster paint property system. The CartoDB Positron light tiles already loaded in `MapView.tsx` are the correct base — they use a neutral, near-monochrome palette. Applying `raster-saturation: -0.8` to `-1.0` and a small positive `raster-brightness-min` lift (0.05–0.15) achieves a professional silver/desaturated aesthetic in the initial style definition. No tile source changes, no new tile providers, no new libraries required. The values can be baked into the MapLibre style at initialization time; no runtime `setPaintProperty` calls are needed for the base theme.

For the layout shells, the goal is to formalize the structural patterns already implicit in the codebase. `AppLayout.tsx` exists but is minimal. `MapShell` and `ResultsShell` should be React components that provide consistent positioning, z-index, and overflow rules for their respective content areas. The glassmorphism treatment on navigation chrome (SideRailNav, InspectorPanel) is already partially implemented — Phase 29 refines the values and ensures data content areas use solid backgrounds. No new dependencies are needed; Tailwind v4 utilities + CSS variables already in `index.css` cover all requirements.

**Primary recommendation:** Apply silver map style via raster paint properties in the `MapView.tsx` style definition. Build MapShell and ResultsShell as thin Tailwind wrappers using the existing design token system. Enforce the glassmorphism/solid boundary by convention: glass = `bg-black/30 backdrop-blur-xl border-white/10`, solid data = `bg-grey-900`.

---

## User Constraints

No CONTEXT.md exists for Phase 29. All architectural decisions are at Claude's discretion within the constraints set by prior phases.

### Locked from Prior Phases
- MapView lives in `_authenticated.tsx` (Phase 28 decision — do not move)
- MapContext (React Context, not Zustand) is the shared map access pattern (Phase 28)
- ResultsLayout uses CSS transform left-edge overlay, not react-resizable-panels (Phase 28)
- SideRailNav uses three primary icons: Map, ListOrdered, FolderOpen with lucide-react (Phase 28)
- InspectorPanel slides from right on parcel click (Phase 28)
- Design tokens live in Tailwind v4 `@theme` block in `frontend/src/styles/index.css` (Phase 27)
- `cn()` utility from `tailwind-merge` + `clsx` (Phase 27)
- CVA (class-variance-authority) available for component variants (Phase 27)
- Color system: oklch colors, `--color-grey-*` scale, `--color-amber-accent`, CSS variable references (Phase 27)
- Z-index scale: CSS variables (`--z-map-canvas`, `--z-sidebar`, `--z-side-rail`, `--z-property-panel`, etc.) (Phase 27)

### Claude's Discretion
- Exact raster paint property values for silver aesthetic (saturation, brightness-min, contrast levels)
- Whether MapShell and ResultsShell are separate files or co-located in layout/
- Whether glassmorphism refinements are done via new CSS variables or inline Tailwind classes
- Whether to update existing AppLayout.tsx or replace it with named shells

---

## Standard Stack

### Core (all already installed — no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `maplibre-gl` | 5.17.0 | Map rendering + raster paint properties | Already project standard |
| `tailwindcss` | 4.1.18 | Layout utilities and shell components | Already project standard |
| `clsx` + `tailwind-merge` | 2.1.1 + 3.4.1 | Class merging via `cn()` | Already project standard (Phase 27) |
| `class-variance-authority` | 0.7.1 | Component variants | Already project standard (Phase 27) |

### No New Dependencies
All Phase 29 requirements are implementable with existing installed libraries. Do not propose new packages.

---

## Architecture Patterns

### Recommended File Changes

```
frontend/src/
├── styles/
│   └── index.css                  # Minor: glassmorphism token refinements (optional)
├── components/
│   └── layout/
│       ├── AppLayout.tsx          # EXISTS: simplest path is rename/extend to MapShell
│       ├── MapShell.tsx           # NEW: full-viewport map page shell
│       ├── ResultsShell.tsx       # NEW: results/data page shell (non-map routes)
│       ├── SideRailNav.tsx        # EXISTS: possible glassmorphism refinement
│       └── InspectorPanel.tsx     # EXISTS: possible glassmorphism refinement
└── components/
    └── map/
        └── MapView.tsx            # MODIFIED: raster paint properties for silver style
```

### Pattern 1: Silver Raster Map Style via Paint Properties

**What:** Set silver/desaturated raster paint properties in the MapLibre style definition at map initialization time.

**When to use:** Baked-in style — no user toggle needed. Applied in `MapView.tsx` initial style object.

**Where to modify:** The `carto-light-layer` raster layer in `MapView.tsx`'s style definition.

**Current state of `carto-light-layer`:**
```typescript
// Current in MapView.tsx — no paint properties (uses defaults)
{
  id: 'carto-light-layer',
  type: 'raster',
  source: 'carto-light',
}
```

**Target silver style:**
```typescript
// Source: MapLibre Style Spec (maplibre.org/maplibre-style-spec/layers/)
{
  id: 'carto-light-layer',
  type: 'raster',
  source: 'carto-light',
  paint: {
    'raster-saturation': -0.9,      // Deep desaturation (range: -1 to 1, default: 0)
    'raster-brightness-min': 0.08,  // Slight lift so it reads as silver not dark grey
    'raster-brightness-max': 0.95,  // Cap highlights to stay neutral
    'raster-contrast': -0.1,        // Soften contrast slightly for professional look
  },
}
```

**Rationale for CartoDB Positron as base:** The existing CartoDB Positron tiles (`CARTO_LIGHT_TILES` in `pdok.ts`) already use a near-monochrome, light-grey palette designed for data overlays. Combined with heavy desaturation, they produce a clean silver backdrop. ESRI satellite tiles are also in the style (but set to 0 opacity by default) — leave satellite opacity unchanged.

**Recommended values to test (start here, adjust in plan):**
- Silver professional: `saturation: -0.85, brightness-min: 0.05, contrast: -0.05`
- Silver with depth: `saturation: -1.0, brightness-min: 0.1, brightness-max: 0.9, contrast: 0`

**Key constraint:** `raster-brightness-min` is in range [0, 1] (NOT [-1, 1]). `raster-brightness-max` default is 1. Setting `brightness-min` above 0 prevents full black, giving the silver "metal" quality.

### Pattern 2: Layout Shell Components

**What:** Named wrapper components that enforce consistent layout structure for different page types.

**When to use:** MapShell for the /map route (full-viewport, layers stack absolutely), ResultsShell for non-map data pages (/projecten, /rapport, /instellingen).

**Current AppLayout.tsx:**
```typescript
// Already exists — thin wrapper
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <main className="relative w-full h-full overflow-hidden">
      {children}
    </main>
  );
}
```

**MapShell target pattern:**
```typescript
// MapShell.tsx — full-viewport absolute positioning context
// Source: pattern derived from existing AppLayout + _authenticated.tsx layout structure
export default function MapShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {children}
    </div>
  )
}
```

**ResultsShell target pattern:**
```typescript
// ResultsShell.tsx — scrollable data content with solid background
// For non-map routes that don't need the map canvas context
export default function ResultsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-full overflow-y-auto bg-grey-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  )
}
```

**Naming decision:** Keep `AppLayout.tsx` as an alias or deprecate in favor of `MapShell` for clarity. The critical thing is consistent naming so routes communicate their layout intent.

### Pattern 3: Glassmorphism Chrome vs. Solid Data Surfaces

**What:** DS-04 requires navigation chrome to use glassmorphism while data areas use solid backgrounds.

**Current state (from code review):**
- SideRailNav: `bg-black/30 backdrop-blur-xl border-r border-white/10` — already glassmorphism
- InspectorPanel: `bg-grey-900/90 backdrop-blur-xl border-l border-white/10` — already partial (90% opacity = mostly solid, has blur)
- Zone info card in map.tsx: `bg-white/95 backdrop-blur-sm` — light glassmorphism (wrong for dark theme, uses white)
- Active gemeente header: `bg-white/95` — wrong (white background, not dark theme)

**The distinction:**
- **Navigation chrome** (SideRailNav, InspectorPanel header strip, LayerToggle) = glass: `bg-black/25 backdrop-blur-xl border border-white/10`
- **Data content areas** (InspectorPanel body, ResultsShell body, report pages) = solid: `bg-grey-900` (no backdrop-filter)
- **Cards floating over map** (zone info, gemeente header) = should use dark glassmorphism: `bg-grey-900/85 backdrop-blur-md`, NOT white

**Refinement needed:** The zone info card and gemeente header in `map.tsx` use `bg-white/95` — these should be updated to match the dark design system.

### Pattern 4: CSS Variables for Glassmorphism Tokens (Optional)

**What:** Optionally define CSS variables for the glassmorphism recipe to ensure consistency.

**Where:** `frontend/src/styles/index.css` in `:root` block.

**Example:**
```css
:root {
  /* Glassmorphism recipe — navigation chrome */
  --glass-bg: rgba(0, 0, 0, 0.25);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-blur: 20px;
}
```

**Assessment:** This is optional. The current pattern of inline Tailwind classes (`bg-black/30 backdrop-blur-xl`) is consistent enough. CSS variables would only add value if the glassmorphism formula needs to be tweakable centrally.

### Anti-Patterns to Avoid

- **Using `map.setPaintProperty()` for the silver style at runtime:** Unnecessary complexity — bake it into the initial style definition. `setPaintProperty` is for user-toggled changes.
- **Using `map.setStyle()` to swap the entire map style:** Destroys all added sources/layers (parcel overlays, bestemmingsplan, etc.). Never do this.
- **Applying backdrop-blur to large data areas:** GPU-intensive, hurts performance. Glassmorphism is for navigation chrome only.
- **Hardcoding colors:** All colors must use CSS variables or Tailwind utility classes (never hex or rgb directly in component files).
- **Creating a new AppLayout AND keeping old one:** Either rename AppLayout to MapShell in-place, or create MapShell and update all import sites. Don't leave orphaned files.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Silver map | Custom tile provider or CSS filter on map canvas | MapLibre `raster-saturation` paint property | Native to MapLibre, no hacks, GPU-accelerated |
| Color merging | Manual className string concatenation | `cn()` from `lib/utils.ts` | Already project standard, handles Tailwind conflicts |
| Component variants | Manual if/else className logic | CVA (`class-variance-authority`) | Already installed, cleaner than ternary chains |
| Glassmorphism | Custom PostCSS or JS blur | Tailwind `backdrop-blur-*` utilities | Browser native `backdrop-filter: blur()` |

---

## Common Pitfalls

### Pitfall 1: Raster Brightness Range Confusion

**What goes wrong:** Developer sets `raster-brightness-min: -0.1` expecting it to darken the map. The property clamps to [0, 1] — negative values have no effect or cause errors.

**Why it happens:** `raster-saturation` and `raster-contrast` have range [-1, 1], but `raster-brightness-min` and `raster-brightness-max` have range [0, 1]. The asymmetry is easy to miss.

**How to avoid:** Check MapLibre style spec. For brightness: min is "floor" (0 = allow full black), max is "ceiling" (1 = allow full white). Set min to 0.05–0.15 to lift shadows; set max to 0.9–0.95 to cap highlights.

**Warning signs:** Map looks identical after change, or TypeScript/MapLibre console warnings about invalid paint values.

### Pitfall 2: `setStyle()` Destroys All Added Layers

**What goes wrong:** Developer calls `map.setStyle(newStyle)` to change the basemap at runtime. All dynamically added sources and layers (parcel scores, wijk boundaries, bestemmingsplan, etc.) are destroyed.

**Why it happens:** `setStyle()` replaces the entire style object. The `transformStyle` option partially mitigates this, but requires carefully merging layers.

**How to avoid:** Bake the silver style into the initial style definition in `MapView.tsx`. Do not call `setStyle()` at runtime for the base theme. For user-toggleable layer paint changes, use `setPaintProperty()` on specific layer IDs.

**Warning signs:** Parcel score layer disappears after any style switch.

### Pitfall 3: Glassmorphism on Non-Blurred Backgrounds

**What goes wrong:** `backdrop-blur` on a component that has a solid background behind it (e.g., data panel on solid `bg-grey-950` body) shows no effect. The blur composites what's visually behind the element — if that's a solid color, it just looks like a semi-transparent solid.

**Why it happens:** `backdrop-filter: blur()` blurs the area behind the element in the stacking context. Over a solid background there is nothing to blur.

**How to avoid:** Glassmorphism only makes visual sense over the map canvas or other visually rich backgrounds. Navigation chrome floats over the map — good. Data panels that scroll on solid page backgrounds should use solid `bg-grey-900`, not glassmorphism.

**Warning signs:** Element looks like a simple semi-transparent block; backdrop-filter appears to have no effect.

### Pitfall 4: AppLayout Import Site Scatter

**What goes wrong:** If `AppLayout.tsx` is renamed to `MapShell.tsx`, all existing import sites break. `map.tsx` imports `AppLayout` — this is the only current consumer.

**Why it happens:** Renaming a component without updating imports.

**How to avoid:** Search all import sites before renaming. Use `grep -r "AppLayout"` across `src/`. Currently only `map.tsx` imports it — one update needed. Alternatively, keep `AppLayout.tsx` and have it re-export `MapShell` for backward compatibility during transition.

**Warning signs:** TypeScript errors at build time — easily caught by `npm run check`.

### Pitfall 5: White Cards on Dark Map (Existing Inconsistency)

**What goes wrong:** Several UI elements in `map.tsx` use `bg-white/95` and `text-gray-900` (light theme) that clashes with the dark-theme design system:
- Active gemeente header: `bg-white/95 backdrop-blur-sm rounded-lg`
- Zone info card: `bg-white/95 backdrop-blur-sm`
- Zone loading indicator: same

**Why it happens:** These were built before the design system was formalized in Phase 27.

**How to avoid:** Phase 29 should update these to dark theme: `bg-grey-900/90 backdrop-blur-md border border-white/10 text-grey-100`. This is within DS-04 scope (navigation chrome refinement).

---

## Code Examples

### Silver Map Style — Initial Definition

```typescript
// Source: MapLibre Style Spec (maplibre.org/maplibre-style-spec/layers/ — raster paint properties)
// Applied in: frontend/src/components/map/MapView.tsx

// In the MapLibre style definition passed to new maplibregl.Map({ style: { ... } })
layers: [
  {
    id: 'background',
    type: 'background',
    paint: { 'background-color': '#1a1a2e' },
  },
  {
    id: 'carto-light-layer',
    type: 'raster',
    source: 'carto-light',
    paint: {
      'raster-saturation': -0.9,      // [-1, 1] — deep desaturation for silver look
      'raster-brightness-min': 0.08,  // [0, 1] — floor to prevent full black
      'raster-brightness-max': 0.92,  // [0, 1] — cap highlights
      'raster-contrast': -0.05,       // [-1, 1] — slight softening
    },
  },
  {
    id: 'esri-satellite-layer',
    type: 'raster',
    source: 'esri-satellite',
    paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 300 } },
    // Note: satellite layer stays hidden (opacity 0) for default silver view
  },
],
```

### MapShell Component

```typescript
// Source: pattern from existing AppLayout.tsx + _authenticated.tsx layout
// File: frontend/src/components/layout/MapShell.tsx

interface MapShellProps {
  children: React.ReactNode
}

/**
 * Full-viewport layout shell for the /map route.
 *
 * Provides absolute positioning context for all floating map UI:
 * search bar, layer toggle, inspector panel, property cards, overlays.
 *
 * Note: h-full not h-screen — parent (_authenticated.tsx) already owns full height.
 * The persistent MapView lives in the parent; MapShell wraps controls rendered on top.
 */
export default function MapShell({ children }: MapShellProps) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {children}
    </div>
  )
}
```

### ResultsShell Component

```typescript
// Source: pattern derived from non-map routes (projecten.tsx, instellingen.tsx)
// File: frontend/src/components/layout/ResultsShell.tsx

interface ResultsShellProps {
  children: React.ReactNode
  className?: string
}

/**
 * Scrollable data content shell for non-map authenticated routes.
 *
 * Uses solid bg-grey-950 background (NOT glassmorphism) per DS-04:
 * data content areas use solid backgrounds for readability.
 *
 * Routes using this: /projecten, /instellingen, /rapport/:id
 */
export default function ResultsShell({ children, className }: ResultsShellProps) {
  return (
    <div className={cn('w-full h-full overflow-y-auto bg-grey-950', className)}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  )
}
```

### Dark Theme Card (replaces white bg-white/95 cards in map.tsx)

```typescript
// Source: derived from InspectorPanel design pattern + dark theme tokens
// Applied to: zone info card, gemeente header in map.tsx

// Before (incorrect — light theme):
// className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-gray-900"

// After (dark theme glassmorphism):
// className="bg-grey-900/90 backdrop-blur-md border border-white/10 rounded-lg shadow-lg px-4 py-2 text-grey-100"
```

### Glassmorphism vs Solid Rule (DS-04)

```typescript
// Navigation chrome — glassmorphism (floats over map)
const GLASS_CHROME = 'bg-black/25 backdrop-blur-xl border border-white/10'

// Data content — solid (scrollable content pages)
const SOLID_DATA = 'bg-grey-900'

// Data panel body (non-scrollable, fixed dimensions)
const SOLID_PANEL_BODY = 'bg-grey-900/95'  // 5% transparency max, no blur
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| CSS filter on map container element | MapLibre native `raster-saturation` paint property | No visual artifacts, GPU-accelerated, style-spec compliant |
| External tile providers with pre-styled silver tiles | Desaturate existing CartoDB Positron via paint properties | No new API keys, no new tile sources, no new ToS concerns |
| White/light cards for floating UI | Dark glassmorphism consistent with design system | Consistent dark-first aesthetic |

---

## Open Questions

1. **Exact saturation/brightness values for silver aesthetic**
   - What we know: `raster-saturation: -0.9` gives deep desaturation; `brightness-min: 0.08` lifts shadow floor
   - What's unclear: Exact values depend on visual judgment — the plan should instruct the developer to test with these starting values and adjust
   - Recommendation: The plan should specify starting values (`saturation: -0.85, brightness-min: 0.08, brightness-max: 0.92`) and note they are tunable

2. **AppLayout.tsx fate**
   - What we know: Only `map.tsx` imports `AppLayout`
   - What's unclear: Does the plan rename AppLayout to MapShell in-place, or create a new file and update the import?
   - Recommendation: Rename in-place (or have MapShell replace AppLayout) — fewer files is cleaner. Update the one import site in `map.tsx`.

3. **Whether ResultsShell is immediately adopted by existing routes**
   - What we know: `/projecten`, `/instellingen`, `/rapport.$id` don't use AppLayout
   - What's unclear: Phase 29 success criteria requires MapShell and ResultsShell "provide consistent page structure" — does this mean retrofitting existing routes?
   - Recommendation: Create both shells and apply MapShell to map.tsx. Apply ResultsShell to at least one other route (e.g. instellingen.tsx) as proof of concept. Full retrofit is a separate phase.

---

## Sources

### Primary (HIGH confidence)
- [MapLibre Style Spec — Layers](https://maplibre.org/maplibre-style-spec/layers/) — raster paint property names, value ranges, defaults (fetched 2026-02-18)
- [MapLibre GL JS Map API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/) — setPaintProperty signature confirmed (fetched 2026-02-18)
- Direct code review of `frontend/src/components/map/MapView.tsx` — existing layer IDs, current paint values
- Direct code review of `frontend/src/styles/index.css` — existing design tokens, z-index scale
- Direct code review of `frontend/src/routes/_authenticated.tsx` and `map.tsx` — current layout structure
- Direct code review of `frontend/src/components/layout/SideRailNav.tsx`, `InspectorPanel.tsx`, `AppLayout.tsx`

### Secondary (MEDIUM confidence)
- [MapLibre GL JS setPaintProperty example](https://maplibre.org/maplibre-gl-js/docs/examples/change-building-color-based-on-zoom-level/) — confirmed 3-arg signature: `setPaintProperty(layerId, property, value)`
- WebSearch: raster-saturation confirmed in MapLibre Style Spec, cross-verified with MapTiler GL spec mirror

### Tertiary (LOW confidence)
- Specific silver aesthetic raster values (saturation: -0.85 to -1.0, brightness-min: 0.05–0.15) — derived from knowledge of the property system; actual visual result requires in-browser testing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new dependencies
- MapLibre raster paint properties: HIGH — verified against official MapLibre Style Spec documentation
- Architecture (MapShell, ResultsShell patterns): HIGH — derived from existing codebase patterns in _authenticated.tsx and AppLayout.tsx
- Exact silver paint values: LOW — technically correct range, visually tunable; requires browser testing
- Glassmorphism dark theme corrections: HIGH — directly observed from code that uses white backgrounds inconsistently with the dark design system

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable APIs — MapLibre style spec is stable)
