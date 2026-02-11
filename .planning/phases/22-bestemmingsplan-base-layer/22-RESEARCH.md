# Phase 22: Bestemmingsplan Base Layer - Research

**Researched:** 2026-02-11
**Domain:** WMS raster tile integration, GetFeatureInfo spatial queries, SVBP2012 zoning standards, and legend UI components for Dutch spatial planning data
**Confidence:** MEDIUM

## Summary

Phase 22 adds a foundational bestemmingsplan (zoning plan) visualization layer to the existing MapLibre map. Users can toggle a WMS raster layer showing color-coded zoning areas per SVBP2012 standards (wonen, bedrijven, agrarisch, groen, etc.), click zones to see plan metadata via GetFeatureInfo, and understand zoning context through a legend component. This layer serves as the visual foundation for Phase 23's area selection workflow and Phase 24's zoning-enriched scanning.

The technical approach leverages PDOK's existing WMS service for ruimtelijke plannen at `https://service.pdok.nl/kadaster/plu/wms/v1_0`. The "Enkelbestemming" (single designation) layer provides color-coded zoning areas that can be rendered as raster tiles directly in MapLibre. GetFeatureInfo requests on click return plan metadata (plan naam, bestemming type, plan link). A custom legend component maps SVBP2012 hoofdgroep colors to category names.

The primary challenge is that SVBP2012 color specifications exist in the official standard but are embedded in PDF figures rather than published as a machine-readable table. The standard references "Figure 2" with RGB values for each hoofdgroep, but extracting these requires manual PDF inspection or reverse-engineering from PDOK's actual WMS rendering. Additionally, the WMS service predates the DSO REST API v4 that Phase 20 uses for detailed zoning data, creating potential format inconsistencies.

**Primary recommendation:** PDOK WMS Enkelbestemming layer as raster source → MapLibre GetFeatureInfo via queryRenderedFeatures + manual fetch → SVBP2012 color legend component (manually extracted RGB values) → Phase 21's LayerToggle pattern for visibility control.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MapLibre GL JS | 5.17.0 (installed) | WMS raster source support, GetFeatureInfo integration | Already integrated (Phase 21), supports WMS via raster source type |
| PDOK WMS | v1_0 (stable) | Government-provided bestemmingsplan WMS service | Official Dutch government spatial data infrastructure, free, no API key, CORS-enabled |
| SVBP2012 | v1.3.2 (current) | Zoning color standard for visual consistency | Legal standard for Dutch spatial planning visualization (Staatscourant 2013) |
| Radix UI Collapsible | Latest (via shadcn/ui) | Legend panel expand/collapse | Accessible UI primitive, already used for sidebar components (Phase 16-17) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx (backend) | Installed | Proxy GetFeatureInfo requests if CORS issues | Only if PDOK WMS CORS headers block direct browser access |
| @turf/boolean-point-in-polygon | 7.3.0 (installed) | Client-side zone boundary checks | For hover effects or zone highlighting before server query |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PDOK WMS raster tiles | DSO REST API v4 vector zones | DSO API provides geometries but requires pagination, coordinate transformation, and client-side rendering — WMS simpler for base layer visualization |
| GetFeatureInfo (click) | Load all zone polygons client-side | 10,000+ zoning areas per gemeente → multi-MB payload, rendering lag, memory pressure — WMS + GetFeatureInfo defers detail fetch until needed |
| Manual color mapping | PDOK SLD style introspection | WMS GetStyles theoretically provides color spec, but PDOK implementation may not expose full SLD — manual mapping more reliable |

**Installation:**
```bash
# Frontend (no new dependencies - all already installed)
# MapLibre GL JS 5.17.0 ✓
# @turf/turf 7.3.0 ✓

# Backend (no new dependencies needed)
# httpx ✓ (only if CORS proxy needed)
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/map/
│   ├── MapView.tsx                     # Existing MapLibre container (Phase 13)
│   ├── LayerToggle.tsx                 # Existing - ADD bestemmingsplan toggle (Phase 13)
│   ├── GemeenteBoundariesLayer.tsx     # Existing gemeente boundaries (Phase 21)
│   ├── BestemmingsplanLayer.tsx        # NEW: WMS raster source + GetFeatureInfo
│   └── BestemmingsplanLegend.tsx       # NEW: SVBP2012 color legend with collapsible panel
├── lib/
│   ├── pdok.ts                         # Existing - ADD WMS endpoint constants (Phase 21)
│   └── svbp2012.ts                     # NEW: SVBP2012 hoofdgroep color mappings
└── types/
    └── bestemmingsplan.ts               # NEW: ZoneFeature, ZoneLegendItem types

backend/app/
└── (no changes needed - WMS direct from frontend)
```

