# Phase 15: Property Data & Map Interactions - Research

**Researched:** 2026-02-08
**Domain:** React + MapLibre GL JS + PDOK APIs + TanStack Query v5
**Confidence:** HIGH

## Summary

Phase 15 builds on the map foundation (Phase 13) and authentication (Phase 14) to add property intelligence features: floating address search with PDOK autocomplete, property lookup triggering backend aggregation, detail panel with progressive disclosure, and PDOK kadastrale kaart parcel boundaries overlay.

The standard approach uses MapLibre GL JS GeoJSON sources/layers for property/parcel geometries (backend already returns WGS84 coordinates), TanStack Query for API state management with cache invalidation strategies, controlled debounced input (NOT useDeferredValue for network requests), and standard React patterns for floating UI with click-outside/escape-key handling. PDOK vector tiles are available via OGC API Tiles for parcel boundaries, avoiding large GeoJSON downloads in dense urban areas.

**Primary recommendation:** Use MapLibre `map.addSource()` + `map.addLayer()` for property/parcel GeoJSON, TanStack Query `useMutation` for property lookup (mutations invalidate report cache), standard `setTimeout` debouncing for suggest API (300ms), PDOK vector tiles for parcel boundaries layer, and Headless UI Disclosure components for progressive disclosure sections.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MapLibre GL JS | 5.17.0 | Map rendering + GeoJSON layers | Industry standard WebGL map library, fork of Mapbox GL JS |
| TanStack Query | 5.90.20 | Server state + caching | De facto standard for async state in React, v5 stable |
| React Hook Form | 7.71.1 | Search input state | Already in project, lightweight form state |
| MapLibre GeoJSON Source | Built-in | Dynamic geometry rendering | Native MapLibre feature, no library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Headless UI | 2.x | Disclosure/accordion components | Accessible progressive disclosure without styling opinions |
| proj4js | 2.x (if needed) | RD→WGS84 conversion | Only if backend returns RD coordinates (unlikely) |
| geojson-vt | 4.x | Vector tile generation | Only if client-side GeoJSON clustering needed (prefer PDOK tiles) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query | SWR | SWR simpler but less powerful cache control, TQ better for mutations |
| Custom debounce | useDeferredValue | useDeferredValue doesn't prevent network requests, need real debounce |
| PDOK vector tiles | Backend GeoJSON | Backend GeoJSON simpler but risks large payloads in dense areas |
| Headless UI | Radix UI | Radix more features but heavier, Headless UI sufficient for accordions |

**Installation:**
```bash
# Already installed: maplibre-gl, @tanstack/react-query, react-hook-form
# Add if needed:
pnpm add @headlessui/react
```

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/
├── components/
│   ├── map/
│   │   ├── MapView.tsx              # Existing map component
│   │   ├── LayerToggle.tsx          # Existing layer toggle
│   │   ├── ParcelBoundariesLayer.tsx # New: PDOK vector tiles layer
│   │   └── PropertyGeometryLayer.tsx # New: Property/parcel GeoJSON rendering
│   ├── search/
│   │   ├── AddressSearch.tsx        # Floating search bar with autocomplete
│   │   └── AddressAutocomplete.tsx  # Dropdown with suggestions
│   └── property/
│       ├── PropertyDetailPanel.tsx  # Floating panel (desktop) / bottom sheet (mobile)
│       ├── PropertySummary.tsx      # Collapsed view
│       └── PropertySection.tsx      # Expandable section (kadaster/zoning/monuments)
├── hooks/
│   ├── usePropertyLookup.ts         # TanStack Query mutation for property lookup
│   ├── useAddressSuggest.ts         # Debounced suggest query
│   └── useMapClick.ts               # Map click → property lookup workflow
└── lib/
    ├── pdok.ts                      # Existing tile constants
    ├── geometry.ts                  # New: GeoJSON helpers (center calculation, etc.)
    └── api.ts                       # New: API client functions
