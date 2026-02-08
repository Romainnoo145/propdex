# Domain Pitfalls: Map-First React Frontend for Dutch Property/GIS Application

**Domain:** Map-first React SPA for Dutch property intelligence (Kadaster, zoning, monuments)
**Researched:** 2026-02-08
**Context:** Adding React + Vite + MapLibre GL JS frontend to existing FastAPI backend (v1.1 complete, 275 tests passing)

## Critical Pitfalls

Mistakes that cause rewrites, major performance issues, or security vulnerabilities.

### Pitfall 1: MapLibre Memory Leaks in React SPAs
**What goes wrong:** Memory consumption increases each time a map is created and destroyed. In SPAs with route changes or conditional map rendering, memory leaks accumulate because `map.remove()` doesn't fully clean up internal state. AbortController objects and Worker class caches (layerIndexes, availableImages, workerSources) persist after component unmounts.

**Why it happens:**
- Developers forget to call `map.remove()` in useEffect cleanup
- Even when `map.remove()` is called, MapLibre versions 4.1-4.7.1 have known memory leaks in Worker class
- Event handlers aren't properly removed when stored in global scope

**Consequences:**
- Browser memory grows continuously during navigation
- Map performance degrades after 5-10 route changes
- Mobile browsers crash or become unresponsive
- Dev environment with HMR compounds the issue (memory not released on hot reload)

**Prevention:**
```typescript
// CORRECT: Always cleanup in useEffect
useEffect(() => {
  const map = new Map({
    container: mapContainer.current,
    style: PDOK_STYLE_URL,
  });

  // Store event handlers to remove them explicitly
  const handlers = {
    click: (e) => handleClick(e),
    moveend: () => handleMoveEnd(),
  };

  map.on('click', handlers.click);
  map.on('moveend', handlers.moveend);

  return () => {
    // Remove handlers BEFORE calling map.remove()
    map.off('click', handlers.click);
    map.off('moveend', handlers.moveend);
    map.remove();
  };
}, []);
```

**Detection:**
- Chrome DevTools Memory tab: Take heap snapshot, navigate away, force GC, take another snapshot. Compare retained size.
- Warning signs: Map interactions become sluggish after navigating between pages 5+ times
- Browser task manager shows increasing memory for the tab

**Phase:** Phase 1 (Core Map Setup) — must establish cleanup pattern from the start

