# Architecture Patterns: React + Vite Frontend with FastAPI Backend

**Domain:** Full-page map application for property intelligence (React + MapLibre + Vite)
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

Propdex frontend architecture integrates React + Vite with the existing FastAPI backend on port 8000. The architecture is map-first (MapLibre GL JS full viewport), with JWT authentication, real-time data polling for long-running property lookups, and efficient GeoJSON rendering for cadastral boundaries. The recommended stack prioritizes modern, lightweight tools: axios with interceptors for API client, TanStack Query for server state, Zustand for minimal client state, react-map-gl for MapLibre wrapper, and Vite proxy for local CORS-free development.

**Key architectural decisions:**
- **API Client:** axios (not ky or fetch) — interceptors for JWT handling, widespread adoption
- **JWT Storage:** Hybrid approach — access token in memory (React state), refresh token in httpOnly cookie
- **State Management:** TanStack Query for server data (80% of state), Context API for auth, Zustand for UI state
- **Map Integration:** react-map-gl (visgl/react-map-gl) — proven MapLibre wrapper with React-friendly API
- **Project Structure:** Feature-based folders (auth, map, properties, reports) with shared components layer
- **CORS in Dev:** Vite proxy to FastAPI (eliminates CORS during development)
- **Deployment:** Multi-stage Docker build OR separate static hosting (CDN) + FastAPI

---

## 1. API Client Architecture

### Recommended: axios with Request/Response Interceptors

**Why axios over fetch and ky:**
- Built-in interceptors for request/response lifecycle hooks (critical for JWT handling)
- Automatic JSON parsing and error transformation
- Widespread adoption in React ecosystem (mature patterns)
- Timeout configuration built-in
- Better DX for request cancellation (AbortController integrated)

**ky considerations:**
- Lighter weight (157KB) but less mature interceptor patterns
- Uses hooks (`beforeRequest`, `afterResponse`) instead of interceptors
- Good for new projects, but axios has more Stack Overflow answers for JWT patterns

**fetch considerations:**
- Smallest bundle (native), but requires manual JSON parsing
- No built-in request/response interception (manual wrapper needed)
- Good for simple apps, but Propdex needs JWT rotation logic

### Implementation Pattern

```typescript
// src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000, // 30s for long property lookups
  withCredentials: true, // Send httpOnly cookies with requests
});

// Request interceptor: Attach access token from memory
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken(); // From auth context/zustand
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Call /auth/refresh (sends httpOnly cookie automatically)
        const { data } = await axios.post('/auth/refresh', {}, {
          withCredentials: true,
        });

        // Store new access token in memory
        setAccessToken(data.access_token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — logout user
        logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

**Why this pattern works:**
- Access token in memory (XSS-safe, lost on page refresh)
- Refresh token in httpOnly cookie (CSRF-protected with sameSite)
- Automatic retry on 401 with token rotation
- Single source of truth for all API calls

**Sources:**
- [Axios vs Fetch 2025 comparison](https://blog.logrocket.com/axios-vs-fetch-2025/)
- [Why Ky is alternative to Axios](https://dev.to/usluer/why-ky-is-the-best-alternative-to-axios-and-fetch-for-modern-http-requests-27c3)
- [JWT Authentication with Axios interceptors](https://mihai-andrei.com/blog/jwt-authentication-using-axios-interceptors/)
- [Handling JWT Access and Refresh Token using Axios](https://blog.theashishmaurya.me/handling-jwt-access-and-refresh-token-using-axios-in-react-app)

---

## 2. JWT Token Management in React

### Recommended: Hybrid Storage (Memory + httpOnly Cookie)

**Security best practices (2026):**
- Store short-lived access token (15min) in memory (React Context/Zustand state)
- Store long-lived refresh token (7 days) in httpOnly cookie (set by FastAPI)
- Implement silent refresh on page load to restore access token from refresh token

**Why NOT localStorage for access token:**
- Vulnerable to XSS attacks (any injected script can read localStorage)
- JWT in localStorage = game over if XSS exists

**Why httpOnly cookie for refresh token:**
- Cannot be read by JavaScript (XSS-proof)
- Automatically sent with requests (no manual attachment needed)
- Protected with sameSite flag (CSRF mitigation)

**Why memory for access token:**
- Lost on page refresh (forces silent refresh from httpOnly cookie)
- XSS-proof (exists only in React state closure)
- Fast access (no localStorage read overhead)

### Implementation Pattern

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Silent refresh on mount (restore from httpOnly cookie)
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Call /auth/refresh (sends httpOnly cookie automatically)
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.access_token);

        // Fetch user details
        const userRes = await api.get('/auth/me');
        setUser(userRes.data);
      } catch (error) {
        // No valid refresh token — user not logged in
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.access_token);
    // Refresh token stored in httpOnly cookie by FastAPI

    const userRes = await api.get('/auth/me');
    setUser(userRes.data);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout'); // Revoke refresh token
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

**FastAPI changes required:**
- `/auth/login` and `/auth/register` must set httpOnly cookie with refresh token
- `/auth/refresh` must read httpOnly cookie and return new access + refresh tokens
- `/auth/logout` must clear httpOnly cookie

**Sources:**
- [JWT Storage React: LocalStorage vs Cookies Security](https://cybersierra.co/blog/react-jwt-storage-guide/)
- [Choosing Between Local Storage and HttpOnly Cookies for JWT](https://medium.com/@cjun1775/choosing-between-local-storage-and-httponly-cookies-for-storing-jwt-tokens-47f4ecbca6ee)
- [LocalStorage vs Cookies: Storing JWT Tokens Securely](https://www.cyberchief.ai/2023/05/secure-jwt-token-storage.html)
- [Context API JWT authentication](https://medium.com/geekculture/how-to-use-context-api-and-jwt-to-maintain-user-sessions-eb5602e83a03)
- [JWT Refresh Token Rotation Best Practices](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/)

---

## 3. React Project Structure for Map-First App

### Recommended: Feature-Based with Shared Layer

**Why feature-based:**
- Map-first app has clear feature domains (auth, map, properties, reports, projects)
- Each feature is self-contained (components + hooks + types + API calls)
- Scales better than layer-based (components/, hooks/, utils/) for complex apps
- Team-friendly (easy to work on features independently)

### Directory Structure

```
frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   └── PasswordResetForm.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   ├── api/
│   │   │   │   └── authApi.ts
│   │   │   ├── types/
│   │   │   │   └── auth.types.ts
│   │   │   └── AuthContext.tsx
│   │   │
│   │   ├── map/
│   │   │   ├── components/
│   │   │   │   ├── PropertyMap.tsx
│   │   │   │   ├── CadastralLayer.tsx
│   │   │   │   ├── ZoningLayer.tsx
│   │   │   │   ├── MapControls.tsx
│   │   │   │   └── PropertyPopup.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useMapInstance.ts
│   │   │   │   ├── useGeoJSONLayer.ts
│   │   │   │   └── useMapClick.ts
│   │   │   ├── utils/
│   │   │   │   ├── geoJSONHelpers.ts
│   │   │   │   └── coordinateTransform.ts
│   │   │   └── types/
│   │   │       └── map.types.ts
│   │   │
│   │   ├── properties/
│   │   │   ├── components/
│   │   │   │   ├── AddressSearch.tsx
│   │   │   │   ├── PropertyDetails.tsx
│   │   │   │   ├── ZoningSection.tsx
│   │   │   │   ├── MonumentSection.tsx
│   │   │   │   └── CadastralSection.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── usePropertyLookup.ts
│   │   │   │   ├── useAddressAutocomplete.ts
│   │   │   │   └── useAIParsingJob.ts
│   │   │   ├── api/
│   │   │   │   └── propertiesApi.ts
│   │   │   └── types/
│   │   │       └── property.types.ts
│   │   │
│   │   ├── reports/
│   │   │   ├── components/
│   │   │   │   ├── ReportList.tsx
│   │   │   │   ├── ReportDetail.tsx
│   │   │   │   ├── SaveReportModal.tsx
│   │   │   │   └── ReportFilters.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useReports.ts
│   │   │   │   ├── useSaveReport.ts
│   │   │   │   └── useReportFreshness.ts
│   │   │   ├── api/
│   │   │   │   └── reportsApi.ts
│   │   │   └── types/
│   │   │       └── report.types.ts
│   │   │
│   │   └── projects/
│   │       ├── components/
│   │       │   ├── ProjectList.tsx
│   │       │   └── ProjectForm.tsx
│   │       ├── hooks/
│   │       │   └── useProjects.ts
│   │       ├── api/
│   │       │   └── projectsApi.ts
│   │       └── types/
│   │           └── project.types.ts
│   │
│   ├── components/          # Shared/reusable components
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── Toast.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Layout.tsx
│   │
│   ├── lib/                 # Shared utilities and configs
│   │   ├── api.ts           # Axios instance with interceptors
│   │   └── queryClient.ts   # TanStack Query client config
│   │
│   ├── hooks/               # Global custom hooks
│   │   └── useDebounce.ts
│   │
│   ├── types/               # Global TypeScript types
│   │   └── global.types.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
│
├── .env.example
├── .env.local
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

