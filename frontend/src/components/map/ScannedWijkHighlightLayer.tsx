import type maplibregl from 'maplibre-gl';

const SCANNED_SOURCE_ID = 'scanned-wijken';
const SCANNED_FILL_LAYER = 'scanned-wijken-fill';
const SCANNED_LINE_LAYER = 'scanned-wijken-line';

/**
 * Add scanned wijk highlight overlay to the map.
 *
 * Shows filled semi-transparent amber overlay for wijken that have completed
 * scans, visually distinguishing them from:
 * - Unscanned wijken: emerald green (#10b981) from WijkBoundariesLayer
 * - Monitored wijken: blue (rgba(59,130,246,0.15)) from MonitoredWijkOverlay
 *
 * Renders below wijk boundary lines but above the basemap.
 *
 * @param map - MapLibre GL JS map instance
 * @param wijkGeojson - Full CBS wijk GeoJSON FeatureCollection
 * @param scannedWijkNames - Array of wijk_naam values that have completed scans
 */
export function addScannedWijkHighlight(
  map: maplibregl.Map,
  wijkGeojson: GeoJSON.FeatureCollection,
  scannedWijkNames: string[]
): void {
  // Guard: source already exists
  if (map.getSource(SCANNED_SOURCE_ID)) {
    return;
  }

  // Filter to only scanned wijken (remove falsy values first)
  const scannedSet = new Set(scannedWijkNames.filter(Boolean));
  const filteredFeatures = wijkGeojson.features.filter((feature) => {
    const wijkNaam = feature.properties?.statnaam as string | undefined;
    return wijkNaam && scannedSet.has(wijkNaam);
  });

  // If no matching features, do not add empty source
  if (filteredFeatures.length === 0) {
    return;
  }

  // Add GeoJSON source with filtered features
  map.addSource(SCANNED_SOURCE_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: filteredFeatures,
    },
  });

  // Determine insertion point (before wijk-fill if it exists, so scanned overlay is below)
  const beforeLayer = map.getLayer('wijk-fill') ? 'wijk-fill' : undefined;

  // No fill — parcel score colors must not be obscured.
  // Only the amber outline (below) marks scanned wijken.
  map.addLayer(
    {
      id: SCANNED_FILL_LAYER,
      type: 'fill',
      source: SCANNED_SOURCE_ID,
      paint: {
        'fill-color': 'rgba(245, 158, 11, 0)',
        'fill-opacity': 0,
      },
    },
    beforeLayer
  );

  // Add amber outline
  map.addLayer(
    {
      id: SCANNED_LINE_LAYER,
      type: 'line',
      source: SCANNED_SOURCE_ID,
      paint: {
        'line-color': 'rgba(245, 158, 11, 0.7)', // Amber semi-transparent
        'line-width': 2,
      },
    },
    beforeLayer
  );
}

/**
 * Remove scanned wijk highlight overlay from the map.
 * Removes layers and source.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeScannedWijkHighlight(map: maplibregl.Map): void {
  // Remove layers (must be removed before source)
  if (map.getLayer(SCANNED_LINE_LAYER)) {
    map.removeLayer(SCANNED_LINE_LAYER);
  }

  if (map.getLayer(SCANNED_FILL_LAYER)) {
    map.removeLayer(SCANNED_FILL_LAYER);
  }

  // Remove source
  if (map.getSource(SCANNED_SOURCE_ID)) {
    map.removeSource(SCANNED_SOURCE_ID);
  }
}

/**
 * Update scanned wijk highlight with new scanned wijken list.
 * Removes existing overlay and adds updated version.
 *
 * @param map - MapLibre GL JS map instance
 * @param wijkGeojson - Full CBS wijk GeoJSON FeatureCollection
 * @param scannedWijkNames - Updated array of scanned wijk_naam values
 */
export function updateScannedWijkHighlight(
  map: maplibregl.Map,
  wijkGeojson: GeoJSON.FeatureCollection,
  scannedWijkNames: string[]
): void {
  removeScannedWijkHighlight(map);
  addScannedWijkHighlight(map, wijkGeojson, scannedWijkNames);
}
