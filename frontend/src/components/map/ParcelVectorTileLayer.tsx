import type maplibregl from 'maplibre-gl';

const SOURCE_ID = 'parcels-vector';
const FILL_LAYER_ID = 'parcel-vector-fill';
const LINE_LAYER_ID = 'parcel-vector-line';

// Track hovered parcel for feature-state management
let hoveredParcelId: string | number | null = null;

/**
 * Add a vector tile layer for parcel boundaries with click/hover interaction.
 *
 * This layer accepts any vector tile source (PDOK or custom tile server) and
 * provides click/hover handlers. Used for interactive parcel visualization.
 *
 * @param map - MapLibre GL JS map instance
 * @param tileUrl - Vector tile URL template (e.g., https://tiles.example.com/{z}/{x}/{y}.mvt)
 * @param sourceLayer - Name of the layer in the MVT tile (e.g., 'parcels')
 * @param onParcelClick - Optional callback fired when a parcel is clicked
 */
export function addParcelVectorTileLayer(
  map: maplibregl.Map,
  tileUrl: string,
  sourceLayer: string,
  onParcelClick?: (properties: Record<string, unknown>) => void
): void {
  // Guard: Don't re-add if already exists
  if (map.getSource(SOURCE_ID)) {
    return;
  }

  // Add vector tile source
  map.addSource(SOURCE_ID, {
    type: 'vector',
    tiles: [tileUrl],
    minzoom: 10,
    maxzoom: 18,
  });

  // Add fill layer for hit detection (nearly invisible)
  map.addLayer({
    id: FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    paint: {
      'fill-color': '#64748b',
      'fill-opacity': 0.01,
    },
    minzoom: 14,
  });

  // Add line layer for parcel boundaries
  map.addLayer({
    id: LINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    'source-layer': sourceLayer,
    paint: {
      'line-color': '#64748b',
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        2,
        0.5,
      ],
      'line-opacity': 0.8,
    },
    minzoom: 14,
  });

  // Hover effect: Update feature-state on mousemove
  map.on('mousemove', LINE_LAYER_ID, (e) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      if (!feature) return;

      // Clear previous hover state
      if (hoveredParcelId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer, id: hoveredParcelId },
          { hover: false }
        );
      }

      // Set new hover state
      hoveredParcelId = feature.id ?? null;
      if (hoveredParcelId !== null) {
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer, id: hoveredParcelId },
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
  map.on('mouseleave', LINE_LAYER_ID, () => {
    if (hoveredParcelId !== null) {
      map.setFeatureState(
        { source: SOURCE_ID, sourceLayer, id: hoveredParcelId },
        { hover: false }
      );
    }
    hoveredParcelId = null;
    const canvas = map.getCanvas();
    if (canvas) {
      canvas.style.cursor = '';
    }
  });

  // Click handler
  if (onParcelClick) {
    map.on('click', FILL_LAYER_ID, (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        if (!feature) return;
        const properties = feature.properties ?? {};
        onParcelClick(properties);
      }
    });
  }
}

/**
 * Remove vector tile parcel layer from the map.
 *
 * Cleans up event handlers, layers, and source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeParcelVectorTileLayer(map: maplibregl.Map): void {
  // Clear hover state
  hoveredParcelId = null;

  // Reset cursor
  const canvas = map.getCanvas();
  if (canvas) {
    canvas.style.cursor = '';
  }

  // Remove layers (this also removes layer-specific event handlers)
  if (map.getLayer(LINE_LAYER_ID)) {
    map.removeLayer(LINE_LAYER_ID);
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
 * Toggle visibility of vector tile parcel layer.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setParcelVectorTileVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(FILL_LAYER_ID)) {
    map.setLayoutProperty(FILL_LAYER_ID, 'visibility', visibility);
  }

  if (map.getLayer(LINE_LAYER_ID)) {
    map.setLayoutProperty(LINE_LAYER_ID, 'visibility', visibility);
  }
}
