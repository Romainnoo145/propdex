# Phase 21: Map Visualization - Research

**Researched:** 2026-02-10
**Domain:** Interactive web mapping with vector tiles, spatial data visualization, and real-time background job monitoring
**Confidence:** HIGH

## Summary

Phase 21 transforms the existing address-based map into an area intelligence visualization platform. Users select a gemeente from CBS boundaries, trigger an area scan (Phase 20 backend), and watch as the map transitions from static WMS raster tiles to interactive vector tiles showing scored parcels with color-coded development potential. The frontend polls the scan API for progress updates and renders a progress bar with phase indicators while the background job runs.

The technical foundation is solid: MapLibre GL JS 5.17.0 is already integrated (from Phase 13-15), Phase 20's REST API provides all required endpoints (`POST /api/scans`, `GET /api/scans/{id}`, `GET /api/scans/{id}/results`), and Phase 18's PostGIS spatial database holds the parcel geometries. The challenge is orchestrating four new layers (CBS gemeente boundaries, PDOK vector parcel tiles, Martin-served colored score tiles, and scan progress UI) while maintaining the existing property lookup flow.

**Primary recommendation:** CBS WFS for gemeente boundaries → MapLibre GeoJSON click handlers → TanStack Query polling with `refetchInterval` → PDOK vector tiles for parcel outlines → Martin tile server (Docker) for score overlay → Radix UI progress bar (via shadcn/ui pattern).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MapLibre GL JS | 5.17.0 (installed) | Vector tile rendering, user interaction | Industry standard for open-source web mapping, GPU-accelerated, already integrated |
| TanStack Query | 5.90.20 (installed) | Polling with `refetchInterval`, scan status management | Already used for property lookup, built-in polling, auto-cleanup on unmount |
| Martin Tile Server | 1.3.0+ (Docker: `ghcr.io/maplibre/martin`) | PostGIS → MVT vector tiles with custom styling | MapLibre official tile server, optimized for PostGIS 3.0+, production-ready Rust performance |
| PDOK OGC APIs | CBS 2026 WFS v1_0, Kadaster OGC API Tiles v1 | Government boundary + parcel data sources | Official Dutch government geospatial infrastructure, free, no API key |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GeoJSON | Built-in | CBS gemeente boundary rendering | MapLibre native GeoJSON source for clickable polygons |
| Radix UI Progress | Latest (via shadcn/ui pattern) | Scan progress bar component | Accessible progress indicator with proper ARIA attributes |
| openpyxl | 3.1.2+ (backend, installed) | Excel export (Phase 20-06) | Already integrated for filtered result export |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Martin | pg_tileserv | pg_tileserv easier setup but Martin better performance, MapLibre ecosystem support, and more flexible styling |
| PDOK vector tiles | PDOK WMS raster tiles | Already using WMS for property parcels (Phase 15), but vector tiles enable click/hover interaction and sharper rendering at any zoom |
| TanStack Query polling | WebSockets | Polling simpler (no server changes, works with REST API from Phase 20), adequate UX for 5-15 minute scan duration |

