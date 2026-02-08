/**
 * PDOK tile service URLs for MapLibre GL JS.
 *
 * Tile services (WMTS) are safe for direct browser access.
 * Data APIs (BAG, DSO, Kadaster) must be proxied through the backend.
 *
 * @see https://www.pdok.nl/introductie/-/article/pdok-luchtfoto-rgb-open-
 */

/** PDOK Aerial imagery (Luchtfoto RGB) — latest orthophotos */
export const PDOK_AERIAL_TILES =
  'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_ortho8RGB/EPSG:3857/{z}/{x}/{y}.jpeg';

/** PDOK Topographic map (BRT Achtergrondkaart) — standard Dutch topo */
export const PDOK_TOPO_TILES =
  'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png';

/** Attribution text for PDOK layers */
export const PDOK_AERIAL_ATTRIBUTION = '© PDOK - Actuele luchtfoto';
export const PDOK_TOPO_ATTRIBUTION = '© PDOK - BRT Achtergrondkaart';

/** Default map center: Netherlands (Amsterdam area) */
export const DEFAULT_CENTER: [number, number] = [4.9, 52.37];

/** Default zoom level (shows Amsterdam metro area) */
export const DEFAULT_ZOOM = 12;
