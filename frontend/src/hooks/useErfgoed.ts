/**
 * TanStack Query hook for erfgoed data.
 *
 * Fetches from: GET /api/gemeente/{naam}/erfgoed
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface BeschermdGezichtResponse {
  naam: string
  type: string
  aangewezen: string | null
  oppervlakte_ha: number | null
}

export interface ErfgoedResponse {
  gemeente_naam: string
  beschermde_gezichten: BeschermdGezichtResponse[]
  total: number
}

export function useErfgoed(gemeenteNaam: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ErfgoedResponse, Error>({
    queryKey: ['erfgoed', gemeenteNaam],
    queryFn: () =>
      apiFetch<ErfgoedResponse>(
        `/api/gemeente/${encodeURIComponent(gemeenteNaam!)}/erfgoed`,
        { method: 'GET', accessToken },
      ),
    staleTime: 60 * 60 * 1000, // 1h
    enabled: !!accessToken && !!gemeenteNaam,
  })
}
