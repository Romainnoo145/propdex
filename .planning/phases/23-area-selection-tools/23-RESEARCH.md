# Phase 23: Area Selection Tools - Research

**Researched:** 2026-02-11
**Domain:** MapLibre drawing tools + bbox-based area scanning + user-defined scan boundaries
**Confidence:** HIGH

## Summary

Phase 23 enables user-defined area scanning by adding drawing tools to the MapLibre map, calculating bounding boxes from drawn geometries, and triggering focused BAG scans on custom areas (hundreds of parcels) instead of entire gemeenten (thousands of parcels). This transforms Propdex from "gemeente-wide batch scanning" to "area-first targeted intelligence."

The implementation leverages existing v3.0 infrastructure with minimal new dependencies: the scan pipeline (AreaScan model, ARQ worker, progress tracking) already supports arbitrary bboxes, the BAG WFS client already handles bbox queries with pagination, and the frontend already has MapLibre and scan progress UI. The core gaps are drawing tool integration and bbox calculation, both solvable with well-maintained libraries (@watergis/maplibre-gl-terradraw for drawing, @turf/bbox for geometry calculations).

Architecture approach is ADDITIVE: extend existing ScanCreateRequest schema with optional bbox parameter, add frontend drawing UI that calculates bbox and passes to trigger endpoint, reuse ScanProgressOverlay component without modification. Backend scan flow unchanged (area_scan_job already uses AreaScan.bbox_* fields). Zero breaking changes to existing gemeente scan workflow.

**Primary recommendation:** Use @watergis/maplibre-gl-terradraw (1.0.1+) for drawing tools and @turf/bbox (7.2.0+) for bbox calculation. Both libraries are actively maintained, lightweight, and designed for MapLibre integration. Extend ScanCreateRequest with optional bbox field and add frontend DrawingToolsControl component.

## Standard Stack

### Core Libraries (NEW DEPENDENCIES)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **@watergis/maplibre-gl-terradraw** | 1.0.1+ | Rectangle/polygon drawing on MapLibre map | Official MapLibre plugin, actively maintained (2025+), wraps Terra Draw library, replaces deprecated mapbox-gl-draw |
| **terra-draw** | 1.24.0+ | Core drawing engine | Peer dependency of maplibre-gl-terradraw, supports MapLibre/Mapbox/Leaflet/OpenLayers adapters |
| **@turf/bbox** | 7.2.0+ | Calculate bounding box from GeoJSON geometry | Industry standard for geospatial calculations in JavaScript, 8M+ weekly downloads, minimal bundle size (~2KB) |

### Supporting Libraries (ALREADY IN PROJECT)

| Library | Version | Purpose | Existing Use |
|---------|---------|---------|---------------|
| **maplibre-gl** | 5.17.0 | Base map library | v2.0 Phase 13, full-page map with layer controls |
| **shapely** | 2.0.0+ | Backend bbox validation | v3.0 Phase 18, PostGIS geometry operations |
| **httpx** | 0.28.1+ | Backend BAG WFS queries | v1.0 Phase 2, existing BAG client |
| **ARQ** | 0.27.0+ | Background scan jobs | v1.0 Phase 4, existing area_scan_job |

### Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **@watergis/maplibre-gl-terradraw** | **mapbox-gl-draw** | NEVER - deprecated, no longer maintained as of 2024 |
| **@watergis/maplibre-gl-terradraw** | **@geoman-io/maplibre-geoman-free** | If need advanced features (circle radius, cutting, snapping) - heavier bundle but more features |
| **@turf/bbox** | **Manual bbox calculation** | NEVER - edge cases like antimeridian crossing, degenerate geometries |

**Installation:**
```bash
# Frontend (new dependencies)
cd frontend
npm install @watergis/maplibre-gl-terradraw@^1.0.1 terra-draw@^1.24.0 @turf/bbox@^7.2.0

# Backend (no new dependencies)
# Existing shapely, httpx, ARQ cover all requirements
```

## Architecture Patterns

### Pattern 1: Drawing Tools Integration

