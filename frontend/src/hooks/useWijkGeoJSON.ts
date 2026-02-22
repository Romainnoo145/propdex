/**
 * TanStack Query hook for fetching wijk GeoJSON boundaries from CBS WFS.
 *
 * Wraps fetchWijken with a 30-minute staleTime because CBS WFS boundary data
 * is stable (wijken don't change shape frequently). Disabled when gemeenteCode
 * is null (e.g., no gemeente selected yet).
 *
 * Query key: ['wijk-geojson', gemeenteCode]
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchWijken } from '@/lib/api'

/**
 * Fetch wijk GeoJSON boundaries for a gemeente.
 *
 * @param gemeenteCode - CBS gemeentecode (e.g., 'GM0983' or '0983') — passed
 *   directly to fetchWijken without prefix stripping (backend handles it)
 * @returns TanStack Query result with GeoJSON FeatureCollection
 */
export function useWijkGeoJSON(gemeenteCode: string | null) {
  const { accessToken } = useAuth()

  return useQuery<GeoJSON.FeatureCollection, Error>({
    queryKey: ['wijk-geojson', gemeenteCode],
    queryFn: () => fetchWijken(gemeenteCode!, accessToken),
    enabled: !!accessToken && !!gemeenteCode,
    staleTime: 30 * 60 * 1000, // 30 minutes — CBS WFS boundary data is stable
  })
}