### Pattern 1: WMS Raster Source in MapLibre
**What:** Add PDOK WMS layer as a raster tile source with GetMap requests transformed to MapLibre tile URL template
**When to use:** For government-provided WMS services where raster rendering is acceptable and CORS headers allow direct browser access

**Flow:**
1. Construct WMS GetMap URL template with tile coordinates as parameters
2. Add MapLibre raster source with WMS URL pattern
3. Add raster layer with opacity and minzoom/maxzoom for performance
4. Layer added below property geometry layers but above basemap (satellite/streets)

**Example:**
```typescript
// Source: MapLibre GL JS raster source documentation + PDOK WMS pattern
// https://maplibre.org/maplibre-style-spec/sources/#raster

const WMS_BASE_URL = 'https://service.pdok.nl/kadaster/plu/wms/v1_0'

// Calculate bbox for tile coordinate (Web Mercator EPSG:3857)
function tileToBBox(z: number, x: number, y: number): string {
  const n = Math.pow(2, z)
  const lon_min = (x / n) * 360 - 180
  const lat_min = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI
  const lon_max = ((x + 1) / n) * 360 - 180
  const lat_max = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI
  return `${lon_min},${lat_min},${lon_max},${lat_max}`
}

// MapLibre raster source for WMS
map.addSource('pdok-bestemmingsplan', {
  type: 'raster',
  tiles: [
    `${WMS_BASE_URL}?service=WMS&version=1.3.0&request=GetMap` +
    `&layers=enkelbestemming` +
    `&bbox={bbox-epsg-3857}` +
    `&width=256&height=256` +
    `&crs=EPSG:3857` +
    `&format=image/png` +
    `&transparent=true`
  ],
  tileSize: 256,
  minzoom: 12, // Only show at neighborhood/parcel level
  maxzoom: 18,
})

map.addLayer({
  id: 'bestemmingsplan-layer',
  type: 'raster',
  source: 'pdok-bestemmingsplan',
  paint: {
    'raster-opacity': 0.6, // Semi-transparent to see basemap underneath
  },
}, 'gemeente-fill') // Insert before gemeente boundaries layer
```

**CRITICAL NOTE:** MapLibre's `{bbox-epsg-3857}` placeholder is automatically replaced with tile bounds. Verify PDOK WMS accepts EPSG:3857 (Web Mercator) or use EPSG:4326 with appropriate CRS parameter.

### Pattern 2: GetFeatureInfo on WMS Layer Click
**What:** Translate MapLibre click coordinates to WMS GetFeatureInfo request to fetch zone metadata
**When to use:** For WMS layers where queryable features need to return attribute data on user interaction

**Flow:**
1. User clicks on map → MapLibre click event with lngLat coordinates
2. Convert lngLat to pixel coordinates relative to viewport
3. Construct WMS GetFeatureInfo URL with QUERY_LAYERS, I/J pixel coordinates, and current map bounds
4. Fetch GetFeatureInfo response (XML or JSON depending on INFO_FORMAT)
5. Parse response and display in modal or tooltip

**Example:**
```typescript
// Source: WMS GetFeatureInfo specification + MapLibre point-to-pixel conversion
// https://docs.geoserver.org/stable/en/user/services/wms/reference.html#getfeatureinfo

async function getFeatureInfoAtPoint(
  map: maplibregl.Map,
  lngLat: maplibregl.LngLat
): Promise<ZoneFeature | null> {
  const bounds = map.getBounds()
  const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`

  const size = map.getContainer().getBoundingClientRect()
  const point = map.project(lngLat)

  const url = new URL('https://service.pdok.nl/kadaster/plu/wms/v1_0')
  url.searchParams.set('service', 'WMS')
  url.searchParams.set('version', '1.3.0')
  url.searchParams.set('request', 'GetFeatureInfo')
  url.searchParams.set('layers', 'enkelbestemming')
  url.searchParams.set('query_layers', 'enkelbestemming')
  url.searchParams.set('bbox', bbox)
  url.searchParams.set('width', String(Math.floor(size.width)))
  url.searchParams.set('height', String(Math.floor(size.height)))
  url.searchParams.set('crs', 'EPSG:4326') // Or EPSG:3857 if WMS supports it
  url.searchParams.set('info_format', 'application/json') // Or 'text/xml'
  url.searchParams.set('i', String(Math.floor(point.x))) // WMS 1.3.0 uses I/J
  url.searchParams.set('j', String(Math.floor(point.y)))
  url.searchParams.set('feature_count', '1')

  const response = await fetch(url.toString())
  if (!response.ok) return null

  const data = await response.json()

  // Parse PDOK GetFeatureInfo response structure
  // (exact structure varies by WMS server - may need XML parsing)
  if (data.features && data.features.length > 0) {
    const feature = data.features[0]
    return {
      planNaam: feature.properties.plannaam || 'Onbekend',
      bestemmingType: feature.properties.bestemming || 'Onbekend',
      planLink: feature.properties.planurl || null,
    }
  }

  return null
}