**What:** Add drawing controls to MapLibre map with rectangle and polygon modes, extract drawn geometry, calculate bbox.

**When to use:** User-initiated area selection for focused scanning (alternative to gemeente-wide scans).

**Example:**
```typescript
// frontend/src/components/map/DrawingToolsControl.tsx
import { TerraDraw, TerraDrawMapLibreGLAdapter } from 'terra-draw'
import { TerraDrawRectangleMode, TerraDrawPolygonMode } from 'terra-draw/modes'
import bbox from '@turf/bbox'
import type { Map } from 'maplibre-gl'

interface DrawingToolsControlProps {
  map: Map
  onAreaDrawn: (bbox: [number, number, number, number], geometry: GeoJSON.Geometry) => void
}

export function DrawingToolsControl({ map, onAreaDrawn }: DrawingToolsControlProps) {
  const [draw, setDraw] = useState<TerraDraw | null>(null)
  const [activeMode, setActiveMode] = useState<'rectangle' | 'polygon' | null>(null)

  useEffect(() => {
    // Initialize Terra Draw with MapLibre adapter
    const terraDraw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawRectangleMode(),
        new TerraDrawPolygonMode(),
      ],
    })

    terraDraw.start()
    setDraw(terraDraw)

    return () => {
      terraDraw.stop()
    }
  }, [map])

  const handleRectangleClick = () => {
    if (!draw) return
    draw.setMode('rectangle')
    setActiveMode('rectangle')

    // Listen for completion
    draw.on('finish', (feature: GeoJSON.Feature) => {
      const bounds = bbox(feature) // [minX, minY, maxX, maxY]
      onAreaDrawn(bounds as [number, number, number, number], feature.geometry)
      draw.clear() // Clear drawn shapes
      setActiveMode(null)
    })
  }

  return (
    <div className="maplibre-ctrl maplibre-ctrl-group">
      <button
        onClick={handleRectangleClick}
        className={activeMode === 'rectangle' ? 'active' : ''}
        title="Draw Rectangle"
      >
        <RectangleIcon />
      </button>
      <button
        onClick={handlePolygonClick}
        className={activeMode === 'polygon' ? 'active' : ''}
        title="Draw Polygon"
      >
        <PolygonIcon />
      </button>
    </div>
  )
}
```

**Key principles:**
- Terra Draw handles mode state, geometry validation, map interaction
- Use `@turf/bbox` for coordinate extraction (handles all geometry types)
- Call `draw.clear()` after scan trigger to remove drawn shape
- Store geometry along with bbox for future parcel highlight

### Pattern 2: Bbox-Filtered Scan Trigger

**What:** Extend existing scan endpoint to accept optional bbox parameter, backend validates bbox area (<10 km²), frontend passes bbox from drawing tools.

**When to use:** User draws area on map and clicks "Scan this area" button.

**Example:**
```python
# backend/app/scans/schemas.py
class ScanCreateRequest(BaseModel):
    """Schema for triggering a new area scan."""

    gemeente_code: str = Field(...)
    gemeente_naam: str = Field(...)
    force_rescan: bool = Field(default=False)

    # NEW: Optional bbox for user-defined area scans
    bbox: tuple[float, float, float, float] | None = Field(
        default=None,
        description="Optional bounding box [minx, miny, maxx, maxy] in EPSG:28992 (RD New). "
                    "If provided, scan is limited to this area instead of entire gemeente. "
                    "Max area: 10 km².",
    )
```

