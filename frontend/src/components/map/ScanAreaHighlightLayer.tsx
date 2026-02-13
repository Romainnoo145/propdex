import type maplibregl from 'maplibre-gl';

const SCAN_AREA_SOURCE = 'scan-area-highlight';
const SCAN_AREA_FILL_LAYER = 'scan-area-fill';
const SCAN_AREA_LINE_LAYER = 'scan-area-outline';

/**
 * Add scan area highlight to the map using actual geometry shape.
 * Displays the polygon/multipolygon with a purple dashed outline and semi-transparent fill.
 *
 * @param map - MapLibre GL JS map instance
 * @param geometry - GeoJSON Polygon or MultiPolygon geometry to highlight
 */
export function addScanAreaHighlight(
  map: maplibregl.Map,
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): void {
  // Guard: source already exists
  if (map.getSource(SCAN_AREA_SOURCE)) {
    return;
  }

  // Add GeoJSON source
  map.addSource(SCAN_AREA_SOURCE, {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry,
      properties: {},
    },
  });

  // Add fill layer with purple tint
  map.addLayer({
    id: SCAN_AREA_FILL_LAYER,
    type: 'fill',
    source: SCAN_AREA_SOURCE,
    paint: {
      'fill-color': '#8b5cf6',
      'fill-opacity': 0.15,
    },
  });

  // Add dashed line layer for border
  map.addLayer({
    id: SCAN_AREA_LINE_LAYER,
    type: 'line',
    source: SCAN_AREA_SOURCE,
    paint: {
      'line-color': '#8b5cf6',
      'line-width': 3,
      'line-dasharray': [2, 2],
    },
  });
}

/**
 * Remove scan area highlight from the map.
 * Removes layers and source if they exist.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeScanAreaHighlight(map: maplibregl.Map): void {
  // Remove layers (must be removed before source)
  if (map.getLayer(SCAN_AREA_LINE_LAYER)) {
    map.removeLayer(SCAN_AREA_LINE_LAYER);
  }

  if (map.getLayer(SCAN_AREA_FILL_LAYER)) {
    map.removeLayer(SCAN_AREA_FILL_LAYER);
  }

  // Remove source
  if (map.getSource(SCAN_AREA_SOURCE)) {
    map.removeSource(SCAN_AREA_SOURCE);
  }
}