**Installation:**
```bash
# Frontend (no new dependencies - already installed)
# MapLibre GL JS 5.17.0 ✓
# TanStack Query 5.90.20 ✓

# Backend (Martin tile server via Docker)
# Add to docker-compose.yml:
services:
  martin:
    image: ghcr.io/maplibre/martin:1.3.0
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://app_role:${DATABASE_PASSWORD}@postgres:5432/propdex
    depends_on:
      - postgres
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/map/
│   ├── MapView.tsx                     # Existing MapLibre container (Phase 13)
│   ├── LayerToggle.tsx                 # Existing layer switcher (Phase 13)
│   ├── ParcelBoundariesLayer.tsx       # Existing WMS layer (Phase 15) - keep for property lookup
│   ├── GemeenteBoundariesLayer.tsx     # NEW: CBS WFS → GeoJSON → MapLibre source
│   ├── ParcelVectorTileLayer.tsx       # NEW: PDOK vector tiles (replaces WMS for scan areas)
│   ├── ParcelScoreLayer.tsx            # NEW: Martin tile server vector overlay
│   └── ScanProgressOverlay.tsx         # NEW: Progress bar + phase indicator UI
├── hooks/
│   ├── useScans.ts                     # NEW: TanStack Query hooks for scan CRUD
│   └── useScanPolling.ts               # NEW: Poll scan status with refetchInterval
└── lib/
    ├── api.ts                          # Existing - ADD scan endpoints
    └── types/scan.ts                   # NEW: ScanCreateRequest, ScanStatusResponse, etc.

backend/app/
├── scans/
│   ├── router.py                       # ✓ Already implemented (Phase 20-05)
│   ├── service.py                      # ✓ Already implemented (Phase 20-03/04)
│   └── schemas.py                      # ✓ Already implemented (Phase 20-05)
└── services/
    └── gemeente_service.py             # ✓ Already implemented (Phase 20-01)

docker-compose.yml                       # ADD Martin tile server service
```

### Pattern 1: CBS Gemeente Boundaries (GeoJSON Source + Click Handler)
**What:** Fetch CBS WFS gemeente polygons, convert to GeoJSON, render as selectable layer, attach click handler to trigger scans
**When to use:** For area selection UI where user clicks a region to initiate batch processing

**Flow:**
1. Fetch CBS WFS GetFeature for gemeente layer (EPSG:28992 or EPSG:4326)
2. Parse WFS response → transform to GeoJSON FeatureCollection
3. Add MapLibre GeoJSON source + fill layer with hover/click styling
4. Attach `map.on('click', 'gemeente-layer')` → extract gemeente_code/naam from feature properties → trigger scan API

**Example:**
```typescript
// Source: MapLibre GL JS examples + PDOK CBS WFS
// https://maplibre.org/maplibre-gl-js/docs/examples/

const response = await fetch(
  'https://service.pdok.nl/cbs/gebiedsindelingen/2026/wfs/v1_0?' +
  'service=WFS&version=2.0.0&request=GetFeature' +
  '&typeName=gebiedsindelingen:gemeente_gegeneraliseerd' +
  '&outputFormat=application/json&srsName=EPSG:4326'
)
const geojson = await response.json()

map.addSource('cbs-gemeenten', {
  type: 'geojson',
  data: geojson,
})

map.addLayer({
  id: 'gemeente-fill',
  type: 'fill',
  source: 'cbs-gemeenten',
  paint: {
    'fill-color': '#4A90E2',
    'fill-opacity': ['case',
      ['boolean', ['feature-state', 'hover'], false],
      0.6,
      0.3
    ],
  },
})

map.on('click', 'gemeente-fill', (e) => {
  const feature = e.features?.[0]
  if (feature?.properties) {
    triggerScan({
      gemeente_code: feature.properties.statcode, // CBS gemeentecode
      gemeente_naam: feature.properties.statnaam,
    })
  }
})
```

### Pattern 2: PDOK Vector Tiles for Parcel Boundaries
**What:** Replace WMS raster tiles with PDOK vector tiles for click/hover interaction and sharper rendering
**When to use:** For scan areas where user needs to interact with individual parcels (click to view detail, hover for preview)

**Why vector over WMS:**
- Click detection: `map.queryRenderedFeatures()` on vector layers returns feature properties (parcel ID, address)
- Hover effects: Feature state for visual feedback without re-rendering entire layer
- Sharp at any zoom: Vector data scales to display resolution, no pixelation
- Smaller payload: MVT protocol more efficient than PNG tiles for detailed boundary data

