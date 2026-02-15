import type maplibregl from 'maplibre-gl';

const MONITORED_SOURCE_ID = 'monitored-wijken';
const MONITORED_FILL_LAYER = 'monitored-wijken-fill';
const MONITORED_LINE_LAYER = 'monitored-wijken-line';

/**
 * Add monitored wijk overlay to the map.
 *
 * Shows filled semi-transparent overlay for wijken that are being monitored
 * for changes (permits and zoning updates). Renders below wijk boundary lines
 * but above the basemap.
 *
 * @param map - MapLibre GL JS map instance
 * @param wijkGeojson - Full CBS wijk GeoJSON FeatureCollection
 * @param monitoredWijkNames - Array of wijk_naam values that are monitored
 */
export function addMonitoredWijkOverlay(
  map: maplibregl.Map,
  wijkGeojson: GeoJSON.FeatureCollection,
  monitoredWijkNames: string[]
): void {
  // Guard: source already exists
  if (map.getSource(MONITORED_SOURCE_ID)) {
    return;
  }

  // Filter to only monitored wijken
  const monitoredSet = new Set(monitoredWijkNames);
  const filteredFeatures = wijkGeojson.features.filter((feature) => {
    const wijkNaam = feature.properties?.statnaam as string | undefined;
    return wijkNaam && monitoredSet.has(wijkNaam);
  });

  // Add GeoJSON source with filtered features
  map.addSource(MONITORED_SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: filteredFeatures,
    },
  });

  // Determine insertion point (before wijk-fill if it exists, so monitored overlay is below)
  const beforeLayer = map.getLayer('wijk-fill') ? 'wijk-fill' : undefined;

  // Add fill layer with semi-transparent blue
  map.addLayer(
    {
      id: MONITORED_FILL_LAYER,
      type: 'fill',
      source: MONITORED_SOURCE_ID,
      paint: {
        'fill-color': 'rgba(59, 130, 246, 0.15)', // Blue semi-transparent
        'fill-antialias': true,
      },
    },
    beforeLayer
  );

  // Add subtle outline
  map.addLayer(
    {
      id: MONITORED_LINE_LAYER,
      type: 'line',
      source: MONITORED_SOURCE_ID,
      paint: {
        'line-color': 'rgba(59, 130, 246, 0.5)', // Blue semi-transparent
        'line-width': 1,
      },
    },
    beforeLayer
  );
}

/**
 * Remove monitored wijk overlay from the map.
 * Removes layers and source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeMonitoredWijkOverlay(map: maplibregl.Map): void {
  // Remove layers (must be removed before source)
  if (map.getLayer(MONITORED_LINE_LAYER)) {
    map.removeLayer(MONITORED_LINE_LAYER);
  }

  if (map.getLayer(MONITORED_FILL_LAYER)) {
    map.removeLayer(MONITORED_FILL_LAYER);
  }

  // Remove source
  if (map.getSource(MONITORED_SOURCE_ID)) {
    map.removeSource(MONITORED_SOURCE_ID);
  }
}

/**
 * Update monitored wijk overlay with new monitored wijken list.
 * Removes existing overlay and adds updated version.
 *
 * @param map - MapLibre GL JS map instance
 * @param wijkGeojson - Full CBS wijk GeoJSON FeatureCollection
 * @param monitoredWijkNames - Updated array of monitored wijk_naam values
 */
export function updateMonitoredWijkOverlay(
  map: maplibregl.Map,
  wijkGeojson: GeoJSON.FeatureCollection,
  monitoredWijkNames: string[]
): void {
  removeMonitoredWijkOverlay(map);
  addMonitoredWijkOverlay(map, wijkGeojson, monitoredWijkNames);
}
