# Phase 23: Area Selection Tools - Research

**Researched:** 2026-02-12
**Domain:** Frontend map interactions (click-based area selection), backend scan triggering with bbox
**Confidence:** HIGH

## Summary

Phase 23 enables users to click on existing map features (bestemmingsplan zones or gemeente boundaries) to define scan areas, replacing the reverted drawing tools approach. The backend bbox support (Plan 23-02) is already shipped and handles WGS84→RD New coordinate conversion, Netherlands bounds validation, and 10 km² area limits.

This is a REPLAN focusing on **click-based selection** rather than drawing tools. The infrastructure exists:
- Backend accepts `bbox_wgs84` in `ScanCreateRequest` (Plan 23-02 ✓)
- GemeenteBoundariesLayer with GeoJSON features and click handlers (Phase 21 ✓)
- BestemmingsplanLayer with WMS tiles and GetFeatureInfo click handlers (Phase 22 ✓)
- ScanProgressOverlay component for progress tracking (Phase 20 ✓)
- Scan polling hooks and ARQ worker pipeline (Phase 20 ✓)

**Primary recommendation:** Extract bounding boxes from clicked GeoJSON features (gemeente boundaries) and WMS-queried bestemmingsplan zones, send to backend scan API, highlight selected area on map before triggering scan.

**Critical insight from revert:** Drawing rectangles/polygons is not how real estate developers think about areas. They think in terms of existing boundaries (gemeentes, bestemmingsplan zones, neighborhoods). The click-based approach aligns with user mental models.

## Standard Stack

### Core (Already Present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | 5.17.0 | Map rendering + interactions | Industry standard for web maps, fork of Mapbox GL |
| @tanstack/react-query | 5.90.20 | Server state + mutations | Caching, polling, optimistic updates out of the box |
| React | 19.2.0 | UI framework | Component model, hooks for side effects |

### Supporting (Already Present)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.9.3 | Type safety | All frontend code (strict mode enforced) |
| Tailwind | 4.1.18 | Styling | Layout, spacing, UI components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Click-based selection | Drawing tools (terra-draw) | **REVERTED** — drawing UX not natural for real estate developers who think in existing boundaries |
| Native MapLibre | react-map-gl wrapper | Wrapper adds abstraction but codebase uses native MapLibre (already integrated in v2.0/v3.0) |
| Client-side proj4 | Server-side conversion | Backend already has pyproj+shapely, frontend stays dependency-light |

