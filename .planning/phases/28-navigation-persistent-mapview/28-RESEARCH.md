# Phase 28: Navigation Structure + Persistent MapView — Research

**Researched:** 2026-02-18
**Domain:** React routing, persistent layout, MapLibre GL JS lifecycle, slide-over panel
**Confidence:** HIGH

---

## Summary

Phase 28 restructures the authenticated app shell so that MapLibre never unmounts when the user navigates between Kaart, Resultaten, and Projecten. The core problem is that MapLibre is expensive to initialize (tile data re-downloads, camera state resets, all layers must be re-added), so destroying and recreating the map on route change creates an unacceptably bad UX.

The existing codebase already has the correct architectural foundation: `_authenticated.tsx` is a TanStack Router pathless layout route. Its component (`AuthenticatedLayout`) stays mounted across all child route changes — only the `<Outlet />` region re-renders. The missing piece is that `MapView` currently lives inside `_authenticated/map.tsx` (a child route), not in `_authenticated.tsx` (the parent layout). Moving it up, combined with CSS `display: none` toggling for non-map views, solves NAV-02 with no library additions.

NAV-01 (sidebar with Kaart/Resultaten/Projecten) is already 80% built: `SideRailNav` exists with icon links to `/dashboard`, `/map`, `/projecten`. The phase needs to refine this to the three specific routes specified in requirements. NAV-03 (inspector slide-over panel) is a right-edge slide-in panel rendered over the persistent map — it does not block map interactions because it uses `pointer-events` CSS control.

**Primary recommendation:** Hoist `MapView` into `_authenticated.tsx` layout. Use CSS `display` toggling (not conditional rendering) to show/hide the map canvas for non-map routes. Expose `mapRef` and `mapReady` state via React context to child routes that need map access. No new state management library needed.

---

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-router` | 1.158.4 | File-based routing, pathless layouts | Already project standard |
| `maplibre-gl` | 5.17.0 | Map rendering | Already project standard |
| `react` | 19.2.0 | Component model, Context API | Already project standard |
| `tailwindcss` | 4.1.18 | Layout utilities | Already project standard |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 0.564.0 | Icon library (already in package.json) | Can replace inline SVG icons in SideRailNav |
| `react-resizable-panels` | 2.1.9 | Resizable panel for results view | Already used in ResultsLayout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `display:none` toggling | `tanstack-router-keepalive` | Community library, unverified in v1.158.4, adds a dependency for a problem solvable with CSS |
| React Context for mapRef | Zustand store | Zustand not in project; Context is sufficient for a single map instance |
| CSS slide-over (custom) | `react-sliding-pane` | External library for something that is 30 lines of Tailwind + CSS transition |

**Installation:** No new packages required. All needed libraries are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── routes/
│   ├── __root.tsx                  # Unchanged
│   ├── _authenticated.tsx          # MODIFIED: hoists MapView here
│   └── _authenticated/
│       ├── map.tsx                 # MODIFIED: map controls only (no MapView)
│       ├── resultaten.tsx          # NEW: Resultaten view (or keep in map.tsx)
│       ├── projecten.tsx           # Unchanged
│       └── dashboard.tsx          # Unchanged
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx          # Minor layout adjustments
│   │   ├── SideRailNav.tsx        # MODIFIED: updated nav items
│   │   └── InspectorPanel.tsx     # NEW: slide-over parcel inspector
│   └── map/
│       └── MapView.tsx            # Unchanged (receives mapRef from layout)
└── lib/
    └── MapContext.tsx             # NEW: React Context exposing mapRef/mapReady
```

### Pattern 1: Hoist MapView to Layout Route (Persistent Map)

**What:** Move `MapView` from `_authenticated/map.tsx` up into `_authenticated.tsx`. The layout renders MapView always, then shows/hides it with CSS based on current route.

**When to use:** When a heavy component must survive route changes. TanStack Router's pathless layout parent (`_authenticated.tsx`) stays mounted across all child route changes — only `<Outlet />` swaps content.