// Click handler on bestemmingsplan layer
map.on('click', 'bestemmingsplan-layer', async (e) => {
  const zoneInfo = await getFeatureInfoAtPoint(map, e.lngLat)
  if (zoneInfo) {
    // Show modal or tooltip with zone info
    showZoneInfoModal(zoneInfo)
  }
})
```

**IMPORTANT:** PDOK GetFeatureInfo response format may be XML by default. Check PDOK documentation for supported `INFO_FORMAT` values (`application/json`, `text/html`, `text/xml`). If only XML available, parse with DOMParser.

### Pattern 3: SVBP2012 Color Legend Component
**What:** Static legend mapping SVBP2012 hoofdgroep colors to category names (wonen, bedrijven, etc.)
**When to use:** For zoning layers that follow standardized color schemes requiring user explanation

**Structure:**
```typescript
// Source: SVBP2012 v1.3.2 standard (Figure 2 - manually extracted)
// Note: These RGB values need to be verified from official SVBP2012 PDF

export const SVBP2012_COLORS = {
  wonen: '#ffcccc', // Residential (light red/pink)
  bedrijven: '#ccccff', // Business/Industrial (light blue/purple)
  agrarisch: '#ffffcc', // Agricultural (light yellow)
  groen: '#ccffcc', // Green/Recreation (light green)
  gemengd: '#ffccff', // Mixed use (light magenta)
  centrumvoorzieningen: '#ffcc99', // Center facilities (light orange)
  water: '#99ccff', // Water (blue)
  verkeer: '#cccccc', // Traffic/Infrastructure (grey)
} as const

type HoofdgroepKey = keyof typeof SVBP2012_COLORS

export const HOOFDGROEP_LABELS: Record<HoofdgroepKey, string> = {
  wonen: 'Wonen',
  bedrijven: 'Bedrijven',
  agrarisch: 'Agrarisch',
  groen: 'Groen',
  gemengd: 'Gemengd',
  centrumvoorzieningen: 'Centrumvoorzieningen',
  water: 'Water',
  verkeer: 'Verkeer',
}

// Legend component using Radix UI Collapsible
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export function BestemmingsplanLegend() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="absolute top-20 right-4 z-[var(--z-map-controls)] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg max-w-xs">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full px-4 py-2 flex items-center justify-between text-sm font-semibold">
          <span>Bestemmingsplan Legenda</span>
          <ChevronDownIcon className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {(Object.keys(SVBP2012_COLORS) as HoofdgroepKey[]).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: SVBP2012_COLORS[key] }}
                />
                <span className="text-xs">{HOOFDGROEP_LABELS[key]}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
```

**CRITICAL TODO:** The SVBP2012_COLORS mapping above is a placeholder. Plan 22-01 MUST verify actual RGB values from official SVBP2012 v1.3.2 PDF (Figure 2) or by inspecting PDOK WMS rendered tiles and reverse-engineering colors.

### Pattern 4: Layer Toggle Integration (Extending Phase 21 Pattern)
**What:** Add bestemmingsplan toggle button to existing LayerToggle component alongside parcels/gemeenten
**When to use:** When adding new overlay layers that users should be able to show/hide independently

**Example:**
```typescript
// In LayerToggle.tsx (extend existing component)
const [showBestemmingsplan, setShowBestemmingsplan] = useState(false)

const handleBestemmingsplanToggle = () => {
  if (!mapRef.current) return

  const map = mapRef.current
  const newShowBestemmingsplan = !showBestemmingsplan

  // If source doesn't exist yet, add it first
  if (!map.getSource('pdok-bestemmingsplan')) {
    addBestemmingsplanLayer(map)
  }

  // Toggle visibility
  setBestemmingsplanVisibility(map, newShowBestemmingsplan)
  setShowBestemmingsplan(newShowBestemmingsplan)

  // Show/hide legend when layer toggled
  if (onBestemmingsplanToggle) {
    onBestemmingsplanToggle(newShowBestemmingsplan)
  }
}

