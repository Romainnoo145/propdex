/**
 * TanStack Query hook for gemeente profile data.
 *
 * Fetches aggregated regulatory posture from:
 *   GET /api/gemeente/{naam}/profile
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface GemeenteProfile {
  gemeente_naam: string
  severity_label: 'Gunstig' | 'Gemiddeld' | 'Ongunstig' | 'Zeer ongunstig' | 'Onbekend'
  approval_rate_pct: number | null
  rejection_rate_pct: number | null
  avg_doorlooptijd_days: number | null
  bekendmakingen_30d: number
  bekendmakingen_90d: number
  bekendmakingen_365d: number
  permit_type_distribution: Record<string, number>
  sample_size: number
  data_coverage: 'high' | 'medium' | 'low' | 'none'
}

export const SEVERITY_COLORS: Record<string, string> = {
  'Gunstig': '#22c55e',
  'Gemiddeld': '#f59e0b',
  'Ongunstig': '#f97316',
  'Zeer ongunstig': '#ef4444',
  'Onbekend': '#94a3b8',
}

export function useGemeenteProfile(gemeenteNaam: string | null) {
  const { accessToken } = useAuth()

  return useQuery<GemeenteProfile, Error>({
    queryKey: ['gemeente-profile', gemeenteNaam],
    queryFn: () =>
      apiFetch<GemeenteProfile>(
        `/api/gemeente/${encodeURIComponent(gemeenteNaam!)}/profile`,
        { method: 'GET', accessToken },
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken && !!gemeenteNaam,
  })
}