**Installation:** No new dependencies needed — all libraries already present in package.json

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/components/map/
├── GemeenteBoundariesLayer.tsx    # GeoJSON features, queryRenderedFeatures
├── BestemmingsplanLayer.tsx       # WMS raster, GetFeatureInfo
├── ScanAreaHighlightLayer.tsx     # NEW: Show selected bbox outline before scan
└── ScanProgressOverlay.tsx        # Existing: Progress UI during scan
```

### Pattern 1: GeoJSON Feature Click → Bbox Extraction
**What:** User clicks gemeente boundary (GeoJSON polygon), extract bbox from feature geometry, trigger scan
**When to use:** For vector features with client-side geometry (gemeente boundaries from Phase 21)
**How it works:**
1. MapLibre `queryRenderedFeatures()` at click point returns GeoJSON feature
2. Iterate polygon coordinates to find [minLon, minLat, maxLon, maxLat]
3. Send bbox to backend via `triggerScan` mutation with `bbox_wgs84` field
4. Highlight selected area on map using outline layer

**Example:**
```typescript
// Based on GemeenteBoundariesLayer.tsx existing pattern
map.on('click', GEMEENTE_FILL_LAYER, (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: [GEMEENTE_FILL_LAYER]
  })

  if (features && features[0]) {
    const geometry = features[0].geometry
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      const bbox = calculateBboxFromGeometry(geometry) // [minLon, minLat, maxLon, maxLat]

      // Trigger scan with bbox
      triggerScan.mutate({
        gemeente_code,
        gemeente_naam,
        bbox_wgs84: bbox
      })
    }
  }
})
```

### Pattern 2: WMS GetFeatureInfo → Bbox from Map Bounds
**What:** User clicks bestemmingsplan zone (WMS raster), query GetFeatureInfo for zone details, extract visible area bbox
**When to use:** For WMS raster layers without client-side geometry (bestemmingsplan zones)
**How it works:**
1. WMS GetFeatureInfo returns zone metadata (plan name, bestemming type) but NO geometry
2. Cannot extract exact zone polygon — WMS is raster tiles, not vector features
3. Two approaches:
   - **A) Current map viewport bbox** (simple but coarse)
   - **B) Approximate zone bbox from nearby WMS clicks** (complex, error-prone)
4. Recommend **Approach A** for v3.1: use current visible area as bbox constraint

**Example:**
```typescript
// When user clicks bestemmingsplan zone (existing handler in BestemmingsplanLayer.tsx)
const handleBestemmingsplanClick = async (e: maplibregl.MapMouseEvent) => {
  const zoneInfo = await fetchGetFeatureInfo(map, e.lngLat)

  if (zoneInfo) {
    // Option A: Use visible map bounds as scan bbox
    const bounds = map.getBounds()
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ]

    // Show confirmation UI: "Scan visible area for {zone.planNaam}?"
    // User confirms → trigger scan with bbox
    triggerScan.mutate({
      gemeente_code,
      gemeente_naam,
      bbox_wgs84: bbox
    })
  }
}
```

**Important caveat:** WMS GetFeatureInfo returns zone metadata but NOT geometry. For precise zone boundaries, would need to switch to Ruimtelijkeplannen.nl REST API v4 (Phase 26 blocker) or PDOK WFS (check availability). For v3.1, viewport-based bbox is pragmatic compromise.

### Pattern 3: Scan Trigger with Bbox Field
**What:** Send optional `bbox_wgs84` field to backend scan API, backend handles coordinate conversion and area validation
**When to use:** Every scan triggered from click-based selection (both gemeente and bestemmingsplan clicks)
**Already implemented:** Plan 23-02 ✓

**Example:**
```typescript
// From useScans.ts hook
triggerScan.mutate({
  gemeente_code: '0363',
  gemeente_naam: 'Amsterdam',
  bbox_wgs84: [4.8, 52.3, 4.9, 52.4] // Optional WGS84 bbox
})
```

Backend validates:
- Netherlands bounds: 3.3-7.2°E, 50.7-53.6°N
- Min < max coordinates
- Area < 10 km² (in EPSG:28992 for accuracy)
- Returns 400 error with Dutch message if validation fails

### Pattern 4: Visual Feedback Before Scan
**What:** Highlight selected area on map before triggering scan, let user confirm or cancel
**When to use:** After clicking feature but before scan mutation, prevent accidental large scans
**How it works:**
1. Calculate bbox from clicked feature
2. Add temporary outline layer showing selected area
3. Show confirmation toast/modal: "Scan {area} km² in {zone name}?"
4. User confirms → trigger scan, user cancels → remove highlight

**Example:**
```typescript
// In map.tsx
const [selectedBbox, setSelectedBbox] = useState<[number, number, number, number] | null>(null)

