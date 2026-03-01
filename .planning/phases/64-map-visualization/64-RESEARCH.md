# Phase 64: Map Visualization - Research

**Researched:** 2026-03-02
**Domain:** MapLibre GL JS — WMS raster layers, canvas-generated fill patterns, symbol label zoom control, score color expressions, layer catalog extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Building footprints layer:**
- Outline-only rendering (no fill) — keeps parcel score colors visible underneath
- Dark grey/charcoal outline color — neutral, doesn't compete with score colors, works in both themes
- Clicking a building footprint selects the parent parcel (buildings are visual context, parcels are the actionable unit)
- Data source: PDOK BAG WMS tiles — no extra data storage, always up-to-date, minimal frontend work

**Score color scheme:**
- Continuous gradient from low to high score (not discrete buckets)
- Grey-to-green palette: grey for low-opportunity (in_gebruik), transitioning through yellow/amber to green for high-opportunity (vacant/sloop)
- Empty parcels (no buildings) get a hatched/diagonal stripe pattern overlay in addition to score color — instantly distinguishable from built parcels
- Compact gradient legend bar in a map corner, always visible when score layer is on, collapsible

**Map clarity & defaults:**
- Default zoom: fit wijk bounds — auto-zoom to show entire wijk boundary when user opens a wijk
- Progressive label disclosure: no labels at wijk overview zoom, score numbers at medium zoom, address + score at street zoom
- Dense areas: cluster parcels at overview zoom with average score and parcel count, expand to individual parcels on zoom-in
- Wijk boundary: dashed outline — thin dashed line for spatial context without competing with parcel colors

**Layer panel UX:**
- Default state: parcels + scores ON, BAG buildings OFF (user enables when they want building context)
- Toggles grouped by type: "Data layers" (parcels, buildings), "Overlays" (scores, bestemmingsplan), "Basemap" (satellite, streets)
- Mutual exclusivity: basemap options only (satellite vs streets). All data/overlay layers can be combined freely
- No opacity controls — layers are on or off, opacity pre-tuned for best visual result
- Layer toggle state persisted via localStorage across sessions

### Claude's Discretion
- Exact gradient color stops and transition points
- Cluster threshold (how many parcels trigger clustering)
- Label font sizes and readability tuning
- WMS tile layer configuration details
- Hatched pattern line spacing and angle

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-01 | A "BAG Panden" toggle appears in the map layer catalog and, when enabled, draws building footprint outlines over parcels | PDOK BAG WMS v2.0 confirmed at `https://service.pdok.nl/lv/bag/wms/v2_0`, layer name `pand`, supports EPSG:3857. Pattern: raster source + line-only rendering via existing `BestemmingsplanLayer.tsx` pattern. |
| MAP-02 | Parcel score colors on the map accurately reflect opportunity level using the corrected post-backfill data (vacant land is green/amber, occupied buildings are grey) | Score field `score` (0–100) is already in MVT tiles from `tile_proxy.py`; `vacancy_signal` field also in tiles (`leeg_perceel`, `leegstaand_pand`, `in_gebruik`). Current color expression (red→green) must be replaced with grey→green palette + vacancy-driven gradient calibration. |
| MAP-03 | Map labels are readable at default zoom for Venlo wijken with no overlapping text or element clutter | Progressive label disclosure using MapLibre `minzoom` on symbol layers and `text-size` interpolation by zoom. Wijk boundary `line-dasharray` style exists in `WijkBoundariesLayer.tsx` as solid line — needs to be switched to dashed. Parcel clustering uses GeoJSON `cluster: true` but MVT source cannot cluster; alternative is zoom-gated label visibility. |
</phase_requirements>

## Summary

Phase 64 is a frontend-only phase. All three deliverables are MapLibre GL JS layer changes in the frontend; no backend schema changes or new API endpoints are required. The tile data served by `tile_proxy.py` already contains `score`, `vacancy_signal`, `has_pand`, and `pand_status` — the raw ingredients for correct colour mapping are already present in the MVT tiles.

