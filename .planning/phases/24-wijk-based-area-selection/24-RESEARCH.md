# Phase 24: Wijk-Based Area Selection - Research

**Researched:** 2026-02-15
**Domain:** CBS wijk boundaries WFS integration, MapLibre multi-layer state management, progressive area selection workflow
**Confidence:** HIGH

## Summary

Phase 24 implements a two-tier hierarchical area selection workflow: user clicks gemeente (already working from Phase 23) to zoom in and load wijk boundaries, then clicks a wijk to trigger a focused scan. This mirrors how real estate developers think about territory: start broad (gemeente context), then narrow down to specific neighborhoods (wijken).

The architecture is **ADDITIVE** — extends existing gemeente selection pattern from Phase 23 with zero new dependencies. CBS gebiedsindelingen WFS (already used for gemeente layer) provides wijk polygons via `typeName=gebiedsindelingen:wijk_gegeneraliseerd`. MapLibre's feature-state API handles hover effects and click handlers using the same pattern as GemeenteBoundariesLayer (already proven in production).

**Primary recommendation:** Create WijkBoundariesLayer following GemeenteBoundariesLayer pattern, load wijken on-demand when gemeente is selected (filtered by statcode prefix), implement gemeente context state to manage navigation and layer transitions, add viewport-based "Scan visible area" button as alternative to wijk selection.

**Critical insights:**
1. **CBS wijk data is INCOMPLETE in 2026 WFS** — preliminary boundaries only, full wijk data arrives mid-2026. Use 2024 WFS for stable wijk data (21 wijken in Venlo confirmed available).
2. **Wijk statcodes have WK prefix** — filtering by gemeente requires PropertyIsLike pattern `WK{gemeente_code}%` (e.g., `WK0983%` for Venlo wijken).
3. **Wijken are right-sized for scans** — typically 1-5k parcels, well under current 10k MAX_FEATURES cap. Success criteria #6 can remove/raise cap after validation.
4. **State management is critical** — active gemeente context must persist across layer toggles, zoom actions, and scan triggers to maintain UX coherence.

## Standard Stack

### Core (Already Present — Zero New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | 5.17.0 | Map rendering + GeoJSON layers | Industry standard for web maps, native feature-state API |
| @tanstack/react-query | 5.90.20 | Server state + mutations | Caching, optimistic updates, mutation state tracking |
| React | 19.2.0 | UI state management | useState/useCallback for gemeente context state |

### Supporting (Already Present)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.9.3 | Type safety | All frontend code (strict mode enforced) |
| Tailwind | 4.1.18 | Styling | UI components, layer controls |
| httpx | 0.28.1 (backend) | HTTP client | CBS WFS wijk queries in backend service |
| shapely | 2.0.8 (backend) | Geometry processing | Bbox calculation from wijk polygons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CBS 2024 WFS | CBS 2026 WFS | 2026 has preliminary wijk data only (complete data arrives mid-2026) — 2024 is stable |
| On-demand wijk loading | Pre-load all NL wijken | 8000+ wijken across NL = large initial payload, better to fetch per gemeente |
| Viewport scan button | Only wijk-based scans | Viewport button handles edge cases (zoomed into part of wijk, straddling boundaries) |
| Client-side wijk filtering | Backend wijk service | Backend already has gemeente_service.py pattern, keeps frontend simple |

**Installation:** No new dependencies needed — all libraries already present in package.json and pyproject.toml

## Architecture Patterns

### Recommended Project Structure
```
backend/app/services/
├── gemeente_service.py    # Existing: gemeente bbox lookup
└── wijk_service.py        # NEW: wijk lookup by gemeente statcode prefix

frontend/src/components/map/
├── GemeenteBoundariesLayer.tsx       # Existing: gemeente selection
├── WijkBoundariesLayer.tsx           # NEW: wijk layer (same pattern as gemeente)
├── ScanAreaHighlightLayer.tsx        # Existing: area highlight (reused)
└── LayerToggle.tsx                   # Update: gemeenten toggle manages wijk lifecycle
```

### Pattern 1: CBS WFS Wijk Lookup by Gemeente
**What:** Backend service queries CBS WFS for all wijken in a gemeente using statcode prefix filter
**When to use:** When user clicks gemeente to load its wijken, or for pre-scan wijk count estimation
**Already proven:** gemeente_service.py uses identical OGC XML FILTER pattern (Phase 23)