const handleGemeenteClick = (bbox: [number, number, number, number], naam: string) => {
  setSelectedBbox(bbox) // Triggers ScanAreaHighlightLayer render

  // Show confirmation (sonner toast with action buttons)
  toast.info(`Scan ${calculateArea(bbox)} km² in ${naam}?`, {
    action: {
      label: 'Scan starten',
      onClick: () => {
        triggerScan.mutate({ gemeente_code, gemeente_naam, bbox_wgs84: bbox })
        setSelectedBbox(null)
      }
    },
    cancel: {
      label: 'Annuleren',
      onClick: () => setSelectedBbox(null)
    }
  })
}
```

### Anti-Patterns to Avoid
- **Drawing tools for arbitrary shapes:** REVERTED — users don't think in rectangles/polygons, they think in existing boundaries
- **Client-side coordinate conversion:** Backend already has pyproj+shapely, don't duplicate with proj4 on frontend
- **Scanning without bbox validation:** Backend enforces 10 km² limit, but frontend should show estimated area BEFORE triggering scan to prevent user frustration
- **Tight coupling between layer handlers:** Keep gemeente click handler separate from bestemmingsplan click handler, even if both trigger scans — different UX flows

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bbox calculation from polygon | Custom coordinate iteration | Simple min/max reducer over coordinates | GeoJSON polygons are [[[lon, lat], ...]] arrays — iterate once, track min/max |
| WMS feature geometry extraction | Custom WMS parsing, proxy server | Accept WMS limitation: use viewport bbox or defer to Phase 26 | WMS GetFeatureInfo returns metadata only, not geometries. Parsing WMS XML/GeoJSON is complex and fragile. |
| Coordinate projection | Frontend proj4/turf.js | Backend pyproj (already implemented in 23-02) | Backend has PostGIS + pyproj + shapely for all spatial ops, frontend stays simple |
| Scan progress UI | Custom polling + progress bar | Existing ScanProgressOverlay + useScanPolling hook | Already built in Phase 20, reuse component |
| Area calculation | Custom Haversine formula | Backend shapely in RD New (conformal projection) | WGS84 area distorted at high latitudes, RD New is accurate for Netherlands |

**Key insight:** Phase 22 created bestemmingsplan WMS layer, but WMS is raster — no client-side geometry. Extracting precise zone boundaries requires either:
1. Ruimtelijkeplannen.nl REST API v4 with GML/GeoJSON geometry (requires API key, Phase 26 blocker)
2. PDOK WFS for bestemmingsplangebied layer (check if available, may have same data)
3. Pragmatic compromise: use visible map viewport as bbox when clicking bestemmingsplan zone

**Recommendation for v3.1:** Accept WMS limitation, use viewport bbox for bestemmingsplan clicks. Phase 26 can upgrade to precise zone boundaries once REST API v4 key is obtained.

## Common Pitfalls

### Pitfall 1: WMS Raster vs Vector Feature Confusion
**What goes wrong:** Clicking WMS bestemmingsplan layer returns feature info (metadata) but not geometry. Developers expect polygon coordinates like GeoJSON features.
**Why it happens:** WMS serves raster tiles, not vector features. GetFeatureInfo is metadata lookup, not geometry query.
**How to avoid:**
- Accept WMS limitation for v3.1
- Use `map.getBounds()` to get viewport bbox when user clicks bestemmingsplan zone
- Show clear UI messaging: "Scan visible area within {zone name}"
- Phase 26 can upgrade to precise boundaries via REST API v4
**Warning signs:** Trying to parse WMS XML responses for polygon coordinates, searching for WMS-to-GeoJSON converters

### Pitfall 2: Bbox Coordinate Order Confusion
**What goes wrong:** MapLibre `getBounds()` returns LngLatBounds object, but backend expects flat array `[minLon, minLat, maxLon, maxLat]`
**Why it happens:** MapLibre API uses LngLatBounds class with methods like `getWest()`, `getSouth()`, etc. Backend expects simple tuple.
**How to avoid:**
```typescript
const bounds = map.getBounds()
const bbox: [number, number, number, number] = [
  bounds.getWest(),  // minLon
  bounds.getSouth(), // minLat
  bounds.getEast(),  // maxLon
  bounds.getNorth()  // maxLat
]
```
**Warning signs:** Backend 400 errors about "min > max" when bbox looks correct in frontend logs

### Pitfall 3: GeoJSON MultiPolygon Edge Case
**What goes wrong:** Gemeente boundaries can be MultiPolygon (e.g., islands, exclaves). Extracting bbox from first polygon only misses other parts.
**Why it happens:** `geometry.coordinates` is `[Polygon1, Polygon2, ...]` for MultiPolygon, not single array
**How to avoid:**
```typescript
function calculateBboxFromGeometry(geometry: GeoJSON.Geometry): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity

  const coords = geometry.type === 'Polygon'
    ? [geometry.coordinates]  // Wrap Polygon in array
    : geometry.coordinates     // MultiPolygon already array of Polygons

  for (const polygon of coords) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        minLon = Math.min(minLon, lon)
        minLat = Math.min(minLat, lat)
        maxLon = Math.max(maxLon, lon)
        maxLat = Math.max(maxLat, lat)
      }
    }
  }

  return [minLon, minLat, maxLon, maxLat]
}
```
**Warning signs:** Bbox too small for island gemeentes, scan results missing features

### Pitfall 4: Event Handler Memory Leaks
**What goes wrong:** Adding MapLibre event handlers in useEffect without cleanup causes duplicate handlers on re-render
**Why it happens:** MapLibre `map.on()` registers handler but doesn't auto-remove on component unmount
**How to avoid:**
```typescript
useEffect(() => {
  if (!mapReady || !mapRef.current) return

  const handleClick = (e: maplibregl.MapMouseEvent) => {
    // handler logic
  }

  const map = mapRef.current
  map.on('click', LAYER_ID, handleClick)

  // Cleanup function
  return () => {
    map.off('click', LAYER_ID, handleClick)
  }
}, [mapReady, /* other deps */])
```
**Warning signs:** Click handlers firing multiple times, console warnings about too many listeners

### Pitfall 5: Scan Trigger Race Condition
**What goes wrong:** User clicks multiple features rapidly, triggering overlapping scans. Backend creates multiple scan records, frontend shows wrong scan progress.
**Why it happens:** No debouncing or loading state check before mutation
**How to avoid:**
- Check `triggerScan.isPending` before allowing new click
- Show loading cursor/overlay during mutation
- Disable layer interaction while scan is pending
**Example:**
```typescript
const handleClick = (e) => {
  if (triggerScan.isPending || activeScanId) {
    toast.info('Scan al bezig, wacht even...')
    return
  }
  // proceed with scan trigger
}
```
**Warning signs:** Multiple scan progress overlays appearing, backend logs show duplicate scans for same gemeente

## Code Examples

Verified patterns from existing codebase and MapLibre documentation:

### Bbox Calculation from GeoJSON Feature
```typescript
// Source: GeoJSON RFC 7946 + existing GemeenteBoundariesLayer.tsx pattern
function calculateBboxFromGeometry(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): [number, number, number, number] {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity

  // Handle both Polygon and MultiPolygon
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates

  for (const polygon of polygons) {
    // First ring is exterior, others are holes (ignore for bbox)
    const exteriorRing = polygon[0]
    for (const [lon, lat] of exteriorRing) {
      minLon = Math.min(minLon, lon)
      minLat = Math.min(minLat, lat)
      maxLon = Math.max(maxLon, lon)
      maxLat = Math.max(maxLat, lat)
    }
  }

  return [minLon, minLat, maxLon, maxLat]
}
```

### Gemeente Click Handler with Bbox Extraction
```typescript
// Source: Existing GemeenteBoundariesLayer.tsx + new bbox logic
// In addGemeenteBoundariesLayer function
map.on('click', GEMEENTE_FILL_LAYER, (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: [GEMEENTE_FILL_LAYER]
  })

  if (features && features.length > 0) {
    const feature = features[0]
    const statcode = feature.properties?.statcode
    const statnaam = feature.properties?.statnaam

    // Extract bbox from feature geometry
    const bbox = calculateBboxFromGeometry(feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon)

    // Call handler with bbox
    onGemeenteClick(statcode, statnaam, bbox)
  }
})
```

### Bestemmingsplan Click Handler with Viewport Bbox
```typescript
// Source: Existing BestemmingsplanLayer.tsx + new bbox logic
const handleBestemmingsplanClick = async (e: maplibregl.MapMouseEvent) => {
  const layer = map.getLayer(BESTEMMINGSPLAN_LAYER_ID)
  if (!layer) return

  const visibility = map.getLayoutProperty(BESTEMMINGSPLAN_LAYER_ID, 'visibility')
  if (visibility !== 'visible') return

  // Query WMS GetFeatureInfo for zone metadata
  const zoneInfo = await fetchGetFeatureInfo(map, e.lngLat)

  if (zoneInfo) {
    // Extract viewport bbox (WMS doesn't provide feature geometry)
    const bounds = map.getBounds()
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ]

    // Call handler with zone info + viewport bbox
    onBestemmingsplanClick(zoneInfo, bbox)
  }
}
```

### Scan Trigger with Bbox
```typescript
// Source: Existing useScans.ts + ScanCreateRequest schema
const handleConfirmScan = (
  gemeenteCode: string,
  gemeenteNaam: string,
  bbox: [number, number, number, number]
) => {
  triggerScan.mutate({
    gemeente_code: gemeenteCode,
    gemeente_naam: gemeenteNaam,
    bbox_wgs84: bbox
  }, {
    onSuccess: (data) => {
      setActiveScanId(data.scan_id)
      toast.success('Scan gestart')
    },
    onError: (err) => {
      toast.error(`Scan starten mislukt: ${err.message}`)
    }
  })
}
```

### Highlight Selected Area Before Scan
```typescript
// Source: New component pattern, similar to PropertyGeometryLayer.tsx
export function addScanAreaHighlight(
  map: maplibregl.Map,
  bbox: [number, number, number, number]
): void {
  const [minLon, minLat, maxLon, maxLat] = bbox

  // Create GeoJSON box for highlight
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat]
        ]]
      },
      properties: {}
    }]
  }

  // Add or update source
  const source = map.getSource('scan-area-highlight')
  if (source && source.type === 'geojson') {
    source.setData(geojson)
  } else {
    map.addSource('scan-area-highlight', {
      type: 'geojson',
      data: geojson
    })

    // Add line layer for outline
    map.addLayer({
      id: 'scan-area-outline',
      type: 'line',
      source: 'scan-area-highlight',
      paint: {
        'line-color': '#8b5cf6', // Purple
        'line-width': 3,
        'line-dasharray': [2, 2]
      }
    })

    // Add fill layer for tint
    map.addLayer({
      id: 'scan-area-fill',
      type: 'fill',
      source: 'scan-area-highlight',
      paint: {
        'fill-color': '#8b5cf6',
        'fill-opacity': 0.15
      }
    }, 'scan-area-outline') // Insert before outline
  }
}

