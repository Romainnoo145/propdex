/**
 * TanStack Query hooks for parcel favorites operations
 *
 * Provides:
 * - useParcelFavorites: list all favorites for the current user
 * - useToggleFavorite: add or remove a parcel favorite with optimistic update
 * - useUpdatePipelineStage: PATCH pipeline stage with optimistic cache update
 *
 * Uses parcel.parcel_code (Kadaster string) for all API calls — NOT parcel_id (UUID).
 * See Phase 109 RESEARCH.md Pitfall 1 for context.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch, generateReportFromParcel } from '@/lib/api'
import { normalizeGemeenteCode } from '@/lib/geo/normalizers'
import type { FavoriteResponse, PipelineStage, PortfolioResponse } from '@/lib/types/portfolio'
import type { ScanResultItem } from '@/lib/types/scan'

const FAVORITES_BASE = '/api/parcels/favorites'

/**
 * Fetch grouped portfolio data for the current authenticated user
 *
 * Query key: ['portfolio']
 * Stale time: 5 minutes
 * Only runs when user is authenticated
 */
export function usePortfolio() {
  const { accessToken } = useAuth()

  return useQuery<PortfolioResponse, Error>({
    queryKey: ['portfolio'],
    queryFn: () => apiFetch<PortfolioResponse>('/api/portfolio', { method: 'GET', accessToken }),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })
}

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
    { parcel: ScanResultItem; isFavorited: boolean; gemeenteNaam?: string | null; wijkNaam?: string | null },
    { previousFavorites: FavoriteResponse[] | undefined }
  >({
    mutationFn: async ({ parcel, isFavorited, gemeenteNaam, wijkNaam }) => {
      const normalizedGemeenteCode = normalizeGemeenteCode(parcel.gemeente_code)

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
            gemeente_code: normalizedGemeenteCode,
            gemeente_naam: gemeenteNaam ?? null,
            wijk_naam: wijkNaam ?? null,
            address: parcel.address ?? null,
          }),
          accessToken,
        })
      }
    },

    onMutate: async ({ parcel, isFavorited, gemeenteNaam, wijkNaam }) => {
      const normalizedGemeenteCode = normalizeGemeenteCode(parcel.gemeente_code)

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
            parcel_cache_id: parcel.parcel_id,
            user_id: '',
            gemeente_code: normalizedGemeenteCode,
            gemeente_naam: gemeenteNaam ?? null,
            wijk_naam: wijkNaam ?? null,
            address: parcel.address ?? null,
            pipeline_stage: 'Gesignaleerd',
            afgerond_reden: null,
            notitie: null,
            potentie_score: parcel.potentie_score ?? null,
            risico_score: parcel.risico_score ?? null,
            has_report: false,
            report_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          return [...current, optimisticEntry]
        }
      })

      return { previousFavorites }
    },

    onSuccess: (data, { isFavorited, parcel }) => {
      // Auto-generate report when a new favorite is created
      if (!isFavorited && data && data.parcel_cache_id && !data.has_report) {
        // Fire-and-forget: don't block the UI
        // Pass the parcel's display address so from-parcel uses it instead of
        // the potentially stale parcel_cache.address
        generateReportFromParcel(data.parcel_cache_id, accessToken, {
          address_override: parcel.address ?? undefined,
        })
          .then(() => {
            // Refresh favorites to pick up has_report=true
            queryClient.invalidateQueries({ queryKey: ['favorites'] })
          })
          .catch(() => {
            // Silent failure — user can manually generate later
          })
      }
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
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

/**
 * Update the pipeline stage for a favorited parcel
 *
 * Performs an optimistic update: the favorites cache is updated immediately
 * before the server responds. On error the cache is rolled back to the
 * previous snapshot and a toast notification is shown.
 *
 * Variables:
 *   parcelId      — Kadaster string (e.g. "HTT02-A-1234"), NOT UUID
 *   stage         — new pipeline stage
 *   afgerondReden — reason for completion (only for 'Afgerond')
 *   notitie       — optional free-text note
 *
 * Note: Does NOT invalidate ['portfolio'] — portfolio has no pipeline data.
 */
export function useUpdatePipelineStage() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    FavoriteResponse,
    Error,
    { parcelId: string; stage: PipelineStage; afgerondReden?: string | null; notitie?: string | null },
    { previousFavorites: FavoriteResponse[] | undefined }
  >({
    mutationFn: ({ parcelId, stage, afgerondReden, notitie }) =>
      apiFetch<FavoriteResponse>(
        `${FAVORITES_BASE}/${encodeURIComponent(parcelId)}/pipeline`,
        {
          method: 'PATCH',
          body: JSON.stringify({ stage, afgerond_reden: afgerondReden ?? null, notitie: notitie ?? null }),
          accessToken,
        },
      ),

    onMutate: async ({ parcelId, stage, afgerondReden, notitie }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['favorites'] })

      // Snapshot the current favorites list for rollback
      const previousFavorites = queryClient.getQueryData<FavoriteResponse[]>(['favorites'])

      // Optimistically update the cache
      queryClient.setQueryData<FavoriteResponse[]>(['favorites'], (old) =>
        (old ?? []).map((f) => {
          if (f.parcel_id !== parcelId) return f
          return {
            ...f,
            pipeline_stage: stage,
            afgerond_reden: stage === 'Afgerond' ? (afgerondReden ?? null) : null,
            notitie: stage === 'Afgerond' ? (notitie ?? null) : null,
            updated_at: new Date().toISOString(),
          }
        }),
      )

      return { previousFavorites }
    },

    onError: (_error, _variables, context) => {
      // Roll back to previous state
      if (context?.previousFavorites !== undefined) {
        queryClient.setQueryData(['favorites'], context.previousFavorites)
      }
      toast.error('Kan fase niet bijwerken')
    },

    onSettled: () => {
      // Refetch favorites only — portfolio has no pipeline data
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}

/**
 * Update the free-text note (notitie) on a favorited parcel.
 * Works in any pipeline stage.
 */
export function useUpdateNotitie() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<FavoriteResponse, Error, { parcelId: string; notitie: string | null }>({
    mutationFn: ({ parcelId, notitie }) =>
      apiFetch<FavoriteResponse>(`${FAVORITES_BASE}/${encodeURIComponent(parcelId)}/notitie`, {
        method: 'PATCH',
        accessToken,
        body: JSON.stringify({ notitie }),
      }),

    onMutate: async ({ parcelId, notitie }) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] })
      const previous = queryClient.getQueryData<FavoriteResponse[]>(['favorites'])
      queryClient.setQueryData<FavoriteResponse[]>(['favorites'], (old) =>
        (old ?? []).map((f) => (f.parcel_id === parcelId ? { ...f, notitie } : f)),
      )
      return { previous }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['favorites'], context.previous)
      toast.error('Notitie opslaan mislukt')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}

