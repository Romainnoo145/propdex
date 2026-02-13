import type maplibregl from 'maplibre-gl';

const SCAN_AREA_SOURCE = 'scan-area-highlight';
const SCAN_AREA_FILL_LAYER = 'scan-area-fill';
const SCAN_AREA_LINE_LAYER = 'scan-area-outline';

/**
 * Convert bounding box to GeoJSON Polygon.
 * Creates a closed ring with 5 points (starting point repeated at end).
 *
 * @param bbox - Bounding box as [minLon, minLat, maxLon, maxLat]
 * @returns GeoJSON Polygon geometry
 */
function bboxToPolygon(
  bbox: [number, number, number, number]
): GeoJSON.Polygon {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat], // Close the ring
      ],
    ],
  };
}

/**
 * Add scan area highlight to the map.
 * Displays bbox as a purple dashed outline with semi-transparent fill.
 *
 * @param map - MapLibre GL JS map instance
 * @param bbox - Bounding box as [minLon, minLat, maxLon, maxLat]
 */
export function addScanAreaHighlight(
  map: maplibregl.Map,
  bbox: [number, number, number, number]
): void {
  // Guard: source already exists
  if (map.getSource(SCAN_AREA_SOURCE)) {
    return;
  }

  const polygon = bboxToPolygon(bbox);

  // Add GeoJSON source
  map.addSource(SCAN_AREA_SOURCE, {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: polygon,
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
 * Update scan area highlight with a new bbox.
 * If source doesn't exist, creates it using addScanAreaHighlight.
 *
 * @param map - MapLibre GL JS map instance
 * @param bbox - Bounding box as [minLon, minLat, maxLon, maxLat]
 */
export function updateScanAreaHighlight(
  map: maplibregl.Map,
  bbox: [number, number, number, number]
): void {
  const source = map.getSource(SCAN_AREA_SOURCE) as
    | maplibregl.GeoJSONSource
    | undefined;

  if (source) {
    const polygon = bboxToPolygon(bbox);
    source.setData({
      type: 'Feature',
      geometry: polygon,
      properties: {},
    });
  } else {
    // Source doesn't exist, create it
    addScanAreaHighlight(map, bbox);
  }
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