**Example:**
```typescript
// Source: PDOK Kadaster OGC API Tiles
// https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1

map.addSource('pdok-parcels-vector', {
  type: 'vector',
  tiles: [
    'https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/' +
    'tiles/WebMercatorQuad/{z}/{x}/{y}?f=mvt'
  ],
  minzoom: 15,
  maxzoom: 20,
})

map.addLayer({
  id: 'parcel-boundaries-vector',
  type: 'line',
  source: 'pdok-parcels-vector',
  'source-layer': 'perceel', // Layer name from MVT tileset
  paint: {
    'line-color': '#333',
    'line-width': 1,
  },
})

// Click handler for parcel detail
map.on('click', 'parcel-boundaries-vector', (e) => {
  const features = map.queryRenderedFeatures(e.point, {
    layers: ['parcel-boundaries-vector']
  })
  if (features.length > 0) {
    const parcel = features[0]
    // Open parcel detail modal with parcel.properties.id
  }
})
```

### Pattern 3: Martin Tile Server for Score-Based Color Overlay
**What:** Serve parcel_cache PostGIS table as vector tiles with data-driven color styling based on score/category
**When to use:** For custom spatial data visualization where color coding reflects business logic (development scores, risk levels, demand heatmaps)

**Martin configuration:**
```yaml
# Martin auto-detects PostGIS tables with geometry columns
# Requires: parcel_cache table with GIST-indexed geometry column (✓ Phase 18)

# Martin generates tile endpoint:
# http://localhost:3000/parcel_cache/{z}/{x}/{y}.pbf

# MapLibre data-driven styling:
map.addSource('parcel-scores', {
  type: 'vector',
  tiles: ['http://localhost:3000/parcel_cache/{z}/{x}/{y}.pbf'],
  minzoom: 12,
  maxzoom: 18,
})

map.addLayer({
  id: 'parcel-score-overlay',
  type: 'fill',
  source: 'parcel-scores',
  'source-layer': 'parcel_cache', // Martin uses table name as layer
  paint: {
    'fill-color': [
      'interpolate',
      ['linear'],
      ['get', 'score'], // Read score property from vector tile
      0, '#dc2626',    // Red: Low score
      50, '#f59e0b',   // Orange: Medium
      100, '#10b981'   // Green: High score
    ],
    'fill-opacity': 0.7,
  },
  filter: ['has', 'score'], // Only show scored parcels
})
```

**Multi-tenant isolation:**
Martin serves entire table → frontend MUST filter by `organization_id` via query param or backend proxy layer:
```typescript
// Option 1: Backend proxy endpoint
GET /api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf
// → Queries parcel_cache WHERE scan_id IN (SELECT id FROM area_scans WHERE organization_id = ?)

// Option 2: Martin filter (if supported)
tiles: [`http://localhost:3000/parcel_cache/{z}/{x}/{y}.pbf?filter=organization_id:${orgId}`]
```

**Recommendation:** Backend proxy for security (don't expose Martin directly to frontend). Add tile endpoint to `scans/router.py`.

### Pattern 4: TanStack Query Polling for Scan Progress
**What:** Use `refetchInterval` to poll scan status while job is running, stop polling when completed/failed
**When to use:** For long-running background jobs (5-15 min) where real-time WebSocket overhead is unnecessary

**Example:**
```typescript
// Source: TanStack Query documentation
// https://tanstack.com/query/v4/docs/framework/react/reference/useQuery

export function useScanPolling(scanId: string | null) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['scan-status', scanId],
    queryFn: () => fetchScanStatus(scanId!, accessToken),
    enabled: !!scanId, // Only poll when scanId exists
    refetchInterval: (data) => {
      // Stop polling when scan complete/failed
      if (!data || data.status === 'completed' || data.status === 'failed') {
        return false
      }
      // Poll every 2 seconds while running
      return 2000
    },
    refetchIntervalInBackground: true, // Keep polling even if tab not focused
  })
}

// Usage in component:
const { data: scanStatus } = useScanPolling(activeScanId)

