/**
 * TanStack Query hook for favorite parcel centroids
 *
 * Returns lon/lat for each favorited parcel so they can be rendered
 * as markers on the map. The query key `['favorites', 'centroids']`
 * is a sub-key of `['favorites']`, so it is automatically invalidated
 * whenever `useToggleFavorite` settles (via partial key matching).
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface FavoriteCentroid {
  parcel_code: string
  lon: number
  lat: number
}

/**
 * Fetch centroids for all favorited parcels for the current user.
 *
 * Query key: ['favorites', 'centroids']
 * Stale time: 5 minutes
 * Only runs when user is authenticated
 */
export function useFavoriteCentroids() {
  const { accessToken } = useAuth()

  return useQuery<FavoriteCentroid[], Error>({
    queryKey: ['favorites', 'centroids'],
    queryFn: () =>
      apiFetch<FavoriteCentroid[]>('/api/parcels/favorites/centroids', {
        method: 'GET',
        accessToken,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })
}