// In render (add after Gemeenten button)
<button
  onClick={handleBestemmingsplanToggle}
  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 ${
    showBestemmingsplan ? 'bg-purple-500/30 text-white shadow-sm' : 'bg-transparent text-white/70 hover:text-white hover:bg-white/10'
  }`}
>
  Bestemmingsplan
</button>
```

### Anti-Patterns to Avoid

- **Don't load WMS layer at high zoom levels (country/province view)**: Bestemmingsplan detail only relevant at gemeente/neighborhood level. Set `minzoom: 12` to avoid overwhelming server and user with irrelevant data.
- **Don't assume GetFeatureInfo returns JSON**: PDOK WMS may default to XML. Always check `INFO_FORMAT` capabilities and handle both XML and JSON parsing.
- **Don't hardcode WMS bbox to EPSG:28992 (Dutch RD grid)**: MapLibre uses EPSG:3857 (Web Mercator) internally. Verify PDOK WMS CRS support and transform coordinates if needed.
- **Don't show legend when layer is hidden**: Legend visibility should mirror layer visibility to avoid confusion. Toggle legend component when layer toggled.
- **Don't query GetFeatureInfo on every mousemove**: Unlike vector layers with feature-state hover, WMS requires server roundtrip. Limit to click events only to avoid rate limiting and poor UX.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVBP2012 color standard | Screen-scrape PDOK WMS tiles to extract colors | Official SVBP2012 v1.3.2 PDF Figure 2 + manual extraction | Color values are standardized by law (Staatscourant 2013) — use authoritative source, not reverse-engineered approximations |
| WMS GetFeatureInfo XML parsing | Custom regex-based XML extractor | DOMParser + XPath or fast-xml-parser library | XML namespaces, nested structures, edge cases — parsing is hard to get right |
| Legend UI component | Custom accordion with CSS animations | Radix UI Collapsible (via shadcn/ui) | Accessibility (ARIA), keyboard navigation, animation states — already integrated from Phase 16-17 |
| Coordinate transformations (EPSG:4326 ↔ 3857 ↔ 28992) | Manual proj4js calculations | MapLibre built-in LngLat.toArray() + PDOK WMS CRS parameter | Datum shifts, precision edge cases, tested implementations |
| WMS tile caching | Custom IndexedDB cache layer | Browser HTTP cache + MapLibre's built-in tile cache | Cache invalidation, storage limits, eviction policies — browsers handle this well |

**Key insight:** WMS integration is mature technology with well-established patterns. The complexity lies in SVBP2012 color mapping (requires manual PDF extraction) and GetFeatureInfo response parsing (varies by server implementation). Focus effort on verifying PDOK-specific response formats rather than reinventing WMS client logic.

## Common Pitfalls

### Pitfall 1: WMS CRS Mismatch Between MapLibre and PDOK
**What goes wrong:** Bestemmingsplan layer renders at wrong location (off by kilometers) or doesn't render at all, console shows WMS errors
**Why it happens:** MapLibre uses EPSG:3857 (Web Mercator) for tile coordinates, but PDOK WMS may expect EPSG:4326 (WGS84) or EPSG:28992 (Dutch RD grid). GetMap bbox parameter must match CRS parameter.
**How to avoid:**
1. Check PDOK WMS GetCapabilities for supported CRS values
2. If EPSG:3857 supported: Use `crs=EPSG:3857` with `{bbox-epsg-3857}` placeholder
3. If only EPSG:4326: Transform tile bounds from 3857 to 4326 before GetMap request
4. Verify rendered layer aligns with gemeente boundaries (known-good EPSG:4326 layer from Phase 21)

**Warning signs:** Layer visible but misaligned, layer disappears when zooming, GetMap returns 400/500 errors

### Pitfall 2: GetFeatureInfo Returns Empty Results for Valid Clicks
**What goes wrong:** User clicks on clearly visible zoning area, but GetFeatureInfo returns no features or empty JSON
**Why it happens:** Pixel coordinates (I/J parameters) don't account for map rotation/bearing, bbox doesn't match GetMap request exactly, or layer not marked queryable in WMS capabilities
**How to avoid:**
1. Verify `query_layers` matches `layers` parameter exactly (e.g., `enkelbestemming`)
2. Use same bbox and size as current viewport (not cached values)
3. Check PDOK GetCapabilities: layer MUST have `queryable="1"` attribute
4. Test GetFeatureInfo with static coordinates first (known zoning area) before dynamic click handler
5. If `feature_count` returns empty, increase to 5-10 to catch edge cases