// Render progress bar:
{scanStatus?.status === 'running' && (
  <Progress value={scanStatus.progress_pct} max={100} />
  <p>Phase: {scanStatus.current_phase}</p>
)}
```

### Pattern 5: Scan Progress Overlay UI
**What:** Fixed-position overlay showing progress bar, phase name, parcel counts, with ability to cancel
**When to use:** For operations where user needs status visibility without blocking map interaction

**Structure:**
```typescript
// Radix UI Progress pattern (via shadcn/ui)
<div className="fixed top-20 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-lg p-4 z-50">
  <div className="flex items-center gap-4">
    <Spinner />
    <div className="flex-1 min-w-[300px]">
      <div className="flex justify-between text-sm mb-2">
        <span>{phaseLabel(scanStatus.current_phase)}</span>
        <span>{scanStatus.progress_pct}%</span>
      </div>
      <Progress value={scanStatus.progress_pct} max={100} />
      <div className="text-xs text-gray-600 mt-2">
        {scanStatus.parcels_processed} / {scanStatus.parcels_total} parcels
        {scanStatus.parcels_failed > 0 && (
          <span className="text-amber-600"> ({scanStatus.parcels_failed} failed)</span>
        )}
      </div>
    </div>
    <Button variant="ghost" size="sm" onClick={handleCancelScan}>
      Cancel
    </Button>
  </div>
</div>