**Sources:**
- [MapLibre Memory Leak Issue #4811](https://github.com/maplibre/maplibre-gl-js/issues/4811)
- [Worker class cleanup issue #3733](https://github.com/maplibre/maplibre-gl-js/issues/3733)
- [Memory leak on GeoJSON updates #6154](https://github.com/maplibre/maplibre-gl-js/issues/6154)

---

### Pitfall 2: JWT in localStorage = XSS Account Takeover
**What goes wrong:** Storing JWT access tokens in localStorage makes them readable by any XSS attack. Malicious scripts injected via third-party dependencies, compromised CDNs, or user-generated content can steal tokens and impersonate users across organizations (critical for multi-tenant SaaS).

**Why it happens:**
- localStorage is the "easiest" solution taught in tutorials
- Developers don't realize localStorage is JavaScript-readable (not protected like HttpOnly cookies)
- Refresh tokens in localStorage are especially dangerous (long-lived, can mint new access tokens)

**Consequences:**
- Single XSS vulnerability = all user sessions compromised
- Multi-tenant data breach (attacker gains access to multiple organizations)
- Cannot revoke stolen tokens until expiry (15 min access, 7 days refresh per .env.example)
- No defense against compromised npm packages reading localStorage

**Prevention:**
```typescript
// WRONG: Never do this
localStorage.setItem('access_token', token);

// CORRECT: Hybrid approach
// 1. Access token in memory (React Context/Zustand)
// 2. Refresh token in HttpOnly cookie (set by backend)
const AuthContext = createContext();

function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null); // Memory only

  const refreshAccessToken = async () => {
    // Refresh token sent automatically via HttpOnly cookie
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Send HttpOnly cookie
    });
    const { access_token } = await response.json();
    setAccessToken(access_token); // Memory only
  };

  return (
    <AuthContext.Provider value={{ accessToken, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Backend changes required:**
```python
# FastAPI: Set refresh token as HttpOnly cookie
response.set_cookie(
    key="refresh_token",
    value=refresh_token,
    httponly=True,  # Not accessible to JavaScript
    secure=True,    # HTTPS only
    samesite="strict",  # CSRF protection
    max_age=7 * 24 * 60 * 60,  # 7 days
)
```

**Detection:**
- Code review: Search for `localStorage.setItem.*token`
- Security audit: Check if tokens are JavaScript-readable
- Warning sign: Authentication tutorial recommends localStorage

**Phase:** Phase 2 (Authentication Integration) — architecture decision that's painful to change later

**Sources:**
- [JWT Storage Security Guide](https://www.descope.com/blog/post/developer-guide-jwt-storage)
- [WorkOS Secure JWT Storage](https://workos.com/blog/secure-jwt-storage)
- [XSS and localStorage vulnerability](https://medium.com/@BenedekGagyi/storing-tokens-securely-what-about-xss-f59c08b06f1a)
- [React JWT storage comparison](https://cybersierra.co/blog/react-jwt-storage-guide/)

---

### Pitfall 3: Coordinate Projection Mismatch (RD New vs WGS84)
**What goes wrong:** Dutch Kadaster data uses EPSG:28992 (RD New / Rijksdriehoek), but MapLibre GL expects EPSG:4326 (WGS84). Displaying RD coordinates directly causes features to render in the wrong location (often in the ocean near Africa at 0,0). Backend returns GeoJSON in RD, frontend displays it assuming WGS84 → properties appear 200km+ from actual location.

**Why it happens:**
- Developers assume "GeoJSON = WGS84" (usually true, but not for Dutch government data)
- PDOK tile services use Web Mercator, but BAG API returns RD coordinates
- Backend developers copy Kadaster examples that use RD without conversion
- No visual indication until zooming to actual locations in Netherlands

**Consequences:**
- Map shows no features (they're plotted in wrong hemisphere)
- Click interactions fail (coordinates don't match tile locations)
- Geocoding results don't align with parcel boundaries
- Multi-day debugging sessions ("why isn't GeoJSON showing?")

**Prevention:**
```python
# Backend: ALWAYS convert Kadaster RD to WGS84 before returning GeoJSON
from pyproj import Transformer

# Create transformer once (RD New → WGS84)
transformer = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)

def convert_kadaster_geometry(rd_geometry: dict) -> dict:
    """Convert RD New coordinates to WGS84 for MapLibre GL."""
    if rd_geometry["type"] == "Polygon":
        # Transform each coordinate pair
        coordinates = []
        for ring in rd_geometry["coordinates"]:
            wgs84_ring = [
                transformer.transform(x, y) for x, y in ring
            ]
            coordinates.append(wgs84_ring)
        return {"type": "Polygon", "coordinates": coordinates}
    # ... handle other geometry types

# Always validate CRS when receiving from Kadaster
assert kadaster_response.get("crs") == "EPSG:28992"
```

**Detection:**
- Symptom: Map loads but shows no features in Netherlands viewport
- Debug: `console.log()` the first GeoJSON coordinate pair:
  - RD: `[155000, 463000]` (large numbers, inside Netherlands bounding box)
  - WGS84: `[5.387, 52.156]` (lat/lon, -180 to 180 range)
- Warning sign: Coordinates have 5-6 digit values instead of 2-digit decimal degrees

**Phase:** Phase 3 (Property Data Integration) — catch early or spend days debugging rendering issues

**Sources:**
- [EPSG:28992 (RD New) Reference](https://epsg.io/28992)
- [Kadaster projection documentation](https://gdal.org/en/stable/drivers/vector/lvbag.html)
- [RD to WGS84 conversion example](https://gist.github.com/bertt/04a3329b8b1241168db51998de2e7a6e)
- [Dutch coordinate systems overview](http://wiki.bk.tudelft.nl/toi-pedia/Coordinate_reference_systems)

---

### Pitfall 4: Too Many GeoJSON Features (No Clustering)
**What goes wrong:** Rendering 1000+ individual property polygons as GeoJSON source causes exponential performance degradation. Map becomes unresponsive, zoom/pan stutters, mobile browsers crash. The problem: GeoJSON is converted to vector tiles in a Worker, triggering full map re-render when tiles become available. With 10,000+ parcels in a municipality, the map freezes for 10-30 seconds on load.

**Why it happens:**
- Backend returns all properties in viewport without pagination
- "It works with 100 test properties" → doesn't scale to production data
- MapLibre's performance threshold: noticeable slowdown at 1,000 features, exponential degradation beyond 50,000

**Consequences:**
- Map unusable in dense urban areas (Amsterdam has 200,000+ parcels)
- Mobile browsers crash or become unresponsive
- Users abandon the application during initial load
- No way to interact with features until rendering completes

**Prevention:**
```typescript
// CORRECT: Enable clustering for point features
map.addSource('properties', {
  type: 'geojson',
  data: propertiesGeoJSON,
  cluster: true,
  clusterMaxZoom: 14, // Don't cluster after zoom 14
  clusterRadius: 50,  // Cluster points within 50px radius
});

// For polygons: Use vector tiles instead of GeoJSON
// Backend generates PMTiles or serves MVT tiles
map.addSource('parcels', {
  type: 'vector',
  tiles: [`${API_URL}/tiles/parcels/{z}/{x}/{y}.pbf`],
  minzoom: 10,
  maxzoom: 16,
});
```

**Alternative strategies:**
1. **Viewport-based loading:** Only request features in current map bounds
2. **Zoom-based filtering:** Show clusters at low zoom, individual features at high zoom
3. **Data reduction:** Simplify polygon geometries with Turf.js or Mapshaper (reduce vertices)
4. **Split datasets:** Load data in chunks as user pans/zooms

**Detection:**
- Performance profiling: Map rendering takes >2 seconds
- Browser DevTools Performance tab shows long Worker tasks
- Warning sign: `getSource('properties').setData()` takes >500ms

**Phase:** Phase 3 (Property Data Integration) — architectural decision (GeoJSON vs vector tiles)

**Sources:**
- [MapLibre Performance Guide for Large Datasets](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [Performance Analysis: 50,000+ features threshold](https://www.mdpi.com/2220-9964/14/9/336)
- [Clustering tutorial](https://docs.stadiamaps.com/tutorials/clustering-styling-points-with-maplibre/)
- [Performance issue with large GeoJSON #4364](https://github.com/maplibre/maplibre-gl-js/issues/4364)

---

### Pitfall 5: PDOK CORS Changes (Direct Browser Access)
**What goes wrong:** PDOK APIs changed CORS pre-flight handling in 2025/2026. Older examples showing direct browser calls to `api.pdok.nl` may fail with CORS errors if not following HTTP specifications exactly (missing `Origin` or `Access-Control-Allow-Methods` headers). BAG API migration deadline is July 15, 2026 — old endpoints will break.

**Why it happens:**
- Documentation lags behind CORS policy changes
- Developers copy outdated Stack Overflow examples
- Frontend makes requests to old BAG API endpoint (`/lv/bag/ogc/v1` → phased out)
- CORS pre-flight requires exact header combinations that differ by browser

**Consequences:**
- Production frontend breaks when PDOK tightens CORS (no backend fallback)
- API calls work in development (via proxy) but fail in production
- Old BAG API stops working on July 15, 2026 (6-month migration window)
- No error logging (browser blocks request before it reaches server)

**Prevention:**
```typescript
// DECISION POINT: Should frontend call PDOK directly or proxy through backend?

// Option 1: Proxy through backend (RECOMMENDED for Propdex)
// Pros: Backend already fetches BAG/DSO data, caching in place, no CORS issues
// Cons: Extra hop, but negligible since backend caches responses
const response = await fetch('/api/properties/lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: query }),
});

// Option 2: Direct browser calls to PDOK (use for tiles only)
// Tiles: Always safe (no authentication, permissive CORS)
const PDOK_AERIAL_TILES = 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/...';

// Data APIs: Avoid direct calls (CORS issues, no caching, rate limits)
// Let backend handle BAG/DSO/RCE lookups (it already does in v1.1)
```

**PDOK tile services safe for direct use:**
- Aerial imagery: `service.pdok.nl/hwh/luchtfotorgb/wmts`
- Cadastral boundaries: `service.pdok.nl/kadaster/kadastralekaart/wmts`
- Topo maps: `service.pdok.nl/brt/achtergrondkaart/wmts`

**Detection:**
- Browser console: `CORS policy: No 'Access-Control-Allow-Origin' header`
- Network tab: Request shows `(failed) CORS error` with no response
- Warning sign: Direct fetch to `api.pdok.nl` from frontend code

**Phase:** Phase 1 (Core Map Setup) for tiles, Phase 3 (Property Data) for data APIs

**Sources:**
- [PDOK BAG API migration notice (July 15, 2026 deadline)](https://www.pdok.nl/-/nieuwe-bag-ogc-api-features?redirect=/nieuws)
- [PDOK API documentation](https://api.pdok.nl/)
- [PDOK CORS pre-flight handling changes](https://www.pdok.nl/-/nieuwe-bag-ogc-api-features?redirect=/nieuws)

---

### Pitfall 6: React State Triggers Unnecessary Map Re-renders
**What goes wrong:** Storing map state (center, zoom, bearing) in React state causes infinite render loops. Every map movement updates state → triggers re-render → map resets position → fires moveend event → updates state → infinite loop. Also: calling native MapLibre methods (map.flyTo, map.setMaxZoom) bypasses React props, causing state desynchronization.

**Why it happens:**
- Developers treat map like a controlled React component (put everything in useState)
- Misunderstanding: "React should manage all state"
- React-map-gl wrapper is "fully controlled" but vanilla MapLibre GL is imperative

**Consequences:**
- Map stutters or jumps during user interactions
- Infinite render loops crash the browser
- Performance degrades (map re-initializes on every state change)
- Gestures feel "laggy" or unresponsive

**Prevention:**
```typescript
// WRONG: Map state in React state causes re-render loops
const [viewport, setViewport] = useState({ lng: 5.4, lat: 52.1, zoom: 12 });

useEffect(() => {
  const map = new Map({ center: [viewport.lng, viewport.lat], zoom: viewport.zoom });
  map.on('moveend', () => {
    setViewport({ lng: map.getCenter().lng, lat: map.getCenter().lat, zoom: map.getZoom() });
    // ^ Triggers re-render → map resets → fires moveend → infinite loop
  });
}, [viewport]); // Dependency causes re-initialization

// CORRECT: Map manages its own state, sync to React only when needed
const mapRef = useRef(null);
const mapInstanceRef = useRef(null);

useEffect(() => {
  // Initialize once
  const map = new Map({
    container: mapRef.current,
    center: [5.4, 52.1],
    zoom: 12,
  });

  mapInstanceRef.current = map;

  // Only sync to React state when you need it elsewhere (e.g., URL params)
  map.on('moveend', () => {
    // Optional: debounce this if syncing to URL
    const center = map.getCenter();
    // Update URL without triggering re-render
    window.history.replaceState(null, '', `?lat=${center.lat}&lng=${center.lng}`);
  });

  return () => map.remove();
}, []); // Empty deps = initialize once

// Imperative commands via ref (no re-renders)
const flyToProperty = (lng, lat) => {
  mapInstanceRef.current?.flyTo({ center: [lng, lat], zoom: 16 });
};
```

**Rule of thumb:** Let MapLibre manage map state imperatively. Only sync to React state for:
- URL persistence (debounced)
- Sharing state with non-map components (debounced)
- Initial render (pass once, don't react to changes)

**Detection:**
- Symptom: Map "jumps" or resets position during pan/zoom
- React DevTools: Profiler shows map component re-rendering continuously
- Console error: "Maximum update depth exceeded"

**Phase:** Phase 1 (Core Map Setup) — fundamental architecture decision

**Sources:**
- [react-map-gl State Management Guide](https://visgl.github.io/react-map-gl/docs/get-started/state-management)
- [React-MapLibre controlled components](https://visgl.github.io/react-maplibre/docs)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or poor UX (fixable but painful).

### Pitfall 7: Full-Page Map Z-Index Chaos
**What goes wrong:** Sidebar panels, property detail overlays, search autocomplete dropdowns, and modals compete in z-index wars. Symptom: Dropdown appears behind map, or map controls overlap sidebar text. Root cause: MapLibre canvas creates its own stacking context, and CSS z-index only works within the same stacking context.

**Why it happens:**
- Developers add `z-index: 9999` to "fix" overlay issues (doesn't work across stacking contexts)
- Map controls (zoom buttons, attribution) have hardcoded z-index
- Sidebar with `position: absolute` creates new stacking context
- No systematic z-index scale (random values throughout CSS)

**Prevention:**
```css
/* CORRECT: Define z-index scale for full-page map layout */
:root {
  --z-map-canvas: 0;           /* Map canvas (base layer) */
  --z-map-controls: 10;        /* Zoom buttons, attribution */
  --z-sidebar: 100;            /* Sidebar overlay on desktop */
  --z-property-panel: 200;     /* Floating property details */
  --z-search-dropdown: 300;    /* Autocomplete results */
  --z-modal: 1000;             /* Dialogs, confirmations */
  --z-toast: 2000;             /* Notifications (top of everything) */
}

/* Map container */
.map-container {
  position: relative;
  z-index: var(--z-map-canvas);
}

/* Sidebar */
.sidebar {
  position: absolute;
  top: 0;
  left: 0;
  z-index: var(--z-sidebar);
  /* Mobile: Full-screen overlay with higher z-index */
}

@media (max-width: 768px) {
  .sidebar {
    z-index: var(--z-modal); /* Cover map on mobile */
  }
}
```

**Mobile-specific gotcha:** Sidebar should cover entire map on mobile (not side-by-side). Use React state to toggle sidebar visibility, don't rely on CSS transforms that keep it in the stacking context.

**Detection:**
- Visual: Dropdown or panel appears "behind" something it should cover
- DevTools: Inspect element and check computed z-index and position values
- Warning sign: CSS has multiple `z-index: 9999` declarations

**Phase:** Phase 1 (Core Map Setup) — establish layout patterns early

**Sources:**
- [Z-Index Stacking Context in React](https://dev.to/minoosh/today-i-learned-layouts-and-the-z-index-trap-in-react-366f)
- [Managing Z-Index in Component-Based Apps](https://www.smashingmagazine.com/2019/04/z-index-component-based-web-application/)

---

### Pitfall 8: Map Doesn't Resize on Container Changes
**What goes wrong:** Map renders at wrong size when sidebar collapses, modal opens, or browser window resizes. Common scenario: User opens sidebar → map shrinks but doesn't adjust → half the map is blank. MapLibre v3 uses ResizeObserver but React's layout changes might not trigger it correctly.

**Why it happens:**
- Map container size changes but map doesn't know to recalculate
- React state change updates layout but map is already initialized
- CSS transitions complete after map thinks resize is done
- Modal/overlay changes container dimensions without triggering ResizeObserver

**Prevention:**
```typescript
useEffect(() => {
  const map = new Map({ container: mapRef.current });

  // Listen to container size changes
  const resizeObserver = new ResizeObserver(() => {
    map.resize(); // Force map to recalculate size
  });

  resizeObserver.observe(mapRef.current);

  return () => {
    resizeObserver.disconnect();
    map.remove();
  };
}, []);

// Explicitly call resize after layout changes
const toggleSidebar = () => {
  setIsSidebarOpen(prev => !prev);
  // Wait for CSS transition to complete, then resize map
  setTimeout(() => {
    mapInstanceRef.current?.resize();
  }, 300); // Match CSS transition duration
};
```

**Detection:**
- Visual: Gray/white area where map should be after layout change
- Console: MapLibre warnings about canvas size
- Warning sign: Map "snaps" to correct size after user interacts with it

**Phase:** Phase 4 (Property Search & Display) — becomes apparent when adding interactive panels

**Sources:**
- [MapLibre resize() documentation](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/)
- [ResizeObserver in MapLibre v3](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/)
- [Container size issues #1363](https://github.com/maplibre/maplibre-gl-js/issues/1363)

---

### Pitfall 9: Search Autocomplete Without Debouncing
**What goes wrong:** Every keystroke in address search triggers API call to backend → backend calls PDOK Locatieserver → 10 requests for "Amsterdam" typed. Consequences: Rate limiting, slow UX (results flash rapidly), wasted backend cache, potential PDOK ban.

**Why it happens:**
- Developers use `onChange` without debouncing
- "It works in dev with 2 test queries" → doesn't scale to production traffic
- PDOK Locatieserver has undocumented rate limits (direct calls get blocked)

**Prevention:**
```typescript
import { useMemo, useState } from 'react';
import debounce from 'lodash.debounce';

function AddressSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  // Debounce API calls (wait 300ms after user stops typing)
  const fetchResults = useMemo(
    () => debounce(async (searchQuery: string) => {
      if (searchQuery.length < 3) return; // Min 3 characters

      const response = await fetch(`/api/addresses/search?q=${searchQuery}`);
      const data = await response.json();
      setResults(data);
    }, 300), // 300ms delay
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    fetchResults(value); // Debounced call
  };

  return (
    <input
      value={query}
      onChange={handleChange}
      placeholder="Search address..."
    />
  );
}
```

**Additional best practices:**
- Minimum 2-3 characters before sending request
- Show loading indicator during debounce
- Cancel in-flight requests when query changes (AbortController)
- Cache recent results in memory (TanStack Query handles this)

**Detection:**
- Network tab: Burst of requests for partially typed queries
- Backend logs: 10+ requests from same user within 1 second
- Warning sign: Autocomplete dropdown flickers rapidly

**Phase:** Phase 4 (Property Search & Display)

**Sources:**
- [Use-places-autocomplete with debouncing](https://www.npmjs.com/package/use-places-autocomplete)
- [Debouncing best practices](https://www.geoapify.com/address-autocomplete/)
- [Optimizing autocomplete](https://dev.to/gaelsimon/implement-and-optimize-autocomplete-with-google-places-api-461h)

---

### Pitfall 10: Touch Events Conflict (Scrolling Panels Over Map)
**What goes wrong:** User tries to scroll property details panel on mobile → map pans instead of panel scrolling. Or: User tries to pan map → page scrolls instead. MapLibre's default behavior hijacks touch events for map pan/zoom, blocking overlays from scrolling.

**Why it happens:**
- MapLibre captures all touch events on the map canvas by default
- Overlay panels are positioned over the map (same touch target)
- Mobile browsers can't distinguish "scroll panel" vs "pan map" intent
- Two-finger pan on mobile conflicts with page zoom

**Prevention:**
```typescript
// Enable cooperative gestures (require Ctrl/Cmd or two fingers)
const map = new Map({
  container: mapRef.current,
  cooperativeGestures: true, // Require meta key (desktop) or two fingers (mobile)
});