**Key principles:**
- **Feature folders are self-contained:** All code for auth lives in `features/auth/`
- **Shared components are domain-agnostic:** `components/ui/Button.tsx` can be used anywhere
- **API calls live with features:** `features/properties/api/propertiesApi.ts` handles all property API calls
- **Types mirror backend schemas:** `features/properties/types/property.types.ts` matches FastAPI PropertyReportResponse

**Sources:**
- [React Folder Structure with Vite & TypeScript](https://medium.com/@prajwalabraham.21/react-folder-structure-with-vite-typescript-beginner-to-advanced-9cd12d1d18a6)
- [React Folder Structure in 5 Steps 2025](https://www.robinwieruch.de/react-folder-structure/)
- [Best Folder Structure for React Complex Projects](https://dev.to/shubhadip_bhowmik/best-folder-structure-for-react-complex-projects-432p)
- [Recommended Folder Structure for React 2025](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc)

---

## 4. State Management: TanStack Query + Zustand + Context

### The Modern Hybrid Approach (2026)

**State categorization:**
- **Server state (80%):** TanStack Query (properties, reports, projects, address autocomplete)
- **Auth state (global):** React Context API (user, accessToken, login/logout)
- **UI state (local):** Zustand or useState (map viewport, sidebar open/closed, selected property)

**Why NOT Redux:**
- Hand-written Redux down to 10% of new projects (2026 data)
- Redux Toolkit still common in enterprises, but overkill for Propdex
- TanStack Query handles 80% of what Redux did (server data + caching + refetching)

**Why Zustand over Jotai:**
- Zustand: Single store (simpler mental model for small apps)
- Jotai: Atomic state (better for complex UIs with many independent atoms)
- Propdex needs simple global UI state (map viewport, selected report ID) — Zustand wins

**Why Context API for auth:**
- Auth is truly global (every component needs isAuthenticated check)
- Minimal re-renders (auth state changes rarely)
- No extra library needed (React built-in)

### Implementation Patterns

#### TanStack Query for Server State

```typescript
// src/features/properties/hooks/usePropertyLookup.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { lookupProperty } from '../api/propertiesApi';
import type { AddressInput, PropertyReportResponse } from '../types/property.types';

export function usePropertyLookup() {
  return useMutation<PropertyReportResponse, Error, AddressInput>({
    mutationFn: (input) => lookupProperty(input),
    // Cache result by postcode + huisnummer
    mutationKey: (variables) => ['property', variables.postcode, variables.huisnummer],
  });
}

// Polling for AI parsing job status
export function useAIParsingJob(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-parsing-job', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: enabled && !!jobId, // Only poll when job exists
    refetchInterval: (data) => {
      // Stop polling when complete or failed
      if (data?.status === 'complete' || data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds while in_progress
    },
  });
}
```

#### Zustand for UI State

```typescript
// src/lib/mapStore.ts
import { create } from 'zustand';

interface MapState {
  viewport: { lng: number; lat: number; zoom: number };
  selectedPropertyId: string | null;
  setViewport: (viewport: MapState['viewport']) => void;
  setSelectedPropertyId: (id: string | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewport: { lng: 5.2913, lat: 52.1326, zoom: 7 }, // Amsterdam default
  selectedPropertyId: null,
  setViewport: (viewport) => set({ viewport }),
  setSelectedPropertyId: (id) => set({ selectedPropertyId: id }),
}));
```

#### Context API for Auth

```typescript
// src/features/auth/AuthContext.tsx (see section 2 for full implementation)
```

**Sources:**
- [TanStack Query vs Zustand vs Jotai comparison](https://medium.com/@pooja.1502/state-management-in-2025-redux-toolkit-vs-zustand-vs-jotai-vs-tanstack-store-c888e7e6f784)
- [State Management Trends React 2025](https://makersden.io/blog/react-state-management-in-2025)
- [Do You Need State Management in 2025](https://dev.to/saswatapal/do-you-need-state-management-in-2025-react-context-vs-zustand-vs-jotai-vs-redux-1ho)
- [React State Management: Context, Zustand & Jotai](https://javascript-conference.com/blog/react-state-management-context-zustand-jotai/)

---

## 5. MapLibre GL JS in React: react-map-gl

### Recommended: visgl/react-map-gl

**Why react-map-gl over raw MapLibre:**
- React-friendly API (components, not imperative map.addLayer() calls)
- Proper React lifecycle integration (useEffect cleanup, ref management)
- Performance optimizations (minimizes React overhead)
- Proven library (Uber's deck.gl ecosystem)
- Works with both Mapbox GL JS and MapLibre GL JS

**Why NOT raw MapLibre:**
- Imperative API (map.addLayer, map.on('click')) fights React's declarative model
- Manual cleanup required (map.remove() in useEffect cleanup)
- State synchronization issues (React state vs. map state)
- More boilerplate for simple tasks

**Performance considerations:**
- react-map-gl v8+ has significant performance improvements (ESM build 57KB, down from 219KB)
- Overhead is minimal (benchmarks show near-native MapLibre performance)
- GPU-accelerated rendering (MapLibre's strength) is preserved

### Installation

```bash
npm install react-map-gl maplibre-gl
```

### Implementation Pattern

```typescript
// src/features/map/components/PropertyMap.tsx
import { useState } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

interface PropertyMapProps {
  cadastralGeometry: FeatureCollection | null;
  zoningGeometry: FeatureCollection | null;
  center: [number, number];
}

export function PropertyMap({ cadastralGeometry, zoningGeometry, center }: PropertyMapProps) {
  const [viewState, setViewState] = useState({
    longitude: center[0],
    latitude: center[1],
    zoom: 16,
  });

  const [selectedParcel, setSelectedParcel] = useState<any>(null);

  const handleMapClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (feature && feature.layer.id === 'cadastral-fill') {
      setSelectedParcel(feature.properties);
    }
  };

  return (
    <Map
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      onClick={handleMapClick}
      interactiveLayerIds={['cadastral-fill']}
      mapStyle="https://api.maptiler.com/maps/basic-v2/style.json?key=YOUR_KEY"
      style={{ width: '100%', height: '100vh' }}
    >
      {/* Cadastral parcels layer */}
      {cadastralGeometry && (
        <Source id="cadastral" type="geojson" data={cadastralGeometry}>
          <Layer
            id="cadastral-fill"
            type="fill"
            paint={{
              'fill-color': '#088',
              'fill-opacity': 0.3,
            }}
          />
          <Layer
            id="cadastral-outline"
            type="line"
            paint={{
              'line-color': '#088',
              'line-width': 2,
            }}
          />
        </Source>
      )}

      {/* Zoning rules layer */}
      {zoningGeometry && (
        <Source id="zoning" type="geojson" data={zoningGeometry}>
          <Layer
            id="zoning-fill"
            type="fill"
            paint={{
              'fill-color': '#f08',
              'fill-opacity': 0.2,
            }}
          />
        </Source>
      )}

      {/* Popup for selected parcel */}
      {selectedParcel && (
        <Popup
          longitude={selectedParcel.centroid[0]}
          latitude={selectedParcel.centroid[1]}
          onClose={() => setSelectedParcel(null)}
        >
          <div>
            <h3>{selectedParcel.kadastrale_aanduiding}</h3>
            <p>Oppervlakte: {selectedParcel.oppervlakte} m²</p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
```

**Key patterns:**
- `Source` component wraps GeoJSON data
- `Layer` components define how to render (fill, line, symbol)
- `interactiveLayerIds` enables click handling on specific layers
- `viewState` controlled by React (map position synced with React state)

**Sources:**
- [react-map-gl documentation](https://visgl.github.io/react-map-gl/)
- [React map library comparison](https://blog.logrocket.com/react-map-library-comparison/)
- [Adding Custom Data to react-map-gl](https://visgl.github.io/react-map-gl/docs/get-started/adding-custom-data)
- [Complete Guide to Sources and Layers in React and Mapbox GL JS](https://www.lostcreekdesigns.co/writing/a-complete-guide-to-sources-and-layers-in-react-and-mapbox-gl-js)

---

## 6. GeoJSON Handling in React

### Parsing Kadaster Geometries and Rendering

**FastAPI backend returns:**
- `PropertyReportResponse.cadastral_parcels[].geometry` — GeoJSON polygon (EPSG:28992 or WGS84)
- `PropertyReportResponse.map_data.parcel_geometries` — List of GeoJSON geometries
- `PropertyReportResponse.map_data.zoning_geometries` — List of GeoJSON geometries

**Frontend requirements:**
- Parse GeoJSON from API response
- Convert to FeatureCollection for MapLibre Source
- Handle coordinate system (RD vs WGS84)
- Click handling for parcel selection

### Implementation Pattern

```typescript
// src/features/map/utils/geoJSONHelpers.ts
import type { FeatureCollection, Geometry } from 'geojson';

export function createFeatureCollection(geometries: Geometry[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geometries.map((geometry, index) => ({
      type: 'Feature',
      id: index,
      geometry,
      properties: {},
    })),
  };
}

export function createCadastralFeatureCollection(
  parcels: Array<{ kadastrale_aanduiding: string; oppervlakte: number; geometry: Geometry }>
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: parcels.map((parcel, index) => ({
      type: 'Feature',
      id: index,
      geometry: parcel.geometry,
      properties: {
        kadastrale_aanduiding: parcel.kadastrale_aanduiding,
        oppervlakte: parcel.oppervlakte,
      },
    })),
  };
}
```

**Click handling pattern:**

```typescript
// src/features/map/hooks/useMapClick.ts
import { useState } from 'react';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

export function useMapClick() {
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  const handleClick = (event: MapLayerMouseEvent) => {
    // Get clicked features from interactive layers
    const features = event.features;
    if (features && features.length > 0) {
      const feature = features[0];
      setSelectedFeature({
        properties: feature.properties,
        geometry: feature.geometry,
      });
    }
  };

  return { selectedFeature, handleClick };
}
```

**Large dataset optimization:**
- For 100+ parcels, use GeoJSON source with clustering
- For complex polygons, simplify geometry server-side before sending to frontend
- Use layer filters to show/hide features based on zoom level

**Sources:**
- [MapLibre GeoJSON Polygon example](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-geojson-polygon/)
- [Optimising MapLibre Performance for Large GeoJSON](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [@mapcomponents/react-maplibre MlGeoJsonLayer](https://www.npmjs.com/package/@mapcomponents/react-maplibre)

---

## 7. CORS Setup: Vite Dev Proxy + FastAPI

### Development Environment (Vite Proxy)

**Problem:** Vite dev server runs on `http://localhost:9300`, FastAPI on `http://localhost:8000` — cross-origin requests trigger CORS preflight.

**Solution:** Vite proxy forwards `/api` requests to FastAPI, making browser see same-origin requests.

**vite.config.ts:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 9300,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        // Don't rewrite path — FastAPI expects /api/properties, not /properties
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

**How it works:**
- Frontend calls `axios.get('/api/properties/lookup')` (relative URL)
- Vite proxy forwards to `http://localhost:8000/api/properties/lookup`
- Browser sees same-origin request (no CORS preflight)
- httpOnly cookies are sent automatically (withCredentials: true)

**FastAPI CORS config (already exists):**

```python
# backend/app/main.py (already configured)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # ["http://localhost:9300"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Environment variables:**

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:8000  # Used in axios baseURL for production

# backend/.env
CORS_ORIGINS=http://localhost:9300,http://localhost:3000
FRONTEND_URL=http://localhost:9300
```

**Sources:**
- [Solving CORS with Vite Proxy Configuration](https://en.kelen.cc/posts/solving-cors-with-vite-proxy-configuration)
- [Local CORS Issues with Vite Proxy](https://medium.com/@kychok98/frontend-tips-2-local-cors-issues-with-vite-proxy-6b2cf4ca3672)
- [Setup Proxy in React Vite for CORS](https://medium.com/@aparna1002v/setup-proxy-in-react-vite-for-cors-issues-167c6a1eb569)
- [Vite Config Proxy CORS Guide](https://www.restack.io/p/vite-answer-config-proxy-cors)

---

## 8. Real-Time Data Flow: Property Lookup with Polling

### Long-Running Property Lookup Flow

**Backend pattern:**
1. Client POSTs to `/api/properties/lookup` with `postcode` + `huisnummer`
2. FastAPI calls multiple government APIs (BAG, PDOK, DSO, RCE) — may take 5-10 seconds
3. If bestemmingsplan PDF needs AI parsing, enqueue ARQ job and return job_id
4. Client polls `/api/properties/jobs/{job_id}/status` until complete

**Frontend pattern (TanStack Query polling):**

```typescript
// src/features/properties/hooks/usePropertyLookup.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { lookupProperty, getJobStatus } from '../api/propertiesApi';

export function usePropertyLookup() {
  const [jobId, setJobId] = useState<string | null>(null);

  // Step 1: Initial property lookup (may return in_progress AI job)
  const lookupMutation = useMutation({
    mutationFn: lookupProperty,
    onSuccess: (data) => {
      if (data.ai_parsing?.status === 'in_progress' && data.ai_parsing?.job_id) {
        setJobId(data.ai_parsing.job_id);
      }
    },
  });

  // Step 2: Poll job status if AI parsing is in progress
  const jobQuery = useQuery({
    queryKey: ['ai-parsing-job', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId, // Only start polling when jobId exists
    refetchInterval: (data) => {
      // Stop polling when complete, failed, or not found
      if (!data || data.status === 'complete' || data.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds while in_progress
    },
    // Re-fetch property data when AI parsing completes
    onSuccess: (data) => {
      if (data.status === 'complete') {
        // Trigger property lookup again to get updated report with AI data
        lookupMutation.mutate(lookupMutation.variables!);
        setJobId(null); // Stop polling
      }
    },
  });

  return {
    lookup: lookupMutation.mutate,
    isLoading: lookupMutation.isPending || jobQuery.isFetching,
    data: lookupMutation.data,
    jobStatus: jobQuery.data,
    error: lookupMutation.error || jobQuery.error,
  };
}
```

**UI pattern:**

```typescript
// src/features/properties/components/PropertyDetails.tsx
export function PropertyDetails() {
  const { lookup, isLoading, data, jobStatus } = usePropertyLookup();

  const handleLookup = (address: AddressInput) => {
    lookup(address);
  };

  return (
    <div>
      <AddressSearch onSubmit={handleLookup} />

      {isLoading && (
        <div>
          <Spinner />
          {jobStatus?.status === 'in_progress' && (
            <p>Bestemmingsplan wordt geanalyseerd... {jobStatus.progress_pct}%</p>
          )}
        </div>
      )}

      {data && <PropertyReport data={data} />}
    </div>
  );
}
```

**Polling best practices:**
- Use `refetchInterval` function (not static number) to stop polling when job completes
- Show progress indicator (TanStack Query provides `isFetching` state)
- Clean up polling on unmount (TanStack Query handles this automatically)
- Implement exponential backoff for failed jobs (optional)

**Sources:**
- [TanStack Query refetchInterval polling](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching)
- [Long polling with React](https://medium.com/@ignatovich.dm/implementing-long-polling-with-express-and-react-2cb965203128)
- [Implementing Polling in React Guide](https://medium.com/@sfcofc/implementing-polling-in-react-a-guide-for-efficient-real-time-data-fetching-47f0887c54a7)
- [Enhancing User Experience with React Polling](https://www.dhiwise.com/post/a-guide-to-real-time-applications-with-react-polling)

---

## 9. Build and Deployment

### Option A: Multi-Stage Docker Build (FastAPI Serves Static Files)

**Pros:**
- Single deployment artifact (one Docker image)
- Simple infrastructure (one container, one port)
- No CORS in production (same origin)

**Cons:**
- FastAPI serves static files (not ideal for performance)
- No CDN benefits (static files not cached at edge)
- Larger Docker image (includes both frontend and backend)

**Dockerfile (multi-stage):**

```dockerfile
# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/dist

# Stage 2: Build backend
FROM python:3.12-slim AS backend
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# Copy frontend build to backend static directory
COPY --from=frontend-builder /app/frontend/dist /app/static

# Serve static files from /static
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**FastAPI changes (serve static files):**

```python
# backend/app/main.py
from fastapi.staticfiles import StaticFiles

# Mount static files after API routers
app.mount("/", StaticFiles(directory="static", html=True), name="static")
```

### Option B: Separate Deployments (Recommended for Production)

**Pros:**
- CDN for frontend (fast global delivery, caching at edge)
- FastAPI focuses on API (no static file serving overhead)
- Independent scaling (scale frontend CDN vs. backend compute separately)
- Smaller Docker images (backend-only)

**Cons:**
- Two deployments to manage
- CORS configuration required (already configured)

**Frontend deployment:**
- Build: `npm run build` → `dist/` folder
- Deploy to: Vercel, Netlify, Cloudflare Pages, or AWS S3 + CloudFront
- Environment variable: `VITE_API_URL=https://api.propdex.nl`

**Backend deployment:**
- Docker image with Python + FastAPI only
- Deploy to: AWS ECS, Google Cloud Run, or DigitalOcean App Platform
- Environment variable: `CORS_ORIGINS=https://app.propdex.nl`

**docker-compose.yml (local development):**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://...
      - CORS_ORIGINS=http://localhost:9300
    depends_on:
      - db

  frontend:
    build:
      context: ./frontend
      target: development
    ports:
      - "9300:9300"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000

  db:
    image: postgres:16
    # ... (existing config)
```

**Sources:**
- [Serving Vite React with FastAPI via Docker](https://github.com/fastapi/fastapi/discussions/5134)
- [FastAPI Static Files](https://fastapi.tiangolo.com/tutorial/static-files/)
- [Multi-stage Docker build for Vite React](https://medium.com/@mahendhiran/building-a-production-ready-docker-image-for-a-react-vite-application-using-multi-stage-builds-3a34fe4a1c68)
- [React Vite Docker Nginx Production Deployment](https://www.buildwithmatija.com/blog/production-react-vite-docker-deployment)

---

## 10. TypeScript Types from Python Schemas

### Recommended: pydantic-to-typescript CLI

**Why auto-generate:**
- Single source of truth (Python Pydantic models)
- Eliminates manual sync errors (backend changes → frontend types update automatically)
- CI/CD integration (fail build if types out of sync)

**Installation:**

```bash
pip install pydantic-to-typescript
```

**Generate TypeScript types:**

```bash
# Generate from Python schemas
pydantic2ts \
  --module backend.app.schemas.property \
  --output frontend/src/types/generated/property.types.ts \
  --exclude BaseModel

pydantic2ts \
  --module backend.app.schemas.report \
  --output frontend/src/types/generated/report.types.ts

pydantic2ts \
  --module backend.app.auth.schemas \
  --output frontend/src/types/generated/auth.types.ts
```

**Generated output example:**

```typescript
// frontend/src/types/generated/property.types.ts (auto-generated)
export interface PropertyReportResponse {
  address: BAGAddressResponse;
  building: BuildingData | null;
  cadastral_parcels: CadastralParcel[];
  data_sources: DataSourceInfo[];
  completeness_score: number;
  errors: string[];
  resolved_at: string;
  zoning: ZoningData | null;
  monuments: MonumentStatus | null;
  map_data: MapData | null;
  section_sources: SectionSourceInfo[];
  ai_parsing: AIParsingSection | null;
}

export interface CadastralParcel {
  kadastrale_aanduiding: string | null;
  perceelnummer: string | null;
  sectie: string | null;
  oppervlakte: number | null;
  geometry: Record<string, any> | null; // GeoJSON geometry
}

// ... more types
```

**CI/CD integration (GitHub Actions):**

```yaml
# .github/workflows/sync-types.yml
name: Sync TypeScript Types

on:
  push:
    paths:
      - 'backend/app/schemas/**'

jobs:
  sync-types:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - run: pip install pydantic-to-typescript
      - run: |
          pydantic2ts --module backend.app.schemas.property --output frontend/src/types/generated/property.types.ts
          pydantic2ts --module backend.app.schemas.report --output frontend/src/types/generated/report.types.ts
          pydantic2ts --module backend.app.auth.schemas --output frontend/src/types/generated/auth.types.ts
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: "chore: sync TypeScript types from Python schemas"
```

**Alternative: Manual types (NOT recommended):**
- Error-prone (backend changes → manual frontend updates)
- No validation (backend adds field, frontend misses it)
- Only viable for very small projects

**Sources:**
- [pydantic-to-typescript PyPI](https://pypi.org/project/pydantic-to-typescript/)
- [GitHub phillipdupuis/pydantic-to-typescript](https://github.com/phillipdupuis/pydantic-to-typescript)
- [Converting Pydantic to TypeScript](https://medium.com/@blackkadder/converting-python-pydantic-classes-to-typescript-interfaces-7b6c3c2e360d)
- [Pydantic to Typescript GitHub Action](https://github.com/marketplace/actions/pydantic-to-typescript)

---

## Component Boundaries and Data Flow

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Port 9300)                    │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Auth UI   │  │   Map View   │  │   Reports List UI    │   │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────────────┘   │
│         │                │                  │                    │
│  ┌──────▼────────────────▼──────────────────▼─────────────────┐ │
│  │           TanStack Query (Server State Cache)              │ │
│  │  - Property data (cached by postcode)                      │ │
│  │  - Report list (pagination, filters)                       │ │
│  │  - AI parsing job status (polling)                         │ │
│  └──────┬──────────────────────────────────────────┬──────────┘ │
│         │                                           │            │
│  ┌──────▼────────────┐                   ┌─────────▼─────────┐  │
│  │  Auth Context     │                   │  Zustand Store    │  │
│  │  (user, tokens)   │                   │  (map viewport,   │  │
│  │                   │                   │   selected item)  │  │
│  └──────┬────────────┘                   └───────────────────┘  │
│         │                                                        │
│  ┌──────▼────────────────────────────────────────────────────┐  │
│  │         Axios Instance (with JWT interceptors)            │  │
│  │  - Attach access token to all requests                    │  │
│  │  - Auto-refresh on 401 errors                             │  │
│  └──────┬────────────────────────────────────────────────────┘  │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          │ HTTP (Vite proxy in dev, CORS in production)
          │
┌─────────▼────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Port 8000)                      │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │   /auth    │  │/properties │  │  /reports  │  │ /projects │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  │
│        │               │               │               │         │
│  ┌─────▼───────────────▼───────────────▼───────────────▼──────┐  │
│  │             JWT Auth Middleware                            │  │
│  │  - Verify access token                                     │  │
│  │  - Extract organization_id                                 │  │
│  └─────┬──────────────────────────────────────────────────────┘  │
│        │                                                          │
│  ┌─────▼──────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  PostgreSQL    │  │  Redis (ARQ) │  │  Government APIs     │ │
│  │  (RLS enabled) │  │  Job Queue   │  │  (BAG, PDOK, DSO)    │ │
│  └────────────────┘  └──────────────┘  └──────────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Request Flow: Property Lookup

1. **User enters address** → AddressSearch component
2. **TanStack Query mutation** → `usePropertyLookup().mutate({ postcode, huisnummer })`
3. **Axios interceptor** → Attaches `Authorization: Bearer {accessToken}` header
4. **Vite proxy** (dev) → Forwards `/api/properties/lookup` to `http://localhost:8000`
5. **FastAPI router** → `/api/properties/lookup` endpoint
6. **JWT middleware** → Extracts `organization_id` from token
7. **Property aggregator** → Calls BAG, PDOK, DSO, RCE APIs
8. **Response** → `PropertyReportResponse` with GeoJSON geometries
9. **TanStack Query cache** → Stores result with cache key `['property', postcode, huisnummer]`
10. **React renders** → PropertyMap component displays cadastral boundaries on map

### Request Flow: AI Parsing Job (Long Polling)

1. **Property lookup returns** → `ai_parsing.status = "in_progress"`, `ai_parsing.job_id = "abc123"`
2. **TanStack Query polling** → Starts `useQuery` with `refetchInterval: 2000`
3. **Poll endpoint** → GET `/api/properties/jobs/abc123/status` every 2 seconds
4. **ARQ job status** → Returns `{ status: "in_progress", progress_pct: 50 }`
5. **Job completes** → Status changes to `"complete"`, returns parsed plan data
6. **TanStack Query callback** → Stops polling, re-fetches property data
7. **React re-renders** → Shows AI-parsed bestemmingsplan section

### Component Hierarchy

```
App.tsx
├── AuthProvider (Context for user/token state)
│   ├── Layout
│   │   ├── Header (with user menu, logout button)
│   │   ├── Sidebar (navigation, filters)
│   │   └── MainContent
│   │       ├── MapView (full-page map)
│   │       │   ├── PropertyMap (react-map-gl)
│   │       │   │   ├── CadastralLayer (GeoJSON source + fill layer)
│   │       │   │   ├── ZoningLayer (GeoJSON source + fill layer)
│   │       │   │   └── PropertyPopup (click details)
│   │       │   ├── AddressSearch (autocomplete with PDOK)
│   │       │   └── PropertyDetails (sidebar panel)
│   │       │       ├── AddressSection
│   │       │       ├── BuildingSection
│   │       │       ├── CadastralSection
│   │       │       ├── ZoningSection
│   │       │       ├── MonumentSection
│   │       │       └── AIParsingSection (with job status polling)
│   │       │
│   │       ├── ReportsView
│   │       │   ├── ReportList (with filters, pagination)
│   │       │   └── ReportDetail (full report with map)
│   │       │
│   │       └── ProjectsView
│   │           ├── ProjectList
│   │           └── ProjectDetail (with assigned reports)
│   │
│   └── Toast (global notifications)
```

---

## Integration Points with Existing Backend

### Existing FastAPI Endpoints (No Changes Required)

| Endpoint | Method | Purpose | Frontend Usage |
|----------|--------|---------|----------------|
| `/auth/register` | POST | Register new user | RegisterForm component |
| `/auth/login` | POST | Login with email/password | LoginForm component |
| `/auth/refresh` | POST | Refresh access token | Axios interceptor + silent refresh on mount |
| `/auth/logout` | POST | Logout (revoke refresh token) | Logout button |
| `/auth/me` | GET | Get current user | AuthProvider initialization |
| `/api/properties/lookup` | POST | Property lookup | usePropertyLookup mutation |
| `/api/properties/suggest` | GET | Address autocomplete | useAddressAutocomplete query |
| `/api/properties/jobs/{job_id}/status` | GET | AI parsing job status | useAIParsingJob polling query |
| `/api/properties/upload-pdf` | POST | Upload bestemmingsplan PDF | PDF upload form |
| `/api/reports` | GET | List saved reports | useReports query with filters |
| `/api/reports` | POST | Save new report | useSaveReport mutation |
| `/api/reports/{id}` | GET | Get report detail | useReport query |
| `/api/reports/{id}` | DELETE | Delete report | useDeleteReport mutation |
| `/api/reports/{id}/notes` | PATCH | Update report notes | useUpdateNotes mutation |
| `/api/reports/{id}/export/pdf` | GET | Export report as PDF | PDF download button |
| `/api/reports/{id}/freshness` | GET | Check report freshness | useFreshness query |

### FastAPI Changes Required

**1. httpOnly Cookie for Refresh Token**

Currently, FastAPI returns refresh token in JSON response body. For security, move it to httpOnly cookie:

```python
# backend/app/auth/router.py
from fastapi import Response

@router.post("/login", response_model=TokenResponse)
async def login(
    response: Response,  # Add Response parameter
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    # ... existing login logic ...

    # Set refresh token as httpOnly cookie (instead of returning in JSON)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",  # HTTPS only in prod
        samesite="lax",  # CSRF protection
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/auth/refresh",  # Only send cookie to refresh endpoint
    )

    # Return only access token in JSON body
    return TokenResponse(
        access_token=access_token,
        # refresh_token=refresh_token,  # Remove from JSON body
    )
```

**2. Read Refresh Token from Cookie**

```python
@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,  # Add Request parameter
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    # Read refresh token from httpOnly cookie
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    # ... existing refresh logic using refresh_token ...

    # Set new refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/auth/refresh",
    )

    return TokenResponse(access_token=new_access_token)
```

**3. Clear Cookie on Logout**

```python
@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    refresh_token = request.cookies.get("refresh_token")

    # ... existing logout logic ...

    # Clear refresh token cookie
    response.delete_cookie(key="refresh_token", path="/auth/refresh")

    return MessageResponse(message="Logged out successfully")
```

**Note:** These changes are **optional but strongly recommended** for security. If not implemented, frontend can use localStorage for refresh token (less secure, but simpler).

---

## Suggested Build Order (Roadmap Phase Structure)

### Phase 1: Foundation (Auth + API Client)

**Why first:** No feature work possible without authentication and API integration.

**Deliverables:**
- Vite + React + TypeScript project setup
- axios instance with interceptors
- AuthContext with JWT storage (memory + httpOnly cookie)
- Login/Register UI
- Protected routes (react-router with auth guard)
- TanStack Query client configuration

**Success criteria:**
- User can register, login, logout
- Access token stored in memory, refresh token in httpOnly cookie
- Silent refresh on page load works
- Axios automatically attaches Bearer token to requests

---

### Phase 2: Map Integration (MapLibre + GeoJSON)

**Why second:** Map is core feature, needed for property lookup visualization.

**Deliverables:**
- react-map-gl + MapLibre GL JS setup
- PropertyMap component with PDOK base layer
- GeoJSON rendering for cadastral parcels (fill + outline layers)
- Click handling for parcel selection
- Popup with parcel details

**Success criteria:**
- Full-page map renders
- Cadastral boundaries display correctly
- Click on parcel shows popup with kadastrale_aanduiding + oppervlakte

---

### Phase 3: Property Lookup (Search + Display)

**Why third:** Core business feature, uses map from Phase 2.

**Deliverables:**
- AddressSearch component with autocomplete (`/api/properties/suggest`)
- usePropertyLookup hook with TanStack Query mutation
- PropertyDetails sidebar panel
- Display all sections (address, building, cadastral, zoning, monuments)
- Map centers on looked-up property

**Success criteria:**
- User can search address with autocomplete
- Property lookup displays data in sidebar
- Cadastral boundaries render on map
- Zoning rules overlay on map

---

### Phase 4: AI Parsing Job Polling

**Why fourth:** Builds on property lookup, adds long-running job handling.

**Deliverables:**
- useAIParsingJob hook with TanStack Query polling
- Job status display (progress bar, status messages)
- PDF upload form for manual bestemmingsplan upload
- AI parsing section in PropertyDetails

**Success criteria:**
- Property lookup with AI parsing shows "in progress" status
- Poll job status every 2 seconds until complete
- Display AI-parsed bestemmingsplan data when ready
- PDF upload fallback works

---

### Phase 5: Reports CRUD

**Why fifth:** Enables saving property lookups for later, core user value.

**Deliverables:**
- SaveReportModal component
- useReports query with filters (city, project, search)
- ReportList with pagination
- ReportDetail view (full report with map)
- Delete/restore report actions

**Success criteria:**
- User can save property lookup as report
- Reports list with filters and search works
- View saved report with full data
- Delete report (soft delete)

---

### Phase 6: Projects + Report Assignment

**Why sixth:** Organizational feature, depends on reports existing.

**Deliverables:**
- ProjectList and ProjectForm components
- Assign report to project flow
- Filter reports by project

**Success criteria:**
- User can create projects
- Assign reports to projects
- Filter reports by project in list view

---

### Phase 7: Advanced Features

**Why last:** Polish and optimization, not core MVP.

**Deliverables:**
- Report freshness check (`/api/reports/{id}/freshness`)
- PDF export (`/api/reports/{id}/export/pdf`)
- Report notes editing
- Multiple layers toggle (cadastral, zoning, monuments)
- Map styling options

**Success criteria:**
- Freshness badge shows stale sections
- PDF export downloads professional report
- Notes save correctly
- Layer toggles work

---

### Phase 8: Production Deployment

**Deliverables:**
- Multi-stage Docker build OR separate deployments
- Environment variables configuration
- CI/CD pipeline (GitHub Actions)
- pydantic-to-typescript in CI/CD
- Production CORS configuration

**Success criteria:**
- Frontend deployed to production (Vercel/Netlify or Docker)
- Backend serves API correctly
- CORS configured for production domain
- TypeScript types auto-sync from Python schemas

---

## Technology Decisions Summary

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| **Build Tool** | Vite | Latest | Fast HMR, native ESM, excellent DX |
| **Framework** | React | 18+ | Ecosystem maturity, team familiarity |
| **Language** | TypeScript | 5+ | Type safety, auto-generated from Pydantic |
| **API Client** | axios | 1.6+ | Interceptors for JWT, widespread adoption |
| **State (Server)** | TanStack Query | v5 | Caching, polling, mutations, 80% of state |
| **State (Auth)** | React Context | Built-in | Global user state, minimal re-renders |
| **State (UI)** | Zustand | 4+ | Lightweight, simple API, map viewport |
| **Map Library** | react-map-gl | 8+ | React wrapper for MapLibre, proven |
| **Map Engine** | MapLibre GL JS | 4+ | Open-source, GPU-accelerated, GeoJSON |
| **Routing** | React Router | 6+ | Standard routing, protected routes |
| **UI Components** | Custom + Tailwind CSS | - | Match existing backend, no heavy framework |
| **Forms** | React Hook Form | 7+ | Performance, validation, DX |
| **Validation** | Zod | 3+ | TypeScript-first, matches backend schemas |
| **HTTP/Cookie** | withCredentials: true | - | Send httpOnly cookies automatically |
| **Dev Proxy** | Vite proxy | Built-in | CORS-free development |
| **Type Generation** | pydantic-to-typescript | Latest | Auto-sync backend schemas to TS types |
| **Package Manager** | npm | - | Standard, team familiarity |

---

## Sources Summary

**API Client Architecture:**
- [Axios vs. Fetch (2025 update)](https://blog.logrocket.com/axios-vs-fetch-2025/)
- [Why Ky is the Best Alternative to Axios](https://dev.to/usluer/why-ky-is-the-best-alternative-to-axios-and-fetch-for-modern-http-requests-27c3)
- [JWT Authentication using Axios interceptors](https://mihai-andrei.com/blog/jwt-authentication-using-axios-interceptors/)
- [Handling JWT with Axios in React](https://blog.theashishmaurya.me/handling-jwt-access-and-refresh-token-using-axios-in-react-app)

**JWT Token Management:**
- [JWT Storage in React: LocalStorage vs Cookies](https://cybersierra.co/blog/react-jwt-storage-guide/)
- [Choosing Between Local Storage and HttpOnly Cookies](https://medium.com/@cjun1775/choosing-between-local-storage-and-httponly-cookies-for-storing-jwt-tokens-47f4ecbca6ee)
- [LocalStorage vs Cookies: JWT Security](https://www.cyberchief.ai/2023/05/secure-jwt-token-storage.html)
- [Context API and JWT for User Sessions](https://medium.com/geekculture/how-to-use-context-api-and-jwt-to-maintain-user-sessions-eb5602e83a03)
- [Refresh Token Rotation Best Practices](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/)

**React Project Structure:**
- [React Folder Structure with Vite & TypeScript](https://medium.com/@prajwalabraham.21/react-folder-structure-with-vite-typescript-beginner-to-advanced-9cd12d1d18a6)
- [React Folder Structure in 5 Steps [2025]](https://www.robinwieruch.de/react-folder-structure/)
- [Best Folder Structure for React Complex Projects](https://dev.to/shubhadip_bhowmik/best-folder-structure-for-react-complex-projects-432p)
- [Recommended Folder Structure for React 2025](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc)

**State Management:**
- [State Management in 2025: Redux Toolkit vs. Zustand vs. Jotai](https://medium.com/@pooja.1502/state-management-in-2025-redux-toolkit-vs-zustand-vs-jotai-vs-tanstack-store-c888e7e6f784)
- [State Management Trends in React 2025](https://makersden.io/blog/react-state-management-in-2025)
- [Do You Need State Management in 2025?](https://dev.to/saswatapal/do-you-need-state-management-in-2025-react-context-vs-zustand-vs-jotai-vs-redux-1ho)
- [React State Management: Context, Zustand & Jotai](https://javascript-conference.com/blog/react-state-management-context-zustand-jotai/)

**MapLibre in React:**
- [react-map-gl documentation](https://visgl.github.io/react-map-gl/)
- [React map library comparison](https://blog.logrocket.com/react-map-library-comparison/)
- [Adding Custom Data to react-map-gl](https://visgl.github.io/react-map-gl/docs/get-started/adding-custom-data)
- [Complete Guide to Sources and Layers](https://www.lostcreekdesigns.co/writing/a-complete-guide-to-sources-and-layers-in-react-and-mapbox-gl-js)

**GeoJSON Handling:**
- [MapLibre GeoJSON Polygon example](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-geojson-polygon/)
- [Optimising MapLibre Performance for Large GeoJSON](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [@mapcomponents/react-maplibre](https://www.npmjs.com/package/@mapcomponents/react-maplibre)

**CORS and Vite Proxy:**
- [Solving CORS with Vite Proxy Configuration](https://en.kelen.cc/posts/solving-cors-with-vite-proxy-configuration)
- [Local CORS Issues with Vite Proxy](https://medium.com/@kychok98/frontend-tips-2-local-cors-issues-with-vite-proxy-6b2cf4ca3672)
- [Setup Proxy in React Vite for CORS](https://medium.com/@aparna1002v/setup-proxy-in-react-vite-for-cors-issues-167c6a1eb569)
- [Vite Config Proxy CORS Guide](https://www.restack.io/p/vite-answer-config-proxy-cors)

**Real-Time Polling:**
- [TanStack Query Auto Refetching](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching)
- [Long polling with Express and React](https://medium.com/@ignatovich.dm/implementing-long-polling-with-express-and-react-2cb965203128)
- [Implementing Polling in React Guide](https://medium.com/@sfcofc/implementing-polling-in-react-a-guide-for-efficient-real-time-data-fetching-47f0887c54a7)
- [Enhancing UX with React Polling](https://www.dhiwise.com/post/a-guide-to-real-time-applications-with-react-polling)

**Build and Deployment:**
- [Serving Vite React with FastAPI via Docker](https://github.com/fastapi/fastapi/discussions/5134)
- [FastAPI Static Files](https://fastapi.tiangolo.com/tutorial/static-files/)
- [Multi-stage Docker build for Vite React](https://medium.com/@mahendhiran/building-a-production-ready-docker-image-for-a-react-vite-application-using-multi-stage-builds-3a34fe4a1c68)
- [React Vite Docker Nginx Production](https://www.buildwithmatija.com/blog/production-react-vite-docker-deployment)

**TypeScript Type Generation:**
- [pydantic-to-typescript PyPI](https://pypi.org/project/pydantic-to-typescript/)
- [GitHub phillipdupuis/pydantic-to-typescript](https://github.com/phillipdupuis/pydantic-to-typescript)
- [Converting Pydantic to TypeScript](https://medium.com/@blackkadder/converting-python-pydantic-classes-to-typescript-interfaces-7b6c3c2e360d)
- [Pydantic to Typescript GitHub Action](https://github.com/marketplace/actions/pydantic-to-typescript)

**Path Aliases in Vite:**
- [Streamlining Absolute Imports in React with Vite](https://dev.to/mizanrifat/streamlining-absolute-imports-in-react-with-typescript-and-vite-2bpp)
- [Setting up path aliases in Vite + TypeScript](https://medium.com/@vitor.vicen.te/setting-up-path-aliases-in-a-vite-typescript-react-project-the-ultimate-way-d2a9a8ff7c63)
- [vite-tsconfig-paths npm](https://www.npmjs.com/package/vite-tsconfig-paths)