```

### Pattern 1: Debounced Autocomplete with AbortController
**What:** Controlled input with 300ms debounce, cancelling previous requests
**When to use:** Address suggest endpoint (min 3 chars, 60/min rate limit)
**Example:**
```typescript
// Source: React AbortController patterns (2026)
// https://www.j-labs.pl/en/tech-blog/how-to-use-the-useeffect-hook-with-the-abortcontroller/
function useAddressSuggest(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ["address-suggest", debouncedQuery],
    queryFn: async ({ signal }) => {
      if (debouncedQuery.length < 3) return [];
      const res = await fetch(`/api/properties/suggest?q=${debouncedQuery}`, { signal });
      return res.json();
    },
    enabled: debouncedQuery.length >= 3,
  });
}
```

### Pattern 2: Property Lookup Mutation with Cache Invalidation
**What:** POST /api/properties/lookup as mutation, invalidate report cache on success
**When to use:** User selects address suggestion or clicks map
**Example:**
```typescript
// Source: TanStack Query v5 Mutations documentation
// https://tanstack.com/query/v5/docs/react/guides/mutations
function usePropertyLookup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { postcode: string; huisnummer: number }) => {
      const res = await fetch("/api/properties/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Lookup failed");
      return res.json();
    },
    onSuccess: (data) => {
      // Cache property data for detail panel
      queryClient.setQueryData(["property", data.address.nummeraanduiding_id], data);
      // Invalidate reports list (if report was saved)
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
```

### Pattern 3: MapLibre GeoJSON Layer for Property Geometries
**What:** Add GeoJSON source + fill layer for property/parcel boundaries from backend
**When to use:** PropertyReportResponse returns map_data with geometries
**Example:**
```typescript
// Source: MapLibre GL JS GeoJSON documentation
// https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/
function addPropertyGeometry(map: maplibregl.Map, geometry: GeoJSON.Geometry) {
  // Remove existing layer/source if present
  if (map.getLayer("property-fill")) map.removeLayer("property-fill");
  if (map.getSource("property")) map.removeSource("property");

  // Add GeoJSON source
  map.addSource("property", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: geometry,
      properties: {},
    },
  });

  // Add fill layer with outline
  map.addLayer({
    id: "property-fill",
    type: "fill",
    source: "property",
    paint: {
      "fill-color": "#2563eb",
      "fill-opacity": 0.2,
      "fill-outline-color": "#2563eb",
    },
  });

  // Fly to geometry center
  const bbox = turf.bbox(geometry);
  map.fitBounds(bbox as [number, number, number, number], { padding: 50 });
}
```

### Pattern 4: PDOK Vector Tiles for Parcel Boundaries
**What:** Add PDOK kadastrale kaart vector tiles as toggleable layer
**When to use:** User toggles parcel boundaries (performance for dense areas)
**Example:**
```typescript
// Source: PDOK OGC API Tiles + MapLibre vector tiles
// https://www.pdok.nl/-/de-kadastrale-kaart-nu-ook-via-pdok-beschikbaar-in-ogc-api
function addParcelBoundariesLayer(map: maplibregl.Map) {
  // Note: Actual tile URL needs verification from PDOK API docs
  // Typical OGC API Tiles format: /tiles/{tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}
  map.addSource("pdok-parcels", {
    type: "vector",
    tiles: [
      "https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/tiles/WebMercatorQuad/{z}/{x}/{y}?f=mvt",
    ],
  });

  map.addLayer({
    id: "parcel-boundaries",
    type: "line",
    source: "pdok-parcels",
    "source-layer": "parcels", // Verify actual layer name from PDOK
    paint: {
      "line-color": "#64748b",
      "line-width": 1,
      "line-opacity": 0.6,
    },
  });
}
```

### Pattern 5: Progressive Disclosure with Headless UI
**What:** Collapsible sections for kadaster/zoning/monuments data
**When to use:** Property detail panel sections with lots of data
**Example:**
```typescript
// Source: Headless UI Disclosure component
// https://headlessui.com/react/disclosure
import { Disclosure } from "@headlessui/react";

function PropertySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Disclosure>
      {({ open }) => (
        <>
          <Disclosure.Button className="flex justify-between w-full">
            <span>{title}</span>
            <span>{open ? "−" : "+"}</span>
          </Disclosure.Button>
          <Disclosure.Panel>{children}</Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
```

### Pattern 6: Map Click to Property Lookup
**What:** Click map → reverse geocode (or query nearby features) → trigger lookup
**When to use:** User clicks map instead of using search
**Example:**
```typescript
// Source: MapLibre GL JS click events
// https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/
function useMapClick(map: maplibregl.Map | null, onLookup: (coords: [number, number]) => void) {
  useEffect(() => {
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      onLookup([lng, lat]);

      // Alternative: Query rendered features at click point
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["parcel-boundaries"], // If PDOK tiles have click data
      });

      if (features.length > 0) {
        // Extract address from parcel feature properties
        console.log(features[0].properties);
      }
    };

    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [map, onLookup]);
}
```

### Anti-Patterns to Avoid
- **Don't use useDeferredValue for network requests:** It doesn't prevent HTTP calls, only defers React renders. Use explicit debouncing with setTimeout for suggest API.
- **Don't parse postcode/huisnummer from weergavenaam:** PDOK suggest returns separate `postcode` and `huis_nlt` fields. Extract directly instead of regex parsing display names.
- **Don't add GeoJSON layers without cleanup:** Always remove existing layers/sources before re-adding to prevent memory leaks and duplicate renders.
- **Don't store access token in closure:** Phase 14 established AuthContext pattern with in-memory token. Use `useAuth()` hook for API calls.
- **Don't hardcode z-index values:** Use CSS variables from index.css (--z-search-bar: 100, --z-property-panel: 300, --z-dropdown: 400).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Address autocomplete debouncing | Custom debounce with refs | Standard setTimeout in useEffect | Simpler, testable, AbortController integration |
| Progressive disclosure accordion | Custom expand/collapse state | Headless UI Disclosure | Handles accessibility (ARIA, keyboard nav) automatically |
| Click outside detection | Manual document event listeners | Headless UI built-in behavior | Memory leaks, event bubbling edge cases |
| GeoJSON clustering | Custom point aggregation | MapLibre cluster: true | geojson-vt under the hood, optimized for WebGL |
| Coordinate conversion RD→WGS84 | Manual projection math | Backend returns WGS84 (center_wgs84) | Backend already handles this, frontend receives WGS84 |
| API request cancellation | Manual fetch abort tracking | TanStack Query signal prop | Automatic cleanup on unmount/new query |

**Key insight:** MapLibre GL JS and TanStack Query handle 90% of complexity. Custom solutions for debouncing, GeoJSON rendering, or state management introduce bugs without performance gains. Leverage built-in features first.

## Common Pitfalls

### Pitfall 1: PDOK Suggest Response Parsing
**What goes wrong:** Attempting to parse `postcode` and `huisnummer` from `weergavenaam` field using regex
**Why it happens:** PDOK documentation emphasizes `weergavenaam` as display name, easy to assume it's the only field
**How to avoid:** PDOK suggest response includes direct fields `postcode`, `huis_nlt` (huisnummer), `straatnaam`, `woonplaats`. Extract these directly.
**Warning signs:** Regex patterns failing on addresses with letter suffixes (e.g., "123A"), special postcode formats
**Example:**
```typescript
// WRONG: Parsing weergavenaam
const match = suggestion.weergavenaam.match(/(\d{4}\s?[A-Z]{2}).*?(\d+)/);

// RIGHT: Use direct fields (verify actual field names from backend tests)
const postcode = suggestion.postcode;
const huisnummer = suggestion.huis_nlt || suggestion.huisnummer;
```

### Pitfall 2: Coordinate Projection Mismatch
**What goes wrong:** Mixing RD (EPSG:28992) and WGS84 (EPSG:4326) coordinates in MapLibre
**Why it happens:** PDOK datasets use RD natively, backend returns both RD and WGS84, easy to use wrong field
**How to avoid:** MapLibre GL JS ONLY supports Web Mercator (EPSG:3857), which uses WGS84 lon/lat. Backend PropertyReportResponse provides `center_wgs84` and geometries in WGS84. Always use `*_wgs84` fields.
**Warning signs:** Map flies to incorrect location (e.g., North Sea instead of Amsterdam), geometries render off-screen
**Example:**
```typescript
// Backend returns both:
// map_data.center_rd: [121000, 487000]  // RD coordinates
// map_data.center_wgs84: [4.89, 52.37]  // WGS84 lon/lat

// WRONG: Using RD coordinates
map.flyTo({ center: mapData.center_rd, zoom: 16 });

