import type maplibregl from 'maplibre-gl';

const BBOX_SOURCE_ID = 'scan-bbox-outline';
const BBOX_FILL_LAYER_ID = 'scan-bbox-outline-fill';
const BBOX_BORDER_LAYER_ID = 'scan-bbox-outline-border';

/**
 * Convert bbox to GeoJSON Polygon Feature
 *
 * @param bbox - Bounding box as [minLon, minLat, maxLon, maxLat]
 * @returns GeoJSON Feature with Polygon geometry
 */
function bboxToPolygon(
  bbox: [number, number, number, number]
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [minLon, minLat, maxLon, maxLat] = bbox;

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ],
      ],
    },
  };
}

/**
 * Add bbox outline to map as immediate visual feedback after drawing
 *
 * Shows amber semi-transparent fill with dashed border to indicate selected area.
 * Also fits map bounds to bbox with padding.
 *
 * @param map - MapLibre GL JS map instance
 * @param bbox - Bounding box as [minLon, minLat, maxLon, maxLat] in WGS84
 */
export function addBboxOutline(
  map: maplibregl.Map,
  bbox: [number, number, number, number]
): void {
  // Remove existing bbox outline if present
  removeBboxOutline(map);

  // Convert bbox to GeoJSON
  const feature = bboxToPolygon(bbox);

  // Add GeoJSON source
  map.addSource(BBOX_SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [feature],
    },
  });

  // Add fill layer with amber tint
  map.addLayer({
    id: BBOX_FILL_LAYER_ID,
    type: 'fill',
    source: BBOX_SOURCE_ID,
    paint: {
      'fill-color': '#f59e0b', // Tailwind amber-500
      'fill-opacity': 0.1,
    },
  });

  // Add dashed border
  map.addLayer({
    id: BBOX_BORDER_LAYER_ID,
    type: 'line',
    source: BBOX_SOURCE_ID,
    paint: {
      'line-color': '#d97706', // Tailwind amber-600
      'line-width': 2,
      'line-opacity': 0.8,
      'line-dasharray': [4, 2],
    },
  });

  // Fit map to bbox with padding
  const [minLon, minLat, maxLon, maxLat] = bbox;
  map.fitBounds(
    [
      [minLon, minLat],
      [maxLon, maxLat],
    ],
    { padding: 50 }
  );
}

/**
 * Remove bbox outline from map
 *
 * Cleans up fill and border layers, and removes source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeBboxOutline(map: maplibregl.Map): void {
  // Remove layers
  if (map.getLayer(BBOX_BORDER_LAYER_ID)) {
    map.removeLayer(BBOX_BORDER_LAYER_ID);
  }
  if (map.getLayer(BBOX_FILL_LAYER_ID)) {
    map.removeLayer(BBOX_FILL_LAYER_ID);
  }

  // Remove source
  if (map.getSource(BBOX_SOURCE_ID)) {
    map.removeSource(BBOX_SOURCE_ID);
  }
}

/**
 * Add scan area highlight after scan completes
 *
 * This removes the bbox outline and lets the score layer take over.
 * The score layer is already added in map.tsx after scan completion.
 *
 * @param map - MapLibre GL JS map instance
 */
export function addScanAreaHighlight(map: maplibregl.Map): void {
  removeBboxOutline(map);
}
