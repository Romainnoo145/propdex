# Phase 113: Map Markers - Research

**Researched:** 2026-03-16
**Domain:** MapLibre GL JS — client-side GeoJSON overlay layer driven by TanStack Query cache
**Confidence:** HIGH

## Summary

Phase 113 requires favorited parcels to appear visually distinct on the map tile layer, and for that distinction to update in real time when the user toggles the heart button — no page reload. The map uses MapLibre GL JS with MVT vector tiles served from a FastAPI tile proxy (`tile_proxy.py`). Parcel fill colors are score-driven paint expressions on the `parcel-scores` vector tile source.

The core architectural decision is whether to embed favorites in the MVT tiles (server-side) or overlay them via a client-side GeoJSON source. Server-side embedding would require favorites data in the tile SQL query plus a tile cache-bust on every toggle — slow, complex, and introduces auth coupling into the tile pipeline. Client-side GeoJSON overlay is the correct approach: the `['favorites']` TanStack Query cache is already available in-browser, and MapLibre supports dynamically updating a GeoJSON source with `map.getSource().setData()`. This matches the existing pattern used by `PropertyGeometryLayer.tsx` (GeoJSON overlays on top of vector tiles).

The key challenge is bridging the identifier gap: `FavoriteResponse.parcel_id` stores the Kadaster parcel code (e.g. `HTT02-A-1234`), and the MVT tile feature already exposes `parcel_code` (column `pc.parcel_id AS parcel_code` in the tile SQL). For the GeoJSON overlay we do NOT need the parcel polygon geometry — instead we render circle markers at the parcel centroid. Centroids are available via `GET /api/scans/parcels/{parcel_id}/centroid` but that requires a UUID, not a Kadaster code. The simpler approach: a new lightweight backend endpoint `GET /api/parcels/favorites/centroids` that resolves all favorited parcel codes to their WGS84 centroids in one query (JOIN `parcel_cache` on `parcel_id = parcel_code`).

**Primary recommendation:** Client-side GeoJSON source for favorite markers. A single new backend endpoint returns centroids for all favorited parcel codes. The frontend `FavoriteMarkersLayer` module manages a GeoJSON `circle` layer over the score tiles, updated reactively via a `useEffect` that depends on the `['favorites']` query data.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FAV-03 | Favorited parcels render a distinct marker or color on the map tile layer (different from standard score-based coloring), and markers update when a parcel is favorited or unfavorited without requiring a page reload | GeoJSON overlay layer driven by favorites cache, centroid endpoint for position data, `setData()` for live updates |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | Already in project | Add/update GeoJSON sources and layers | All existing map layers use this API |
| @tanstack/react-query | Already in project | `['favorites']` query cache as reactive data source | HeartButton already invalidates this cache |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SQLAlchemy 2.x | Already in project | Backend centroid query via `ST_Centroid` + `ST_Transform` | New `/api/parcels/favorites/centroids` endpoint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GeoJSON circle layer | Modify MVT tile SQL to include `is_favorite` flag | MVT approach requires tile cache-bust on every toggle (slow), auth coupling in tile pipeline, no real-time update without tile reload |
| GeoJSON circle layer | maplibre-gl Marker objects (HTML) | DOM markers do not scale well for 100+ favorites, not batch-renderable, can't use paint expressions |
| Centroid endpoint | Client-side polygon centroid computation | Would require fetching full parcel geometries — expensive; centroid DB query is a single JOIN |