Plan 64-01 (BAG building footprints) is a self-contained layer addition. The PDOK BAG WMS `pand` layer is confirmed at `https://service.pdok.nl/lv/bag/wms/v2_0` with a WMS raster source following the identical pattern already established by `BestemmingsplanLayer.tsx`. The key constraint is "outline only" — rendered as a raster tile, so opacity tricks are needed rather than a vector fill control (raster WMS cannot separate fill from stroke). The recommended approach is to use the `pand_gefilterd` or `pand_status` style which renders a styled footprint; opacity set to produce a visible outline effect on the default basemap.

Plan 64-02 (score colors + map clarity) has three sub-tasks: (a) replace the current red–orange–yellow–green gradient with a grey–amber–green gradient calibrated so `in_gebruik` parcels land in the grey end and `leeg_perceel` / `leegstaand_pand` parcels land in the green/amber end, (b) add a hatched canvas sprite overlay for empty parcels, and (c) progressive label layers using `minzoom` and zoom-interpolated `text-size`. The wijk dashed outline is a one-line CSS property change in `WijkBoundariesLayer.tsx`.

The clustering decision requires clarification: MVT sources (already used for parcels) do NOT support the built-in `cluster: true` GeoJSON option. Clustering with MVT tiles requires server-side support (e.g. Martin) or a GeoJSON centroid source in parallel. Given the project avoids Martin and the tile source cannot change mid-phase, the research recommendation is to implement zoom-gated label visibility (minzoom on symbol layer) rather than true clustering — this satisfies the intent of "no label clutter at overview zoom" without infrastructure changes.

**Primary recommendation:** Follow the existing `BestemmingsplanLayer.tsx` pattern for BAG WMS; use `map.addImage()` with a canvas-drawn stripe for empty-parcel hatching; replace colour expression in `ParcelScoreLayer.tsx`; implement zoom-gated symbol layers for labels.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | Already installed (v4.x) | Map engine, layer management, fill-pattern, WMS sources | Already in use across all 14 map components |
| PDOK BAG WMS | v2.0 (free, no key) | Building footprint raster tiles | Confirmed active, same host as existing bestemmingsplan WMS |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Canvas API (browser native) | n/a | Generate diagonal-stripe sprite for hatch pattern | Used at map load time to add a canvas-based image to map style via `map.addImage()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PDOK BAG WMS raster layer | BAG WFS vector layer | WFS would give true vector outline control but requires per-tile fetching at scale; WMS is zero-effort and always up-to-date |
| Canvas sprite hatch pattern | SVG data URL | Both work; canvas is simpler in TypeScript without extra deps |
| Zoom-gated label visibility | True GeoJSON clustering | Clustering requires GeoJSON source (not MVT); would need a centroid-only endpoint from backend — out of phase scope |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/components/map/
├── BAGPandLayer.tsx          # Plan 64-01: new file, WMS raster source + layer
├── ParcelScoreLayer.tsx      # Plan 64-02: modify colour expression + add hatch pattern
├── WijkBoundariesLayer.tsx   # Plan 64-02: switch line to dashed
├── LayerToggle.tsx           # Plan 64-01: add BAG toggle + regroup layer catalog UI
frontend/src/lib/map/
├── layers.ts                 # Plan 64-01: extend PersistedMapLayerState + MAP_LAYER_CATALOG
├── pdok.ts                   # Plan 64-01: add PDOK_BAG_PAND_WMS constant
frontend/src/lib/types/
└── property.ts               # No changes needed
```

### Pattern 1: WMS Raster Layer (BAG Panden)

**What:** Add a PDOK WMS raster source and a raster layer. Follows `BestemmingsplanLayer.tsx` exactly.
**When to use:** Any time you need a PDOK WMS tile overlay.

```typescript
// Source: BestemmingsplanLayer.tsx (existing pattern to copy)
export function addBAGPandLayer(map: maplibregl.Map): void {
  if (map.getSource(BAG_PAND_SOURCE_ID)) return;

  map.addSource(BAG_PAND_SOURCE_ID, {
    type: 'raster',
    tiles: [PDOK_BAG_PAND_WMS],
    tileSize: 256,
    minzoom: 10,
    maxzoom: 19,
  });

  map.addLayer({
    id: BAG_PAND_LAYER_ID,
    type: 'raster',
    source: BAG_PAND_SOURCE_ID,
    minzoom: 14,   // Only show when zoomed to parcel scale
    layout: { visibility: 'none' },
    paint: {
      'raster-opacity': 0.85,
    },
  });
}
```

