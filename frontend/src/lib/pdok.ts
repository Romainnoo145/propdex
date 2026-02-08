/**
 * Map tile service URLs for MapLibre GL JS.
 *
 * PDOK tile services (WMTS) are safe for direct browser access.
 * Data APIs (BAG, DSO, Kadaster) must be proxied through the backend.
 */

/** PDOK Aerial imagery (Luchtfoto HR) — latest 8cm orthophotos */
export const PDOK_AERIAL_TILES =
  'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg';

/** CartoDB Positron — modern light greyscale basemap with retina tiles */
export const CARTO_LIGHT_TILES =
  'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';

/** Attribution text for tile layers */
export const PDOK_AERIAL_ATTRIBUTION = '© PDOK - Actuele luchtfoto';
export const CARTO_ATTRIBUTION =
  '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Default map center: Netherlands (Amsterdam area) */
export const DEFAULT_CENTER: [number, number] = [4.9, 52.37];

/** Default zoom level (shows Amsterdam metro area) */
export const DEFAULT_ZOOM = 12;
