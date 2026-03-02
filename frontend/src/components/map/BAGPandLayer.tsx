import type maplibregl from 'maplibre-gl';
import { PDOK_BAG_PAND_WMS } from '@/lib/pdok';

const BAG_PAND_SOURCE_ID = 'pdok-bag-pand';
const BAG_PAND_LAYER_ID = 'bag-pand-layer';

/**
 * Add PDOK BAG building footprints WMS layer to the map.
 *
 * Creates a WMS raster source and layer showing building footprints (panden).
 * Layer is hidden by default (visibility: 'none').
 * Only visible at zoom 14+ to avoid visual noise at lower zoom levels.
 *
 * WMS raster tiles render filled polygons at 0.35 opacity — dark borders remain
 * visible while the fill stays nearly transparent, keeping parcel score colors
 * clearly visible underneath.
 *
 * Clicks pass through to the parcel fill layer beneath (raster WMS layers are
 * transparent to mouse events by default in MapLibre GL JS).
 *
 * @param map - MapLibre GL JS map instance
 */
export function addBAGPandLayer(map: maplibregl.Map): void {
  if (map.getSource(BAG_PAND_SOURCE_ID)) {
    return;
  }

  map.addSource(BAG_PAND_SOURCE_ID, {
    type: 'raster',
    tiles: [PDOK_BAG_PAND_WMS],
    tileSize: 256,
    minzoom: 10,
    maxzoom: 19,
  });

  if (!map.getLayer(BAG_PAND_LAYER_ID)) {
    map.addLayer({
      id: BAG_PAND_LAYER_ID,
      type: 'raster',
      source: BAG_PAND_SOURCE_ID,
      minzoom: 14,
      layout: {
        visibility: 'none',
      },
      paint: {
        'raster-opacity': 0.35,
      },
    });
  }
}

/**
 * Remove PDOK BAG building footprints layer from the map.
 *
 * Layer must be removed before source (MapLibre GL JS throws if source is
 * removed while a layer still references it).
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeBAGPandLayer(map: maplibregl.Map): void {
  try {
  if (map.getLayer(BAG_PAND_LAYER_ID)) {
    map.removeLayer(BAG_PAND_LAYER_ID);
  }

  if (map.getSource(BAG_PAND_SOURCE_ID)) {
    map.removeSource(BAG_PAND_SOURCE_ID);
  }
  } catch {
    // Map already destroyed during unmount — safe to ignore
  }
}

/**
 * Toggle visibility of BAG pand (building footprint) layer.
 *
 * Uses layout.visibility (not raster-opacity: 0) to prevent unnecessary
 * tile loading when the layer is disabled.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setBAGPandVisibility(map: maplibregl.Map, visible: boolean): void {
  if (!map.isStyleLoaded()) return;
  const visibility = visible ? 'visible' : 'none';

  if (map.getLayer(BAG_PAND_LAYER_ID)) {
    map.setLayoutProperty(BAG_PAND_LAYER_ID, 'visibility', visibility);
  }
}
