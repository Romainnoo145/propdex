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

/** Default map center: Netherlands (Amsterdam area) */
export const DEFAULT_CENTER: [number, number] = [4.9, 52.37];

/** Default zoom level (shows Amsterdam metro area) */
export const DEFAULT_ZOOM = 12;