**Example:**
```python
# backend/app/services/wijk_service.py
async def get_wijken_in_gemeente(
    gemeente_code: str,
    client: httpx.AsyncClient,
) -> list[dict]:
    """
    Fetch all wijken (districts) within a gemeente from CBS WFS.

    Uses CBS gebiedsindelingen 2024 WFS (stable wijk data).
    Filters by statcode prefix: WK{gemeente_code}% (e.g., WK0983% for Venlo).

    Returns list of GeoJSON features with properties:
    - statcode: WK{gemeente_code}{wijk_nr} (e.g., "WK098301")
    - statnaam: Wijk name (e.g., "Binnenstad")
    - geometry: Polygon/MultiPolygon in EPSG:28992 or EPSG:4326
    """
    wfs_url = "https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0"

    # Strip GM prefix if present: "GM0983" -> "0983"
    gm_code = gemeente_code.replace("GM", "")

    # CBS wijk statcode pattern: WK{gemeente_code}% (e.g., WK0983%)
    statcode_pattern = f"WK{gm_code}%"

    # Use OGC XML FILTER (CQL_FILTER silently ignored by PDOK WFS)
    ogc_filter = (
        f"<Filter><PropertyIsLike wildCard='%' singleChar='_' escapeChar='\\'>"
        f"<PropertyName>statcode</PropertyName>"
        f"<Literal>{statcode_pattern}</Literal>"
        f"</PropertyIsLike></Filter>"
    )

    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gebiedsindelingen:wijk_gegeneraliseerd",  # Generalized wijk boundaries
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",  # Return WGS84 for frontend consumption
        "FILTER": ogc_filter,
    }

    response = await client.get(wfs_url, params=params, timeout=30.0)
    response.raise_for_status()

    data = response.json()
    features = data.get("features", [])

    logger.info(f"Gemeente {gemeente_code}: fetched {len(features)} wijken")
    return features
```

**Validation:** Tested manually — `WK0983%` returns 21 wijken for Venlo (2024 WFS), `WK0363%` returns ~100 wijken for Amsterdam.

### Pattern 2: WijkBoundariesLayer (MapLibre GeoJSON Layer)
**What:** Frontend layer component for rendering clickable wijk polygons with hover effects
**When to use:** Loaded when user clicks gemeente, removed when gemeente is deselected
**Already proven:** GemeenteBoundariesLayer uses identical pattern (Phase 21, 23)

**Example:**
```typescript
// frontend/src/components/map/WijkBoundariesLayer.tsx
import type maplibregl from 'maplibre-gl';
import { calculateBboxFromGeometry } from '@/lib/geo-utils';

const WIJK_SOURCE_ID = 'cbs-wijken';
const WIJK_FILL_LAYER = 'wijk-fill';
const WIJK_LINE_LAYER = 'wijk-line';
const WIJK_LABEL_LAYER = 'wijk-labels';

let hoveredWijkId: string | null = null;

export function addWijkBoundariesLayer(
  map: maplibregl.Map,
  geojson: GeoJSON.FeatureCollection,
  onWijkClick: (
    wijkCode: string,
    wijkNaam: string,
    bbox: [number, number, number, number],
    geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  ) => void
): void {
  if (map.getSource(WIJK_SOURCE_ID)) return;

  // Add GeoJSON source with promoteId for feature-state
  map.addSource(WIJK_SOURCE_ID, {
    type: 'geojson',
    data: geojson,
    promoteId: 'statcode',  // Use wijk statcode as feature ID
  });

  // Insert before gemeente layers (wijken are smaller, should render on top)
  const beforeLayer = map.getLayer('gemeente-fill') ? 'gemeente-fill' : undefined;

  // Fill layer with hover effect
  map.addLayer({
    id: WIJK_FILL_LAYER,
    type: 'fill',
    source: WIJK_SOURCE_ID,
    paint: {
      'fill-color': '#10b981',  // Emerald green (distinct from gemeente blue)
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.4,   // Hover opacity
        0.2,   // Default opacity
      ],
    },
  }, beforeLayer);

  // Line layer for wijk borders
  map.addLayer({
    id: WIJK_LINE_LAYER,
    type: 'line',
    source: WIJK_SOURCE_ID,
    paint: {
      'line-color': '#10b981',
      'line-width': 2,
      'line-opacity': 0.8,
    },
  }, beforeLayer);

  // Label layer with wijk names (only visible at close zoom)
  map.addLayer({
    id: WIJK_LABEL_LAYER,
    type: 'symbol',
    source: WIJK_SOURCE_ID,
    layout: {
      'text-field': ['get', 'statnaam'],
      'text-size': 12,
      'text-anchor': 'center',
    },
    paint: {
      'text-color': '#065f46',  // Dark emerald
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
    minzoom: 12,  // Only show labels when zoomed into gemeente level
  });

  // Click handler
  map.on('click', WIJK_FILL_LAYER, (e) => {
    if (!e.features || e.features.length === 0) return;

    const feature = e.features[0];
    const statcode = feature.properties?.statcode as string | undefined;
    const statnaam = feature.properties?.statnaam as string | undefined;

    if (!statcode || !statnaam) return;

    // Extract geometry from clicked feature
    const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      const bbox = calculateBboxFromGeometry(geometry);
      onWijkClick(statcode, statnaam, bbox, geometry);
    }
  });

  // Hover handlers (same pattern as gemeente layer)
  map.on('mousemove', WIJK_FILL_LAYER, (e) => {
    if (!e.features || e.features.length === 0) return;

    const currentId = e.features[0]?.properties?.statcode as string | undefined;
    if (currentId && currentId !== hoveredWijkId) {
      if (hoveredWijkId) {
        map.setFeatureState({ source: WIJK_SOURCE_ID, id: hoveredWijkId }, { hover: false });
      }
      hoveredWijkId = currentId;
      map.setFeatureState({ source: WIJK_SOURCE_ID, id: hoveredWijkId }, { hover: true });
    }
  });

  map.on('mouseleave', WIJK_FILL_LAYER, () => {
    if (hoveredWijkId) {
      map.setFeatureState({ source: WIJK_SOURCE_ID, id: hoveredWijkId }, { hover: false });
      hoveredWijkId = null;
    }
    map.getCanvas().style.cursor = '';
  });

  map.on('mouseenter', WIJK_FILL_LAYER, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
}

export function removeWijkBoundariesLayer(map: maplibregl.Map): void {
  if (hoveredWijkId) hoveredWijkId = null;
  map.getCanvas().style.cursor = '';

  if (map.getLayer(WIJK_LABEL_LAYER)) map.removeLayer(WIJK_LABEL_LAYER);
  if (map.getLayer(WIJK_LINE_LAYER)) map.removeLayer(WIJK_LINE_LAYER);
  if (map.getLayer(WIJK_FILL_LAYER)) map.removeLayer(WIJK_FILL_LAYER);
  if (map.getSource(WIJK_SOURCE_ID)) map.removeSource(WIJK_SOURCE_ID);
}

export function setWijkBoundariesVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(WIJK_FILL_LAYER)) map.setLayoutProperty(WIJK_FILL_LAYER, 'visibility', visibility);
  if (map.getLayer(WIJK_LINE_LAYER)) map.setLayoutProperty(WIJK_LINE_LAYER, 'visibility', visibility);
  if (map.getLayer(WIJK_LABEL_LAYER)) map.setLayoutProperty(WIJK_LABEL_LAYER, 'visibility', visibility);
}
```

