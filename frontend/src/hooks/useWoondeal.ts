/**
 * TanStack Query hook for Woondeal gemeente-context (M054/S06, context-only).
 * Fetches from: GET /api/gemeente/{code}/woondeal?gemeente_naam={naam}
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface WoondealOpgave {
  gemeente_naam: string
  toevoegingen: number | null
  plancapaciteit: number | null
  gat: number | null
  sleutelprojecten_aantal: number | null
  sleutelprojecten_woningen: number | null
}

export interface WoondealResponse {
  gemeente_naam: string
  heeft_woondeal: boolean
  regio_naam: string | null
  periode: string | null
  opgave: WoondealOpgave | null
  aandeel_betaalbaar: number | null
  betaalbaar_definitie: string | null
  regelingen: string[]
  doelgroepen: string[]
  document_title: string | null
}

export function useWoondeal(
  gemeenteCode: string | null,
  gemeenteNaam: string | null,
) {
  const { accessToken } = useAuth()

  return useQuery<WoondealResponse, Error>({
    queryKey: ['woondeal', gemeenteCode, gemeenteNaam],
    queryFn: () =>
      apiFetch<WoondealResponse>(
        `/api/gemeente/${encodeURIComponent(gemeenteCode!)}/woondeal?gemeente_naam=${encodeURIComponent(gemeenteNaam!)}`,
        { method: 'GET', accessToken },
      ),
    staleTime: 60 * 60 * 1000, // 1h — woondeals change rarely
    enabled: !!accessToken && !!gemeenteCode && !!gemeenteNaam,
  })
}
