/**
 * FavoriteMarkersLayer
 *
 * Renders favorited parcels as amber heart markers on the MapLibre map.
 * Uses a symbol layer with a heart icon (loaded as image).
 *
 * Layer is added AFTER the parcel score layer so it renders on top.
 * Always visible when user has favorites — not tied to layer toggles.
 */

import type maplibregl from 'maplibre-gl'

export const FAVORITE_MARKERS_SOURCE = 'favorite-markers'
export const FAVORITE_MARKERS_LAYER = 'favorite-markers-heart'
const HEART_IMAGE_ID = 'heart-icon'

/**
 * Create a heart-shaped canvas icon for MapLibre.
 * Returns an ImageData-compatible object.
 */
function createHeartImage(size: number, color: string): { width: number; height: number; data: Uint8Array } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const s = size

  // Draw heart shape
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(s / 2, s * 0.85)
  ctx.bezierCurveTo(s * 0.1, s * 0.55, s * 0.0, s * 0.3, s * 0.25, s * 0.15)
  ctx.bezierCurveTo(s * 0.35, s * 0.1, s * 0.45, s * 0.15, s * 0.5, s * 0.25)
  ctx.bezierCurveTo(s * 0.55, s * 0.15, s * 0.65, s * 0.1, s * 0.75, s * 0.15)
  ctx.bezierCurveTo(s * 1.0, s * 0.3, s * 0.9, s * 0.55, s / 2, s * 0.85)
  ctx.closePath()
  ctx.fill()

  // White stroke
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = size * 0.08
  ctx.stroke()

  return ctx.getImageData(0, 0, size, size) as unknown as { width: number; height: number; data: Uint8Array }
}

/**
 * Add the GeoJSON source and symbol layer for favorite heart markers.
 */
export function addFavoriteMarkersLayer(map: maplibregl.Map): void {
  // Add heart icon image
  if (!map.hasImage(HEART_IMAGE_ID)) {
    const img = createHeartImage(48, '#F9A826')
    map.addImage(HEART_IMAGE_ID, img)
  }

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
 */
export function removeFavoriteMarkersLayer(map: maplibregl.Map): void {
  if (map.getLayer(FAVORITE_MARKERS_LAYER)) {
    map.removeLayer(FAVORITE_MARKERS_LAYER)
  }
  if (map.getSource(FAVORITE_MARKERS_SOURCE)) {
    map.removeSource(FAVORITE_MARKERS_SOURCE)
  }
}
