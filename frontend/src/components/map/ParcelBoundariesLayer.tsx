import type maplibregl from 'maplibre-gl';

const PARCEL_SOURCE_ID = 'pdok-parcels';
const PARCEL_LAYER_ID = 'parcel-boundaries';

/**
 * PDOK Kadastrale Kaart WMS — parcel boundaries for the Netherlands.
 *
 * Uses WMS GetMap requests (raster tiles) since PDOK does not offer
 * vector tiles for kadastrale kaart. MapLibre fetches 256x256 PNG tiles
 * with transparent background, rendered as a raster overlay.
 *
 * Free, no API key required.
 */
const PDOK_PARCEL_WMS =
  'https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0' +
  '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  '&LAYERS=Perceel&STYLES=' +
  '&CRS=EPSG:3857&BBOX={bbox-epsg-3857}' +
  '&WIDTH=256&HEIGHT=256' +
  '&FORMAT=image/png&TRANSPARENT=true';

/**
 * Add PDOK parcel boundaries layer to the map.
 *
 * Creates a WMS raster source and layer showing cadastral parcel lines.
 * Layer is hidden by default (visibility: 'none').
 * Only useful at zoom 15+ where individual parcels are visible.
 *
 * @param map - MapLibre GL JS map instance
 */
export function addParcelBoundariesLayer(map: maplibregl.Map): void {
  const add = () => {
    if (map.getSource(PARCEL_SOURCE_ID)) return;

    map.addSource(PARCEL_SOURCE_ID, {
      type: 'raster',
      tiles: [PDOK_PARCEL_WMS],
      tileSize: 256,
      minzoom: 15,
      maxzoom: 21,
    });

    if (!map.getLayer(PARCEL_LAYER_ID)) {
      map.addLayer({
        id: PARCEL_LAYER_ID,
        type: 'raster',
        source: PARCEL_SOURCE_ID,
        minzoom: 15,
        layout: {
          visibility: 'none',
        },
        paint: {
          'raster-opacity': 0.8,
        },
      });
    }
  };

  if (map.isStyleLoaded()) {
    add();
  } else {
    map.once('idle', add);
  }
}

/**
 * Remove PDOK parcel boundaries layer from the map.
 *
 * @param map - MapLibre GL JS map instance
 */
export function removeParcelBoundariesLayer(map: maplibregl.Map): void {
  if (map.getLayer(PARCEL_LAYER_ID)) {
    map.removeLayer(PARCEL_LAYER_ID);
  }

  if (map.getSource(PARCEL_SOURCE_ID)) {
    map.removeSource(PARCEL_SOURCE_ID);
  }
}

/**
 * Toggle visibility of parcel boundaries layer.
 *
 * @param map - MapLibre GL JS map instance
 * @param visible - Whether layer should be visible
 */
export function setParcelBoundariesVisibility(
  map: maplibregl.Map,
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none';

  const apply = () => {
    if (map.getLayer(PARCEL_LAYER_ID)) {
      map.setLayoutProperty(PARCEL_LAYER_ID, 'visibility', visibility);
    }
  };

  if (map.isStyleLoaded()) {
    apply();
  } else {
    map.once('idle', apply);
  }
}
