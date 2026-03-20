/**
 * TanStack Query hook for huisvestingsverordening data.
 *
 * Fetches from: GET /api/gemeente/{naam}/huisvestingsverordening
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface HuisvestingsverordeningResponse {
  gemeente_naam: string
  heeft_verordening: boolean
  title: string | null
  identifier: string | null
  modified: string | null
  subject: string | null
  url: string | null
}

export function useHuisvestingsverordening(gemeenteNaam: string | null) {
  const { accessToken } = useAuth()

  return useQuery<HuisvestingsverordeningResponse, Error>({
    queryKey: ['huisvestingsverordening', gemeenteNaam],
    queryFn: () =>
      apiFetch<HuisvestingsverordeningResponse>(
        `/api/gemeente/${encodeURIComponent(gemeenteNaam!)}/huisvestingsverordening`,
        { method: 'GET', accessToken },
      ),
    staleTime: 60 * 60 * 1000, // 1h — regulations change rarely
    enabled: !!accessToken && !!gemeenteNaam,
  })
}
