/**
 * Map tile service URLs for MapLibre GL JS.
 *
 * PDOK tile services (WMTS) are safe for direct browser access.
 * Data APIs (BAG, DSO, Kadaster) must be proxied through the backend.
 */

/** ESRI World Imagery — global satellite coverage (no white borders) */
export const ESRI_SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** CartoDB Positron — modern light greyscale basemap with retina tiles */
export const CARTO_LIGHT_TILES =
  'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';

/** Attribution text for tile layers */
export const ESRI_SATELLITE_ATTRIBUTION =
  '© <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics';
export const CARTO_ATTRIBUTION =
  '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Default map center: Venlo */
export const DEFAULT_CENTER: [number, number] = [6.1724, 51.3704];

/** Default zoom level (shows Venlo metro area) */
export const DEFAULT_ZOOM = 12;

/** Geographic center of Netherlands (for gemeente overview) */
export const NL_CENTER: [number, number] = [5.2913, 52.1326];

/** Zoom level showing all of Netherlands */
export const NL_ZOOM = 7;

/**
 * CBS WFS endpoint for gemeente boundaries (2024 version)
 * Returns GeoJSON FeatureCollection with properties: statcode, statnaam
 */
export const CBS_GEMEENTEN_WFS =
  'https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeName=gebiedsindelingen:gemeente_gegeneraliseerd&outputFormat=application/json&srsName=EPSG:4326';

/**
 * CBS WFS endpoint for province boundaries (2024 version)
 * Returns GeoJSON FeatureCollection with 12 Dutch provinces (MultiPolygon, ~615 KB)
 */
export const CBS_PROVINCIES_WFS =
  'https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeName=gebiedsindelingen:provincie_gegeneraliseerd&outputFormat=application/json&srsName=EPSG:4326';

/** PDOK WMS Ruimtelijke Plannen — enkelbestemming layer (SVBP2012 colored zoning areas). Free, no API key. */
export const PDOK_BESTEMMINGSPLAN_WMS =
  'https://service.pdok.nl/kadaster/plu/wms/v1_0' +
  '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap' +
  '&LAYERS=enkelbestemming&STYLES=' +
  '&CRS=EPSG:3857&BBOX={bbox-epsg-3857}' +
  '&WIDTH=256&HEIGHT=256' +
  '&FORMAT=image/png&TRANSPARENT=true';
