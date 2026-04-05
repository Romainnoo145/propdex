/**
 * FavoriteMarkersLayer
 *
 * Renders favorited parcels as red heart markers on the MapLibre map.
 * Uses a pre-loaded heart SVG image for reliable symbol rendering.
 *
 * Layer is added AFTER the parcel score layer so it renders on top.
 * Visibility is NOT tied to the Percelen toggle — favorites markers
 * serve a different purpose (portfolio awareness) and should always
 * be visible when the user has favorites.
 */

import type maplibregl from 'maplibre-gl'

export const FAVORITE_MARKERS_SOURCE = 'favorite-markers'
export const FAVORITE_MARKERS_LAYER = 'favorite-markers-heart'
const HEART_IMAGE_ID = 'heart-icon'

// Filled red heart with white outline, 40x40 for crisp rendering at 20px symbol size
const HEART_SVG = `<svg width="40" height="40" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
  <path d="M25 39.7l-.6-.5C11.5 28.7 8 25 8 19c0-5 4-9 9-9 4.1 0 6.4 2.3 8 4.1 1.6-1.8 3.9-4.1 8-4.1 5 0 9 4 9 9 0 6-3.5 9.7-16.4 20.2l-.6.5z"
    fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
</svg>`

/**
 * Load the heart icon into the map's sprite if not already present.
 */
function ensureHeartImage(map: maplibregl.Map): Promise<void> {
  if (map.hasImage(HEART_IMAGE_ID)) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const img = new Image(40, 40)
    img.onload = () => {
      if (!map.hasImage(HEART_IMAGE_ID)) {
        map.addImage(HEART_IMAGE_ID, img)
      }
      resolve()
    }
    img.onerror = reject
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(HEART_SVG)}`
  })
}

/**
 * Add the GeoJSON source and symbol layer for favorite markers.
 * Initializes with an empty FeatureCollection.
 *
 * Call this after addParcelScoreLayer so markers render on top.
 */
export async function addFavoriteMarkersLayer(map: maplibregl.Map): Promise<void> {
  await ensureHeartImage(map)

  if (map.getSource(FAVORITE_MARKERS_SOURCE)) return

  map.addSource(FAVORITE_MARKERS_SOURCE, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  })

  map.addLayer({
    id: FAVORITE_MARKERS_LAYER,
    type: 'symbol',
    source: FAVORITE_MARKERS_SOURCE,
    layout: {
      'icon-image': HEART_IMAGE_ID,
      'icon-size': 0.55,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
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