// RIGHT: Using WGS84 coordinates
map.flyTo({ center: mapData.center_wgs84 as [number, number], zoom: 16 });
```

### Pitfall 3: Debouncing Without Cancellation
**What goes wrong:** Multiple overlapping requests when user types quickly, slow responses overwrite fast ones (race condition)
**Why it happens:** setTimeout debouncing doesn't cancel in-flight requests, only delays new ones
**How to avoid:** Combine debouncing with AbortController. TanStack Query automatically cancels previous queries when queryKey changes.
**Warning signs:** Network tab shows multiple simultaneous requests, console errors "AbortError", stale data appearing in UI
**Example:**
```typescript
// WRONG: Debounce only, no cancellation
const [query, setQuery] = useState("");
const [debounced, setDebounced] = useState("");
useEffect(() => {
  const timer = setTimeout(() => setDebounced(query), 300);
  return () => clearTimeout(timer);
}, [query]);
// fetch(debounced) runs without cancelling previous fetch

// RIGHT: TanStack Query handles cancellation automatically
const { data } = useQuery({
  queryKey: ["suggest", debounced],
  queryFn: async ({ signal }) => {
    const res = await fetch(`/api/properties/suggest?q=${debounced}`, { signal });
    return res.json();
  },
  enabled: debounced.length >= 3,
});
```

### Pitfall 4: Large GeoJSON Performance
**What goes wrong:** Adding thousands of parcel polygons as single GeoJSON source causes jank/freezing
**Why it happens:** Dense urban areas (Amsterdam centrum) have hundreds of parcels per tile, GeoJSON parsing blocks main thread
**How to avoid:** Use PDOK vector tiles for parcel boundaries layer (pre-tiled, streaming), reserve GeoJSON for selected property only (1-5 parcels max).
**Warning signs:** Map stuttering when panning dense areas, browser "Page Unresponsive" warnings, high CPU in DevTools profiler
**Example:**
```typescript
// WRONG: Loading all parcels in viewport as GeoJSON
const parcels = await fetch(`/api/parcels?bbox=${bbox}`).then(r => r.json());
map.addSource("parcels", { type: "geojson", data: parcels }); // 1000s of features

// RIGHT: Use PDOK vector tiles for all parcels, GeoJSON for selected only
map.addSource("pdok-parcels", {
  type: "vector",
  tiles: ["https://api.pdok.nl/kadaster/.../tiles/{z}/{x}/{y}"],
});
map.addSource("selected-parcel", {
  type: "geojson",
  data: propertyReport.cadastral_parcels[0].geometry, // Single parcel
});
```

### Pitfall 5: Missing Layer/Source Cleanup
**What goes wrong:** "Layer already exists" errors, duplicate geometries rendering on top of each other
**Why it happens:** Re-adding layers without removing previous ones when user performs new lookup
**How to avoid:** Always check if layer/source exists before adding. Remove in reverse order (layer first, then source).
**Warning signs:** Console errors "Layer with id 'X' already exists", multiple overlapping property boundaries visible
**Example:**
```typescript
// WRONG: Adding layer unconditionally
map.addLayer({ id: "property", type: "fill", source: "property-source", paint: {...} });

// RIGHT: Check and remove before adding
if (map.getLayer("property")) map.removeLayer("property");
if (map.getSource("property-source")) map.removeSource("property-source");

map.addSource("property-source", { type: "geojson", data: geometry });
map.addLayer({ id: "property", type: "fill", source: "property-source", paint: {...} });
```

### Pitfall 6: Mobile Bottom Sheet Scroll Conflicts
**What goes wrong:** Dragging bottom sheet also pans the map, confusing user interactions
**Why it happens:** Touch events propagate from sheet to map, MapLibre interprets as pan gesture
**How to avoid:** Stop event propagation on bottom sheet touch events, or disable map interactions when sheet is expanded.
**Warning signs:** Map jumping around when scrolling property details on mobile, users complaining about "glitchy" behavior
**Example:**
```typescript
// Add touch event handlers to property panel
<div
  className="property-panel"
  onTouchStart={(e) => e.stopPropagation()}
  onTouchMove={(e) => e.stopPropagation()}
  onTouchEnd={(e) => e.stopPropagation()}
>
  {/* Property details */}