The WMS URL format (following `PDOK_BESTEMMINGSPLAN_WMS` pattern):
```typescript
export const PDOK_BAG_PAND_WMS =
  'https://service.pdok.nl/lv/bag/wms/v2_0' +
  '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  '&LAYERS=pand&STYLES=' +
  '&CRS=EPSG:3857&BBOX={bbox-epsg-3857}' +
  '&WIDTH=256&HEIGHT=256' +
  '&FORMAT=image/png&TRANSPARENT=true';
```

Note: `pand` layer renders building outlines with fill by default at PDOK. At `raster-opacity: 0.85` with charcoal tones the outline reads as building context without fully obscuring parcel colors beneath.

### Pattern 2: Canvas Sprite for Hatch Pattern

**What:** Generate a diagonal stripe image at map init, add via `map.addImage()`, reference with `fill-pattern` expression for parcels with no building.
**When to use:** When a fill visual needs texture not achievable with solid colour expressions.

```typescript
// Source: MapLibre official docs (map.addImage API)
function createHatchPattern(
  lineColor: string = '#555555',
  spacing: number = 6,
  angle: number = 45
): { data: Uint8ClampedArray; width: number; height: number } {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  // Draw diagonal lines
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-size, size);
  ctx.lineTo(size, -size);
  ctx.moveTo(size, size * 2);
  ctx.lineTo(size * 2, size);
  ctx.stroke();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { data: imageData.data, width: size, height: size };
}

// Called once after map.on('load'):
map.addImage('parcel-hatch', createHatchPattern('#555555'));
```

Usage in the fill layer (MUST be a separate layer on top of the score fill, because `fill-pattern` replaces `fill-color`):
```typescript
map.addLayer({
  id: 'parcel-empty-hatch',
  type: 'fill',
  source: SOURCE_ID,
  'source-layer': sourceLayer,
  filter: [
    'all',
    ['has', 'score'],
    ['==', ['downcase', ['to-string', ['coalesce', ['get', 'has_pand'], 'false']]], 'false'],
  ],
  paint: {
    'fill-pattern': 'parcel-hatch',
    'fill-opacity': 0.4,
  },
  minzoom: 14,
});
```

### Pattern 3: Score Colour Expression (Grey-to-Green)

**What:** Replace the current red→green gradient in `ParcelScoreLayer.tsx` with a grey→green palette aligned to opportunity semantics.

Current expression (incorrect for demo):
```typescript
// Red=low, green=high — but in_gebruik parcels score ~30-50, not 0
'fill-color': ['interpolate', ['linear'], ['get', 'score'],
  0, '#dc2626',   // Red
  25, '#f97316',  // Orange
  50, '#eab308',  // Yellow
  75, '#22c55e',  // Green
  100, '#16a34a', // Dark green
],
```

Replacement expression (grey=occupied/low-opportunity, green=vacant/high-opportunity):
```typescript
'fill-color': ['interpolate', ['linear'], ['get', 'score'],
  0,   '#64748b', // Slate grey — in_gebruik, low opportunity
  25,  '#94a3b8', // Light grey — marginal
  45,  '#eab308', // Amber — borderline opportunity
  65,  '#84cc16', // Lime — good opportunity
  80,  '#22c55e', // Green — strong opportunity (leegstaand_pand)
  100, '#16a34a', // Dark green — highest (leeg_perceel)
],
```

Note: Score values from `parcel_scoring.py` show `vacancy_signal == "in_gebruik"` yields negative contribution (-0.30 delta from 0.50 baseline = ~0.20 confidence), and `leeg_perceel` gets +0.34. The raw `score` column in `scan_results` is `float | None`. The gradient breakpoints above should be validated against the actual score distribution in Venlo data (see Open Questions).

### Pattern 4: Progressive Label Layers