function phaseLabel(phase: string | null): string {
  switch (phase) {
    case 'fetching_parcels': return 'Fetching parcels from Kadaster...'
    case 'cross_referencing_bag': return 'Cross-referencing buildings...'
    case 'querying_bestemmingen': return 'Checking zoning rules...'
    default: return 'Starting scan...'
  }
}
```

### Anti-Patterns to Avoid

- **Don't add gemeente click handlers before existing property lookup layers**: Existing property lookup should take precedence. Add gemeente layer below property geometry layers in layer stack.
- **Don't fetch entire CBS gemeenten dataset on map load**: Load on-demand when user zooms to NL viewport or triggers "area scan mode" toggle.
- **Don't poll faster than 1 request/second**: Phase 20's rate limiter allows 60 req/min for status endpoint. 2-second interval = safe margin.
- **Don't show Martin tiles before scan completes**: Only add `parcel-score-overlay` layer after scan status = 'completed' and results exist.
- **Don't forget to clean up polling on unmount**: TanStack Query handles this automatically, but verify with custom hooks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector tile serving from PostGIS | Custom Python MVT encoder + Flask | Martin tile server | Handles tile caching, concurrent requests, SQL injection safety, GIST index optimization -- production-hardened Rust performance |
| Progress bar with accessibility | Custom div + CSS animations | Radix UI Progress (via shadcn/ui) | ARIA attributes, screen reader announcements, state management, keyboard focus -- accessibility is complex |
| Coordinate transformations (EPSG:28992 ↔ 4326) | Manual proj4 calculations | pyproj (backend) + PostGIS ST_Transform | Edge cases near datum boundaries, precision requirements, tested implementations |
| Vector tile click detection | Custom raycasting / bounding box math | `map.queryRenderedFeatures()` | GPU-accelerated, handles tile boundaries, accounts for rotation/pitch, returns exact features |
| Long polling state management | useEffect + setInterval | TanStack Query `refetchInterval` | Auto-cleanup, request deduplication, background refetch, cache invalidation -- polling is hard to get right |

**Key insight:** Spatial data visualization tooling is mature and battle-tested. Martin + MapLibre + TanStack Query handle 90% of implementation complexity. Focus effort on UX flow (gemeente selection → scan trigger → progress → result visualization) rather than infrastructure plumbing.

## Common Pitfalls

### Pitfall 1: Vector Tile Layer Ordering Conflicts
**What goes wrong:** Adding parcel score layer interferes with existing property lookup click handlers, or gemeente click triggers unintended scans
**Why it happens:** MapLibre click events propagate through layer stack. Top layer (drawn last) receives event first. Property lookup and gemeente selection both use click handlers on overlapping geometries.
**How to avoid:**
1. Use layer IDs consistently: `gemeente-*` for area layer, `property-*` for property lookup, `scan-*` for scan results
2. Add gemeente layer BELOW property layers in stack: `map.addLayer(gemeenteLayer, beforeId: 'property-fill')`
3. Stop event propagation in property click handler: `e.preventDefault()` to prevent gemeente handler from firing
4. Use layer filters to show/hide based on mode: Filter gemeente layer when property detail drawer is open

**Warning signs:** Double-triggers, click events firing on wrong features, layers disappearing when new ones added

### Pitfall 2: CBS WFS Coordinate System Mismatch
**What goes wrong:** Gemeente boundaries render at wrong location (off by hundreds of km) or don't render at all
**Why it happens:** CBS WFS default CRS is EPSG:28992 (Dutch RD grid), but MapLibre uses EPSG:4326 (WGS84 lat/lon) and EPSG:3857 (Web Mercator) internally. GeoJSON must be in EPSG:4326.
**How to avoid:**
1. Always request EPSG:4326 from CBS WFS: Add `&srsName=EPSG:4326` to GetFeature URL
2. Verify GeoJSON coordinates: First coordinate should be ~4-7° E (longitude), second ~50-54° N (latitude) for Netherlands
3. If stuck with EPSG:28992 response: Transform on backend with `ST_Transform(geometry, 4326)` before sending to frontend

**Warning signs:** Boundaries render near Africa, console errors about invalid coordinates, layer doesn't appear but no errors

### Pitfall 3: Martin Tile Server Multi-Tenant Data Leakage
**What goes wrong:** User from Organization A sees parcel scores from Organization B's scans
**Why it happens:** Martin serves entire PostGIS table as tiles. No built-in RLS or filtering. Frontend can request any tile coordinates and see all data.
**How to avoid:**
1. **DO NOT expose Martin directly to frontend** -- put behind authenticated proxy
2. Add tile endpoint to FastAPI scans router: `GET /api/scans/{scan_id}/tiles/{z}/{x}/{y}.pbf`
3. Backend validates scan ownership: `WHERE scan.organization_id = current_org_id`
4. Query parcel_cache with organization filter: `WHERE organization_id = ?`
5. Generate MVT tile with filtered data only
6. Consider PostGIS RLS policies on parcel_cache table for defense-in-depth

**Warning signs:** User sees parcels outside their gemeente scan, parcel count doesn't match scan results, different colors than expected

### Pitfall 4: Polling Continues After Scan Complete
**What goes wrong:** Frontend keeps polling status endpoint every 2 seconds even after scan finishes, wasting API calls and hitting rate limits
**Why it happens:** TanStack Query `refetchInterval` continues unless explicitly disabled. Status check response doesn't update query key, so interval persists.
**How to avoid:**
1. Use function form of `refetchInterval`: Return `false` to stop polling
2. Check status in interval function: `(data) => (data?.status === 'running' ? 2000 : false)`
3. Also stop on error: `(data, query) => (query.state.error ? false : ...)`
4. Test unmount cleanup: Verify polling stops when component unmounts (TanStack Query handles this, but test it)

**Warning signs:** Console shows repeated API calls after scan done, rate limit errors after completing scan, network tab shows ongoing requests

### Pitfall 5: Progress Bar Percentage Jumps Backwards
**What goes wrong:** Progress bar animates from 60% → 40% → 80%, confusing users and breaking trust
**Why it happens:** Backend calculates progress differently across phases (e.g., "fetching parcels" might complete at 30%, "querying bestemmingen" starts at 0% relative to that phase)
**How to avoid:**
1. **Backend must calculate cumulative percentage**: Each phase has weight, progress = sum of (completed phase weights) + (current phase weight × current phase progress)
2. Example weights: fetching_parcels (40%), cross_referencing_bag (30%), querying_bestemmingen (30%)
3. Never decrement `progress_pct` in backend: Assert new value >= previous value before update
4. Frontend can smooth jumps: Use CSS transition or animate from `prevProgress` to `data.progress_pct` over 500ms

**Warning signs:** Progress bar visually jerks backwards, user reports confusing status, `progress_pct` value decreases between polls

### Pitfall 6: PDOK Vector Tiles Missing Feature Properties
**What goes wrong:** Click on parcel vector tile feature, but `feature.properties` is empty or missing parcel_id/address
**Why it happens:** PDOK vector tiles only include subset of properties in MVT format (to reduce tile size). Parcel ID may be in different property key than expected.
**How to avoid:**
1. Inspect PDOK tile response to identify available properties: Open Network tab → find .pbf request → decode MVT to see properties
2. Map PDOK properties to app schema: PDOK uses `identificatie` for parcel ID, not `id` or `parcel_id`
3. For missing data: Store PDOK parcel ID → query backend API for full parcel detail
4. Don't rely on vector tiles for full data: Use tiles for rendering/interaction, API for complete information

**Warning signs:** Click handlers return undefined properties, hover tooltips show "Unknown", parcel detail modal can't load data

## Code Examples

Verified patterns from official sources:

### Triggering Scan from Gemeente Click
```typescript
// Source: Phase 20 backend schemas + MapLibre examples
import { useMutation } from '@tanstack/react-query'
import type { ScanCreateRequest, ScanResponse } from '@/lib/types/scan'