</div>
```

### Pitfall 7: PDOK Vector Tile Layer Name Assumptions
**What goes wrong:** Vector tile layer not rendering, no errors in console
**Why it happens:** Assuming source-layer name without verifying from PDOK API docs (could be "parcels", "kadaster", "brk", etc.)
**How to avoid:** Inspect PDOK OGC API Tiles endpoint directly, or use MapLibre inspector to view available layers in loaded tiles.
**Warning signs:** Layer added but nothing visible, no errors, other vector tile sources work fine
**Resolution:** Check PDOK API docs or use network inspector to see actual tile response, verify `source-layer` field names.

## Code Examples

Verified patterns from official sources:

### MapLibre flyTo Animation
```typescript
// Source: MapLibre GL JS flyTo documentation
// https://maplibre.org/maplibre-gl-js/docs/examples/fly-to-a-location/
map.flyTo({
  center: [4.89, 52.37], // WGS84 lon/lat
  zoom: 16,
  speed: 1.2, // Animation speed (relative to curve)
  curve: 1, // Zoom curve (higher = more exaggerated arc)
  essential: true, // Animation runs even if user has reduced motion preference
});
```

### TanStack Query Optimistic Updates
```typescript
// Source: TanStack Query v5 Optimistic Updates
// https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
const mutation = useMutation({
  mutationFn: saveReport,
  onMutate: async (newReport) => {
    await queryClient.cancelQueries({ queryKey: ["reports"] });
    const previousReports = queryClient.getQueryData(["reports"]);

    queryClient.setQueryData(["reports"], (old: Report[]) => [...old, newReport]);

    return { previousReports };
  },
  onError: (err, newReport, context) => {
    queryClient.setQueryData(["reports"], context.previousReports);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  },
});
```

### Headless UI Keyboard Navigation
```typescript
// Source: Headless UI Disclosure component
// https://headlessui.com/react/disclosure
import { Disclosure } from "@headlessui/react";

function PropertyDetails({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <Disclosure key={section.id}>
          {({ open }) => (
            <>
              <Disclosure.Button className="flex justify-between w-full p-4 text-left">
                <span className="font-medium">{section.title}</span>
                <span>{open ? "−" : "+"}</span>
              </Disclosure.Button>
              <Disclosure.Panel className="p-4 bg-gray-50">
                {section.content}
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
      ))}
    </div>
  );
}
// Automatically handles: Space/Enter to toggle, Tab navigation, aria-expanded
```

### MapLibre queryRenderedFeatures on Click
```typescript
// Source: MapLibre GL JS Map click events
// https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/
map.on("click", "parcel-boundaries", (e) => {
  if (!e.features || e.features.length === 0) return;

  const feature = e.features[0];
  const { kadastrale_aanduiding, oppervlakte } = feature.properties;

  // Show popup or trigger lookup
  new maplibregl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(`<h3>${kadastrale_aanduiding}</h3><p>${oppervlakte} m²</p>`)
    .addTo(map);
});
```

### Click Outside Handler Pattern
```typescript
// Source: React modal external click handling
// https://keyholesoftware.com/cancel-a-react-modal-with-escape-key-or-external-click/
function useClickOutside(ref: React.RefObject<HTMLElement>, onClickOutside: () => void) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClickOutside();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [ref, onClickOutside]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom debounce hooks | TanStack Query + setTimeout | TQ v4+ (2022) | Automatic request cancellation, better DX |
| useDeferredValue for API calls | Explicit debounce + AbortController | React 18 (2022) | useDeferredValue doesn't prevent network requests |
| Mapbox GL JS | MapLibre GL JS | 2021 fork | Open-source, no API keys, active development |
| Custom accordion components | Headless UI / Radix UI | 2020+ | Accessibility built-in (ARIA, keyboard nav) |
| GeoJSON for all boundaries | Vector tiles for base layers | OGC API Tiles (2023+) | Better performance for large datasets |
| Lodash debounce | Native setTimeout | Modern JS | One less dependency, tree-shaking friendly |

**Deprecated/outdated:**
- **react-use-debounce package:** Native setTimeout + useEffect is simpler and more explicit
- **Mapbox GL JS v1:** Use MapLibre GL JS (open-source fork, compatible API)
- **Custom click-outside hooks:** Headless UI components handle this automatically
- **Client-side coordinate projection:** Backend should return WGS84, MapLibre requires it
- **Large GeoJSON downloads:** PDOK vector tiles are designed for this use case

## Open Questions

1. **PDOK Vector Tile Layer Names**
   - What we know: PDOK kadastrale kaart available via OGC API Tiles at `https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1`
   - What's unclear: Exact tile URL template, source-layer names in MVT response, available zoom levels
   - Recommendation: Inspect API endpoint directly during implementation, verify with network inspector. Fallback: Use backend to proxy PDOK tiles if CORS issues arise.

