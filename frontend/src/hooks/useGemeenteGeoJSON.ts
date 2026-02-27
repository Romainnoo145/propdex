import { useQuery } from '@tanstack/react-query'
import { fetchGemeenteGeoJSON } from '@/components/map/GemeenteBoundariesLayer'

const GEMEENTE_GEOJSON_QUERY_KEY = ['geojson', 'gemeenten'] as const

/**
 * Shared query hook for CBS gemeente boundaries.
 * Data is effectively static for workspace UX and can be cached long.
 */
export function useGemeenteGeoJSON(enabled = true) {
  return useQuery<GeoJSON.FeatureCollection, Error>({
    queryKey: GEMEENTE_GEOJSON_QUERY_KEY,
    queryFn: fetchGemeenteGeoJSON,
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 24 * 60 * 60 * 1000, // 24h
  })
}