async function triggerScan(
  request: ScanCreateRequest,
  accessToken: string | null
): Promise<ScanResponse> {
  return apiFetch<ScanResponse>('/api/scans', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(request),
  })
}

export function useGemeenteSelection(map: maplibregl.Map) {
  const { accessToken } = useAuth()
  const triggerMutation = useMutation({
    mutationFn: (request: ScanCreateRequest) => triggerScan(request, accessToken),
  })

  useEffect(() => {
    if (!map) return

    const handleGemeenteClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['gemeente-fill'],
      })

      if (features.length > 0) {
        const feature = features[0]
        triggerMutation.mutate({
          gemeente_code: feature.properties.statcode,
          gemeente_naam: feature.properties.statnaam,
          force_rescan: false,
        })
      }
    }

    map.on('click', 'gemeente-fill', handleGemeenteClick)
    return () => {
      map.off('click', 'gemeente-fill', handleGemeenteClick)
    }
  }, [map, triggerMutation])

  return {
    triggerScan: triggerMutation.mutate,
    isPending: triggerMutation.isPending,
    activeScanId: triggerMutation.data?.scan_id,
  }
}
```

### Hover Effect on Vector Tiles
```typescript
// Source: MapLibre GL JS documentation
// https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/

let hoveredParcelId: string | null = null

map.on('mousemove', 'parcel-score-overlay', (e) => {
  if (e.features && e.features.length > 0) {
    // Remove previous hover state
    if (hoveredParcelId) {
      map.setFeatureState(
        { source: 'parcel-scores', sourceLayer: 'parcel_cache', id: hoveredParcelId },
        { hover: false }
      )
    }

    // Set new hover state
    hoveredParcelId = e.features[0].id as string
    map.setFeatureState(
      { source: 'parcel-scores', sourceLayer: 'parcel_cache', id: hoveredParcelId },
      { hover: true }
    )
  }
})

map.on('mouseleave', 'parcel-score-overlay', () => {
  if (hoveredParcelId) {
    map.setFeatureState(
      { source: 'parcel-scores', sourceLayer: 'parcel_cache', id: hoveredParcelId },
      { hover: false }
    )
    hoveredParcelId = null
  }
})

// Update layer paint to use feature state:
map.setPaintProperty('parcel-score-overlay', 'fill-opacity', [
  'case',
  ['boolean', ['feature-state', 'hover'], false],
  0.9,
  0.7
])
```

### Conditional Polling with Status-Based Stop
```typescript
// Source: TanStack Query documentation
// https://tanstack.com/query/v4/docs/framework/react/reference/useQuery