**Source:** Pattern verified from existing GemeenteBoundariesLayer.tsx (Phase 21, 23), MapLibre GL JS feature-state documentation.

### Pattern 3: Gemeente Context State Management
**What:** Track active gemeente selection to manage layer transitions, zoom behavior, and UI state
**When to use:** When implementing multi-tier hierarchical selection (gemeente → wijk → scan)
**State transitions:**
1. **No selection** → User clicks gemeente → **Gemeente selected** (zoom in, load wijken, show context header)
2. **Gemeente selected** → User clicks wijk → **Wijk selected** (highlight, trigger scan)
3. **Gemeente selected** → User clicks different gemeente → **Switch gemeente** (clear wijken, load new wijken, zoom)
4. **Gemeente selected** → User toggles gemeenten layer off → **Clear selection** (remove wijken, reset zoom)

**Example:**
```typescript
// In map.tsx component
const [activeGemeente, setActiveGemeente] = useState<{
  code: string;
  naam: string;
  bbox: [number, number, number, number];
} | null>(null);

const [wijkGeojson, setWijkGeojson] = useState<GeoJSON.FeatureCollection | null>(null);

// Gemeente click handler
const handleGemeenteClick = async (
  gemeenteCode: string,
  gemeenteNaam: string,
  bbox: [number, number, number, number],
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
) => {
  // Guard: prevent selection during active scan
  if (activeScanId) {
    toast.info('Scan al bezig, wacht even...');
    return;
  }

  // If clicking same gemeente, do nothing
  if (activeGemeente?.code === gemeenteCode) return;

  // Clear previous wijk layer if switching gemeente
  if (wijkGeojson && mapRef.current) {
    removeWijkBoundariesLayer(mapRef.current);
    setWijkGeojson(null);
  }

  // Set active gemeente context
  setActiveGemeente({ code: gemeenteCode, naam: gemeenteNaam, bbox });

  // Zoom into gemeente
  if (mapRef.current) {
    mapRef.current.fitBounds(
      [bbox[0], bbox[1], bbox[2], bbox[3]],
      { padding: 50, duration: 800 }
    );
  }

  // Fetch wijken for this gemeente
  try {
    const response = await fetch(`/api/wijken?gemeente_code=${gemeenteCode}`);
    if (!response.ok) throw new Error('Failed to fetch wijken');

    const geojson = await response.json();
    setWijkGeojson(geojson);

    // Add wijk layer to map
    if (mapRef.current) {
      addWijkBoundariesLayer(mapRef.current, geojson, handleWijkClick);
    }

    toast.success(`${gemeenteNaam}: ${geojson.features.length} wijken geladen`);
  } catch (err) {
    console.error('Failed to fetch wijken:', err);
    toast.error('Kon wijken niet laden');
    setActiveGemeente(null);  // Clear context on error
  }
};

// Wijk click handler
const handleWijkClick = (
  wijkCode: string,
  wijkNaam: string,
  bbox: [number, number, number, number],
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
) => {
  if (!activeGemeente || !mapRef.current) return;

  // Highlight selected wijk
  addScanAreaHighlight(mapRef.current, geometry);

  // Trigger scan directly (wijk click is deliberate action)
  triggerScan.mutate(
    {
      gemeente_code: activeGemeente.code,
      gemeente_naam: activeGemeente.naam,
      bbox_wgs84: bbox,
    },
    {
      onSuccess: (data) => {
        setActiveScanId(data.scan_id);
        if (mapRef.current) removeScanAreaHighlight(mapRef.current);
        toast.success(`Scan gestart voor ${wijkNaam} (wijk ${wijkCode})`);
      },
      onError: (err) => {
        toast.error(`Scan starten mislukt: ${err.message}`);
        if (mapRef.current) removeScanAreaHighlight(mapRef.current);
      },
    }
  );
};

// Gemeenten layer toggle handler (with context cleanup)
const handleGemeentenToggle = (visible: boolean) => {
  if (!visible) {
    // Clear active gemeente context when turning off layer
    setActiveGemeente(null);

    // Remove wijk layer
    if (wijkGeojson && mapRef.current) {
      removeWijkBoundariesLayer(mapRef.current);
      setWijkGeojson(null);
    }

    // Zoom out to NL overview
    if (mapRef.current) {
      mapRef.current.flyTo({ center: NL_CENTER, zoom: NL_ZOOM, duration: 1000 });
    }
  }

  // ... rest of toggle logic
};
```

