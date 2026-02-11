import type maplibregl from 'maplibre-gl';
import { PDOK_BESTEMMINGSPLAN_WMS } from '@/lib/pdok';
import type { ZoneFeatureInfo } from '@/lib/types/bestemmingsplan';

const BESTEMMINGSPLAN_SOURCE_ID = 'pdok-bestemmingsplan';
const BESTEMMINGSPLAN_LAYER_ID = 'bestemmingsplan-layer';

// AbortController for canceling in-flight GetFeatureInfo requests
let currentAbortController: AbortController | null = null;

/**
 * Add PDOK bestemmingsplan WMS layer to the map.
 *
 * Creates a WMS raster source and layer showing SVBP2012 colored zoning areas.
 * Layer is hidden by default (visibility: 'none').
 * Visible at zoom 10+ to provide zoning context at gemeente overview level.
 *
 * @param map - MapLibre GL JS map instance
 */
export function addBestemmingsplanLayer(map: maplibregl.Map): void {
  if (map.getSource(BESTEMMINGSPLAN_SOURCE_ID)) {
    return;
  }

  map.addSource(BESTEMMINGSPLAN_SOURCE_ID, {
    type: 'raster',
    tiles: [PDOK_BESTEMMINGSPLAN_WMS],
    tileSize: 256,
    minzoom: 10,
    maxzoom: 19,
  });

  if (!map.getLayer(BESTEMMINGSPLAN_LAYER_ID)) {
    map.addLayer({
      id: BESTEMMINGSPLAN_LAYER_ID,
      type: 'raster',
      source: BESTEMMINGSPLAN_SOURCE_ID,
      minzoom: 10,
      layout: {
        visibility: 'none',
      },
      paint: {
        'raster-opacity': 0.6,
      },
    });
  }
}

/**
 * Remove PDOK bestemmingsplan layer from the map.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeBestemmingsplanLayer(map: maplibregl.Map): void {
  if (map.getLayer(BESTEMMINGSPLAN_LAYER_ID)) {
    map.removeLayer(BESTEMMINGSPLAN_LAYER_ID);
  }

  if (map.getSource(BESTEMMINGSPLAN_SOURCE_ID)) {
    map.removeSource(BESTEMMINGSPLAN_SOURCE_ID);
  }
}

/**
 * Toggle visibility of bestemmingsplan layer.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setBestemmingsplanVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(BESTEMMINGSPLAN_LAYER_ID)) {
    map.setLayoutProperty(BESTEMMINGSPLAN_LAYER_ID, 'visibility', visibility);
  }
}

/**
 * Fetch zone information via WMS GetFeatureInfo.
 *
 * Queries PDOK WMS for feature details at the clicked location.
 * Cancels any previous in-flight request.
 *
 * @param map - MapLibre GL JS map instance
 * @param lngLat - Clicked coordinates
 * @returns Zone feature info or null if no feature found
 */
async function fetchGetFeatureInfo(
  map: maplibregl.Map,
  lngLat: maplibregl.LngLat
): Promise<ZoneFeatureInfo | null> {
  // Cancel previous request
  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();

  // Get map dimensions and bounds
  const container = map.getContainer();
  const rect = container.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);

  const bounds = map.getBounds();
  const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

  // Project lng/lat to pixel coordinates
  const point = map.project(lngLat);
  const i = Math.floor(point.x);
  const j = Math.floor(point.y);

  // Construct GetFeatureInfo URL
  const baseUrl = 'https://service.pdok.nl/kadaster/plu/wms/v1_0';
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetFeatureInfo',
    layers: 'enkelbestemming',
    query_layers: 'enkelbestemming',
    info_format: 'application/json',
    feature_count: '1',
    crs: 'EPSG:4326',
    bbox,
    width: width.toString(),
    height: height.toString(),
    i: i.toString(),
    j: j.toString(),
  });

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url, { signal: currentAbortController.signal });

    if (!response.ok) {
      console.error('GetFeatureInfo request failed:', response.status);
      return null;
    }

    const data = await response.json();

    // Extract feature from GeoJSON FeatureCollection
    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0];
    const props = feature.properties || {};

    // Defensive property extraction (property names uncertain)
    const planNaam = props.plannaam ?? props.naam ?? props.planNaam ?? 'Onbekend plan';
    const bestemmingType = props.bestemmingshoofdgroep ?? props.bestemming ?? props.type ?? 'Onbekend';
    const planStatus = props.planstatus ?? props.status ?? null;
    const planLink = props.verwijzingNaarExternPlanInfo ?? props.planurl ?? props.planLink ?? null;

    return {
      planNaam,
      bestemmingType,
      planStatus,
      planLink,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Request was cancelled, not an error
      return null;
    }
    console.error('GetFeatureInfo fetch error:', error);
    return null;
  }
}

/**
 * Setup click handler for bestemmingsplan zone inspection.
 *
 * When user clicks the map and bestemmingsplan layer is visible, fetches
 * zone information via GetFeatureInfo and invokes the callback.
 *
 * @param map - MapLibre GL JS map instance
 * @param onZoneClick - Callback when zone info is fetched
 * @param onZoneLoading - Callback to indicate loading state
 * @returns Cleanup function to remove event handlers
 */
export function setupBestemmingsplanClickHandler(
  map: maplibregl.Map,
  onZoneClick: (info: ZoneFeatureInfo, lngLat: [number, number]) => void,
  onZoneLoading: (loading: boolean) => void
): () => void {
  const handleClick = async (e: maplibregl.MapMouseEvent) => {
    // Only handle clicks when bestemmingsplan layer is visible
    const layer = map.getLayer(BESTEMMINGSPLAN_LAYER_ID);
    if (!layer) return;

    const visibility = map.getLayoutProperty(BESTEMMINGSPLAN_LAYER_ID, 'visibility');
    if (visibility !== 'visible') return;

    onZoneLoading(true);

    try {
      const info = await fetchGetFeatureInfo(map, e.lngLat);
      if (info) {
        onZoneClick(info, [e.lngLat.lng, e.lngLat.lat]);
      }
    } finally {
      onZoneLoading(false);
    }
  };

  const handleMouseEnter = () => {
    const layer = map.getLayer(BESTEMMINGSPLAN_LAYER_ID);
    if (!layer) return;

    const visibility = map.getLayoutProperty(BESTEMMINGSPLAN_LAYER_ID, 'visibility');
    if (visibility === 'visible') {
      map.getCanvas().style.cursor = 'pointer';
    }
  };

  const handleMouseLeave = () => {
    map.getCanvas().style.cursor = '';
  };

  // Register event handlers
  map.on('click', handleClick);
  map.on('mouseenter', BESTEMMINGSPLAN_LAYER_ID, handleMouseEnter);
  map.on('mouseleave', BESTEMMINGSPLAN_LAYER_ID, handleMouseLeave);

  // Return cleanup function
  return () => {
    map.off('click', handleClick);
    map.off('mouseenter', BESTEMMINGSPLAN_LAYER_ID, handleMouseEnter);
    map.off('mouseleave', BESTEMMINGSPLAN_LAYER_ID, handleMouseLeave);
  };
}
