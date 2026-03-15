/**
 * TanStack Query hooks for parcel favorites operations
 *
 * Provides:
 * - useParcelFavorites: list all favorites for the current user
 * - useToggleFavorite: add or remove a parcel favorite with optimistic update
 *
 * Uses parcel.parcel_code (Kadaster string) for all API calls — NOT parcel_id (UUID).
 * See Phase 109 RESEARCH.md Pitfall 1 for context.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { FavoriteResponse } from '@/lib/types/portfolio'
import type { ScanResultItem } from '@/lib/types/scan'

const FAVORITES_BASE = '/api/parcels/favorites'

/**
 * Fetch all favorites for the current authenticated user
 *
 * Query key: ['favorites']
 * Stale time: 5 minutes
 * Only runs when user is authenticated
 */
export function useParcelFavorites() {
  const { accessToken } = useAuth()

  return useQuery<FavoriteResponse[], Error>({
    queryKey: ['favorites'],
    queryFn: () =>
      apiFetch<FavoriteResponse[]>(FAVORITES_BASE, {
        method: 'GET',
        accessToken,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })
}

/**
 * Toggle favorite state for a parcel (add or remove)
 *
 * Performs an optimistic update: the favorites cache is updated immediately
 * before the server responds. On error the cache is rolled back to the
 * previous snapshot and a toast notification is shown.
 *
 * Variables:
 *   parcel     — ScanResultItem to favorite/unfavorite
 *   isFavorited — current state (true = currently favorited → DELETE will be called)
 *
 * IMPORTANT: Uses parcel.parcel_code (Kadaster string), NOT parcel.parcel_id (UUID).
 */
export function useToggleFavorite() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    FavoriteResponse | null,
    Error,
    { parcel: ScanResultItem; isFavorited: boolean },
    { previousFavorites: FavoriteResponse[] | undefined }
  >({
    mutationFn: async ({ parcel, isFavorited }) => {
      if (isFavorited) {
        // DELETE — returns 204 No Content (apiFetch returns null for 204)
        await apiFetch<null>(`${FAVORITES_BASE}/${encodeURIComponent(parcel.parcel_code)}`, {
          method: 'DELETE',
          accessToken,
        })
        return null
      } else {
        // POST — returns the created or existing FavoriteResponse
        return apiFetch<FavoriteResponse>(FAVORITES_BASE, {
          method: 'POST',
          body: JSON.stringify({
            parcel_id: parcel.parcel_code,
            gemeente_code: parcel.gemeente_code ?? null,
            gemeente_naam: null,
            wijk_naam: null,
          }),
          accessToken,
        })
      }
    },

    onMutate: async ({ parcel, isFavorited }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['favorites'] })

      // Snapshot the current favorites list for rollback
      const previousFavorites = queryClient.getQueryData<FavoriteResponse[]>(['favorites'])

      // Optimistically update the cache
      queryClient.setQueryData<FavoriteResponse[]>(['favorites'], (old) => {
        const current = old ?? []
        if (isFavorited) {
          // Remove the entry
          return current.filter((f) => f.parcel_id !== parcel.parcel_code)
        } else {
          // Add a placeholder entry (server will return the canonical version on settle)
          const optimisticEntry: FavoriteResponse = {
            id: `optimistic-${parcel.parcel_code}`,
            parcel_id: parcel.parcel_code,
            user_id: '',
            gemeente_code: parcel.gemeente_code ?? null,
            gemeente_naam: null,
            wijk_naam: null,
            pipeline_stage: 'Gesignaleerd',
            afgerond_reden: null,
            notitie: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          return [...current, optimisticEntry]
        }
      })

      return { previousFavorites }
    },

    onError: (_error, _variables, context) => {
      // Roll back to previous state
      if (context?.previousFavorites !== undefined) {
        queryClient.setQueryData(['favorites'], context.previousFavorites)
      }
      toast.error('Favoriet kon niet worden opgeslagen')
    },

    onSettled: () => {
      // Always refetch to ensure server state is reflected
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}
