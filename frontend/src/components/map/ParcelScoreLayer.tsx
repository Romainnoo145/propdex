import type maplibregl from 'maplibre-gl';

const SOURCE_ID = 'parcel-scores';
export const PARCEL_SCORE_FILL_LAYER_ID = 'parcel-score-fill';
const OUTLINE_LAYER_ID = 'parcel-score-outline';
const SELECTED_OUTLINE_LAYER_ID = 'parcel-score-selected-outline';
export const PARCEL_EMPTY_HATCH_LAYER_ID = 'parcel-empty-hatch';
export const PARCEL_BUILT_STATUS_FILL_LAYER_ID = 'parcel-built-status-fill';
export const PARCEL_REPORT_STATUS_FILL_LAYER_ID = 'parcel-report-status-fill';
export const PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID = 'parcel-vacancy-signal-fill';
export const PARCEL_BUILD_CAPACITY_FILL_LAYER_ID = 'parcel-build-capacity-fill';


// Track hovered parcel for feature-state management
let hoveredScoreParcelId: string | number | null = null;

// Track selected parcel separately from hover
let selectedScoreParcelId: string | number | null = null;

/**
 * Create a diagonal stripe hatch pattern canvas for empty parcel overlay.
 *
 * Returns a 16x16 canvas with a diagonal line pattern.
 * Used as a fill-pattern in MapLibre GL JS to visually distinguish
 * empty land parcels (no building) from built parcels.
 */
function createHatchPattern(): HTMLCanvasElement {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-size / 2, size / 2);
  ctx.lineTo(size / 2, -size / 2);
  ctx.moveTo(size / 2, size + size / 2);
  ctx.lineTo(size + size / 2, size / 2);
  ctx.stroke();
  return canvas;
}