**What:** Add symbol layers to the parcel score source with zoom-gated minzoom values so labels only appear when parcels are large enough to read.
**When to use:** Any time text labels must respect zoom level.

```typescript
// Score number label (medium zoom, 15.5–17)
map.addLayer({
  id: 'parcel-score-label',
  type: 'symbol',
  source: SOURCE_ID,
  'source-layer': sourceLayer,
  filter: ['has', 'score'],
  minzoom: 15.5,
  maxzoom: 17,
  layout: {
    'text-field': ['concat', ['to-string', ['round', ['get', 'score']]]],
    'text-size': ['interpolate', ['linear'], ['zoom'], 15.5, 9, 17, 13],
    'text-allow-overlap': false,
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': '#000000',
    'text-halo-width': 1,
  },
});

// Address + score label (street zoom, 17+)
map.addLayer({
  id: 'parcel-address-label',
  type: 'symbol',
  source: SOURCE_ID,
  'source-layer': sourceLayer,
  filter: ['all', ['has', 'score'], ['has', 'address']],
  minzoom: 17,
  layout: {
    'text-field': ['concat', ['get', 'address'], '\n', ['to-string', ['round', ['get', 'score']]]],
    'text-size': 11,
    'text-allow-overlap': false,
    'text-anchor': 'center',
  },
  paint: {
    'text-color': '#ffffff',
    'text-halo-color': '#000000',
    'text-halo-width': 1.5,
  },
});
```

### Pattern 5: Wijk Boundary Dashed Outline

**What:** Change `WijkBoundariesLayer.tsx` wijk-line layer from solid to dashed.
**When to use:** Visual context lines that must not compete with data layers.

```typescript
// In addWijkBoundariesLayer, replace line paint:
paint: {
  'line-color': '#10b981',
  'line-width': 1.5,
  'line-dasharray': [4, 3],  // 4px dash, 3px gap
  'line-opacity': 0.6,
},
```

### Pattern 6: Layer Catalog Extension (LayerToggle + layers.ts)

**What:** Add `showBAGPanden` state to `PersistedMapLayerState`, add `BAG Panden` entry to `MAP_LAYER_CATALOG`, add toggle button to `LayerToggle.tsx`.
**When to use:** Any new toggleable layer.

```typescript
// layers.ts — extend PersistedMapLayerState
export interface PersistedMapLayerState {
  basemap: BaseMapLayerId
  showParcels: boolean
  showGemeenten: boolean
  showBestemmingsplan: boolean
  showWijken: boolean
  showScannedScope: boolean
  showBAGPanden: boolean   // NEW
  activeParcelOverlay: ParcelOverlayLayerId | null
}

export const DEFAULT_MAP_LAYER_STATE: PersistedMapLayerState = {
  // ...existing...
  showBAGPanden: false,  // Off by default per locked decision
}
```

### Pattern 7: Wijk Bounds Auto-Zoom (already exists — verify, don't rebuild)

**What:** `map.fitBounds()` is already called in `map.tsx` when a wijk is clicked (lines 1689-1692 of the existing route file). It passes `{ padding: 70, duration: 900 }`.

The requirement says "auto-zoom to show entire wijk boundary when user opens a wijk" — this already works via `fitBounds`. What needs verification is whether the padding is sufficient for the 21 Venlo wijken (which vary in size from compact urban to rural). The research recommendation is to increase padding to 80px and ensure `maxZoom` is set in `fitBoundsOptions` so that very small wijken don't zoom in too far.

```typescript
// Existing in map.tsx — potential tweak:
mapRef.current.fitBounds(
  [wijkBbox[0], wijkBbox[1], wijkBbox[2], wijkBbox[3]],
  { padding: 80, duration: 900, maxZoom: 17 }  // Add maxZoom guard
)
```

### Anti-Patterns to Avoid