// Alternative: Prevent map events on overlay elements
const panelRef = useRef(null);

useEffect(() => {
  const panel = panelRef.current;
  if (!panel) return;

  // Stop touch events from reaching map
  panel.addEventListener('touchstart', (e) => {
    e.stopPropagation(); // Prevent MapLibre from capturing
  });

  panel.addEventListener('touchmove', (e) => {
    e.stopPropagation();
  });
}, []);
```

**UX considerations:**
- Cooperative gestures add friction (users must learn "two-finger pan")
- Better UX: Floating panels should be dismissible on mobile (close button)
- Consider full-screen panel on mobile instead of overlay

**Detection:**
- Test on mobile device: Try scrolling a panel over the map
- Symptom: Panel won't scroll, or map pans when trying to scroll panel
- Warning sign: User bug reports "Can't read property details on mobile"

**Phase:** Phase 5 (Property Details Panel) — mobile UX is often an afterthought

**Sources:**
- [MapLibre cooperative gestures](https://docs.maptiler.com/sdk-js/examples/cooperative-gestures/)
- [Touch event conflicts #234](https://github.com/maplibre/maplibre-gl-js/issues/234)
- [ScrollZoomHandler documentation](https://maplibre.org/maplibre-gl-js/docs/API/classes/ScrollZoomHandler/)

---

## Minor Pitfalls

Mistakes that cause annoyance or confusion but are easily fixable.

### Pitfall 11: Vite HMR Memory Leaks in Development
**What goes wrong:** During development with Vite's HMR (Hot Module Replacement), memory usage grows continuously. After 10-20 file saves, browser becomes sluggish. Combining Vite's HMR memory issues with MapLibre's memory leaks compounds the problem.

**Why it happens:**
- Vite's module graph grows with each HMR update but doesn't fully clean up stale references
- MapLibre Workers aren't disposed correctly during hot reload
- Developers don't notice until hour 3 of a coding session

**Prevention:**
```typescript
// Vite HMR API: Dispose map properly during hot reload
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  });
}
```

**Workaround:** Hard refresh (`Cmd+Shift+R`) every 30 minutes during heavy development.

**Detection:**
- Browser task manager: Memory grows from 200MB to 2GB+ over dev session
- DevTools Performance: Long Worker tasks after HMR updates
- Symptom: Browser feels "slow" after several hours of development

**Phase:** Phase 1 (Core Map Setup) — nice-to-have optimization for developer experience

**Sources:**
- [Vite HMR memory leak discussion #14438](https://github.com/vitejs/vite/discussions/14438)
- [Debugging Vite memory leaks](https://www.edstem.com/blog/vite_memory_leaks/)

---

### Pitfall 12: Vite Proxy vs Production CORS Mismatch
**What goes wrong:** Frontend works in development (Vite proxy forwards `/api/*` to localhost:8000) but fails in production (direct calls to `api.propdex.nl` blocked by CORS). Developers forget to configure CORS_ORIGINS in backend or hardcode `localhost:9300` in production.

**Why it happens:**
- Vite proxy bypasses CORS during development (same-origin requests)
- Backend CORS_ORIGINS not updated for production domain
- Environment variables (`VITE_API_URL`) baked into build, not runtime configurable

**Prevention:**
```typescript
// vite.config.ts: Proxy in development only
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});

// .env.development
VITE_API_URL=/api

// .env.production
VITE_API_URL=https://api.propdex.nl
```

**Backend verification:**
```python
# backend/.env
CORS_ORIGINS=http://localhost:9300,https://app.propdex.nl
```

**Detection:**
- Production: Network tab shows CORS errors for API calls
- Works locally, fails after deployment
- Warning sign: Forgot to test against production API before deploying

**Phase:** Phase 2 (Authentication Integration) — test production CORS early

**Sources:**
- [Vite proxy configuration guide](https://grokipedia.com/page/Vitejs_Proxy_Configuration)
- [Solving CORS with Vite proxy](https://en.kelen.cc/posts/solving-cors-with-vite-proxy-configuration)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)

---

### Pitfall 13: Environment Variables Baked Into Build
**What goes wrong:** `VITE_API_URL` is baked into JavaScript bundle at build time. Deploying the same Docker image to staging and production requires rebuilding for each environment. Can't reconfigure API URL without redeploying entire frontend.

**Why it happens:**
- Vite replaces `import.meta.env.VITE_*` with literal values during build
- "Twelve-factor app" principle violated (config should be runtime, not build-time)
- Docker best practice: One image, multiple environments

**Prevention:**
```typescript
// Option 1: Runtime config file (fetch on app load)
// public/config.json (NOT bundled, served statically)
{
  "apiUrl": "https://api.propdex.nl"
}

// App.tsx: Fetch config before rendering
const [config, setConfig] = useState(null);

useEffect(() => {
  fetch('/config.json')
    .then(res => res.json())
    .then(setConfig);
}, []);

if (!config) return <div>Loading...</div>;

// Option 2: Inject via server (Nginx replaces placeholder)
// index.html: <meta name="api-url" content="__API_URL__">
// Nginx: sed -i 's|__API_URL__|https://api.propdex.nl|g' /usr/share/nginx/html/index.html
```

**Tradeoff:** Adds complexity. Only necessary if deploying same image to multiple environments.

**Detection:**
- Deployment pain: "We need to rebuild frontend for staging"
- Warning sign: Dockerfile has separate `npm run build` for each environment

**Phase:** Phase 8 (Production Deployment) — optional optimization

**Sources:**
- [Dynamic config in Vite React apps](https://medium.com/@heshani.samarasekara/set-dynamic-config-values-to-your-react-vite-app-c814dca4798c)
- [Managing env vars in Vite + Docker](https://www.mykolaaleksandrov.dev/posts/2025/10/vite-docker-react-environment-variables/)
- [Mastering Vite environment variables](https://medium.com/@gosagnik/mastering-environment-variables-in-your-vite-react-project-89cf6bb66599)

---

## Phase-Specific Warnings

Map research findings to roadmap phases for just-in-time consideration.

| Phase Topic | Likely Pitfall | Mitigation | Research Flag |
|-------------|---------------|------------|---------------|
| **Phase 1: Core Map Setup** | Memory leaks (Critical #1), React state re-renders (Critical #6), Z-index chaos (Moderate #7) | Establish cleanup pattern + useRef architecture + z-index scale early | HIGH — foundational decisions |
| **Phase 2: Authentication** | JWT in localStorage (Critical #2), Vite proxy CORS (Minor #12) | HttpOnly cookies + test production CORS early | HIGH — security architecture |
| **Phase 3: Property Data** | Coordinate projection (Critical #3), Too many features (Critical #4) | Backend converts RD→WGS84, decide GeoJSON vs vector tiles, implement clustering | HIGH — data rendering architecture |
| **Phase 4: Search & Autocomplete** | No debouncing (Moderate #9), PDOK CORS (Critical #5) | Debounce 300ms, min 3 chars, proxy through backend | MEDIUM — UX quality |
| **Phase 5: Property Details Panel** | Touch event conflicts (Moderate #10), Map resize (Moderate #8) | Cooperative gestures or event stopPropagation, ResizeObserver + manual resize() | MEDIUM — mobile UX |
| **Phase 6: Report Generation** | (No map-specific pitfalls) | Backend handles PDF generation (already implemented in v1.1) | LOW — backend-only |
| **Phase 7: Map Interactions** | GeoJSON performance regression (Critical #4 revisited) | Monitor performance as features grow, implement viewport-based loading | MEDIUM — scalability |
| **Phase 8: Production Deployment** | Environment variables (Minor #13), Vite HMR irrelevant in prod | Runtime config if multi-environment, HMR only affects dev | LOW — optional optimization |

---

## Research Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| MapLibre performance & memory | HIGH | Official docs + GitHub issues with specific version numbers |
| JWT security in SPAs | HIGH | Multiple authoritative sources (WorkOS, Descope, security blogs) |
| Dutch coordinate systems | HIGH | EPSG.io + Kadaster official docs + GDAL documentation |
| PDOK CORS & APIs | MEDIUM | Official PDOK notices found, but specific rate limits undocumented |
| React + MapLibre patterns | HIGH | Official react-maplibre docs + community issues |
| Vite HMR & proxy | HIGH | Official Vite docs + extensive community discussions |
| Mobile touch conflicts | HIGH | MapLibre official docs + GitHub issues with solutions |

## Gaps & Unknowns

**LOW confidence areas requiring phase-specific research:**

1. **PDOK rate limits:** No official documentation found. Need to:
   - Test direct browser calls to Locatieserver API
   - Monitor for 429 responses in production
   - Contact PDOK support for official limits

2. **BAG API CORS after July 2026 migration:** New API CORS behavior not fully documented. Need to:
   - Test new BAG OGC API endpoint from browser
   - Verify CORS headers match old API
   - Confirm migration guide accuracy

3. **Vector tiles vs GeoJSON performance:** Theoretical threshold (1,000 features) found, but real-world testing needed:
   - Measure performance with actual Kadaster parcel data
   - Test on mid-range mobile devices (iPhone SE, Android mid-tier)
   - Determine optimal clustering strategy for Dutch property density

4. **MapLibre memory leak status:** Issues documented for v4.1-4.7.1, but:
   - Check if resolved in latest version
   - Test cleanup pattern effectiveness in production
   - Monitor memory usage over 24-hour sessions

---

## Implementation Priority

**Must address in Phase 1 (Foundation):**
- Critical #1: Memory leak cleanup pattern
- Critical #6: React state architecture (refs, not useState)
- Moderate #7: Z-index scale

**Must address in Phase 2 (Auth):**
- Critical #2: JWT security (HttpOnly cookies)

**Must address in Phase 3 (Data):**
- Critical #3: RD→WGS84 conversion
- Critical #4: GeoJSON clustering strategy
- Critical #5: PDOK CORS decision (proxy vs direct)

**Address when encountered (Phases 4-5):**
- Moderate #8: Resize handling
- Moderate #9: Search debouncing
- Moderate #10: Touch conflicts

**Optimize later (Phase 8+):**
- Minor #11: Vite HMR cleanup
- Minor #12: CORS testing
- Minor #13: Runtime config

---

## Summary for Roadmap Creator

**Key takeaways for phase structure:**

1. **Phase 1 is critical:** Memory management, state architecture, and layout decisions are hard to change later. Get these right upfront.

2. **Coordinate projection must be backend:** Don't trust frontend to convert RD→WGS84. Backend should return WGS84 GeoJSON always.

3. **Security decisions early:** JWT storage strategy (HttpOnly cookies) requires backend changes. Decide in Phase 2, not Phase 6.

4. **Performance is architectural:** Clustering and vector tiles aren't optimizations—they're requirements for 1000+ features. Decide in Phase 3.

5. **Mobile is not an afterthought:** Touch conflicts and resize handling must be designed in, not bolted on. Test on real devices early.

6. **PDOK proxy strategy:** Given backend already fetches BAG/DSO data (v1.1 complete), frontend should consume backend APIs, not call PDOK directly (except for tiles). Simplifies CORS, leverages existing cache.

**Anti-pattern checklist for code review:**
- `localStorage.setItem('token')` — REJECT
- `useState(mapInstance)` — REJECT
- `useEffect(..., [mapState])` with map re-initialization — REJECT
- `fetch('api.pdok.nl')` from frontend (except tiles) — QUESTION
- GeoJSON source without clustering for >100 features — REJECT
- RD coordinate in frontend code — REJECT
- No `map.remove()` in useEffect cleanup — REJECT

---

**END OF PITFALLS RESEARCH**

Ready for roadmap creation with focus on preventing these pitfalls through proper phase structure and early architectural decisions.