**Installation:** No new dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/components/map/
├── FavoriteMarkersLayer.tsx   # New: manage favorite marker source + layer
frontend/src/routes/_authenticated/
├── map.tsx                    # Wire: import hook + call addFavoriteMarkersLayer
backend/app/
├── favorites/router.py        # Add: GET /api/parcels/favorites/centroids endpoint
```

### Pattern 1: GeoJSON Overlay Module (matches existing PropertyGeometryLayer pattern)
**What:** A self-contained `FavoriteMarkersLayer.tsx` module exports `addFavoriteMarkersLayer(map)` which creates a GeoJSON source + `circle` layer, and `updateFavoriteMarkers(map, features)` which calls `source.setData()`. No React components inside the module — pure MapLibre imperative API, matching all other layer modules.
**When to use:** Any time a non-tile dataset must be overlaid on the map and updated client-side without tile reloads.
**Example:**
```typescript
// Source: MapLibre GL JS docs — GeoJSON source setData
const source = map.getSource('favorite-markers') as maplibregl.GeoJSONSource
source.setData({
  type: 'FeatureCollection',
  features: favoriteFeatures,
})
```

### Pattern 2: Reactive useEffect in map.tsx
**What:** In `map.tsx`, call `useParcelFavorites()` to subscribe to the `['favorites']` query. A `useEffect` depending on `[favoritesData, mapReady]` calls `updateFavoriteMarkers()`. When the user toggles the heart button, `useToggleFavorite.onSettled` invalidates `['favorites']`, TanStack Query refetches, the effect fires, and the GeoJSON source is updated — all within ~500ms, no reload.
**When to use:** Any reactive map update driven by TanStack Query cache.
**Example:**
```typescript
const { data: favoritesData } = useParcelFavorites()

useEffect(() => {
  if (!mapReady || !mapRef.current) return
  const map = mapRef.current
  if (!map.getSource('favorite-markers')) return
  updateFavoriteMarkers(map, favoriteCentroids)
}, [favoritesData, mapReady, favoriteCentroids])
```

### Pattern 3: Backend Centroids Endpoint
**What:** `GET /api/parcels/favorites/centroids` — authenticated, org-scoped. JOINs `parcel_favorites` with `parcel_cache` on `parcel_favorites.parcel_id = parcel_cache.parcel_id` (Kadaster string). Returns GeoJSON FeatureCollection (or list of `{parcel_code, lon, lat}`) using `ST_X(ST_Transform(ST_Centroid(geometry), 4326))` and `ST_Y(...)`.
**When to use:** Needed once on page load and after every favorites mutation.
**Example:**
```python
# Source: PostGIS ST_Centroid + ST_Transform pattern
SELECT
    pf.parcel_id AS parcel_code,
    ST_X(ST_Transform(ST_Centroid(pc.geometry), 4326)) AS lon,
    ST_Y(ST_Transform(ST_Centroid(pc.geometry), 4326)) AS lat
FROM parcel_favorites pf
JOIN parcel_cache pc ON pc.parcel_id = pf.parcel_id
                     AND pc.organization_id = :org_id
WHERE pf.user_id = :user_id
  AND pf.organization_id = :org_id