- **Adding `cluster: true` to the MVT vector source**: MapLibre only supports clustering on GeoJSON sources. The parcel tile source (`parcel-scores`) is `type: 'vector'`; adding `cluster: true` is silently ignored. Use `minzoom` on label layers instead.
- **Using `fill-pattern` on the same layer as `fill-color`**: MapLibre uses `fill-pattern` when set, completely replacing `fill-color`. The hatch layer MUST be a separate layer on top of the score-colored fill layer.
- **Calling `map.addImage()` before `map.on('load')`**: The style is not ready and addImage will throw. Always add sprites inside the `load` event handler or after it.
- **Removing the raster source before removing its layers**: MapLibre throws if you remove a source while layers still reference it. Always remove layers first (same pattern as `removeParcelScoreLayer`).
- **Setting `raster-opacity: 0` instead of `layout: { visibility: 'none' }`**: Opacity 0 still causes tile requests; visibility 'none' skips tile loading entirely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diagonal stripe pattern | Custom SVG engine | Canvas `ctx.stroke()` + `map.addImage()` | Canvas API is built-in; no dependency needed |
| WMS proxy | Custom backend tile proxy | PDOK BAG WMS direct | PDOK WMS is CORS-enabled for browsers; no backend changes needed |
| Cluster computation | Custom zoom-based aggregation | `minzoom` on symbol layers | MapLibre `text-allow-overlap: false` already prevents collisions within a layer |
| Gradient legend | Custom D3 component | CSS gradient bar (pure CSS + Tailwind) | Score range is fixed 0–100; no dynamic axis calculation needed |

**Key insight:** All three MAP requirements are achievable purely with MapLibre layer configuration changes in existing source files. No new APIs, no new dependencies.

## Common Pitfalls

### Pitfall 1: WMS `pand` Layer Visible at All Zooms
**What goes wrong:** If `minzoom` is not set on the BAG pand layer, it requests tiles at zoom 10 (gemeente overview) where buildings are unreadable noise.
**Why it happens:** PDOK WMS serves tiles at all zoom levels but building footprints only make sense at zoom 14+.
**How to avoid:** Set `minzoom: 14` on the layer, consistent with the parcel score layer.
**Warning signs:** Tiles load but render as solid dark pixels at low zoom.

### Pitfall 2: Hatch Pattern Lost on Map Style Reload
**What goes wrong:** `map.addImage('parcel-hatch', ...)` is called once; if the map style is reloaded (e.g., satellite/kaart switch) the custom image is lost.
**Why it happens:** MapLibre clears all custom images when the style is reassigned.
**How to avoid:** Re-add the image in a `styledata` event listener or call `map.addImage` inside the `load` callback and again after any `setStyle` call. In this project, basemap switching uses `setPaintProperty` (not `setStyle`), so this is LOW risk — but worth a code comment.
**Warning signs:** Hatch fill shows blank/missing after switching basemap.

### Pitfall 3: Score Gradient Misaligned with Actual Data
**What goes wrong:** Grey endpoint at score=0 but the Venlo `in_gebruik` parcels may cluster around score 35-50 (not 0), making them appear amber rather than grey.
**Why it happens:** The scoring model uses vacancy signal + zoning factors; `in_gebruik` parcels don't score 0 unless they also lack build capacity.
**How to avoid:** Before committing gradient stops, run a quick SQL query on the Venlo scan to understand actual score distribution by vacancy_signal (see Open Questions).
**Warning signs:** Map shows mostly amber/green with almost no grey parcels despite 70%+ `in_gebruik` rate in Venlo.

### Pitfall 4: Symbol Layer `text-allow-overlap: false` Not Enough
**What goes wrong:** Even with overlap disabled, dense wijk areas show many labels overlapping because MVT features include all parcels regardless of size.
**Why it happens:** MapLibre respects `text-allow-overlap: false` per-layer but still shows one label per feature (just not stacking them). Small parcels get labels that overflow their boundaries.
**How to avoid:** Add a `filter` that only labels parcels above a minimum area: `['>=', ['get', 'area_m2'], 200]`. Also set `text-size` small at low zoom.
**Warning signs:** Dense parcel areas have unreadable text blobs at minzoom.