export function useScanPolling(scanId: string | null) {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['scan-status', scanId],
    queryFn: async () => {
      if (!scanId) throw new Error('No scan ID')
      return apiFetch<ScanStatusResponse>(`/api/scans/${scanId}`, {
        method: 'GET',
        accessToken,
      })
    },
    enabled: !!scanId,
    refetchInterval: (data, query) => {
      // Stop polling on error
      if (query.state.error) return false

      // Stop polling when scan complete or failed
      if (!data) return false
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        return false
      }

      // Poll every 2 seconds while running
      return 2000
    },
    refetchIntervalInBackground: true,
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mapbox GL JS (proprietary) | MapLibre GL JS (open-source fork) | 2020 onwards | Propdex already using MapLibre 5.17.0 (Phase 13), no migration needed |
| WMS raster tiles for all layers | Vector tiles (MVT) for interactive features | 2018+ standard | PDOK now offers OGC API Tiles, phase migrates from WMS to vector for scan areas |
| Custom tile server implementations | Martin tile server (Rust) | v1.0+ (2024-2025) | Latest v1.3.0 (2026-01), production-ready with PostGIS 3.0+ optimization |
| WebSockets for all real-time updates | Polling with smart intervals for long jobs | TanStack Query v4+ | Simpler architecture, auto-cleanup, sufficient for 5-15 min background jobs |
| Manual accessibility in progress bars | Radix UI primitives with ARIA | Radix UI adoption (2022+) | shadcn/ui pattern wraps Radix, already used in frontend (Phase 14-17) |
| Mapbox Vector Tile (MVT) only | MVT + MapLibre Tile (MLT) | MLT announced Jan 2026 | MLT more efficient, but MVT still standard and required for PDOK/Martin interop |

**Deprecated/outdated:**
- **Mapbox GL JS (pre-v2 license change)**: Use MapLibre GL JS (already adopted)
- **PDOK WFS XML only**: PDOK now offers GeoJSON output format (`outputFormat=application/json`), easier to consume
- **Martin config files**: v1.x auto-discovers PostGIS tables via GIST index detection, minimal config needed
- **TanStack Query v3 `refetchInterval` as number only**: v4+ supports function form for dynamic control

## Open Questions

1. **PDOK Kadaster Vector Tiles Source Layer Name**
   - What we know: PDOK OGC API Tiles endpoint exists at `https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1`, documentation indicates MVT support
   - What's unclear: Exact tile URL pattern (`/tiles/{tileMatrixSetId}/{z}/{x}/{y}?f=mvt`?), source layer name in MVT (`perceel`? `kadastralekaart`?), available properties in tiles
   - Recommendation: Plan 21-03 MUST include discovery step: inspect actual tile response, decode MVT to identify source-layer and properties, document in implementation notes

2. **Martin Tile Server Organization Filtering Strategy**
   - What we know: Martin v1.3 serves entire PostGIS table, no built-in RLS
   - What's unclear: Best approach for multi-tenant isolation -- backend proxy (FastAPI endpoint) vs Martin SQL function with query params vs PostGIS RLS policies
   - Recommendation: Backend proxy (add tile endpoint to scans router) for security + simplicity. Martin SQL functions more complex, RLS policies require DB changes beyond Phase 18 scope.

3. **Scan Progress Overlay Positioning on Mobile**
   - What we know: Fixed positioning at `top-20` works for desktop, but mobile has limited vertical space + soft keyboard interaction
   - What's unclear: Should overlay stick to top (obscures gemeente selection), bottom (obscures legend/controls), or use toast-style slide-in?
   - Recommendation: Plan 21-05 includes responsive positioning -- top on desktop (fixed), bottom-sheet pattern on mobile (slides up from bottom, swipeable to dismiss)

4. **CBS Gemeente Boundaries Data Freshness**
   - What we know: CBS updates gemeenten annually (mergers, boundary adjustments), Phase 20 uses 2026 WFS endpoint
   - What's unclear: Whether to cache gemeente GeoJSON client-side (faster re-render, stale data risk) or fetch fresh on every session (slower, always current)
   - Recommendation: Client-side cache with localStorage + 30-day TTL + version check against CBS endpoint. Most users scan same gemeenten repeatedly, boundary changes rare enough that 30-day staleness acceptable.

## Sources