// ── Notes ─────────────────────────────────────────────────────────────

export interface FavoriteNoteResponse {
  id: string
  content: string
  created_at: string
  updated_at: string
}

export function useFavoriteNotes(parcelId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<FavoriteNoteResponse[], Error>({
    queryKey: ['favorite-notes', parcelId],
    queryFn: () =>
      apiFetch<FavoriteNoteResponse[]>(
        `${FAVORITES_BASE}/${encodeURIComponent(parcelId!)}/notes`,
        { method: 'GET', accessToken },
      ),
    enabled: !!parcelId && !!accessToken,
    staleTime: 30 * 1000,
    retry: false,
  })
}

export function useCreateNote() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<FavoriteNoteResponse, Error, { parcelId: string; content: string }>({
    mutationFn: ({ parcelId, content }) =>
      apiFetch<FavoriteNoteResponse>(
        `${FAVORITES_BASE}/${encodeURIComponent(parcelId)}/notes`,
        { method: 'POST', accessToken, body: JSON.stringify({ content }) },
      ),
    onSuccess: (_data, { parcelId }) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-notes', parcelId] })
    },
  })
}

export function useUpdateNote() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<FavoriteNoteResponse, Error, { parcelId: string; noteId: string; content: string }>({
    mutationFn: ({ parcelId, noteId, content }) =>
      apiFetch<FavoriteNoteResponse>(
        `${FAVORITES_BASE}/${encodeURIComponent(parcelId)}/notes/${noteId}`,
        { method: 'PATCH', accessToken, body: JSON.stringify({ content }) },
      ),
    onSuccess: (_data, { parcelId }) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-notes', parcelId] })
    },
  })
}

export function useDeleteNote() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, { parcelId: string; noteId: string }>({
    mutationFn: ({ parcelId, noteId }) =>
      apiFetch<void>(
        `${FAVORITES_BASE}/${encodeURIComponent(parcelId)}/notes/${noteId}`,
        { method: 'DELETE', accessToken },
      ),
    onSuccess: (_data, { parcelId }) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-notes', parcelId] })
    },
  })
}
