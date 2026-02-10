import type maplibregl from 'maplibre-gl';

const SOURCE_ID = 'parcel-scores';
const FILL_LAYER_ID = 'parcel-score-fill';
const OUTLINE_LAYER_ID = 'parcel-score-outline';

// Track hovered parcel for feature-state management
let hoveredScoreParcelId: string | number | null = null;

/**
 * Add a score-based color overlay layer for parcel visualization.
 *
 * Renders colored fill polygons based on parcel score values (0-100).
 * Color gradient: red (0) → orange (25) → yellow (50) → green (75) → dark green (100).
 *
 * @param map - MapLibre GL JS map instance
 * @param tileUrl - Vector tile URL template pointing to score tiles
 * @param sourceLayer - Name of the layer in the MVT tile containing score data
 */
export function addParcelScoreLayer(
  map: maplibregl.Map,
  tileUrl: string,
  sourceLayer: string
): void {
  // Guard: Don't re-add if already exists
  if (map.getSource(SOURCE_ID)) {
    return;
  }

  // Add vector tile source with score data
  map.addSource(SOURCE_ID, {
    type: 'vector',
    tiles: [tileUrl],
    minzoom: 10,
    maxzoom: 18,
  });

  // Add fill layer with data-driven color based on score
  map.addLayer({
    id: FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: ['has', 'score'], // Only show parcels with score data
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'score'],
        0,
        '#dc2626', // Red: Low score (Tailwind red-600)
        25,
        '#f97316', // Orange (Tailwind orange-500)
        50,
        '#eab308', // Yellow (Tailwind yellow-500)
        75,
        '#22c55e', // Green (Tailwind green-500)
        100,
        '#16a34a', // Dark green (Tailwind green-600)
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.85, // Hover opacity
        0.6, // Default opacity
      ],
    },
    minzoom: 14,
  });

  // Add outline layer for visual separation between parcels
  map.addLayer({
    id: OUTLINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: ['has', 'score'],
    paint: {
      'line-color': '#ffffff',
      'line-width': 0.5,
      'line-opacity': 0.8,
    },
    minzoom: 14,
  });

  // Hover effect: Update feature-state on mousemove
  map.on('mousemove', FILL_LAYER_ID, (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      if (!feature) return;

      // Clear previous hover state
      if (hoveredScoreParcelId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer, id: hoveredScoreParcelId },
          { hover: false }
        );
      }

      // Set new hover state
      hoveredScoreParcelId = feature.id ?? null;
      if (hoveredScoreParcelId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer, id: hoveredScoreParcelId },
          { hover: true }
        );
      }

      // Change cursor to pointer
      const canvas = map.getCanvas();
      if (canvas) {
        canvas.style.cursor = 'pointer';
      }
    }
  });

  // Clear hover state on mouseleave
  map.on('mouseleave', FILL_LAYER_ID, () => {
    if (hoveredScoreParcelId !== null) {
      map.setFeatureState(
        { source: SOURCE_ID, sourceLayer, id: hoveredScoreParcelId },
        { hover: false }
      );
    }
    hoveredScoreParcelId = null;
    const canvas = map.getCanvas();
    if (canvas) {
      canvas.style.cursor = '';
    }
  });
}

/**
 * Remove score overlay layer from the map.
 *
 * Cleans up layers and source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeParcelScoreLayer(map: maplibregl.Map): void {
  // Clear hover state
  hoveredScoreParcelId = null;

  // Reset cursor
  const canvas = map.getCanvas();
  if (canvas) {
    canvas.style.cursor = '';
  }

  // Remove layers (this also removes layer-specific event handlers)
  if (map.getLayer(OUTLINE_LAYER_ID)) {
    map.removeLayer(OUTLINE_LAYER_ID);
  }

  if (map.getLayer(FILL_LAYER_ID)) {
    map.removeLayer(FILL_LAYER_ID);
  }

  // Remove source
  if (map.getSource(SOURCE_ID)) {
    map.removeSource(SOURCE_ID);
  }
}

/**
 * Toggle visibility of score overlay layer.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setParcelScoreVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(FILL_LAYER_ID)) {
    map.setLayoutProperty(FILL_LAYER_ID, 'visibility', visibility);
  }

  if (map.getLayer(OUTLINE_LAYER_ID)) {
    map.setLayoutProperty(OUTLINE_LAYER_ID, 'visibility', visibility);
  }
}

/**
 * Update score overlay source with new tile URL.
 *
 * Used when switching between scan results (different scan_id).
 * Removes existing layers/source and re-adds with new URL.
 *
 * @param map - MapLibre GL JS map instance
 * @param tileUrl - New vector tile URL template
 * @param sourceLayer - Name of the layer in the MVT tile
 */
export function updateParcelScoreSource(
  map: maplibregl.Map,
  tileUrl: string,
  sourceLayer: string
): void {
  // Remove existing implementation
  removeParcelScoreLayer(map);

  // Re-add with new URL
  addParcelScoreLayer(map, tileUrl, sourceLayer);
}
