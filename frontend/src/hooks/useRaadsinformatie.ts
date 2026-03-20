/**
 * TanStack Query hook for raadsinformatie data.
 *
 * Fetches development-relevant council documents from:
 *   GET /api/gemeente/{naam}/raadsinformatie
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface RaadsstukResponse {
  doc_id: string
  titel: string
  datum: string | null
  type: string | null
  samenvatting: string | null
  bron_url: string | null
}

export interface RaadsinformatieResponse {
  gemeente_naam: string
  dekking: boolean
  stukken: RaadsstukResponse[]
  total_found: number
}

export function useRaadsinformatie(gemeenteNaam: string | null) {
  const { accessToken } = useAuth()

  return useQuery<RaadsinformatieResponse, Error>({
    queryKey: ['raadsinformatie', gemeenteNaam],
    queryFn: () =>
      apiFetch<RaadsinformatieResponse>(
        `/api/gemeente/${encodeURIComponent(gemeenteNaam!)}/raadsinformatie`,
        { method: 'GET', accessToken },
      ),
    staleTime: 10 * 60 * 1000, // 10 min — data changes infrequently
    enabled: !!accessToken && !!gemeenteNaam,
  })
}
