import { normalizeAreaName } from '@/lib/geo/normalizers'

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

export function resolveWijkBbox(
  geojson: GeoJSON.FeatureCollection | undefined,
  wijkNaam: string | null
): [number, number, number, number] | null {
  if (!geojson || !wijkNaam) return null

  const target = normalizeAreaName(wijkNaam)
  const match = geojson.features.find((feature) => {
    const name = String(feature.properties?.statnaam ?? '')
    return normalizeAreaName(name) === target
  })
  if (!match) return null

  const geometry = match.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    return null
  }

  return calculateBboxFromGeometry(geometry)
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
  padding = 20
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

  // Apply cos(latitude) correction: at Dutch latitudes (~51.5°N), 1° longitude
  // is only ~62% of 1° latitude in real-world distance. Without this, shapes
  // appear horizontally stretched compared to how they look on a proper map.
  const centerLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const correctedLonRange = lonRange * cosLat;

  const drawW = width - padding * 2;
  const drawH = height - padding * 2;

  // Uniform scale that preserves aspect ratio (using corrected lon range)
  const scale = Math.min(drawW / correctedLonRange, drawH / latRange);
  const projW = correctedLonRange * scale;
  const projH = latRange * scale;

  // Center the projected shape within the padded area
  const offsetX = padding + (drawW - projW) / 2;
  const offsetY = padding + (drawH - projH) / 2;

  // Project a [lon, lat] pair to SVG [x, y]
  // Longitude is scaled by cos(lat) for equirectangular correction
  // maxLat - lat inverts the Y axis (SVG origin is top-left)
  const project = (lon: number, lat: number): [number, number] => [
    offsetX + (lon - minLon) * cosLat * scale,
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

/**
 * Project two GeoJSON geometries (primary + background) into SVG paths
 * using the BACKGROUND geometry's bounding box for scale/offset.
 *
 * The viewBox fits the background shape (e.g. province), so it's fully visible
 * and recognizable. The primary shape (e.g. gemeente) is highlighted within it.
 * This gives immediate geographic context — users see the province silhouette
 * and can identify where the gemeente is located.
 *
 * @param primary - Primary geometry to highlight (rendered on top in accent color)
 * @param background - Background context geometry (determines scale/viewport)
 * @param siblings - Optional array of sibling geometries (e.g. other gemeenten in province)
 * @param width - SVG viewport width in pixels (default 200)
 * @param height - SVG viewport height in pixels (default 150)
 * @param padding - Inset padding in pixels on all sides (default 12)
 * @returns { primaryD, backgroundD, siblingsD?, viewBox }
 */
export function geoJsonToSvgDualPath(
  primary: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  background: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  siblings: (GeoJSON.Polygon | GeoJSON.MultiPolygon)[] = [],
  width = 200,
  height = 150,
  padding = 12
): { primaryD: string; backgroundD: string; siblingsD?: string; viewBox: string } {
  // Derive scale/offset from BACKGROUND geometry so it fits the card
  const bgRings: GeoJSON.Position[][] =
    background.type === 'Polygon'
      ? [background.coordinates[0]!]
      : background.coordinates.map((poly) => poly[0]!);

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const ring of bgRings) {
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

  const lonRange = maxLon - minLon || 1;
  const latRange = maxLat - minLat || 1;

  // Apply cos(latitude) correction for equirectangular projection
  const centerLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const correctedLonRange = lonRange * cosLat;

  const drawW = width - padding * 2;
  const drawH = height - padding * 2;
  const scale = Math.min(drawW / correctedLonRange, drawH / latRange);
  const projW = correctedLonRange * scale;
  const projH = latRange * scale;
  const offsetX = padding + (drawW - projW) / 2;
  const offsetY = padding + (drawH - projH) / 2;

  // Shared projection function using background's bbox with cos(lat) correction
  const project = (lon: number, lat: number): [number, number] => [
    offsetX + (lon - minLon) * cosLat * scale,
    offsetY + (maxLat - lat) * scale,
  ];

  // Build SVG path from a geometry using the shared projection
  const buildPath = (geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): string => {
    const rings: GeoJSON.Position[][] =
      geometry.type === 'Polygon'
        ? [geometry.coordinates[0]!]
        : geometry.coordinates.map((poly) => poly[0]!);

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
    return parts.join(' ');
  };

  // Build sibling paths (all other gemeenten/wijken in the background area)
  let siblingsD: string | undefined;
  if (siblings.length > 0) {
    siblingsD = siblings.map((geom) => buildPath(geom)).join(' ');
  }

  return {
    primaryD: buildPath(primary),
    backgroundD: buildPath(background),
    ...(siblingsD ? { siblingsD } : {}),
    viewBox: `0 0 ${width} ${height}`,
  };
}

/**
 * Compute the center point of a geometry's bounding box.
 * Used for spatial lookups (e.g. which province contains this gemeente).
 */
export function bboxCenter(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): [number, number] {
  const [minLon, minLat, maxLon, maxLat] = calculateBboxFromGeometry(geometry);
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

/**
 * Ray-casting point-in-polygon test on exterior rings.
 * Returns true if point is inside any exterior ring of the geometry.
 */
export function pointInPolygon(
  point: [number, number],
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
): boolean {
  const [px, py] = point;
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  for (const polygon of polygons) {
    const ring = polygon[0];
    if (!ring) continue;

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i]![0];
      const yi = ring[i]![1];
      const xj = ring[j]![0];
      const yj = ring[j]![1];

      if (
        xi !== undefined && yi !== undefined &&
        xj !== undefined && yj !== undefined &&
        yi > py !== yj > py &&
        px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

/**
 * Find the province Feature that contains a given gemeente geometry.
 * Uses centroid point-in-polygon test (12 provinces, <1ms).
 * Returns null if no match found (graceful degradation).
 */
export function findProvinceForGemeente(
  gemeenteGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  provinciesCollection: GeoJSON.FeatureCollection
): GeoJSON.Feature | null {
  const center = bboxCenter(gemeenteGeometry);

  for (const feature of provinciesCollection.features) {
    const geom = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') continue;
    if (pointInPolygon(center, geom)) return feature;
  }
  return null;
}
