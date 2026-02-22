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

/**
 * Project a GeoJSON Polygon or MultiPolygon geometry into an SVG path string.
 * Fits the shape within the given viewport with optional padding.
 * Preserves aspect ratio — does not stretch shapes to fill the viewport.
 * Y-axis is inverted: SVG Y grows downward, geographic latitude grows upward.
 *
 * @param geometry - GeoJSON Polygon or MultiPolygon (WGS84 [lon, lat] coordinates)
 * @param width - SVG viewport width in pixels (default 200)
 * @param height - SVG viewport height in pixels (default 150)
 * @param padding - Inset padding in pixels on all sides (default 8)
 * @returns { d, viewBox } suitable for <svg viewBox={viewBox}><path d={d} /></svg>
 */
export function geoJsonToSvgPath(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  width = 200,
  height = 150,
  padding = 8
): { d: string; viewBox: string } {
  // 1. Collect all exterior ring coordinates (holes are ignored for silhouette)
  const rings: GeoJSON.Position[][] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]!]
      : geometry.coordinates.map((poly) => poly[0]!);

  // 2. Compute bounding box across all rings
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const ring of rings) {
    for (const coord of ring) {
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

  // Guard against degenerate geometries (single point)
  const lonRange = maxLon - minLon || 1;
  const latRange = maxLat - minLat || 1;

  const drawW = width - padding * 2;
  const drawH = height - padding * 2;

  // Uniform scale that preserves aspect ratio
  const scale = Math.min(drawW / lonRange, drawH / latRange);
  const projW = lonRange * scale;
  const projH = latRange * scale;

  // Center the projected shape within the padded area
  const offsetX = padding + (drawW - projW) / 2;
  const offsetY = padding + (drawH - projH) / 2;

  // Project a [lon, lat] pair to SVG [x, y]
  // maxLat - lat inverts the Y axis (SVG origin is top-left)
  const project = (lon: number, lat: number): [number, number] => [
    offsetX + (lon - minLon) * scale,
    offsetY + (maxLat - lat) * scale,
  ];

  // 3. Build SVG path string — each ring becomes a separate sub-path
  const parts: string[] = [];
  for (const ring of rings) {
    const points = ring
      .map((coord) => {
        const lon = coord[0];
        const lat = coord[1];
        if (lon === undefined || lat === undefined) return null;
        return project(lon, lat);
      })
      .filter((pt): pt is [number, number] => pt !== null);

    const first = points[0];
    if (!first) continue;

    const rest = points.slice(1);
    parts.push(
      `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ` +
        rest.map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') +
        ' Z'
    );
  }

  return {
    d: parts.join(' '),
    viewBox: `0 0 ${width} ${height}`,
  };
}