```python
# backend/app/scans/router.py
@router.post("", response_model=ScanResponse)
async def trigger_scan(
    request: Request,
    scan_request: ScanCreateRequest,
    ...
) -> ScanResponse:
    # If bbox provided, validate area
    if scan_request.bbox:
        minx, miny, maxx, maxy = scan_request.bbox

        # Validate bbox is within Netherlands (RD New bounds)
        if not (0 < minx < 300000 and 0 < maxx < 300000 and
                300000 < miny < 650000 and 300000 < maxy < 650000):
            raise HTTPException(400, "Bbox outside Netherlands bounds")

        # Validate area (use shapely for accurate calculation)
        from shapely.geometry import box
        bbox_geom = box(minx, miny, maxx, maxy)
        area_m2 = bbox_geom.area

        MAX_AREA = 10_000_000  # 10 km²
        if area_m2 > MAX_AREA:
            raise HTTPException(
                400,
                f"Scan area {area_m2:.0f} m² exceeds max {MAX_AREA} m² (10 km²). "
                "Please draw a smaller area."
            )

        bbox = scan_request.bbox
    else:
        # Fall back to gemeente bbox (existing logic)
        http_client = request.app.state.http_client
        bbox = await get_gemeente_bbox(scan_request.gemeente_code, http_client)

    # Create scan record (existing logic)
    scan = await service.create_scan(
        organization_id=organization_id,
        gemeente_code=scan_request.gemeente_code,
        gemeente_naam=scan_request.gemeente_naam,
        bbox=bbox,  # Can be user-drawn or gemeente-wide
        session=db,
    )

    # Enqueue ARQ job (unchanged)
    ...
```

**Key principles:**
- Bbox optional = backward compatible with existing gemeente scans
- Validate Netherlands bounds (EPSG:28992 RD New: 0-300000 X, 300000-650000 Y)
- Validate area limit BEFORE creating scan record (prevent wasted ARQ jobs)
- Reuse existing scan pipeline (area_scan_job already uses AreaScan.bbox_* fields)

### Pattern 3: Parcel Highlight Layer

**What:** After scan completes, highlight parcels on map by querying Kadaster WFS with scan bbox, apply highlight style.

**When to use:** Visual confirmation of scan coverage after deep-dive scan completes.

**Example:**
```typescript
// frontend/src/components/map/ScanAreaHighlightLayer.tsx
export function addScanAreaHighlightLayer(
  map: Map,
  bbox: [number, number, number, number]
) {
  const SOURCE_ID = 'scan-area-highlight'
  const LAYER_ID = 'scan-area-highlight-layer'

  // Remove existing highlight if present
  if (map.getLayer(LAYER_ID)) {
    map.removeLayer(LAYER_ID)
  }
  if (map.getSource(SOURCE_ID)) {
    map.removeSource(SOURCE_ID)
  }

  // Add WFS vector source (Kadaster parcel boundaries)
  map.addSource(SOURCE_ID, {
    type: 'vector',
    tiles: [
      `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0?` +
      `service=WMS&request=GetMap&layers=Perceel&` +
      `styles=&format=application/vnd.mapbox-vector-tile&` +
      `transparent=true&version=1.3.0&` +
      `width=256&height=256&crs=EPSG:3857&` +
      `bbox={bbox-epsg-3857}`
    ],
    minzoom: 12,
    maxzoom: 19,
  })

  // Add highlight layer (yellow outline + semi-transparent fill)
  map.addLayer({
    id: LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    'source-layer': 'Perceel',
    paint: {
      'fill-color': '#FFD700',    // Gold
      'fill-opacity': 0.2,
      'fill-outline-color': '#FFA500', // Orange
    },
    // Add before labels for better visibility
  }, 'place-label')

  // Fit map to scan bbox
  const [minx, miny, maxx, maxy] = bbox
  map.fitBounds([[minx, miny], [maxx, maxy]], { padding: 50 })
}
```

**Key principles:**
- Reuse Kadaster WFS parcels layer (already available in Phase 15)
- Apply distinct highlight style (different from score layer colors)
- Fit map to bbox after adding layer (zoom to scan area)
- Clean up previous highlights before adding new one

### Pattern 4: Progress Overlay Reuse

**What:** Reuse existing ScanProgressOverlay component without modification for area deep-dive scans.

**When to use:** User triggers area scan, progress overlay shows phases and percentage.