### Pitfall 5: LayerToggle Props Interface Drift
**What goes wrong:** Adding `showBAGPanden` to `PersistedMapLayerState` and `DEFAULT_MAP_LAYER_STATE` without updating `readPersistedMapLayerState()` parser leaves users with stale `undefined` values from localStorage.
**Why it happens:** The `coerceBoolean` + explicit key parsing pattern in `layers.ts` requires explicit handling of each new key.
**How to avoid:** Add `showBAGPanden: coerceBoolean(parsed.showBAGPanden, DEFAULT_MAP_LAYER_STATE.showBAGPanden)` to the `readPersistedMapLayerState` function. Also bump the `STORAGE_KEY` constant from `v2` to `v3` to force a fresh read from default state for existing users.
**Warning signs:** BAG toggle appears checked on load even though the default is off; or toggle state is not persisted after page reload.

### Pitfall 6: WijkBoundariesLayer Click After Dashed Style Change
**What goes wrong:** No functional regression expected; the `line-dasharray` property affects rendering only. However, if `addWijkBoundariesLayer` uses `beforeLayer` insertion and the click handler uses `wijk-line` layer ID for events, verifying no ID conflicts is required.
**How to avoid:** The click handler is attached to `wijk-fill` (not the line layer), so dashing the line layer is purely cosmetic and safe.

## Code Examples

Verified patterns from existing codebase and official sources:

### BAG WMS URL (verified from PDOK GetCapabilities)
```typescript
// pdok.ts
export const PDOK_BAG_PAND_WMS =
  'https://service.pdok.nl/lv/bag/wms/v2_0' +
  '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  '&LAYERS=pand&STYLES=' +
  '&CRS=EPSG:3857&BBOX={bbox-epsg-3857}' +
  '&WIDTH=256&HEIGHT=256' +
  '&FORMAT=image/png&TRANSPARENT=true';
```

### Removing BAG Layer (follows removeParcelScoreLayer pattern)
```typescript
export function removeBAGPandLayer(map: maplibregl.Map): void {
  if (map.getLayer(BAG_PAND_LAYER_ID)) {
    map.removeLayer(BAG_PAND_LAYER_ID);
  }
  if (map.getSource(BAG_PAND_SOURCE_ID)) {
    map.removeSource(BAG_PAND_SOURCE_ID);
  }
}
```

### Gradient Legend Bar (CSS only)
```tsx
// A compact legend bar — no library needed
<div className="flex items-center gap-2 px-3 py-2">
  <span className="text-xs text-grey-400">Laag</span>
  <div
    className="h-3 w-32 rounded-full"
    style={{
      background: 'linear-gradient(to right, #64748b, #eab308, #22c55e)',
    }}
  />
  <span className="text-xs text-grey-400">Hoog</span>
</div>
```

