/**
 * SatelliteThumbnail — ESRI World Imagery static map for a WGS84 center coordinate.
 *
 * Uses the ArcGIS REST MapServer/export endpoint (no API key required for World Imagery).
 * center_wgs84 is [lng, lat] per GeoJSON convention.
 */

/**
 * Build an ESRI World Imagery static map export URL from a WGS84 center.
 *
 * @param center - [lng, lat] coordinates (WGS84)
 * @param deltaKm - approximate half-width of bounding box in km. Default ~300m coverage.
 * @returns URL string, or null if center is invalid.
 */
export function buildStaticMapUrl(center: number[] | null, deltaKm = 0.3): string | null {
  if (!center || center.length < 2) return null
  const [lng, lat] = center
  if (lng == null || lat == null) return null

  // ~0.003° latitude ≈ 330m, ~0.005° longitude ≈ 330m at NL latitude (~52°)
  const latDelta = deltaKm * 0.009
  const lngDelta = deltaKm * 0.015

  const bbox = `${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}`
  const params = new URLSearchParams({
    bbox,
    bboxSR: '4326',
    imageSR: '4326',
    size: '400,300',
    format: 'png32',
    f: 'image',
  })

  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params.toString()}`
}

interface SatelliteThumbnailProps {
  center: number[] | null
}

/**
 * Renders a satellite thumbnail from ESRI World Imagery for the given WGS84 center.
 * Returns null if no valid center coordinate is available.
 */
export default function SatelliteThumbnail({ center }: SatelliteThumbnailProps) {
  const url = buildStaticMapUrl(center)
  if (!url) return null

  return (
    <img
      src={url}
      alt="Satellietbeeld locatie"
      loading="lazy"
      className="h-40 w-full rounded-xl object-cover"
    />
  )
}