**Example:**
```typescript
// frontend/src/routes/_authenticated/map.tsx
const [activeScan, setActiveScan] = useState<{
  scanId: string
  type: 'gemeente' | 'area'
  bbox?: [number, number, number, number]
} | null>(null)

const handleAreaScanTrigger = async (
  bbox: [number, number, number, number],
  geometry: GeoJSON.Geometry
) => {
  // Trigger scan with bbox
  const response = await api.triggerScan({
    gemeente_code: currentGemeente.code,
    gemeente_naam: currentGemeente.naam,
    bbox,
  })

  // Start polling (existing hook)
  setActiveScan({
    scanId: response.scan_id,
    type: 'area',
    bbox,
  })
}

// Existing polling hook works unchanged
const { status, cancel } = useScans(activeScan?.scanId)

return (
  <>
    <DrawingToolsControl
      map={map}
      onAreaDrawn={handleAreaScanTrigger}
    />

    {/* Existing component, no modifications needed */}
    {activeScan && status && (
      <ScanProgressOverlay
        status={status}
        onCancel={() => cancel()}
        isCancelling={false}
      />
    )}
  </>
)
```

**Key principles:**
- ScanProgressOverlay is type-agnostic (works for gemeente or area scans)
- Polling logic unchanged (GET /api/scans/{scan_id}/status)
- Backend scan phases identical (fetching_parcels → cross_referencing_bag → querying_bestemmingen)
- Only difference: parcel count (hundreds vs thousands)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **Drawing UI state management** | Custom mouse event handlers, geometry validation, mode switching | Terra Draw library via maplibre-gl-terradraw | Handles edge cases: self-intersecting polygons, incomplete drawings, touch events on mobile, undo/redo |
| **Bbox calculation from geometry** | Manual coordinate iteration to find min/max | @turf/bbox | Handles antimeridian crossing, degenerate geometries (points, lines), all GeoJSON types |
| **Coordinate projection** | Custom RD New ↔ Web Mercator transforms | MapLibre built-in projection | MapLibre handles projection automatically, Terra Draw works in map CRS |
| **Area validation** | String-based coordinate parsing and manual area math | shapely.geometry.box + .area property | Handles non-rectangular shapes, validates topology, prevents floating point errors |

**Key insight:** Drawing tools seem simple ("just click two corners for rectangle") but production-ready implementation requires handling: touch events, pinch-zoom conflicts, self-intersecting polygons, incomplete drawings, undo/redo, multi-geometry types, coordinate validation. Terra Draw solves all of this. @turf/bbox handles bbox extraction edge cases (antimeridian, degenerate geometries). Don't reinvent these wheels.

## Common Pitfalls

### Pitfall 1: Forgetting to Validate Bbox Area Before Scan

**What goes wrong:** User draws huge area (50 km²), scan attempts to fetch 100K+ parcels, BAG WFS times out or returns incomplete data, ARQ job runs for hours, frontend polls forever.

**Why it happens:** Drawing tools don't enforce area limits. Calculating area requires projection math (Web Mercator distorts area at high latitudes).

**How to avoid:**
1. Calculate area server-side using shapely (EPSG:28992 is conformal, area calculation accurate)
2. Reject scans >10 km² with clear error message ("Please draw a smaller area")
3. Add client-side preview: show estimated parcel count based on Netherlands density (~2000 parcels per km² in urban areas)

**Warning signs:**
- Frontend loading spinner never completes
- Backend logs show "fetched 1000/150000 panden (page 1)" (huge mismatch)
- Redis memory usage spikes (ARQ job storing massive feature list)

```python
# GOOD: Validate before creating scan
from shapely.geometry import box
bbox_geom = box(*scan_request.bbox)
if bbox_geom.area > 10_000_000:  # 10 km² in m²
    raise HTTPException(400, "Area too large")

# BAD: No validation, scan proceeds with massive bbox
scan = await service.create_scan(bbox=scan_request.bbox)
```

### Pitfall 2: Not Handling Drawing Tool Cleanup on Mode Switch

**What goes wrong:** User draws rectangle, switches to polygon mode, previous rectangle remains on map as ghost layer, user confused about what will be scanned.

**Why it happens:** Terra Draw stores drawn features in internal state, switching modes doesn't auto-clear previous features unless explicitly told.