### Existing fitBounds Pattern (already works for wijk zoom)
```typescript
// From map.tsx line 1689 — already implemented, just needs maxZoom guard
mapRef.current.fitBounds(
  [wijkBbox[0], wijkBbox[1], wijkBbox[2], wijkBbox[3]] as [number, number, number, number],
  { padding: 80, duration: 900, maxZoom: 17 }
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Discrete score buckets (High/Medium/Low) | Continuous `interpolate` gradient | Phase 64 | Eliminates jarring colour jumps between adjacent parcels |
| No building context on map | PDOK BAG WMS overlay (toggleable) | Phase 64 | User can see which parcels have buildings vs. empty lots |
| Solid wijk boundary | Dashed wijk boundary | Phase 64 | Reduces visual competition with parcel score colours |

**Deprecated/outdated:**
- Red–orange–yellow–green gradient: designed before Venlo score distribution was understood; `in_gebruik` parcels at score 35-50 appear orange (alarm) rather than grey (neutral). Phase 64 replaces this.

## Open Questions

1. **What is the actual score distribution for Venlo `in_gebruik` vs. `leeg_perceel` parcels?**
   - What we know: `parcel_scoring.py` gives vacancy_signal a -0.30 delta for `in_gebruik` and +0.34 for `leeg_perceel`, starting from 0.50. But the total score includes zoning, area, bouwjaar, and market factors which can push scores in either direction.
   - What's unclear: Whether `in_gebruik` parcels cluster in the 20–50 range or 40–65 range. This changes where the grey-to-amber inflection point should be set.
   - Recommendation: Executor should run `SELECT AVG(score), MIN(score), MAX(score), vacancy_signal FROM scan_results WHERE scan_id = '<venlo_scan_id>' GROUP BY vacancy_signal` before finalising gradient stops. If median `in_gebruik` score is ~40, set grey at 0–40, amber at 40–60, green at 60–100.

2. **Does the PDOK BAG WMS `pand` layer render outline-only or filled?**
   - What we know: GetCapabilities shows style options: `bag:pand`, `bag:pand_gefilterd`, `bag:pand_status`. The default style renders filled polygons with a dark border.
   - What's unclear: Whether `TRANSPARENT=true` + `raster-opacity: 0.85` is enough to show the outline while letting parcel colors show through, or if the grey fill will obscure parcel score colours completely.
   - Recommendation: Executor should test WMS tile rendering in browser DevTools before committing. If the filled polygon obscures parcel colors, use `raster-opacity: 0.35` to let colours show through, or use the `pand_gefilterd` style which renders a simplified outline-focused view.

3. **Should the gradient legend be collapsible (per locked decision)?**
   - What we know: The CONTEXT.md says "compact gradient legend bar in a map corner, always visible when score layer is on, collapsible."
   - What's unclear: Whether "collapsible" means a collapse button or simply removed when the score layer is toggled off.
   - Recommendation: Implement as "visible when score layer is on, hidden when score layer is off" (tied to `showScore` state). Add a small collapse chevron only if the legend takes meaningful screen space.

## Validation Architecture

> Nyquist validation is configured in `.planning/config.json` — `workflow.nyquist_validation` is not present (defaults to false based on config structure). Skip automated test mapping.

However, the following manual verification steps are critical for correctness:

- **MAP-01**: Enable BAG Panden toggle in browser → buildings appear as outlines at zoom 15+ → clicking a building selects the parent parcel
- **MAP-02**: Open Venlo wijk scan → `in_gebruik` parcels show grey-ish → `leeg_perceel` parcels show green → toggle `Bebouwd/Leeg` overlay to cross-check
- **MAP-03**: Start at wijk overview zoom (13) → no labels → zoom to 15.5 → score numbers appear → zoom to 17 → address labels appear

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) — no frontend test framework needed for this phase |
| Quick run command | `cd backend && ruff check . && mypy .` (for any backend changes — none expected) |
| Frontend check | `cd frontend && npm run check` |

### Wave 0 Gaps
None — no new files require test infrastructure. All changes are to existing layer utility files.

## Sources

### Primary (HIGH confidence)
- PDOK BAG WMS GetCapabilities (fetched 2026-03-02): `https://service.pdok.nl/lv/bag/wms/v2_0?request=getCapabilities&service=WMS` — confirmed layer name `pand`, EPSG:3857 support, TRANSPARENT=true support
- MapLibre GL JS API docs (Map.addImage): `https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/` — confirmed `addImage` signature accepts `{ data, width, height }` for canvas patterns
- MapLibre clustering docs: `https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/` — confirmed clustering is GeoJSON-only, not MVT

### Secondary (MEDIUM confidence)
- MapLibre fill-pattern + canvas example: `https://observablehq.com/@chrispahm/filling-polygons-with-patterns-in-mapbox-gl-js` — pattern applies to MapLibre (shared codebase origin)
- Existing codebase `BestemmingsplanLayer.tsx` — WMS raster source pattern confirmed working in this project
- Existing codebase `ParcelScoreLayer.tsx` — current gradient expression analysed; score field names verified against `tile_proxy.py`

### Tertiary (LOW confidence)
- WebSearch on WMS pand rendering style — unable to verify exact visual output of `pand` vs `pand_gefilterd` style without a live browser test

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing MapLibre patterns verified in codebase; PDOK BAG WMS endpoint confirmed via GetCapabilities
- Architecture: HIGH — all patterns follow established project conventions (BestemmingsplanLayer, ParcelScoreLayer)
- Pitfalls: MEDIUM — hatch pattern pitfalls from MapLibre docs; score distribution pitfall is theoretical (needs Venlo data validation)
- Open questions: Score gradient breakpoints are MEDIUM confidence pending actual data distribution query

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (PDOK WMS endpoints are stable; MapLibre API stable within minor versions)