/**
 * Add a score-based color overlay layer for parcel visualization.
 *
 * Renders colored fill polygons based on parcel score values (0-100).
 * Color gradient: grey (0) → amber (45) → green (65) → dark green (100).
 * Grey = low opportunity (in_gebruik), green = high opportunity (vacant/empty).
 *
 * Also adds a diagonal hatch overlay for empty parcels (has_pand = false)
 * and progressive label layers that appear at higher zoom levels.
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

  // Register hatch pattern image for empty parcels (no building)
  // Must be added after source but before the hatch layer
  if (!map.hasImage('parcel-hatch')) {
    const hatchCanvas = createHatchPattern();
    const ctx = hatchCanvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, hatchCanvas.width, hatchCanvas.height);
    map.addImage('parcel-hatch', {
      width: hatchCanvas.width,
      height: hatchCanvas.height,
      data: new Uint8Array(imageData.data.buffer),
    });
  }

  // Add fill layer with data-driven color based on score
  // Grey-to-green gradient: grey = in_gebruik/low opportunity, green = high opportunity
  map.addLayer({
    id: PARCEL_SCORE_FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: ['all', ['has', 'score'], ['>=', ['get', 'score'], 40]], // Only parcels above threshold
    paint: {
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'score'],
        40,  '#f59e0b', // Amber — borderline opportunity
        60,  '#eab308', // Strong amber — solid opportunity
        75,  '#84cc16', // Lime — good opportunity
        90,  '#22c55e', // Green — strong opportunity
        100, '#16a34a', // Dark green — highest
      ],
      'fill-opacity': [
        'interpolate',
        ['linear'],
        ['get', 'score'],
        40, 0.25,  // Subtle at threshold
        60, 0.45,  // Medium
        80, 0.6,   // Strong
        100, 0.7,  // Brightest
      ],
    },
    minzoom: 14,
  });

  // Hatch overlay for empty parcels (no building — has_pand = false)
  // Separate layer from score fill because fill-pattern replaces fill-color in MapLibre
  map.addLayer({
    id: PARCEL_EMPTY_HATCH_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: [
      'all',
      ['has', 'score'],
      ['>=', ['get', 'score'], 40],
      ['==', ['downcase', ['to-string', ['coalesce', ['get', 'has_pand'], 'false']]], 'false'],
    ],
    paint: {
      'fill-pattern': 'parcel-hatch',
      'fill-opacity': 0.4,
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

  // Optional overlay layer to show report coverage status per parcel.
  // Hidden by default and toggled from LayerToggle.
  map.addLayer({
    id: PARCEL_REPORT_STATUS_FILL_LAYER_ID,
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
        ['downcase', ['to-string', ['coalesce', ['get', 'has_report'], 'false']]],
        ['true', '1', 'yes'],
        '#f59e0b', // Rapport bestaat
        '#64748b', // Nog geen rapport
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

  // Optional overlay layer to highlight vacancy signals.
  // Hidden by default and toggled from LayerToggle.
  map.addLayer({
    id: PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID,
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
        ['downcase', ['to-string', ['coalesce', ['get', 'vacancy_signal'], 'onbekend']]],
        'leeg_perceel',
        '#22c55e',
        'leegstaand_pand',
        '#f59e0b',
        'in_gebruik',
        '#ef4444',
        '#64748b',
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

  // Optional overlay layer to show build capacity from FAR/TAR indicators.
  // Hidden by default and toggled from LayerToggle.
  map.addLayer({
    id: PARCEL_BUILD_CAPACITY_FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: ['has', 'score'],
    layout: {
      visibility: 'none',
    },
    paint: {
      'fill-color': [
        'case',
        ['>=', ['coalesce', ['get', 'max_floor_area_ratio'], 0], 2.0],
        '#16a34a',
        ['>=', ['coalesce', ['get', 'max_floor_area_ratio'], 0], 1.2],
        '#65a30d',
        ['>=', ['coalesce', ['get', 'max_bebouwingspercentage'], 0], 70],
        '#eab308',
        ['>=', ['coalesce', ['get', 'max_floor_area_ratio'], 0], 0.8],
        '#f59e0b',
        '#64748b',
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

  // Add outline layer only for qualifying parcels (score >= 40)
  map.addLayer({
    id: OUTLINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: ['all', ['has', 'score'], ['>=', ['get', 'score'], 40]],
    paint: {
      'line-color': '#f59e0b', // Amber outline for highlighted parcels
      'line-width': 1.2,
      'line-opacity': 0.7,
    },
    minzoom: 14,
  });

  // Add selected parcel outline layer (thick white outline for selected parcel)
  map.addLayer({
    id: SELECTED_OUTLINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    filter: ['all', ['has', 'score'], ['>=', ['get', 'score'], 40]],
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

  // Hover effect on all parcel data overlays.
  map.on('mousemove', PARCEL_SCORE_FILL_LAYER_ID, handleMouseMove);
  map.on('mousemove', PARCEL_BUILT_STATUS_FILL_LAYER_ID, handleMouseMove);
  map.on('mousemove', PARCEL_REPORT_STATUS_FILL_LAYER_ID, handleMouseMove);
  map.on('mousemove', PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID, handleMouseMove);
  map.on('mousemove', PARCEL_BUILD_CAPACITY_FILL_LAYER_ID, handleMouseMove);
  map.on('mouseleave', PARCEL_SCORE_FILL_LAYER_ID, handleMouseLeave);
  map.on('mouseleave', PARCEL_BUILT_STATUS_FILL_LAYER_ID, handleMouseLeave);
  map.on('mouseleave', PARCEL_REPORT_STATUS_FILL_LAYER_ID, handleMouseLeave);
  map.on('mouseleave', PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID, handleMouseLeave);
  map.on('mouseleave', PARCEL_BUILD_CAPACITY_FILL_LAYER_ID, handleMouseLeave);
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

  map.on('click', PARCEL_SCORE_FILL_LAYER_ID, handler);
  return () => map.off('click', PARCEL_SCORE_FILL_LAYER_ID, handler);
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

  if (map.getLayer(PARCEL_REPORT_STATUS_FILL_LAYER_ID)) {
    map.removeLayer(PARCEL_REPORT_STATUS_FILL_LAYER_ID);
  }

  if (map.getLayer(PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID)) {
    map.removeLayer(PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID);
  }

  if (map.getLayer(PARCEL_BUILD_CAPACITY_FILL_LAYER_ID)) {
    map.removeLayer(PARCEL_BUILD_CAPACITY_FILL_LAYER_ID);
  }

  if (map.getLayer(OUTLINE_LAYER_ID)) {
    map.removeLayer(OUTLINE_LAYER_ID);
  }

  // Remove hatch overlay before score fill (hatch is on top of score fill)
  if (map.getLayer(PARCEL_EMPTY_HATCH_LAYER_ID)) {
    map.removeLayer(PARCEL_EMPTY_HATCH_LAYER_ID);
  }

  if (map.getLayer(PARCEL_SCORE_FILL_LAYER_ID)) {
    map.removeLayer(PARCEL_SCORE_FILL_LAYER_ID);
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
  if (!map.isStyleLoaded()) return;
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(PARCEL_SCORE_FILL_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_SCORE_FILL_LAYER_ID, 'visibility', visibility);
  }

  if (map.getLayer(PARCEL_EMPTY_HATCH_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_EMPTY_HATCH_LAYER_ID, 'visibility', visibility);
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
  if (!map.isStyleLoaded()) return;
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(PARCEL_BUILT_STATUS_FILL_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_BUILT_STATUS_FILL_LAYER_ID, 'visibility', visibility);
  }
}

/**
 * Toggle visibility of report-status parcel overlay.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setParcelReportStatusVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  if (!map.isStyleLoaded()) return;
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(PARCEL_REPORT_STATUS_FILL_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_REPORT_STATUS_FILL_LAYER_ID, 'visibility', visibility);
  }
}

/**
 * Toggle visibility of vacancy-signal parcel overlay.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setParcelVacancySignalVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  if (!map.isStyleLoaded()) return;
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_VACANCY_SIGNAL_FILL_LAYER_ID, 'visibility', visibility);
  }
}

/**
 * Toggle visibility of build-capacity parcel overlay.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setParcelBuildCapacityVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  if (!map.isStyleLoaded()) return;
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(PARCEL_BUILD_CAPACITY_FILL_LAYER_ID)) {
    map.setLayoutProperty(PARCEL_BUILD_CAPACITY_FILL_LAYER_ID, 'visibility', visibility);
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