**Warning signs:** Click handler fires but modal shows "No data", GetFeatureInfo URL returns 200 but empty `features` array

### Pitfall 3: SVBP2012 Color Mismatch Between Legend and Rendered Tiles
**What goes wrong:** Legend shows light blue for "wonen" but WMS tiles render dark blue, confusing users
**Why it happens:** SVBP2012 standard defines RGB values, but PDOK WMS may apply transparency, anti-aliasing, or custom SLD styling that alters displayed colors
**How to avoid:**
1. Extract colors from actual PDOK WMS tiles (screenshot + color picker) rather than SVBP2012 PDF alone
2. Document color source: "Colors approximate SVBP2012 standard as rendered by PDOK WMS"
3. Add opacity slider to legend if PDOK applies transparency by default
4. Test legend on both satellite and street basemaps (colors appear different on dark vs light backgrounds)

**Warning signs:** User feedback "colors don't match", legend items look wrong compared to map, accessibility contrast issues

### Pitfall 4: WMS Layer Blocks Click Events for Underlying Layers
**What goes wrong:** User can't click on gemeente boundaries or property parcels after enabling bestemmingsplan layer
**Why it happens:** Raster layers in MapLibre receive click events before underlying layers. WMS tiles are opaque images that block pointer events even in transparent areas.
**How to avoid:**
1. Set WMS layer paint property: `'raster-opacity': 0.6` to maintain visibility of basemap
2. Use layer ordering: Insert bestemmingsplan layer BELOW gemeente boundaries and property layers
3. For overlapping clicks: Query all layers with `map.queryRenderedFeatures(e.point)` and prioritize based on layer ID
4. Consider adding "Shift+Click for zone info" pattern to avoid click conflicts

**Warning signs:** Gemeente click handler stops working when bestemmingsplan visible, property selection broken, users report "map stopped responding"

### Pitfall 5: Legend Shows Hoofdgroepen Not Present in Current Viewport
**What goes wrong:** Legend displays 10+ hoofdgroep categories but viewport only shows "wonen" and "groen", cluttering UI
**Why it happens:** Static legend component shows all possible SVBP2012 categories regardless of what's actually visible
**How to avoid:**
1. **MVP approach:** Show full static legend (simpler, no WMS metadata parsing needed)
2. **Enhanced approach:** Parse WMS GetLegendGraphic response to show only categories in current plan
3. Document in legend footer: "Showing all SVBP2012 categories — not all may be present in this area"
4. Add collapsible sections: "Common" (wonen, bedrijven, groen) vs "Other" (infrequent categories)

**Warning signs:** Legend taller than viewport, user scrolls past irrelevant categories, legend feels cluttered

### Pitfall 6: GetFeatureInfo Performance Degrades on Rapid Clicks
**What goes wrong:** User clicks multiple zones rapidly, browser freezes or shows stale data from previous clicks
**Why it happens:** Each GetFeatureInfo is a synchronous HTTP request. Rapid clicks create request queue, older responses overwrite newer ones due to race conditions.
**How to avoid:**
1. Debounce click handler: Wait 200ms after last click before firing GetFeatureInfo
2. Cancel pending requests: Use AbortController to abort in-flight requests when new click occurs
3. Show loading state: Display spinner in modal/tooltip while GetFeatureInfo pending
4. Cache GetFeatureInfo results: Key by rounded lngLat coordinates (100m grid) to avoid duplicate requests for nearby clicks

**Warning signs:** Modal shows wrong zone info, multiple modals open simultaneously, console shows cancelled request warnings

## Code Examples

Verified patterns from official sources:

### WMS Raster Source with Tile URL Template
```typescript
// Source: MapLibre GL JS raster source documentation
// https://maplibre.org/maplibre-style-spec/sources/#raster

const PDOK_WMS_BASE = 'https://service.pdok.nl/kadaster/plu/wms/v1_0'

export function addBestemmingsplanLayer(map: maplibregl.Map): void {
  // Guard: source already exists
  if (map.getSource('pdok-bestemmingsplan')) {
    return
  }

  // Add WMS raster source
  map.addSource('pdok-bestemmingsplan', {
    type: 'raster',
    tiles: [
      `${PDOK_WMS_BASE}?` +
      'service=WMS&version=1.3.0&request=GetMap' +
      '&layers=enkelbestemming' +
      '&bbox={bbox-epsg-3857}' +
      '&width=256&height=256' +
      '&crs=EPSG:3857' +
      '&format=image/png' +
      '&transparent=true'
    ],
    tileSize: 256,
    minzoom: 12,
    maxzoom: 18,
  })

  // Determine insertion point (before gemeente boundaries if they exist)
  const beforeLayer = map.getLayer('gemeente-fill')
    ? 'gemeente-fill'
    : undefined

  // Add raster layer with semi-transparent rendering
  map.addLayer(
    {
      id: 'bestemmingsplan-layer',
      type: 'raster',
      source: 'pdok-bestemmingsplan',
      paint: {
        'raster-opacity': 0.6,
      },
    },
    beforeLayer
  )
}

export function setBestemmingsplanVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none'

  if (map.getLayer('bestemmingsplan-layer')) {
    map.setLayoutProperty('bestemmingsplan-layer', 'visibility', visibility)
  }
}
```

### GetFeatureInfo Click Handler with Abort Control
```typescript
// Source: WMS GetFeatureInfo specification + AbortController pattern
// https://developer.mozilla.org/en-US/docs/Web/API/AbortController

interface ZoneFeatureInfo {
  planNaam: string
  bestemmingType: string
  planLink: string | null
}

let currentAbortController: AbortController | null = null

async function fetchZoneInfo(
  map: maplibregl.Map,
  lngLat: maplibregl.LngLat
): Promise<ZoneFeatureInfo | null> {
  // Cancel previous request if still pending
  if (currentAbortController) {
    currentAbortController.abort()
  }

  currentAbortController = new AbortController()

  try {
    const bounds = map.getBounds()
    const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`

    const size = map.getContainer().getBoundingClientRect()
    const point = map.project(lngLat)

    const url = new URL('https://service.pdok.nl/kadaster/plu/wms/v1_0')
    url.searchParams.set('service', 'WMS')
    url.searchParams.set('version', '1.3.0')
    url.searchParams.set('request', 'GetFeatureInfo')
    url.searchParams.set('layers', 'enkelbestemming')
    url.searchParams.set('query_layers', 'enkelbestemming')
    url.searchParams.set('bbox', bbox)
    url.searchParams.set('width', String(Math.floor(size.width)))
    url.searchParams.set('height', String(Math.floor(size.height)))
    url.searchParams.set('crs', 'EPSG:4326')
    url.searchParams.set('info_format', 'application/json') // Or text/xml if JSON not supported
    url.searchParams.set('i', String(Math.floor(point.x)))
    url.searchParams.set('j', String(Math.floor(point.y)))
    url.searchParams.set('feature_count', '1')

    const response = await fetch(url.toString(), {
      signal: currentAbortController.signal,
    })

    if (!response.ok) {
      throw new Error(`GetFeatureInfo failed: ${response.statusText}`)
    }

    const data = await response.json()

    // Parse PDOK-specific response structure
    // NOTE: Actual structure needs verification from PDOK GetFeatureInfo response
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      return {
        planNaam: feature.properties?.plannaam || 'Onbekend plan',
        bestemmingType: feature.properties?.bestemming || 'Onbekend',
        planLink: feature.properties?.planurl || null,
      }
    }

    return null
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Request cancelled - expected behavior
      return null
    }
    console.error('GetFeatureInfo error:', error)
    return null
  } finally {
    currentAbortController = null
  }
}

