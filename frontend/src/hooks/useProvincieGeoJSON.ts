import { useQuery } from '@tanstack/react-query'
import { fetchProvincieGeoJSON } from '@/components/map/GemeenteBoundariesLayer'

const PROVINCIE_GEOJSON_QUERY_KEY = ['geojson', 'provincies'] as const

/**
 * Shared query hook for CBS provincie boundaries.
 */
export function useProvincieGeoJSON(enabled = true) {
  return useQuery<GeoJSON.FeatureCollection, Error>({
    queryKey: PROVINCIE_GEOJSON_QUERY_KEY,
    queryFn: fetchProvincieGeoJSON,
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 24 * 60 * 60 * 1000, // 24h
  })
}