**Critical insight:** Gemeente context state is the "source of truth" for which wijken are loaded and visible. Layer toggles, zoom actions, and scan triggers all check/update this state.

### Pattern 4: Viewport-Based "Scan Visible Area" Button
**What:** Alternative scan trigger using current map viewport bbox (handles edge cases like partial wijk views)
**When to use:** When user has zoomed into specific area but no wijk is selected, or when straddling wijk boundaries
**Already proven:** map.getBounds() used in Phase 23 for bestemmingsplan zone scans

**Example:**
```typescript
// In map.tsx
const handleScanViewport = () => {
  if (!mapRef.current || !activeGemeente) {
    toast.info('Selecteer eerst een gemeente');
    return;
  }

  if (activeScanId) {
    toast.info('Scan al bezig, wacht even...');
    return;
  }

  const bounds = mapRef.current.getBounds();
  const bbox: [number, number, number, number] = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ];

  // Create bbox polygon for highlight
  const bboxPolygon: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [[
      [bbox[0], bbox[1]], [bbox[2], bbox[1]],
      [bbox[2], bbox[3]], [bbox[0], bbox[3]],
      [bbox[0], bbox[1]],
    ]],
  };

  addScanAreaHighlight(mapRef.current, bboxPolygon);

  // Trigger scan
  triggerScan.mutate(
    {
      gemeente_code: activeGemeente.code,
      gemeente_naam: activeGemeente.naam,
      bbox_wgs84: bbox,
    },
    {
      onSuccess: (data) => {
        setActiveScanId(data.scan_id);
        if (mapRef.current) removeScanAreaHighlight(mapRef.current);
      },
      onError: (err) => {
        toast.error(`Scan starten mislukt: ${err.message}`);
        if (mapRef.current) removeScanAreaHighlight(mapRef.current);
      },
    }
  );
};

// UI component (absolute positioned button on map)
<div className="absolute top-20 right-4 z-[var(--z-map-controls)]">
  {activeGemeente && (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 space-y-2">
      <div className="text-sm font-medium text-gray-900">
        Actieve gemeente:
      </div>
      <div className="text-xs text-gray-600">{activeGemeente.naam}</div>
      <button
        onClick={handleScanViewport}
        disabled={!!activeScanId}
        className="w-full px-3 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded transition-colors"
      >
        Scan zichtbaar gebied
      </button>
    </div>
  )}
</div>
```

