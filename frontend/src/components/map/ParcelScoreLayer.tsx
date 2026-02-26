import type maplibregl from 'maplibre-gl';

const SOURCE_ID = 'parcel-scores';
const FILL_LAYER_ID = 'parcel-score-fill';
const OUTLINE_LAYER_ID = 'parcel-score-outline';
const SELECTED_OUTLINE_LAYER_ID = 'parcel-score-selected-outline';
export const PARCEL_BUILT_STATUS_FILL_LAYER_ID = 'parcel-built-status-fill';

// Track hovered parcel for feature-state management
let hoveredScoreParcelId: string | number | null = null;

// Track selected parcel separately from hover
let selectedScoreParcelId: string | number | null = null;

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
        ['boolean', ['feature-state', 'selected'], false],
        0.95, // Selected: almost fully opaque
        ['boolean', ['feature-state', 'hover'], false],
        0.85, // Hover opacity
        0.6, // Default opacity
      ],
    },
    minzoom: 14,
  });

  // Optional overlay layer to quickly see built vs unbuilt parcels.
  // Hidden by default and toggled from LayerToggle.
  map.addLayer({
    id: PARCEL_BUILT_STATUS_FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: ['has', 'score'],
    layout: {
      visibility: 'none',
    },
    paint: {
      'fill-color': [
        'match',
        ['downcase', ['to-string', ['coalesce', ['get', 'has_pand'], 'false']]],
        ['true', '1', 'yes'],
        '#ef4444', // Bebouwd
        '#22c55e', // Onbebouwd
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        0.9,
        ['boolean', ['feature-state', 'hover'], false],
        0.8,
        0.58,
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

  // Add selected parcel outline layer (thick white outline for selected parcel)
  map.addLayer({
    id: SELECTED_OUTLINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: ['has', 'score'],
    paint: {
      'line-color': '#ffffff',
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        3, // Selected: thick white outline
        0, // Default: no outline (regular outline layer handles this)
      ],
      'line-opacity': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        1.0,
        0,
      ],
    },
    minzoom: 14,
  });

  const handleMouseMove = (e: maplibregl.MapLayerMouseEvent) => {
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
  };

  const handleMouseLeave = () => {
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
  };

  // Hover effect on both potential and built-status overlays.
  map.on('mousemove', FILL_LAYER_ID, handleMouseMove);
  map.on('mousemove', PARCEL_BUILT_STATUS_FILL_LAYER_ID, handleMouseMove);
  map.on('mouseleave', FILL_LAYER_ID, handleMouseLeave);
  map.on('mouseleave', PARCEL_BUILT_STATUS_FILL_LAYER_ID, handleMouseLeave);
}

/**
 * Setup click handler for parcel selection.
 *
 * Returns parcel_id (string) and feature.id (numeric) for selection state management.
 *
 * @param map - MapLibre GL JS map instance
 * @param onParcelClick - Callback with (parcelId: string, featureId: number | string | undefined)
 * @returns Cleanup function to remove event listener
 */
export function setupParcelScoreClickHandler(
  map: maplibregl.Map,
  onParcelClick: (parcelId: string, featureId: string | number | undefined) => void
): () => void {
  const handler = (e: maplibregl.MapMouseEvent & { features?: maplibregl.GeoJSONFeature[] }) => {
    const feature = e.features?.[0];
    if (feature?.properties?.parcel_id) {
      onParcelClick(feature.properties.parcel_id as string, feature.id);
    }
  };

  map.on('click', FILL_LAYER_ID, handler);
  return () => map.off('click', FILL_LAYER_ID, handler);
}

/**
 * Set selected parcel highlight using feature-state.
 *
 * @param map - MapLibre GL JS map instance
 * @param featureId - Numeric feature ID from MVT (or null to clear)
 * @param sourceLayer - Name of the layer in the MVT tile
 */
export function setParcelScoreSelection(
  map: maplibregl.Map,
  featureId: string | number | null,
  sourceLayer: string
): void {
  // Clear previous selection
  if (selectedScoreParcelId !== null) {
    map.setFeatureState(
      { source: SOURCE_ID, sourceLayer, id: selectedScoreParcelId },
      { selected: false }
    );
  }

  // Set new selection
  selectedScoreParcelId = featureId;
  if (featureId !== null) {
    map.setFeatureState(
      { source: SOURCE_ID, sourceLayer, id: featureId },
      { selected: true }
    );
  }
}

/**
 * Remove score overlay layer from the map.
 *
 * Cleans up layers and source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeParcelScoreLayer(map: maplibregl.Map): void {
  // Clear hover and selection state
  hoveredScoreParcelId = null;
  selectedScoreParcelId = null;

  // Reset cursor
  const canvas = map.getCanvas();
  if (canvas) {
    canvas.style.cursor = '';
  }

  // Remove layers (this also removes layer-specific event handlers)
  if (map.getLayer(SELECTED_OUTLINE_LAYER_ID)) {
    map.removeLayer(SELECTED_OUTLINE_LAYER_ID);
  }

  if (map.getLayer(PARCEL_BUILT_STATUS_FILL_LAYER_ID)) {
    map.removeLayer(PARCEL_BUILT_STATUS_FILL_LAYER_ID);
  }

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

  if (map.getLayer(SELECTED_OUTLINE_LAYER_ID)) {
    map.setLayoutProperty(SELECTED_OUTLINE_LAYER_ID, 'visibility', visibility);
  }
}

/**
 * Toggle visibility of built/unbuilt parcel overlay.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setParcelBuiltStatusVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(PARCEL_BUILT_STATUS_FILL_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_BUILT_STATUS_FILL_LAYER_ID, 'visibility', visibility);
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