**How to avoid:**
1. Call `draw.clear()` when switching modes
2. Clear on successful scan trigger (don't leave drawn shape on map after scan starts)
3. Provide "Cancel Drawing" button that calls `draw.cancel()` + `draw.clear()`

**Warning signs:**
- Multiple rectangles/polygons visible on map
- User reports "I drew a new area but old one is still there"
- Bbox calculation uses first geometry, not latest

```typescript
// GOOD: Clear on mode switch
const handleRectangleClick = () => {
  draw.clear() // Remove previous drawings
  draw.setMode('rectangle')
}

// BAD: Doesn't clear, accumulates shapes
const handleRectangleClick = () => {
  draw.setMode('rectangle') // Ghost layers remain
}
```

### Pitfall 3: Using Web Mercator Coordinates for Backend Bbox

**What goes wrong:** Frontend sends bbox in EPSG:3857 (Web Mercator), backend expects EPSG:28992 (RD New), BAG WFS queries return empty results, scan completes with 0 parcels.

**Why it happens:** MapLibre map uses Web Mercator (lat/lon → meters), but Dutch government APIs (BAG WFS, PDOK) use RD New coordinate system.

**How to avoid:**
1. Convert bbox to RD New in frontend BEFORE sending to backend
2. Use proj4js with EPSG:28992 definition
3. Backend validates bbox is within Netherlands bounds (RD New: 0-300000 X, 300000-650000 Y)
4. Log coordinate system in API requests for debugging

**Warning signs:**
- Scan completes instantly with 0 parcels
- Backend logs show "BAG WFS returned 0 features for bbox"
- Bbox coordinates are 7-digit numbers (Web Mercator) instead of 6-digit (RD New)

```typescript
// GOOD: Convert to RD New before sending
import proj4 from 'proj4'
proj4.defs('EPSG:28992', '+proj=sterea +lat_0=52.15616055555555 ...')

const bboxWebMercator = bbox(feature) // [minX_3857, minY_3857, maxX_3857, maxY_3857]
const bboxRDNew = [
  ...proj4('EPSG:3857', 'EPSG:28992', [bboxWebMercator[0], bboxWebMercator[1]]),
  ...proj4('EPSG:3857', 'EPSG:28992', [bboxWebMercator[2], bboxWebMercator[3]])
]

// BAD: Send Web Mercator coordinates directly
await api.triggerScan({ bbox: bbox(feature) })
```

### Pitfall 4: Not Showing Scan Area Highlight Until Scan Completes

**What goes wrong:** User draws area, triggers scan, sees progress overlay but can't remember what area they selected, tries to navigate map to check but overlay blocks view.

**Why it happens:** No visual feedback of scan area boundaries during scan execution.

**How to avoid:**
1. Add semi-transparent bbox rectangle to map immediately after drawing (before scan starts)
2. Keep bbox visible during scan progress
3. Convert to full parcel highlight layer only after scan completes (requires WFS query)
4. Allow map panning/zooming while scan progresses (overlay is fixed position, doesn't block map)

**Warning signs:**
- User asks "What area am I scanning?" during progress
- User tries to click map to remind themselves (but overlay covers map controls)
- Multiple support requests about "I don't know what I selected"

```typescript
// GOOD: Show bbox immediately, upgrade to parcels later
const handleAreaDrawn = (bbox, geometry) => {
  // 1. Add bbox outline immediately (fast, no API call)
  addBboxOutline(map, bbox)

  // 2. Trigger scan
  const scanId = await api.triggerScan({ bbox })

  // 3. Poll for completion
  // 4. On complete: remove bbox outline, add parcel highlight layer
  addScanAreaHighlightLayer(map, bbox)
}

// BAD: No visual feedback until scan completes
const handleAreaDrawn = (bbox) => {
  const scanId = await api.triggerScan({ bbox })
  // User has no idea what area they selected
}
```

## Code Examples

Verified patterns from official sources:

### MapLibre Terra Draw Integration

```typescript
// Source: https://github.com/watergis/maplibre-gl-terradraw
// Official example from @watergis/maplibre-gl-terradraw
import { TerraDraw, TerraDrawMapLibreGLAdapter } from 'terra-draw'
import {
  TerraDrawRectangleMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode
} from 'terra-draw/modes'

const draw = new TerraDraw({
  adapter: new TerraDrawMapLibreGLAdapter({ map: maplibreMap }),
  modes: [
    new TerraDrawRectangleMode(),
    new TerraDrawPolygonMode({
      snapping: true,        // Snap to existing features
      pointerDistance: 10,   // Click tolerance in pixels
    }),
    new TerraDrawSelectMode({
      flags: {
        arbitary: {
          feature: {},
          delete: null,   // Disable delete (we handle via clear())
        }
      }
    }),
  ],
})

draw.start()

// Set active drawing mode
draw.setMode('rectangle')

// Listen for feature completion
draw.on('finish', (id: string) => {
  const features = draw.getSnapshot()
  const feature = features.find(f => f.id === id)
  if (feature) {
    handleDrawingComplete(feature)
  }
})

// Clear all drawings
draw.clear()

// Cleanup
draw.stop()
```

### Turf.js Bbox Calculation

```typescript
// Source: https://turfjs.org/docs/api/bbox
// Official Turf.js bbox example
import bbox from '@turf/bbox'
import { lineString, polygon } from '@turf/helpers'

// Works with any GeoJSON geometry type
const line = lineString([[-74, 40], [-78, 42], [-82, 35]])
const bounds = bbox(line)
// => [-82, 35, -74, 42] (minX, minY, maxX, maxY)

// Works with polygons (common for area selection)
const poly = polygon([[
  [121000, 487000],
  [122000, 487000],
  [122000, 488000],
  [121000, 488000],
  [121000, 487000]
]])
const polyBounds = bbox(poly)
// => [121000, 487000, 122000, 488000]

// Works with FeatureCollections
const featureCollection = {
  type: 'FeatureCollection',
  features: [line, poly]
}
const collectionBounds = bbox(featureCollection)
// Returns bbox encompassing all features
```

### Backend Bbox Validation with Shapely

```python
# Source: https://shapely.readthedocs.io/en/stable/geometry.html
# Official shapely box() example
from shapely.geometry import box

# Create bbox polygon from coordinates
minx, miny, maxx, maxy = 121000, 487000, 122000, 488000
bbox_geom = box(minx, miny, maxx, maxy)

# Calculate area (accurate for EPSG:28992)
area_m2 = bbox_geom.area  # Square meters

# Validate area limit
MAX_AREA = 10_000_000  # 10 km²
if area_m2 > MAX_AREA:
    raise ValueError(f"Area {area_m2:.0f} m² exceeds max {MAX_AREA} m²")

# Convert to GeoJSON for storage
import json
geojson = json.dumps(bbox_geom.__geo_interface__)

# Validate bbox is within Netherlands bounds (RD New)
NL_BOUNDS = box(0, 300000, 300000, 650000)
if not NL_BOUNDS.contains(bbox_geom):
    raise ValueError("Bbox outside Netherlands bounds")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| **mapbox-gl-draw** | **terra-draw** | 2024 | mapbox-gl-draw unmaintained, terra-draw actively developed with modern API, better MapLibre support |
| **Manual WFS pagination** | **Automatic via bag_wfs_client** | v3.0 Phase 19 | Existing BAG WFS client handles 1000-feature pagination automatically, prevents silent truncation |
| **Gemeente-wide scans only** | **User-defined bbox scans** | This phase | 90%+ reduction in API calls, faster scan times (seconds vs minutes), enables area-first workflow |
| **Turf.js full bundle (600KB)** | **Modular @turf/bbox (2KB)** | 2020+ | Tree-shaking support, only import needed functions |

**Deprecated/outdated:**
- **mapbox-gl-draw:** No longer maintained as of 2024, compatibility issues with MapLibre 3.0+. Use terra-draw instead.
- **turf (full bundle):** Deprecated in favor of modular packages like @turf/bbox. Full bundle is 600KB+, modular is <10KB.
- **OWSLib for WFS queries:** Sync-only library, incompatible with FastAPI async. Use httpx directly (already in project).

## Open Questions

1. **Coordinate Projection in Frontend**
   - What we know: MapLibre uses Web Mercator (EPSG:3857), Dutch APIs use RD New (EPSG:28992)
   - What's unclear: Does @watergis/maplibre-gl-terradraw return geometries in map CRS (Web Mercator) or source CRS?
   - Recommendation: Test with console.log(feature.geometry.coordinates) after drawing. If coordinates are 6-7 digits, likely Web Mercator. Convert to RD New using proj4js before sending to backend.

2. **Drawing Tool UI Placement**
   - What we know: LayerToggle exists in top-right corner, plenty of space
   - What's unclear: Should drawing tools be separate control group or integrated into LayerToggle?
   - Recommendation: Separate control group for visual distinction (drawing is action, layers are visibility toggles). Place below LayerToggle.

3. **Mobile Drawing Experience**
   - What we know: Terra Draw supports touch events
   - What's unclear: How usable is polygon drawing on mobile (small screen, finger precision)?
   - Recommendation: Start with rectangle mode only on mobile (2 taps), defer polygon mode to desktop. Detect screen size and conditionally show polygon button.

## Sources

### Primary (HIGH confidence)

- [MapLibre GL JS Draw Geometries with Terra Draw](https://maplibre.org/maplibre-gl-js/docs/examples/draw-geometries-with-terra-draw/) — Official MapLibre example
- [maplibre-gl-terradraw announcement - FOSS4G Europe 2025](https://talks.osgeo.org/foss4g-europe-2025/talk/UTUW8Z/) — Official plugin announcement
- [GitHub: watergis/maplibre-gl-terradraw](https://github.com/watergis/maplibre-gl-terradraw) — Plugin source code and examples
- [npm: @watergis/maplibre-gl-terradraw](https://www.npmjs.com/package/@watergis/maplibre-gl-terradraw) — Version 1.0.1, published 2025
- [GitHub: JamesLMilner/terra-draw](https://github.com/JamesLMilner/terra-draw) — Core Terra Draw library
- [npm: terra-draw](https://www.npmjs.com/package/terra-draw) — Version 1.24.0, actively maintained
- [Turf.js bbox Documentation](https://turfjs.org/docs/api/bbox) — Official API reference
- [npm: @turf/bbox](https://www.npmjs.com/package/@turf/bbox) — Version 7.2.0, 8M+ weekly downloads
- [Shapely Documentation - box()](https://shapely.readthedocs.io/en/stable/geometry.html) — Official Python library docs

### Secondary (MEDIUM confidence)

- [MapLibre-Geoman Documentation](https://geoman.io/docs/maplibre) — Alternative drawing library (heavier but more features)
- [npm: @geoman-io/maplibre-geoman-free](https://www.npmjs.com/package/@geoman-io/maplibre-geoman-free) — Free version of MapLibre-Geoman
- [MapLibre-Geoman vs Mapbox-GL-Draw](https://geoman.io/blog/maplibre-geoman-vs-mapbox-gl-draw) — Comparison blog post
- [MapLibre Draw Polygon with mapbox-gl-draw](https://maplibre.org/maplibre-gl-js/docs/examples/draw-polygon-with-mapbox-gl-draw/) — Legacy example (deprecated library)

### Tertiary (LOW confidence - needs validation)

- EPSG:28992 proj4 definition — Need to verify official EPSG registry definition for RD New
- Mobile touch event handling in Terra Draw — No official mobile documentation found, needs testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries actively maintained, official MapLibre integration, npm versions verified
- Architecture patterns: HIGH - Existing scan pipeline already supports bbox queries, minimal backend changes needed
- Pitfalls: MEDIUM-HIGH - Coordinate projection needs testing, mobile UX needs validation, area validation critical
- Drawing libraries: HIGH - terra-draw is official recommendation from MapLibre docs, @turf/bbox is industry standard

**Research date:** 2026-02-11
**Valid until:** 2026-04-11 (60 days - stable ecosystem, slow-moving GIS standards)