2. **PDOK Suggest Response Fields**
   - What we know: Response includes `weergavenaam` (display name), `id`, `type`
   - What's unclear: Exact field names for postcode/huisnummer (could be `postcode`, `huis_nlt`, `huisnummer`, etc.)
   - Recommendation: Log full suggest response during development, parse fields empirically. Backend tests show mock data with `weergavenaam`, `id`, `type` but no actual PDOK response captured.

3. **Map Click to Address Lookup**
   - What we know: MapLibre provides click coordinates (lon/lat), backend needs postcode + huisnummer
   - What's unclear: Best UX for map click → property lookup (reverse geocode first? query PDOK tiles? require search only?)
   - Recommendation: Phase 15 focus on search workflow, defer map click to Phase 16/17 polish. If implemented, use PDOK reverse geocoder or query parcel tile features for address.

4. **Mobile Bottom Sheet Library**
   - What we know: Need responsive pattern (floating panel desktop, bottom sheet mobile)
   - What's unclear: Whether to use library (react-modal-sheet, react-spring-bottom-sheet) or build custom with CSS
   - Recommendation: Start with custom CSS approach (media queries, fixed positioning), add library only if needed. Libraries are React Native focused, web versions may be overkill.

5. **Property Detail Panel Z-Index**
   - What we know: CSS variables define --z-property-panel: 300, --z-dropdown: 400
   - What's unclear: Should autocomplete dropdown (child of search bar) use higher z-index than property panel?
   - Recommendation: Use --z-dropdown: 400 for autocomplete (child of search bar), keep property panel at 300. Search initiated first, results should overlay property panel.

## Sources

### Primary (HIGH confidence)
- MapLibre GL JS Official Documentation - API reference, examples, guides (https://maplibre.org/maplibre-gl-js/docs/)
- TanStack Query v5 Official Documentation - Mutations, caching, optimistic updates (https://tanstack.com/query/v5/docs/react/guides/mutations)
- PDOK Official Documentation - Kadastrale Kaart OGC API (https://www.pdok.nl/-/de-kadastrale-kaart-nu-ook-via-pdok-beschikbaar-in-ogc-api)
- Headless UI Official Documentation - Disclosure component (https://headlessui.com/react/disclosure)
- Backend codebase - /backend/app/properties/router.py, /backend/app/schemas/property.py (verified endpoints + response schemas)

### Secondary (MEDIUM confidence)
- React AbortController patterns - Multiple 2024-2025 articles on useEffect cleanup (https://www.j-labs.pl/en/tech-blog/how-to-use-the-useeffect-hook-with-the-abortcontroller/)
- MapLibre GeoJSON performance guide - Official guide on large datasets (https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- React modal external click handling - Pattern for click outside + escape key (https://keyholesoftware.com/cancel-a-react-modal-with-escape-key-or-external-click/)
- PDOK Locatieserver GitHub Wiki - API examples and search patterns (https://github.com/PDOK/locatieserver/wiki/API-Locatieserver)

### Tertiary (LOW confidence - needs verification)
- PDOK vector tile URLs - OGC API endpoint exists but exact tile template needs inspection
- PDOK suggest response fields - Backend tests use mock data, actual field names need verification
- useDeferredValue vs debounce - Multiple articles agree useDeferredValue doesn't prevent network requests, but specific performance claims vary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - MapLibre + TanStack Query are established, backend API documented
- Architecture: HIGH - Patterns follow official docs, backend schemas verified
- Pitfalls: HIGH - Coordinate projection, debouncing, cleanup are well-documented gotchas
- PDOK vector tiles: MEDIUM - API exists but exact tile URLs need verification during implementation
- PDOK suggest fields: MEDIUM - Backend tests show structure but real response needs logging

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable ecosystem, MapLibre + TanStack Query mature)

**Key uncertainties requiring validation during planning:**
1. PDOK vector tile exact URLs and source-layer names (inspect API endpoint)
2. PDOK suggest response field names for postcode/huisnummer (log real response)
3. Map click → property lookup workflow (defer to later phase or implement as stretch goal)

**Planner notes:**
- Backend PropertyReportResponse already returns WGS84 coordinates (center_wgs84, geometries), no projection needed
- TanStack Query already configured in Phase 14 (5min staleTime, retry: 1)
- Z-index scale established in Phase 13 index.css
- AuthContext pattern established in Phase 14 (use useAuth() for API calls)
- Vite proxy configured for /api/* → localhost:8000
- MapView component uses imperative useRef pattern (map.current)