**How it works:** TanStack Router's file-based routing treats `_authenticated.tsx` as a persistent parent layout. When navigating from `/map` to `/projecten`, only the `<Outlet />` region re-renders. The MapView, placed as a sibling to `<Outlet />`, is never touched by the router.

```typescript
// _authenticated.tsx — simplified pattern
function AuthenticatedLayout() {
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const isMapRoute = useMatchRoute({ to: '/map', fuzzy: true })

  return (
    <div className="flex h-screen">
      <SideRailNav />
      <main className="flex-1 relative overflow-hidden">
        {/* MapView always mounted, hidden on non-map routes */}
        <div
          className="absolute inset-0"
          style={{ display: isMapRoute ? 'block' : 'none' }}
        >
          <MapView
            mapRef={mapRef}
            onMapReady={() => setMapReady(true)}
          />
        </div>
        {/* Outlet renders route-specific UI on top of or beside map */}
        <MapContext.Provider value={{ mapRef, mapReady }}>
          <Outlet />
        </MapContext.Provider>
      </main>
    </div>
  )
}
```

**Critical detail:** Use `style={{ display: isMapRoute ? 'block' : 'none' }}` rather than conditional rendering (`{isMapRoute && <MapView />}`). Conditional rendering unmounts the component, destroying the map instance. CSS `display: none` keeps the DOM node alive while hiding it visually. MapLibre GL JS correctly handles being hidden and re-shown this way.

### Pattern 2: MapContext — Sharing mapRef with Child Routes

**What:** React Context that exposes `mapRef` and `mapReady` to child routes that need map access (the map page needs to register event handlers, add layers, etc.).

**When to use:** MapView is now in the parent layout, but `_authenticated/map.tsx` still needs `mapRef` to control the map (fly to coordinates, add layers, etc.).

```typescript
// src/lib/MapContext.tsx
import { createContext, useContext } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

interface MapContextValue {
  mapRef: React.RefObject<MapLibreMap | null>
  mapReady: boolean
}

export const MapContext = createContext<MapContextValue | null>(null)

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMapContext must be used within MapContext.Provider')
  return ctx
}
```

### Pattern 3: Inspector Slide-Over Panel (NAV-03)

**What:** A right-edge panel that slides in over the map when a parcel is selected. Does NOT block map interactions — uses narrow panel width and `pointer-events: none` on the backdrop (or no backdrop at all).

**When to use:** When users click a parcel on the map and want to see details without losing map context.

**Design specification from requirements:** "slide-over panel" implies a partially-visible panel that overlays the map rather than pushing it. The existing `Drawer.tsx` uses a full-height right drawer with backdrop — for the inspector, skip the backdrop (or use a very subtle one) to keep map interactive.