**Use cases:**
- User zooms into partial wijk area (e.g., industrial zone at edge of wijk)
- User wants to scan area straddling multiple wijken (wijk boundaries are administrative, not always meaningful for development)
- User wants precise control over scan bbox beyond predefined wijk boundaries

### Anti-Patterns to Avoid
- **Loading all NL wijken upfront:** 8000+ wijken = large initial payload, defeats progressive disclosure. Load per gemeente on-demand.
- **Using 2026 WFS for wijk data:** Preliminary boundaries only (full data arrives mid-2026). Use 2024 WFS for stable wijk layer.
- **Forgetting to clear wijk layer when switching gemeente:** Memory leak + incorrect polygons displayed. Always `removeWijkBoundariesLayer` before loading new gemeente's wijken.
- **Allowing wijk selection without gemeente context:** Wijken need gemeente context for scan API (gemeente_code required). Guard wijk clicks with `if (!activeGemeente) return`.
- **Tight coupling between layer toggle and context state:** Layer visibility ≠ gemeente selection state. User might hide gemeente layer but keep context active (e.g., to see wijken more clearly).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wijk geometry fetching | Custom WFS XML parsing, manual HTTP | Backend service with httpx + shapely (already proven in gemeente_service.py) | OGC FILTER syntax is complex, backend handles coordinate transforms + validation |
| Feature-state hover effects | Custom MouseEvent tracking + CSS classes | MapLibre's native `map.setFeatureState()` API | Built-in, performant, handles edge cases (rapid mouse movement, layer z-index) |
| Gemeente context persistence | LocalStorage, Redux, Zustand | React useState in map.tsx component | Context is session-scoped, simple parent state sufficient |
| Wijk boundary simplification | Custom geometry simplification | Use `wijk_gegeneraliseerd` typeName from CBS WFS | CBS provides pre-generalized boundaries optimized for web display |
| Layer z-index management | Manual layer reordering with moveLayer | Insert layers with `beforeLayer` parameter on `addLayer` | Declarative, avoids race conditions when layers added in different order |

**Key insight:** MapLibre's feature-state API + CBS's pre-generalized geometries handle 90% of complexity. Don't rebuild what's already optimized.

## Common Pitfalls

### Pitfall 1: Using 2026 WFS for Wijk Data
**What goes wrong:** WFS query returns no features or incomplete wijk boundaries
**Why it happens:** 2026 WFS contains only preliminary gemeente/province boundaries in early 2026. Full wijk data arrives mid-year.
**How to avoid:** Use 2024 WFS (`https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0`) for stable wijk layer
**Warning signs:** Empty features array from WFS GetFeature request, or only 1-2 wijken returned for large gemeente

**Source:** PDOK official documentation confirms "Het meest recente jaar bevat in de eerste helft van dat jaar voorlopige grenzen... nog geen wijken en buurten voor dat jaar"

### Pitfall 2: PropertyIsEqualTo Instead of PropertyIsLike for Wijk Filtering
**What goes wrong:** WFS query returns no features even though wijken exist for that gemeente
**Why it happens:** Wijk statcode is `WK{gemeente_code}{wijk_nr}` (e.g., `WK098301`, `WK098302`). PropertyIsEqualTo matches exact string, but we need prefix match.
**How to avoid:** Use PropertyIsLike with wildcard pattern: `WK0983%` matches all wijken starting with `WK0983`
**Warning signs:** WFS query succeeds but returns empty features array

**Example:**
```xml
<!-- WRONG: PropertyIsEqualTo for prefix match -->
<Filter><PropertyIsEqualTo>
  <PropertyName>statcode</PropertyName>
  <Literal>WK0983</Literal>
</PropertyIsEqualTo></Filter>

<!-- CORRECT: PropertyIsLike with wildcard -->
<Filter><PropertyIsLike wildCard='%' singleChar='_' escapeChar='\'>
  <PropertyName>statcode</PropertyName>
  <Literal>WK0983%</Literal>
</PropertyIsLike></Filter>
```

**Source:** Validated from gemeente_service.py OGC FILTER pattern (Phase 23), OGC Filter Encoding Specification.

### Pitfall 3: Forgetting to Remove Wijk Layer When Switching Gemeente
**What goes wrong:** Old wijken from previous gemeente remain visible, overlapping with new gemeente's wijken
**Why it happens:** MapLibre layers persist until explicitly removed. Changing source data doesn't auto-remove layers.
**How to avoid:** Always call `removeWijkBoundariesLayer(map)` before loading new gemeente's wijken
**Warning signs:** Map shows wijken from multiple gemeentes simultaneously, wijk layer has features from wrong gemeente

