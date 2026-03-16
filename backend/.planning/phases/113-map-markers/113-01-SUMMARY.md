---
phase: 113-map-markers
plan: 01
subsystem: ui
tags: [maplibre, react, tanstack-query, fastapi, postgis, geojson]

# Dependency graph
requires:
  - phase: 109-favorites
    provides: parcel_favorites table + favorites API endpoints + useFavorites hooks
  - phase: 112-portfolio
    provides: portfolio pipeline UI + favorites toggle on map
provides:
  - GET /api/parcels/favorites/centroids endpoint with ST_Centroid PostGIS
  - FavoriteMarkersLayer.ts MapLibre GeoJSON source + circle layer
  - useFavoriteCentroids hook with auto-invalidation on favorites changes
  - Red circle markers on map at favorited parcel centroids
affects: [map, portfolio, favorites]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GeoJSON overlay layer added after vector tile layer for correct z-order"
    - "['favorites', 'centroids'] query key auto-invalidates when ['favorites'] is invalidated"
    - "Favorite markers visibility independent of Percelen toggle (different semantic purpose)"

key-files:
  created:
    - backend/app/favorites/schemas.py (FavoriteCentroidResponse added)
    - frontend/src/hooks/useFavoriteCentroids.ts
    - frontend/src/components/map/FavoriteMarkersLayer.ts
  modified:
    - backend/app/favorites/router.py (centroids endpoint added)
    - frontend/src/routes/_authenticated/map.tsx (hook + layer wiring)

key-decisions:
  - "['favorites', 'centroids'] query key as sub-key of ['favorites'] enables automatic invalidation via TanStack Query partial matching when favorites are toggled"
  - "addFavoriteMarkersLayer called inside ensureParcelScoreLayer after addParcelScoreLayer to guarantee correct z-order"
  - "Favorite markers NOT tied to layerState.showParcels — they serve portfolio awareness, not parcel exploration"
  - "minzoom 12 for markers (vs 14 for parcel score layer) so favorites stay visible slightly further out"

patterns-established:
  - "GeoJSON circle layers added after vector tile sources for marker-on-top z-ordering"

requirements-completed: [FAV-03]

# Metrics
duration: 8min
completed: 2026-03-16
---

# Phase 113 Plan 01: Map Markers Summary

**Backend ST_Centroid endpoint + MapLibre GeoJSON circle layer rendering favorited parcels as red markers on the map, updating live when favorites are toggled**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T07:59:00Z
- **Completed:** 2026-03-16T08:07:10Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `GET /api/parcels/favorites/centroids` — PostGIS ST_Centroid query returning lon/lat per favorited parcel, org-scoped
- Created `FavoriteMarkersLayer.ts` with `addFavoriteMarkersLayer`, `updateFavoriteMarkers`, `removeFavoriteMarkersLayer`
- Created `useFavoriteCentroids` hook with `['favorites', 'centroids']` query key for automatic cache invalidation
- Wired markers into `MapPage` so they update reactively when favorites are toggled, independent of Percelen toggle

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend centroids endpoint + frontend query hook** - `fc2886e` (feat)
2. **Task 2: FavoriteMarkersLayer + map.tsx wiring** - `5fb9595` (feat)

## Files Created/Modified
- `backend/app/favorites/schemas.py` - Added `FavoriteCentroidResponse` model
- `backend/app/favorites/router.py` - Added `GET /favorites/centroids` endpoint with ST_Centroid PostGIS query
- `frontend/src/hooks/useFavoriteCentroids.ts` - TanStack Query hook, query key `['favorites', 'centroids']`
- `frontend/src/components/map/FavoriteMarkersLayer.ts` - MapLibre GeoJSON source + red circle layer
- `frontend/src/routes/_authenticated/map.tsx` - Hook call + addFavoriteMarkersLayer + reactive useEffect

## Decisions Made
- Query key `['favorites', 'centroids']` chosen as sub-key of `['favorites']` so TanStack Query's partial key matching auto-invalidates centroids whenever `useToggleFavorite.onSettled` runs
- `addFavoriteMarkersLayer` inserted inside `ensureParcelScoreLayer` (after `addParcelScoreLayer`) to ensure correct z-order without requiring a separate initialization path
- `minzoom: 12` for markers vs `minzoom: 14` for parcel score layer — favorites stay visible slightly zoomed out for portfolio overview
- Markers deliberately NOT tied to `layerState.showParcels` — favorites represent the user's portfolio, not parcel exploration mode

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Favorite parcel markers visible on map at correct centroid positions
- Markers update live on toggle (add/remove favorite) via TanStack Query invalidation
- `removeFavoriteMarkersLayer` available for cleanup if needed in future phases
- Ready for Phase 113 Plan 02 or any phase extending map marker behavior

---
*Phase: 113-map-markers*
*Completed: 2026-03-16*
