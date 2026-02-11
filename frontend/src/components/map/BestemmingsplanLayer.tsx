import type maplibregl from 'maplibre-gl';
import { PDOK_BESTEMMINGSPLAN_WMS } from '@/lib/pdok';

const BESTEMMINGSPLAN_SOURCE_ID = 'pdok-bestemmingsplan';
const BESTEMMINGSPLAN_LAYER_ID = 'bestemmingsplan-layer';

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