```

### Anti-Patterns to Avoid
- **Embedding favorites in tile SQL:** The `best_sr` CTE in `tile_proxy.py` would need a subquery join against `parcel_favorites` — adds per-tile auth-scoped query cost, requires TILE_SCHEMA_VERSION bump, and cannot react to favorites changes without a full tile cache-bust. Never do this.
- **Using maplibre-gl HTML Marker objects for portfolio markers:** DOM-based, can't be batch-rendered, expensive for large portfolios, no paint expression support. Use a GeoJSON `circle` layer instead.
- **Polling for favorites:** `staleTime: 5 * 60 * 1000` is already set on `['favorites']`. Invalidation on toggle is enough — do not add a polling interval.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Centroid from parcel geometry | Client-side polygon centroid | `ST_Centroid(pc.geometry)` in SQL | PostGIS centroid is exact and fast; client has no access to full polygon from tiles |
| Live marker updates | Polling or tile reload | `source.setData()` after TanStack Query invalidation | Already the standard MapLibre pattern; zero reload |
| Favorite detection on tiles | Tile property `is_favorite` | Client-side GeoJSON overlay | Tiles are pre-rendered bytes; runtime personalization must be client-side |

**Key insight:** MVT tiles are org-scoped but not user-scoped. Favorite data is per-user. Any per-user visual decoration must live in a client-side layer on top of the tiles.

## Common Pitfalls

### Pitfall 1: Source does not exist yet when effect fires
**What goes wrong:** `map.getSource('favorite-markers')` returns undefined if the GeoJSON source was not added before the effect fires (mapReady race).
**Why it happens:** `addFavoriteMarkersLayer` is called once after `map.on('load')`, but `useEffect` for favorites data may fire before the load event completes.
**How to avoid:** Guard with `if (!map.getSource('favorite-markers')) return` in the update effect, or call `addFavoriteMarkersLayer` as part of the same initialization flow that adds `parcel-scores`.
**Warning signs:** Silent failures; markers never appear on first load.

### Pitfall 2: Identifier mismatch between favorites and tile features
**What goes wrong:** `FavoriteResponse.parcel_id` is a Kadaster string (`HTT02-A-1234`). The tile `parcel_id` property is the ParcelCache UUID. Matching on `parcel_id` would fail.
**Why it happens:** The favorites table stores the Kadaster code as `parcel_id` (see Phase 109 pattern). The MVT tile exposes both `parcel_id` (UUID) and `parcel_code` (Kadaster string). The centroid endpoint must JOIN on `parcel_cache.parcel_id = favorites.parcel_id` (both are Kadaster codes).
**How to avoid:** Always use `parcel_code` (Kadaster string) as the join key. Never use the UUID for this query.
**Warning signs:** Empty result set from centroid query despite favorites existing.

### Pitfall 3: Layer ordering — markers hidden under other layers
**What goes wrong:** GeoJSON circle layer added before parcel score fill layers; markers are invisible.
**Why it happens:** MapLibre renders layers in insertion order. Circles must be added after all fill layers.
**How to avoid:** In `addFavoriteMarkersLayer`, call `map.addLayer(layer, beforeLayerId)` to insert the circle layer above the score layers but below UI layers. Or add last (after all parcel layers are initialized).
**Warning signs:** Markers only visible on hover or when other layers are toggled off.

### Pitfall 4: Multi-tenant isolation gap
**What goes wrong:** Centroid endpoint returns parcels from other organizations if org_id filter is missing on `parcel_cache`.
**Why it happens:** `parcel_favorites` is already org-scoped but `parcel_cache` JOIN could cross tenants if WHERE clause omits `pc.organization_id`.
**How to avoid:** Always filter `pc.organization_id = :org_id` in the JOIN. Follow the MEMORY.md multi-tenant pattern.

### Pitfall 5: Empty favorites list produces invalid GeoJSON
**What goes wrong:** `{ type: 'FeatureCollection', features: [] }` is valid GeoJSON. But if the centroid endpoint returns `[]` when no favorites, `setData` call with empty features is correct and hides all markers — this is desired behavior.
**How to avoid:** No special handling needed; MapLibre handles empty FeatureCollections correctly.

## Code Examples

Verified patterns from codebase:

### GeoJSON source + circle layer (MapLibre pattern, matches PropertyGeometryLayer.tsx)
```typescript
// Source: frontend/src/components/map/PropertyGeometryLayer.tsx (circle marker pattern)
map.addSource('favorite-markers', {
  type: 'geojson',
  data: { type: 'FeatureCollection', features: [] },
})