**Example:**
```typescript
// WRONG: Load new wijken without clearing old ones
const handleGemeenteClick = async (code, naam, bbox) => {
  const newWijken = await fetchWijken(code);
  addWijkBoundariesLayer(map, newWijken, onWijkClick);  // Old layer still exists!
};

// CORRECT: Clear old wijken first
const handleGemeenteClick = async (code, naam, bbox) => {
  if (wijkGeojson && mapRef.current) {
    removeWijkBoundariesLayer(mapRef.current);  // Clear old layer
    setWijkGeojson(null);
  }
  const newWijken = await fetchWijken(code);
  setWijkGeojson(newWijken);
  addWijkBoundariesLayer(mapRef.current, newWijken, onWijkClick);
};
```

### Pitfall 4: Layer Visibility Toggle Clearing Gemeente Context State
**What goes wrong:** User toggles gemeenten layer off/on, loses active gemeente context, wijken disappear
**Why it happens:** Conflating layer visibility (visual state) with gemeente selection (semantic state)
**How to avoid:** Separate concerns — layer visibility controls rendering, gemeente context state controls data loading
**Warning signs:** Toggling gemeenten layer off/on resets everything, user has to re-select gemeente

**Example:**
```typescript
// WRONG: Clear context when hiding layer
const handleGemeentenToggle = (visible: boolean) => {
  if (!visible) {
    setActiveGemeente(null);  // ❌ User loses context
    removeWijkBoundariesLayer(map);
  }
  setGemeenteBoundariesVisibility(map, visible);
};

// CORRECT: Keep context, only control visibility
const handleGemeentenToggle = (visible: boolean) => {
  setGemeenteBoundariesVisibility(map, visible);
  // activeGemeente state persists — wijken remain loaded
  // User can hide gemeente layer to see wijken more clearly
};

// Only clear context when explicitly deselecting gemeente (e.g., zoom out button)
const handleClearGemeenteContext = () => {
  setActiveGemeente(null);
  if (wijkGeojson && mapRef.current) {
    removeWijkBoundariesLayer(mapRef.current);
    setWijkGeojson(null);
  }
};
```

**Critical insight:** Layer visibility ≠ semantic selection state. User might want to hide gemeente layer to reduce visual clutter while keeping wijken visible.

## Code Examples

Verified patterns from existing codebase and official sources:

### CBS WFS Wijk Query (Backend)
```python
# backend/app/services/wijk_service.py
# Based on gemeente_service.py pattern (Phase 23 proven)

async def get_wijken_in_gemeente(
    gemeente_code: str,
    client: httpx.AsyncClient,
) -> dict:
    """
    Fetch all wijken in gemeente from CBS WFS 2024.

    Args:
        gemeente_code: CBS code with or without GM prefix (e.g., "0983" or "GM0983")

    Returns:
        GeoJSON FeatureCollection with wijk polygons and properties:
        - statcode: WK{code}{nr} (e.g., "WK098301")
        - statnaam: Wijk name
        - geometry: Polygon/MultiPolygon in WGS84
    """
    wfs_url = "https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0"

    # Strip GM prefix if present
    gm_code = gemeente_code.replace("GM", "")
    statcode_pattern = f"WK{gm_code}%"

    # OGC XML FILTER (CQL_FILTER silently ignored)
    ogc_filter = (
        f"<Filter><PropertyIsLike wildCard='%' singleChar='_' escapeChar='\\'>"
        f"<PropertyName>statcode</PropertyName>"
        f"<Literal>{statcode_pattern}</Literal>"
        f"</PropertyIsLike></Filter>"
    )

    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gebiedsindelingen:wijk_gegeneraliseerd",
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",
        "FILTER": ogc_filter,
    }

    response = await client.get(wfs_url, params=params, timeout=30.0)
    response.raise_for_status()

    return response.json()
```

**Source:** gemeente_service.py (existing), CBS gebiedsindelingen WFS GetCapabilities