export function setupBestemmingsplanClickHandler(
  map: maplibregl.Map,
  onZoneClick: (info: ZoneFeatureInfo) => void
): void {
  map.on('click', 'bestemmingsplan-layer', async (e) => {
    const zoneInfo = await fetchZoneInfo(map, e.lngLat)

    if (zoneInfo) {
      onZoneClick(zoneInfo)
    }
  })

  // Change cursor on hover
  map.on('mouseenter', 'bestemmingsplan-layer', () => {
    map.getCanvas().style.cursor = 'pointer'
  })

  map.on('mouseleave', 'bestemmingsplan-layer', () => {
    map.getCanvas().style.cursor = ''
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WFS vector download + client-side rendering | WMS raster tiles for base visualization | PDOK WFS deprecated July 2024 | WMS simpler for large-area visualization, WFS still used via DSO REST API v4 for detail queries |
| IMRO2008 standards | IMRO2012 + SVBP2012 v1.3.2 | Legal requirement since 2012 | Color standardization enables consistent legend across all Dutch municipalities |
| TAM-IMRO (temporary measure) | STOP/TPOD Omgevingsplan | TAM-IMRO ends January 1, 2026 | Dual format support needed: IMRO for old plans, STOP for new omgevingsplannen |
| Manual bestemmingsplan PDF review | DSO REST API v4 + WMS visualization | DSO API live 2024 | API enables programmatic access, but requires API key (blocker for Phase 26) |
| Mapbox GL JS proprietary | MapLibre GL JS open-source | Propdex using MapLibre 5.17.0 (Phase 21) | No migration needed, WMS raster source pattern identical |

**Deprecated/outdated:**
- **PDOK WFS for ruimtelijke plannen**: Deprecated July 2024, replaced by DSO REST API v4 and WMS v1_0
- **IMRO2008**: Superseded by IMRO2012, though old plans may still use 2008 format
- **TAM-IMRO omgevingsplannen**: No new plans after January 1, 2026 — existing procedures grandfathered until completion
- **Ruimtelijkeplannen.nl direct access**: Now proxied through DSO Omgevingswet infrastructure

## Open Questions

1. **PDOK WMS GetFeatureInfo Response Format**
   - What we know: PDOK WMS v1_0 supports GetFeatureInfo, but documentation doesn't specify response structure or property names
   - What's unclear: Does `INFO_FORMAT=application/json` return GeoJSON FeatureCollection, or custom JSON structure? What are exact property keys for plan naam, bestemming type, plan URL?
   - Recommendation: Plan 22-02 MUST include discovery step: execute sample GetFeatureInfo request on known zoning area, inspect actual response, document structure in implementation notes

2. **SVBP2012 Color Specification RGB Values**
   - What we know: SVBP2012 v1.3.2 defines standardized colors in Figure 2, but PDF extraction failed to retrieve RGB table
   - What's unclear: Exact hex/RGB values for each hoofdgroep (wonen, bedrijven, agrarisch, etc.), whether PDOK WMS applies modifications (transparency, gamma)
   - Recommendation: Plan 22-03 MUST manually extract colors from official SVBP2012 PDF or reverse-engineer from PDOK WMS rendered tiles via screenshot + color picker tool

3. **PDOK WMS CORS Headers for Direct Browser Access**
   - What we know: PDOK WMTS services are CORS-enabled (verified in Phase 21), WMS likely same infrastructure
   - What's unclear: Whether GetFeatureInfo endpoint allows direct browser fetch or requires backend proxy
   - Recommendation: Test direct fetch first (simpler), add backend proxy endpoint only if CORS blocked

4. **Layer Visibility Control UX Pattern**
   - What we know: LayerToggle component (Phase 21) supports parcels and gemeenten toggles, bestemmingsplan would be third overlay
   - What's unclear: Should legend visibility follow layer visibility automatically, or remain independently controllable? Should legend be collapsible by default or always expanded?
   - Recommendation: Auto-hide legend when layer hidden (fewer controls), collapsible by default (saves screen space), user preference persists to localStorage

5. **Hoofdgroep Coverage in PDOK WMS**
   - What we know: SVBP2012 defines 10+ hoofdgroep categories, but not all municipalities use all categories
   - What's unclear: Does PDOK WMS layer aggregate all plans' hoofdgroepen, or does GetLegendGraphic provide per-plan legend?
   - Recommendation: Static full legend for MVP (simpler), investigate dynamic legend in future phase if user testing shows clutter issues

6. **STOP/TPOD vs IMRO Format Handling**
   - What we know: TAM-IMRO ends January 1, 2026, new omgevingsplannen use STOP/TPOD format
   - What's unclear: Does PDOK WMS layer show both IMRO bestemmingsplannen and STOP omgevingsplannen with unified SVBP2012 colors, or do they require separate layers?
   - Recommendation: Assume unified WMS layer for MVP (simpler), document format in GetFeatureInfo response, handle dual formats if needed in Phase 24 enrichment

## Sources

### Primary (HIGH confidence)
- **PDOK WMS Ruimtelijke Plannen** - Official WMS service for bestemmingsplannen
  - [PDOK Introductie Ruimtelijke Plannen](https://www.pdok.nl/introductie/-/article/ruimtelijke-plannen)
  - [PDOK OGC Webservices Ruimtelijke Plannen](https://www.pdok.nl/ogc-webservices/-/article/ruimtelijke-plannen)
  - [PDOK WMS GetCapabilities](https://service.pdok.nl/kadaster/plu/wms/v1_0?request=getcapabilities&service=wms)
- **MapLibre GL JS v5 Documentation** - Raster source, layer styling, event handlers
  - [MapLibre Raster Source](https://maplibre.org/maplibre-style-spec/sources/#raster)
  - [MapLibre GL JS Examples](https://maplibre.org/maplibre-gl-js/docs/examples/)
- **SVBP2012 Standard** - Official Dutch zoning plan visualization standard
  - [SVBP2012 v1.3.2 Documentation](https://docs.geostandaarden.nl/ro/svbp/)
  - [SVBP2012 Functielijst](https://docs.geostandaarden.nl/ro/SVBPfunctielijst/)
  - [SVBP2012 v1.3.1 PDF (Staatscourant 2013)](https://ro-standaarden.geonovum.nl/2012/SVBP/1.3/SVBP2012-v1.3.1.pdf)
- **Propdex Phase 21 Implementation** - Existing MapLibre setup, layer patterns
  - `frontend/src/components/map/GemeenteBoundariesLayer.tsx` - GeoJSON layer pattern
  - `frontend/src/components/map/LayerToggle.tsx` - Layer visibility control
  - `frontend/src/lib/pdok.ts` - PDOK service constants

### Secondary (MEDIUM confidence)
- **DSO Ruimtelijke Plannen REST API v4** - Successor to deprecated WFS, provides detailed zoning data
  - [Developer Overheid API Register](https://apis.developer.overheid.nl/apis/dso-ruimtelijke-plannen-opvragen)
  - [Ruimtelijke Plannen API 4.1.1 Documentation](https://redocly.github.io/redoc/?url=https%3A%2F%2Fruimte.omgevingswet.overheid.nl%2Fruimtelijke-plannen%2Fapi%2Fopvragen%2Fv4%2F)
  - [DSO API Key Request Portal](https://developer.omgevingswet.overheid.nl/api-register/api/rp-opvragen/)
- **WMS Specification** - OGC GetMap and GetFeatureInfo protocols
  - [OGC WMS 1.3.0 Standard](https://www.ogc.org/standard/wms/)
  - [Uitleg WMS, WFS en tiled services (Kadaster)](https://www.ruimtelijkeplannen.nl/web-roo/docs/afnemers/Uitleg_WMS_WFS_en_tiled_services.pdf)
- **MapLibre Legend Components** - Community libraries for legend UI
  - [MapLibre Plugins](https://maplibre.org/maplibre-gl-js/docs/plugins/)
  - [watergis/maplibre-gl-legend](https://github.com/watergis/maplibre-gl-legend)
  - [Custom MapLibre Layer Control (blog)](https://blog.wxm.be/2024/01/24/maplibre-layer-visibility-control.html)

### Tertiary (LOW confidence - requires validation in implementation)
- **SVBP2012 Color RGB Values** - Mentioned in standard but not extracted from PDF
- **PDOK GetFeatureInfo JSON Format** - Inferred from WMS spec, needs verification with actual response
- **TAM-IMRO End Date Impact** - Legal requirement confirmed, but PDOK WMS handling unclear
- **STOP/TPOD Color Standardization** - Assumption that STOP follows SVBP2012 colors, not officially documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PDOK WMS verified via GetCapabilities, MapLibre raster source documented, SVBP2012 legally mandated
- Architecture patterns: MEDIUM - WMS integration well-established, but PDOK-specific response formats need discovery
- Pitfalls: MEDIUM - Based on common WMS issues (CRS mismatches, GetFeatureInfo edge cases) and MapLibre layer ordering principles
- SVBP2012 colors: LOW - Standard exists but RGB values require manual PDF extraction or reverse-engineering from rendered tiles

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days - PDOK WMS stable, but DSO API evolving, TAM-IMRO deadline passed January 1, 2026)

**Key assumptions:**
1. PDOK WMS v1_0 is stable and will remain available through Phase 22-24 implementation (very likely, government infrastructure)
2. GetFeatureInfo returns queryable plan metadata (verified from GetCapabilities `queryable="1"` attribute)
3. SVBP2012 v1.3.2 colors are rendered by PDOK WMS without major modifications (assumption - needs verification)
4. MapLibre 5.17.0 WMS raster source works with PDOK endpoints (very likely, standard WMS protocol)
5. No API key required for PDOK WMS GetMap/GetFeatureInfo (verified for other PDOK services, assumed for WMS)

**Critical blockers for planning:**
- SVBP2012 RGB color values MUST be extracted before Plan 22-03 (legend component)
- PDOK GetFeatureInfo response format MUST be verified before Plan 22-02 (click handler)
- DSO REST API v4 key request needed before Phase 26 (change monitoring), but NOT blocking for Phase 22-24