### Primary (HIGH confidence)
- **MapLibre GL JS v5 Documentation** - Official API reference and examples for vector tiles, GeoJSON sources, click/hover handlers
  - [MapLibre GL JS Overview](https://maplibre.org/maplibre-gl-js/docs/examples/)
  - [Create a Hover Effect](https://maplibre.org/maplibre-gl-js/docs/examples/create-a-hover-effect/)
  - [Map API Reference](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/)
- **Martin Tile Server Documentation** - Installation, configuration, PostGIS integration
  - [Martin GitHub Repository](https://github.com/maplibre/martin)
  - [Martin Documentation](https://maplibre.org/martin/)
  - [Docker Compose Configuration](https://maplibre.org/martin/run-with-docker-compose.html)
- **PDOK Official Services** - CBS gemeente boundaries WFS, Kadaster vector tiles OGC API
  - [CBS Gebiedsindelingen WFS](https://www.pdok.nl/ogc-webservices/-/article/cbs-gebiedsindelingen)
  - [CBS 2026 WFS GetCapabilities](https://service.pdok.nl/cbs/gebiedsindelingen/2026/wfs/v1_0?request=GetCapabilities&service=WFS)
  - [Kadastrale Kaart OGC API Tiles](https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1)
  - [PDOK Vector Tiles Overview](https://www.pdok.nl/vector-tiles)
- **TanStack Query v5 Documentation** - useQuery, refetchInterval, polling patterns
  - [useQuery Reference](https://tanstack.com/query/v4/docs/framework/react/reference/useQuery)
  - [Auto Refetching Example](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching)
- **Propdex Phase 20 Implementation** - Scan API endpoints, schemas, service layer
  - `backend/app/scans/router.py` - POST /api/scans, GET /api/scans/{id}, GET /api/scans/{id}/results
  - `backend/app/scans/schemas.py` - ScanCreateRequest, ScanStatusResponse, ScanResultsResponse
  - `backend/app/models/parcel_cache.py` - PostGIS geometry column with GIST index (ready for Martin)

### Secondary (MEDIUM confidence)
- **MapLibre Style Spec** - Data-driven styling, interpolate expressions, paint properties
  - [Layers - MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/layers/)
  - [Sources - MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/sources/)
- **shadcn/ui Progress Component** - Radix UI Progress primitive with Tailwind styling
  - [shadcn/ui Progress Documentation](https://www.shadcn.io/ui/progress)
  - [Progress - shadcn/ui Radix Components](https://ui.shadcn.com/docs/components/radix/progress)
- **OGC API Standards** - OGC API Tiles specification, MVT format
  - [Public Services on the Map: A Decade of Success (OGC Blog)](https://www.ogc.org/blog-article/public-services-on-the-map-a-decade-of-success/)

### Tertiary (LOW confidence - requires validation in implementation)
- **Martin Multi-Tenant Filtering** - Community discussions, no official multi-tenant docs found
- **PDOK Vector Tile Property Names** - Inferred from WFS schema, needs validation with actual MVT tiles
- **MapLibre Tile (MLT) Format** - Announced Jan 2026, adoption timeline unclear, MVT remains standard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries confirmed in use (MapLibre, TanStack Query) or officially documented (Martin, PDOK APIs)
- Architecture patterns: HIGH - Patterns verified in MapLibre official examples and Phase 20 backend implementation
- Pitfalls: MEDIUM-HIGH - Based on common MapLibre issues (layer ordering, CRS mismatches) and multi-tenant security principles, validated against Propdex MEMORY.md patterns

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - stable ecosystem, but PDOK APIs and Martin versions may update)

**Key assumptions:**
1. Phase 20 backend API is fully functional and tested (verified from router.py implementation)
2. PostGIS spatial database from Phase 18 has parcel_cache table with GIST-indexed geometry (verified from model)
3. Frontend MapLibre integration from Phase 13-15 is stable and extensible (verified from MapView.tsx)
4. No breaking changes in PDOK CBS 2026 WFS or Kadaster OGC API Tiles during Phase 21 implementation
5. Martin v1.3.0 Docker image works with existing PostGIS 16-3.5 setup (very likely, but test in docker-compose first)
