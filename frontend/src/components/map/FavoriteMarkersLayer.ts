/**
 * FavoriteMarkersLayer
 *
 * Renders favorited parcels as red circle markers on the MapLibre map.
 * Markers are added as a GeoJSON source + circle layer so they update
 * reactively without reloading tiles.
 *
 * Layer is added AFTER the parcel score layer so it renders on top.
 * Visibility is NOT tied to the Percelen toggle — favorites markers
 * serve a different purpose (portfolio awareness) and should always
 * be visible when the user has favorites.
 */

import type maplibregl from 'maplibre-gl'

export const FAVORITE_MARKERS_SOURCE = 'favorite-markers'
export const FAVORITE_MARKERS_LAYER = 'favorite-markers-circle'

/**
 * Add the GeoJSON source and circle layer for favorite markers.
 * Initializes with an empty FeatureCollection.
 *
 * Call this after addParcelScoreLayer so markers render on top.
 */
export function addFavoriteMarkersLayer(map: maplibregl.Map): void {
  map.addSource(FAVORITE_MARKERS_SOURCE, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  })

  map.addLayer({
    id: FAVORITE_MARKERS_LAYER,
    type: 'circle',
    source: FAVORITE_MARKERS_SOURCE,
    paint: {
      'circle-radius': 7,
      'circle-color': '#ef4444',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
    },
    minzoom: 12,
  })
}

/**
 * Update the favorite markers GeoJSON source with fresh centroid data.
 * Calling this with an empty array clears all markers without errors.
 */
export function updateFavoriteMarkers(
  map: maplibregl.Map,
  centroids: { parcel_code: string; lon: number; lat: number }[]
): void {
  const source = map.getSource(FAVORITE_MARKERS_SOURCE) as maplibregl.GeoJSONSource | undefined
  if (!source) return

  source.setData({
    type: 'FeatureCollection',
    features: centroids.map((c) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [c.lon, c.lat],
      },
      properties: {
        parcel_code: c.parcel_code,
      },
    })),
  })
}

/**
 * Remove the favorite markers layer and source from the map.
 * Safe to call even if they were never added.
 */
export function removeFavoriteMarkersLayer(map: maplibregl.Map): void {
  if (map.getLayer(FAVORITE_MARKERS_LAYER)) {
    map.removeLayer(FAVORITE_MARKERS_LAYER)
  }
  if (map.getSource(FAVORITE_MARKERS_SOURCE)) {
    map.removeSource(FAVORITE_MARKERS_SOURCE)
  }
}