map.addLayer({
  id: 'favorite-markers-circle',
  type: 'circle',
  source: 'favorite-markers',
  paint: {
    'circle-radius': 8,
    'circle-color': '#ef4444',   // red fill — distinct from amber score colors
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.9,
  },
  minzoom: 12,
})
```

### Updating GeoJSON source reactively (MapLibre setData pattern)
```typescript
// Source: MapLibre GL JS GeoJSON source API
const source = map.getSource('favorite-markers') as maplibregl.GeoJSONSource
source.setData({
  type: 'FeatureCollection',
  features: centroids.map((c) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
    properties: { parcel_code: c.parcel_code },
  })),
})
```

### TanStack Query invalidation trigger (already wired in HeartButton)
```typescript
// Source: frontend/src/hooks/useFavorites.ts lines 153-157
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: ['favorites'] })
  queryClient.invalidateQueries({ queryKey: ['portfolio'] })
},
```
The centroids query should use `['favorites', 'centroids']` as its key so it is automatically invalidated when `['favorites']` is invalidated — or use a dependent query that re-fetches when `favoritesData` changes.

### Backend centroid query (PostGIS pattern matching existing tile_proxy.py style)
```python
# Source: pattern from backend/app/services/tile_proxy.py (ST_Transform usage)
query = text("""
    SELECT
        pf.parcel_id AS parcel_code,
        ST_X(ST_Transform(ST_Centroid(pc.geometry), 4326)) AS lon,
        ST_Y(ST_Transform(ST_Centroid(pc.geometry), 4326)) AS lat
    FROM parcel_favorites pf
    JOIN parcel_cache pc
      ON pc.parcel_id = pf.parcel_id
     AND pc.organization_id = :org_id
    WHERE pf.user_id = :user_id
      AND pf.organization_id = :org_id
""")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTML Marker objects | GeoJSON circle layers | MapLibre best practice | Batch rendering, paint expression support, no DOM overhead |
| Tile-embedded per-user data | Client-side overlay | Architecture principle | Tiles are org-scoped; user-scoped decoration belongs client-side |

**Deprecated/outdated:**
- `maplibregl.Marker` for portfolio-scale markers: fine for 1-2 markers (address search pin), wrong for 10-500 portfolio parcels.

## Open Questions

1. **Where to fetch centroids: new endpoint or derive from existing favorites data?**
   - What we know: `FavoriteResponse` has no coordinates. `parcel_cache` has geometry. JOIN is cheap.
   - What's unclear: Whether a dedicated `/api/parcels/favorites/centroids` endpoint is better than extending `GET /api/parcels/favorites` to include `lon`/`lat` fields.
   - Recommendation: Separate `GET /api/parcels/favorites/centroids` — keeps favorites endpoint lean and avoids a DB JOIN on the hot favorites path. Centroids are only needed when the map is open.

2. **Should the favorite marker layer be always visible or only when `showParcels` is active?**
   - What we know: Score tiles only appear when `layerState.showParcels` is true.
   - What's unclear: Whether favorite markers should be visible even when Percelen toggle is OFF (useful for seeing portfolio locations on a clean map).
   - Recommendation: Show favorite markers independently of the Percelen toggle. Users navigating to their portfolio should always see their favorites on the map. The planner should decide this — flag as discretion item.

3. **Visual design: circle marker or filled parcel polygon?**
   - What we know: Circle markers are the simplest and scale well. Filled parcel polygon requires fetching full geometry (expensive for 100+ favorites). The `PropertyGeometryLayer` uses polygon fill only for the currently selected parcel.
   - Recommendation: Circle markers at centroid for the portfolio overlay. Filled polygon highlight is already handled for the selected/open parcel via `PropertyGeometryLayer`.

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/map/ParcelScoreLayer.tsx` — Full layer module pattern: source setup, layer add, setData, visibility toggle
- `frontend/src/components/map/PropertyGeometryLayer.tsx` — GeoJSON source + circle layer pattern
- `frontend/src/hooks/useFavorites.ts` — `['favorites']` cache structure, invalidation pattern, `FavoriteResponse.parcel_id` = Kadaster string
- `backend/app/services/tile_proxy.py` — `parcel_code` (Kadaster) exposed in MVT as `pc.parcel_id AS parcel_code`; `ST_Transform` usage pattern
- `frontend/src/lib/types/portfolio.ts` — `FavoriteResponse` type: `parcel_id` = Kadaster string

### Secondary (MEDIUM confidence)
- MapLibre GL JS GeoJSON source `setData()` — standard documented API, no verification needed beyond codebase usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — GeoJSON overlay pattern proven in `PropertyGeometryLayer.tsx`, tile-side approach definitively ruled out
- Pitfalls: HIGH — identifier mismatch (parcel_id vs parcel_code) verified from source; layer ordering from MapLibre docs; multi-tenant pattern from MEMORY.md

**Research date:** 2026-03-16
**Valid until:** 2026-06-16 (stable MapLibre + TanStack Query APIs)