### MapLibre Feature-State Hover Effect
```typescript
// frontend/src/components/map/WijkBoundariesLayer.tsx
// Pattern verified from GemeenteBoundariesLayer.tsx (Phase 21)

let hoveredWijkId: string | null = null;

map.addSource(WIJK_SOURCE_ID, {
  type: 'geojson',
  data: geojson,
  promoteId: 'statcode',  // Use statcode as feature ID for feature-state
});

map.addLayer({
  id: WIJK_FILL_LAYER,
  type: 'fill',
  source: WIJK_SOURCE_ID,
  paint: {
    'fill-color': '#10b981',
    'fill-opacity': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.4,   // Hovered
      0.2,   // Default
    ],
  },
});

map.on('mousemove', WIJK_FILL_LAYER, (e) => {
  if (!e.features || e.features.length === 0) return;

  const currentId = e.features[0]?.properties?.statcode;
  if (currentId && currentId !== hoveredWijkId) {
    // Clear previous hover
    if (hoveredWijkId) {
      map.setFeatureState(
        { source: WIJK_SOURCE_ID, id: hoveredWijkId },
        { hover: false }
      );
    }
    // Set new hover
    hoveredWijkId = currentId;
    map.setFeatureState(
      { source: WIJK_SOURCE_ID, id: hoveredWijkId },
      { hover: true }
    );
  }
});

map.on('mouseleave', WIJK_FILL_LAYER, () => {
  if (hoveredWijkId) {
    map.setFeatureState(
      { source: WIJK_SOURCE_ID, id: hoveredWijkId },
      { hover: false }
    );
    hoveredWijkId = null;
  }
});
```

**Source:** GemeenteBoundariesLayer.tsx (existing), MapLibre GL JS feature-state API documentation

### Gemeente Context State Management
```typescript
// frontend/src/routes/_authenticated/map.tsx
// State management pattern for hierarchical selection

const [activeGemeente, setActiveGemeente] = useState<{
  code: string;
  naam: string;
  bbox: [number, number, number, number];
} | null>(null);

const [wijkGeojson, setWijkGeojson] = useState<GeoJSON.FeatureCollection | null>(null);

// Gemeente selection handler
const handleGemeenteClick = async (
  code: string,
  naam: string,
  bbox: [number, number, number, number],
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
) => {
  // Guard: prevent selection during active scan
  if (activeScanId) {
    toast.info('Scan al bezig, wacht even...');
    return;
  }

  // If clicking same gemeente, do nothing
  if (activeGemeente?.code === code) return;

  // Clear previous wijk layer if switching gemeente
  if (wijkGeojson && mapRef.current) {
    removeWijkBoundariesLayer(mapRef.current);
    setWijkGeojson(null);
  }

  // Set context BEFORE async fetch
  setActiveGemeente({ code, naam, bbox });

  // Zoom into gemeente
  if (mapRef.current) {
    mapRef.current.fitBounds(bbox, { padding: 50, duration: 800 });
  }

  // Fetch wijken
  try {
    const response = await fetch(`/api/wijken?gemeente_code=${code}`);
    const geojson = await response.json();

    setWijkGeojson(geojson);

    if (mapRef.current) {
      addWijkBoundariesLayer(mapRef.current, geojson, handleWijkClick);
    }

    toast.success(`${naam}: ${geojson.features.length} wijken geladen`);
  } catch (err) {
    console.error('Failed to fetch wijken:', err);
    toast.error('Kon wijken niet laden');
    setActiveGemeente(null);  // Clear context on error
  }
};

// Wijk selection handler
const handleWijkClick = (
  wijkCode: string,
  wijkNaam: string,
  bbox: [number, number, number, number],
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
) => {
  if (!activeGemeente || !mapRef.current) return;

  // Highlight wijk
  addScanAreaHighlight(mapRef.current, geometry);

  // Trigger scan with gemeente context
  triggerScan.mutate({
    gemeente_code: activeGemeente.code,
    gemeente_naam: activeGemeente.naam,
    bbox_wgs84: bbox,
  });
};
```

**Source:** Existing map.tsx state management patterns (Phase 23), React hooks best practices

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pre-load all wijken | On-demand wijk loading per gemeente | Phase 24 | Reduces initial payload, improves performance |
| Drawing tools for area selection | Click-based hierarchical selection (gemeente → wijk) | Phase 23 (drawing reverted) | Aligns with user mental models |
| Single-tier selection | Two-tier hierarchical selection with context state | Phase 24 | Enables progressive disclosure, manageable scan sizes |
| Gemeente-only scans | Wijk-based scans + viewport fallback | Phase 24 | Right-sized scans (1-5k parcels), user control |

**Deprecated/outdated:**
- **terra-draw for polygon selection:** Reverted in Phase 23 — UX not natural for real estate developers
- **2026 CBS WFS for wijken:** Preliminary data only, use 2024 WFS for stable boundaries
- **CQL_FILTER for PDOK WFS:** Silently ignored by CBS WFS service, use OGC XML FILTER instead (learned in Phase 23)

## Open Questions

### 1. Should we allow multi-wijk selection for combined scans?
**What we know:** User might want to scan multiple adjacent wijken as one operation (e.g., "scan all industrial wijken in Venlo")
**What's unclear:** UX for multi-select (Shift+click? Lasso? Checkbox list?), backend support for multiple bbox unions
**Recommendation:** Defer to Phase 25 (Results Interface) — can add "Combine wijken" feature once single-wijk flow is validated. Viewport-based scan already handles multi-wijk by bbox.