```typescript
// InspectorPanel pattern (overlay, no map-blocking backdrop)
function InspectorPanel({ isOpen, onClose, children }: InspectorPanelProps) {
  return (
    <div
      className={`absolute right-0 top-0 h-full w-80 bg-black/40 backdrop-blur-xl
                  border-l border-white/10 shadow-2xl flex flex-col
                  transition-transform duration-300 ease-out
                  ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ zIndex: 'var(--z-property-panel)' }}
    >
      {children}
    </div>
  )
}
```

Note: Unlike `Drawer.tsx`, this panel does NOT use `FocusLock` or a backdrop overlay. The map underneath remains fully interactive (clicks, pan, zoom all work).

### Pattern 4: SideRailNav Update (NAV-01)

**What:** The existing `SideRailNav` needs to be updated to match the three-view navigation pattern: Kaart, Resultaten, Projecten. The current nav includes Dashboard — the phase requirements specify Kaart, Resultaten, Projecten.

**Current state:**
- Dashboard link → `/dashboard`
- Kaart link → `/map`
- Projecten link → `/projecten`
- Plus: Notification bell, Rapporten toggle button, Instellingen, Logout

**Required changes:**
- The three primary nav items become: Kaart (`/map`), Resultaten (could be `/map` with results panel open, or a separate route), Projecten (`/projecten`)
- "Resultaten" requires clarification: it could be a sidebar panel state (show the scan results), not a separate URL route

**Key decision for planner:** The requirements say "Kaart, Resultaten, and Projecten" but Resultaten is currently a panel within `/map`. Whether to introduce `/resultaten` as a new route or treat it as map-page state that the nav button triggers is an architectural choice. The safest option: Resultaten = navigate to `/map` and set a URL param `?panel=results` that opens the results sidebar. This preserves the existing `ResultsLayout` architecture.

### Anti-Patterns to Avoid

- **Conditional rendering of MapView:** `{isMapRoute && <MapView />}` — unmounts and destroys the MapLibre instance on every route change.
- **Recreating `mapRef` on route change:** `mapRef` must be stable across renders. Keep it in the parent layout (`useRef` at `_authenticated.tsx` level), not in child route components.
- **Wrapping MapView in TanStack Router's `<Outlet />`:** Outlet content remounts on route change. MapView must be a sibling to Outlet, not inside it.
- **Using `tanstack-router-keepalive`:** Community library, untested at v1.158.4, adds a complex dependency for a problem that CSS solves.
- **Backdrop on InspectorPanel:** A full-screen backdrop blocks map interactions. The inspector panel should overlay without a backdrop, or use a very narrow backdrop offset from the map.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS slide animation | Custom keyframe animation | Tailwind `transition-transform` + `translate-x-full`/`translate-x-0` | Already used in existing Drawer.tsx — consistent pattern |
| Map state persistence | Custom serialization | MapLibre's `getCenter()`, `getZoom()`, `getBearing()` on `camera` event | MapLibre natively exposes camera state |
| Focus management in inspector | Custom focus trap | `react-focus-lock` (already installed) | Already used in Drawer.tsx |
| Icon components | More custom SVGs | `lucide-react` (already installed at 0.564.0) | Already in package.json, consistent icon system |

**Key insight:** The persistence problem is solved by architecture (hoisting MapView to parent layout), not by a library. The CSS `display` toggle is the correct primitive — it is what browsers do natively to preserve DOM state.

---

## Common Pitfalls

### Pitfall 1: MapLibre resize after display:none toggle
**What goes wrong:** After hiding (display:none) and re-showing the map container, MapLibre's internal canvas size may be stale, causing the map to render at wrong dimensions.
**Why it happens:** MapLibre listens to container resize events, but `display:none` prevents layout, so the canvas size isn't recalculated.
**How to avoid:** Call `map.resize()` after toggling `display` back to `block`. Add a `useEffect` in the layout that watches the current route and calls `mapRef.current?.resize()` whenever map becomes visible.
**Warning signs:** Map renders correctly on first load but appears misaligned (half-rendered, wrong scale) after returning to `/map` from another route.

### Pitfall 2: MapView `transformRequest` becomes stale
**What goes wrong:** `transformRequest` in the current `map.tsx` captures `accessToken` via closure. If `accessToken` changes (token refresh), the stale closure in the MapLibre instance never updates.
**Why it happens:** MapLibre's `transformRequest` is set at map construction time and is not reactive to React state changes.
**How to avoid:** Use a `useRef` to hold a stable `transformRequestFn` that reads from a ref-backed `accessToken`. Pattern already exists in codebase — carry it to the new layout location.
**Warning signs:** Tile requests fail after long sessions (token expired, new token not used).

### Pitfall 3: useMapContext outside provider
**What goes wrong:** Routes that don't need the map (e.g., `/instellingen`) still get wrapped in `MapContext.Provider` in the layout, so this isn't a problem. But if `useMapContext` is called conditionally or the context isn't provided, it throws.
**Why it happens:** Defensive coding gap.
**How to avoid:** The `useMapContext` hook already throws with a clear error message. No further action needed — just ensure MapContext.Provider wraps `<Outlet />` in `_authenticated.tsx`.

### Pitfall 4: mapRef.current is null in child route effects
**What goes wrong:** A child route's `useEffect` reads `mapRef.current` before the map is ready.
**Why it happens:** MapView initialization is async (map fires `'load'` event). React renders the child route immediately, but the map may still be loading.
**How to avoid:** Guard all map operations with `if (!mapReady || !mapRef.current) return`. The `mapReady` state flag (set in `onMapReady` callback) is the correct gate. Expose it through MapContext alongside `mapRef`.
**Warning signs:** Console errors like "Cannot read properties of null (reading 'getSource')" on initial load.

### Pitfall 5: InspectorPanel intercepts map events
**What goes wrong:** The inspector panel, if positioned over the map, may intercept mouse events (pan, zoom, click) on the portion of the map it overlaps.
**Why it happens:** Default CSS — elements in the stacking order above the map canvas receive pointer events first.
**How to avoid:** The panel itself should receive pointer events (user interacts with it), but areas of the map NOT under the panel should still be interactive. Since the panel is right-edge and the map occupies the full width, the map area left of the panel remains interactive. Use `pointer-events: none` only on any transparent backdrop element (if used at all).
**Warning signs:** User cannot pan the map when the inspector is open (especially on the left side where the panel doesn't overlap).

### Pitfall 6: `display:none` breaks MapLibre cursor and interaction state
**What goes wrong:** After routing away from `/map` and back, MapLibre's cursor might be stuck as `pointer` (from a hover event that fired before navigation).
**Why it happens:** The `mouseleave` event doesn't fire when `display:none` is applied — MapLibre never gets a chance to reset hover state.
**How to avoid:** Reset cursor and hover state explicitly when hiding the map (in the `useEffect` that toggles visibility). Set `map.getCanvas().style.cursor = ''`.

---

## Code Examples

Verified patterns from existing codebase and current documentation:

### Persistent MapView in Layout Route
```typescript
// _authenticated.tsx — key structural pattern
import { useRef, useState } from 'react'
import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router'
import MapView from '@/components/map/MapView'
import { MapContext } from '@/lib/MapContext'
import type { Map as MapLibreMap } from 'maplibre-gl'

