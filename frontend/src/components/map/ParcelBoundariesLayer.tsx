import type maplibregl from 'maplibre-gl';

const PARCEL_SOURCE_ID = 'pdok-parcels';
const PARCEL_LAYER_ID = 'parcel-boundaries';
const PARCEL_FILL_LAYER_ID = 'parcel-boundaries-fill';

/**
 * PDOK Kadastrale Kaart vector tiles (MVT format).
 *
 * Provides cadastral parcel boundaries for the Netherlands.
 * Tiles are served in EPSG:3857 (Web Mercator) projection.
 */
const PDOK_PARCEL_TILES =
  'https://service.pdok.nl/kadaster/kadastralekaart/wmts/v5_0/Kadastralekaart/EPSG:3857/{z}/{x}/{y}.pbf';

/**
 * Add PDOK parcel boundaries layer to the map.
 *
 * Creates a vector tile source and two layers:
 * - Line layer for parcel boundaries (subtle slate color)
 * - Fill layer for interaction targets (transparent)
 *
 * Layers are hidden by default (visibility: 'none').
 * Only visible at zoom 14+ to prevent cluttering at large scales.
 *
 * @param map - MapLibre GL JS map instance
 */
export function addParcelBoundariesLayer(map: maplibregl.Map): void {
  // Check if source already exists
  if (map.getSource(PARCEL_SOURCE_ID)) {
    console.warn(`Source ${PARCEL_SOURCE_ID} already exists`);
    return;
  }

  // Add vector tile source
  map.addSource(PARCEL_SOURCE_ID, {
    type: 'vector',
    tiles: [PDOK_PARCEL_TILES],
    minzoom: 14,
    maxzoom: 22,
  });

  // Add fill layer for click interaction (transparent)
  if (!map.getLayer(PARCEL_FILL_LAYER_ID)) {
    map.addLayer({
      id: PARCEL_FILL_LAYER_ID,
      type: 'fill',
      source: PARCEL_SOURCE_ID,
      'source-layer': 'kadastralekaart', // PDOK layer name
      minzoom: 14,
      layout: {
        visibility: 'none',
      },
      paint: {
        'fill-color': '#64748b',
        'fill-opacity': 0.05,
      },
    });
  }

  // Add line layer for parcel boundaries
  if (!map.getLayer(PARCEL_LAYER_ID)) {
    map.addLayer({
      id: PARCEL_LAYER_ID,
      type: 'line',
      source: PARCEL_SOURCE_ID,
      'source-layer': 'kadastralekaart', // PDOK layer name
      minzoom: 14,
      layout: {
        visibility: 'none',
      },
      paint: {
        'line-color': '#64748b', // Tailwind slate-500
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14, 1,
          18, 2
        ],
        'line-opacity': 0.6,
      },
    });
  }
}

/**
 * Remove PDOK parcel boundaries layer from the map.
 *
 * Cleans up both layers and the vector tile source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeParcelBoundariesLayer(map: maplibregl.Map): void {
  // Remove layers first (must remove layers before source)
  if (map.getLayer(PARCEL_LAYER_ID)) {
    map.removeLayer(PARCEL_LAYER_ID);
  }

  if (map.getLayer(PARCEL_FILL_LAYER_ID)) {
    map.removeLayer(PARCEL_FILL_LAYER_ID);
  }

  // Remove source
  if (map.getSource(PARCEL_SOURCE_ID)) {
    map.removeSource(PARCEL_SOURCE_ID);
  }
}

/**
 * Toggle visibility of parcel boundaries layers.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layers should be visible
 */
export function setParcelBoundariesVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(PARCEL_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_LAYER_ID, 'visibility', visibility);
  }

  if (map.getLayer(PARCEL_FILL_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_FILL_LAYER_ID, 'visibility', visibility);
  }
}