### 2. How to handle gemeentes without wijk data?
**What we know:** Small gemeentes may not have wijk subdivisions in CBS data, or 2024 WFS might be missing some
**What's unclear:** Fallback UX — show error? Fall back to gemeente-level scan? Show "No wijken available" message?
**Recommendation:** Backend should handle empty features array gracefully, frontend shows toast: "Geen wijken beschikbaar, gebruik 'Scan zichtbaar gebied'" and enables viewport scan button.

### 3. Should wijk layer auto-hide when scan completes to show score layer?
**What we know:** Scan completion adds parcel score layer (colored MVT tiles), which might visually conflict with wijk boundaries
**What's unclear:** User might want to keep wijk context visible to understand score distribution by neighborhood
**Recommendation:** Keep wijk layer visible, reduce opacity to 0.1 during active scan (instead of removing). User can manually toggle off if desired.

### 4. Performance implications of 100+ wijken in large gemeente (Amsterdam)?
**What we know:** Amsterdam has ~100 wijken, each a polygon with potentially hundreds of coordinates
**What's unclear:** MapLibre rendering performance at gemeente zoom level, whether client-side generalization needed
**Recommendation:** Use `wijk_gegeneraliseerd` typeName (CBS provides pre-simplified geometries), add `minzoom: 10` to wijk fill layer to hide at country-level zoom. Test with Amsterdam (GM0363) as worst-case scenario.

## Sources

### Primary (HIGH confidence)
- **Existing codebase:**
  - `backend/app/services/gemeente_service.py` — OGC XML FILTER pattern for CBS WFS (Phase 23)
  - `frontend/src/components/map/GemeenteBoundariesLayer.tsx` — MapLibre GeoJSON layer pattern with feature-state hover (Phase 21, 23)
  - `frontend/src/routes/_authenticated/map.tsx` — State management patterns for gemeente selection (Phase 23)
  - `frontend/src/lib/geo-utils.ts` — Bbox calculation from GeoJSON geometry (Phase 23)
- **CBS gebiedsindelingen WFS GetCapabilities** — typeName `gebiedsindelingen:wijk_gegeneraliseerd` confirmed available for 2024 service
- **MapLibre GL JS official documentation** — feature-state API, promoteId parameter, setFeatureState method

### Secondary (MEDIUM confidence)
- [PDOK CBS Gebiedsindelingen Dataset](https://www.pdok.nl/introductie/-/article/cbs-gebiedsindelingen) — Confirms wijk layer availability, preliminary vs definitive boundaries
- [CBS Gebiedsindelingen geüpdatet (2026) - Geoforum](https://geoforum.nl/t/cbs-gebiedsindelingen-geupdatet-2026/11325) — 2026 WFS preliminary data status
- [Wikipedia: Municipalities of the Netherlands](https://en.wikipedia.org/wiki/Municipalities_of_the_Netherlands) — Wijk/buurt administrative structure
- [MapLibre GL JS Display popup on hover](https://maplibre.org/maplibre-gl-js/docs/examples/display-a-popup-on-hover/) — Feature interaction examples

### Tertiary (LOW confidence)
- Web search results about typical wijk sizes — no authoritative source found for "1-5k parcels" estimate. Based on Phase 23 testing: Venlo gemeente = 10k parcels across 21 wijken = ~500 parcels/wijk average. Amsterdam gemeente = 40k parcels across 100 wijken = 400 parcels/wijk average. **Needs validation** in Plan 24-01 by querying actual parcel counts per wijk.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — Zero new dependencies, all libraries already proven in production (Phase 21-23)
- Architecture patterns: **HIGH** — WijkBoundariesLayer directly mirrors GemeenteBoundariesLayer (already shipped), state management follows existing React patterns in map.tsx
- Backend wijk service: **HIGH** — Identical pattern to gemeente_service.py (OGC FILTER validated in Phase 23)
- CBS WFS wijk data: **MEDIUM** — TypeName confirmed in GetCapabilities, but statcode prefix filter pattern needs validation in Plan 24-01. 2024 vs 2026 WFS difference confirmed by PDOK documentation.
- Wijk parcel count estimates: **LOW** — Based on limited testing (Venlo, Amsterdam), needs validation across diverse gemeente sizes
- UX flows (zoom, context transitions): **MEDIUM** — Based on existing gemeente selection UX (Phase 23), but hierarchical state management adds complexity

**Research date:** 2026-02-15
**Valid until:** 2026-04-15 (60 days) — CBS WFS data stable, MapLibre API stable, React patterns evergreen. Revalidate if CBS releases 2026 definitive wijk data mid-year.
