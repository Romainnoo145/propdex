/**
 * M052/S03 — Dashboard (twee-signalen acquisitie-radar) data hooks.
 *
 * Gemeentesignalen hergebruiken de bestaande `/api/monitoring/changes` feed;
 * pijplijn / off-market kansen / banner komen van de nieuwe dashboard-router.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'

export interface PijplijnStageCount {
  stage: string
  count: number
}
export interface PijplijnResponse {
  total: number
  stages: PijplijnStageCount[]
}

export interface Kans {
  parcel_id: string
  address: string | null
  wijk: string | null
  potentie_score: number | null
  projecttype: string | null
  reason: string | null
}
export interface KansenResponse {
  kansen: Kans[]
}

export interface DashboardBanner {
  id: string
  title: string
  change_type: string
  change_date: string
  gemeente_naam: string
  source_url: string | null
}
export interface BannerResponse {
  banner: DashboardBanner | null
}

export interface GemeenteSignaal {
  id: string
  change_type: string
  title: string
  change_date: string
  gemeente_naam: string
  address: string | null
  matched_parcel_id: string | null
}
interface ChangesListResponse {
  changes: GemeenteSignaal[]
  total: number
}

export function usePijplijn() {
  const { accessToken } = useAuth()
  return useQuery<PijplijnResponse, Error>({
    queryKey: ['dashboard', 'pijplijn'],
    queryFn: () =>
      apiFetch<PijplijnResponse>('/api/dashboard/pijplijn', {
        method: 'GET',
        accessToken,
      }),
    staleTime: 60 * 1000,
    enabled: !!accessToken,
  })
}

export function useOffMarketKansen(gemeente: string) {
  const { accessToken } = useAuth()
  return useQuery<KansenResponse, Error>({
    queryKey: ['dashboard', 'kansen', gemeente],
    queryFn: () =>
      apiFetch<KansenResponse>(
        `/api/dashboard/kansen?gemeente=${encodeURIComponent(gemeente)}`,
        { method: 'GET', accessToken },
      ),
    staleTime: 60 * 1000,
    enabled: !!accessToken && !!gemeente,
  })
}

export function useDashboardBanner(gemeente: string) {
  const { accessToken } = useAuth()
  return useQuery<BannerResponse, Error>({
    queryKey: ['dashboard', 'banner', gemeente],
    queryFn: () =>
      apiFetch<BannerResponse>(
        `/api/dashboard/banner?gemeente=${encodeURIComponent(gemeente)}`,
        { method: 'GET', accessToken },
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken && !!gemeente,
  })
}

/** parcel_cache_ids van de favorites van de user (voor in-pijplijn-markering). */
export function usePipelineParcels() {
  const { accessToken } = useAuth()
  return useQuery<string[], Error>({
    queryKey: ['dashboard', 'pipeline-parcels'],
    queryFn: async () => {
      const r = await apiFetch<{ parcel_cache_ids: string[] }>(
        '/api/dashboard/pipeline-parcels',
        { method: 'GET', accessToken },
      )
      return r.parcel_cache_ids
    },
    staleTime: 60 * 1000,
    enabled: !!accessToken,
  })
}

/** Verberg een off-market kans (persistent, server-side). */
export function useDismissKans() {
  const { accessToken } = useAuth()
  const qc = useQueryClient()
  return useMutation<{ status: string }, Error, string>({
    mutationFn: (parcelId: string) =>
      apiFetch<{ status: string }>(
        `/api/dashboard/kansen/${encodeURIComponent(parcelId)}/dismiss`,
        { method: 'POST', accessToken },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard', 'kansen'] }),
  })
}

/** Gemeentesignalen: hergebruik de bestaande monitoring-changes feed. */
export function useGemeenteSignalen(gemeente: string) {
  const { accessToken } = useAuth()
  return useQuery<GemeenteSignaal[], Error>({
    queryKey: ['dashboard', 'signalen', gemeente],
    queryFn: async () => {
      const res = await apiFetch<ChangesListResponse>(
        `/api/monitoring/changes?gemeente_naam=${encodeURIComponent(gemeente)}&include_matches=true&limit=20`,
        { method: 'GET', accessToken },
      )
      return res.changes
    },
    staleTime: 60 * 1000,
    enabled: !!accessToken && !!gemeente,
  })
}
