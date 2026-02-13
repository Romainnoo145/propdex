/**
 * Calculate bounding box from GeoJSON Polygon or MultiPolygon geometry.
 * Handles both single polygons and multi-polygons (e.g., island gemeentes).
 * Returns [minLon, minLat, maxLon, maxLat] in WGS84.
 *
 * @param geometry - GeoJSON Polygon or MultiPolygon geometry
 * @returns Bounding box as [minLon, minLat, maxLon, maxLat]
 */
export function calculateBboxFromGeometry(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  // Normalize to array of polygons for uniform iteration
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  // Iterate through all polygons
  for (const polygon of polygons) {
    // Only process exterior ring (first ring, polygon[0])
    // Interior rings are holes and don't affect bounding box
    const exteriorRing = polygon[0];

    if (!exteriorRing) continue;

    // Track min/max across all coordinates in exterior ring
    for (const coord of exteriorRing) {
      const lon = coord[0];
      const lat = coord[1];

      if (lon !== undefined && lat !== undefined) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  return [minLon, minLat, maxLon, maxLat];
}