function AuthenticatedLayout() {
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const matchRoute = useMatchRoute()
  const isMapVisible = !!matchRoute({ to: '/map', fuzzy: true })

  // Resize map after becoming visible again
  useEffect(() => {
    if (isMapVisible && mapReady && mapRef.current) {
      mapRef.current.resize()
    }
  }, [isMapVisible, mapReady])

  return (
    <div className="flex h-screen">
      <SideRailNav />
      <main className="flex-1 relative overflow-hidden">
        {/* Map: always in DOM, CSS-toggled */}
        <div
          className="absolute inset-0"
          style={{ display: isMapVisible ? 'block' : 'none' }}
        >
          <MapView mapRef={mapRef} onMapReady={() => setMapReady(true)} />
        </div>
        {/* Overlay: route-specific UI */}
        <MapContext.Provider value={{ mapRef, mapReady }}>
          <Outlet />
        </MapContext.Provider>
      </main>
    </div>
  )
}
```

### Consuming mapRef in map route
```typescript
// _authenticated/map.tsx — consumes map from context instead of owning it
import { useMapContext } from '@/lib/MapContext'

function MapPage() {
  const { mapRef, mapReady } = useMapContext()
  // All existing map logic works unchanged — mapRef is the same ref
  // ...
}
```

### InspectorPanel slide-over
```typescript
// components/layout/InspectorPanel.tsx
interface InspectorPanelProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function InspectorPanel({ isOpen, onClose, children }: InspectorPanelProps) {
  return (
    <div
      className={`absolute right-0 top-0 h-full w-80 max-w-[90vw]
                  bg-grey-900/90 backdrop-blur-xl border-l border-white/10
                  shadow-lg flex flex-col
                  transition-transform duration-300 ease-out
                  ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ zIndex: 'var(--z-property-panel)' }}
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-sm font-medium text-grey-100">Perceeldetails</span>
        <button onClick={onClose} aria-label="Sluiten">
          {/* X icon */}
        </button>
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
```

### Camera state preservation (NAV-02)
Camera state is preserved automatically because MapLibre is never unmounted. No extra code needed. The map instance retains its center, zoom, bearing, and pitch across React renders. The only concern is calling `map.resize()` after un-hiding the map container.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MapView in child route (unmounts on nav) | MapView in parent layout (persistent) | This phase | Map never reloads on navigation |
| Drawer with backdrop for property details | InspectorPanel without backdrop | This phase | Map stays interactive when inspector open |
| SideRailNav with Dashboard/Map/Projecten | SideRailNav with Kaart/Resultaten/Projecten | This phase | Matches requirements NAV-01 |
| `mapRef` owned by map page | `mapRef` in layout, shared via Context | This phase | Child routes can access map without prop drilling |

**Current state (before Phase 28):**
- `_authenticated.tsx` — layout with SideRailNav + Outlet (good)
- `_authenticated/map.tsx` — owns MapView, mapRef, all map state (problem: map destroys on route change)
- No inspector panel exists (NAV-03 is new)

---

## Open Questions

1. **Is "Resultaten" a route or a panel state?**
   - What we know: Currently, scan results are shown as a collapsible left panel within `/map` via `ResultsLayout`
   - What's unclear: Requirements say "navigate between Kaart, Resultaten, and Projecten" — does Resultaten deserve its own URL (`/resultaten`)?
   - Recommendation: Keep Resultaten as `/map?panel=results` state rather than a new route. This avoids duplicating map-page logic. The sidebar nav button for Resultaten navigates to `/map` and sets a URL search param. This satisfies NAV-01 without a new route file.

2. **What parcel data does the InspectorPanel show?**
   - What we know: Existing `ParcelEnrichmentCard` and `PropertyDetailDrawer` exist for enriched property data
   - What's unclear: NAV-03 says "parcel details" — is this the scan result enrichment data, or the full property report?
   - Recommendation: For Phase 28, the inspector shows scan result item data (from `ScanResultItem` type). Full property report (kadaster etc.) is the existing PropertyDetailDrawer flow. The planner should treat them as separate flows.

3. **Back/forward browser history with map state (NAV-02 criterion 5)**
   - What we know: TanStack Router manages browser history automatically
   - What's unclear: "Browser back/forward navigates between views with map state preserved" — map state (camera position) persists because MapView never unmounts. But if user navigates from `/map` → `/projecten` → back → `/map`, the back button restores the URL, but MapView was never unmounted, so camera is already correct.
   - Recommendation: This works for free with the hoisted MapView pattern. No special code needed.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `/frontend/src/routes/_authenticated.tsx` — confirms pathless layout already exists
- Codebase: `/frontend/src/components/map/MapView.tsx` — confirms MapLibre uses `useEffect` with empty deps (safe to move to parent)
- Codebase: `/frontend/src/components/layout/SideRailNav.tsx` — confirms nav icons and structure
- Codebase: `/frontend/src/styles/index.css` — confirms CSS variables (`--z-property-panel` etc.)
- Codebase: `/frontend/package.json` — confirms installed libraries, no Zustand
- Codebase: `/frontend/src/components/ui/Drawer.tsx` — confirms existing slide-over pattern

### Secondary (MEDIUM confidence)
- [TanStack Router Discussion #2084](https://github.com/TanStack/router/discussions/2084) — pathless layout routes stay mounted; v1.46.7+ fixes remounting
- [TanStack Router Discussion #1447](https://github.com/TanStack/router/discussions/1447) — KeepAlive pattern is community-driven, no official support
- WebSearch: CSS `display:none` pattern for persistent React components — confirmed by multiple sources as the standard approach for map persistence

### Tertiary (LOW confidence)
- MapLibre `map.resize()` needed after display:none toggle — based on known MapLibre GL JS behavior from training data; verify during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing libraries confirmed in package.json
- Architecture: HIGH — directly derived from reading existing codebase; TanStack Router pathless layout pattern is well-documented
- Pitfalls: MEDIUM — `map.resize()` requirement is from MapLibre knowledge (verify); others derived from reading existing code patterns
- InspectorPanel: HIGH — pattern derived from existing `Drawer.tsx`, adapted for no-backdrop variant

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable stack, 30-day window)