export function removeScanAreaHighlight(map: maplibregl.Map): void {
  if (map.getLayer('scan-area-fill')) {
    map.removeLayer('scan-area-fill')
  }
  if (map.getLayer('scan-area-outline')) {
    map.removeLayer('scan-area-outline')
  }
  if (map.getSource('scan-area-highlight')) {
    map.removeSource('scan-area-highlight')
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drawing tools (terra-draw) | Click-based selection on existing features | Phase 23 revert (2026-02-12) | UX aligned with user mental models — developers think in zones/gemeentes, not arbitrary rectangles |
| Full gemeente scans only | Bbox-constrained scans | Phase 23 Plan 02 (2026-02-11) | Enables focused scans on hundreds of parcels instead of thousands |
| WMS GetMap only | WMS GetFeatureInfo for zone metadata | Phase 22 (2026-02-11) | Click-to-inspect zoning, but no geometry extraction |

**Deprecated/outdated:**
- **terra-draw integration**: Removed in commit 42be8fb (2026-02-12). Drawing rectangles/polygons not natural UX for real estate developers.
- **DrawingToolsControl component**: Removed in revert commit. Replaced by click handlers on existing layers.
- **Frontend proj4/turf dependency**: Never added. Backend handles all coordinate conversion via pyproj.

## Open Questions

1. **Bestemmingsplan zone geometry precision**
   - What we know: Phase 22 uses WMS raster tiles, GetFeatureInfo returns metadata only (no geometry)
   - What's unclear: Is PDOK WFS bestemmingsplangebied layer available for vector features? Or must wait for Ruimtelijkeplannen.nl REST API v4 key (Phase 26)?
   - Recommendation: Accept viewport bbox limitation for v3.1, investigate WFS in parallel as stretch goal

2. **Area estimation before scan trigger**
   - What we know: Backend validates area < 10 km² in RD New coordinates (accurate)
   - What's unclear: Should frontend show area estimate before scan? Calculate in WGS84 (inaccurate but simple) or send bbox to backend validation endpoint?
   - Recommendation: Show simple bbox area estimate using Haversine formula in WGS84, accept ~5% error for Netherlands. Backend is source of truth for validation.

3. **Multi-select for large areas**
   - What we know: Single click = single bbox, 10 km² limit enforced
   - What's unclear: What if user wants to scan multiple disconnected zones? Hold Shift to add to selection? Or defer to Phase 24+?
   - Recommendation: Single-selection for v3.1, defer multi-select to future phase

4. **Confirmation toast vs modal**
   - What we know: Scan trigger is async mutation, can be cancelled via ScanProgressOverlay
   - What's unclear: Is sonner toast with action buttons sufficient for scan confirmation, or does this need dedicated modal with area preview?
   - Recommendation: Toast for gemeente clicks (familiar boundary), modal for bestemmingsplan clicks (viewport bbox may surprise user)

## Sources

### Primary (HIGH confidence)
- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/) - API reference for map interactions, event handling, LngLatBounds
- [MapLibre GL JS Map Class](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/) - getBounds(), queryRenderedFeatures(), event handlers
- [MapLibre GL JS LngLatBounds](https://maplibre.org/maplibre-gl-js/docs/API/classes/LngLatBounds/) - Bounding box representation and conversion
- [GeoJSON RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946) - Polygon/MultiPolygon coordinate structure, bbox format
- Existing codebase Phase 21-22 components (GemeenteBoundariesLayer.tsx, BestemmingsplanLayer.tsx, useScans.ts)
- Backend Plan 23-02 implementation (ScanCreateRequest.bbox_wgs84, coordinate conversion, validation)

### Secondary (MEDIUM confidence)
- [MapLibre GL JS Examples](https://maplibre.org/maplibre-gl-js/docs/examples/) - Polygon click interaction patterns
- [React useCallback documentation](https://react.dev/reference/react/useCallback) - Memoization patterns for map event handlers
- Phase 23 STATE.md revert context (click-based UX rationale)

### Tertiary (LOW confidence)
- [react-map-gl State Management](https://visgl.github.io/react-map-gl/docs/get-started/state-management) - React patterns with MapLibre (library not used in this codebase, but patterns transferable)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already present in codebase, no new dependencies needed
- Architecture: HIGH - Two existing click handler patterns (GeoJSON + WMS), bbox extraction is standard min/max iteration
- Pitfalls: HIGH - WMS raster limitation is well-documented, coordinate order confusion is common MapLibre gotcha, event cleanup is standard React pattern
- Backend integration: HIGH - Plan 23-02 already shipped with bbox_wgs84 field, validation, and coordinate conversion

**Research date:** 2026-02-12
**Valid until:** 60 days (stable domain — MapLibre API stable, GeoJSON spec unchanged, backend contract fixed)

**Key unknowns requiring validation during planning:**
1. PDOK WFS bestemmingsplangebied availability for vector features (alternative to viewport bbox)
2. Confirmation UX flow (toast vs modal) — user testing needed
3. Area estimation accuracy tradeoff (simple WGS84 Haversine vs backend round-trip)
