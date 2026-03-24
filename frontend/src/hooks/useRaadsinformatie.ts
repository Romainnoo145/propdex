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

function normalizeRaadsinformatieUrl(url: string | null): string | null {
  if (!url) return null

  const trimmed = url.trim()
  if (!trimmed) return null

  const duplicatedPrefixMatch = trimmed.match(
    /^https?:\/\/id\.openraadsinformatie\.nl\/(https?:\/\/.+)$/i
  )
  if (duplicatedPrefixMatch?.[1]) {
    return duplicatedPrefixMatch[1]
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return `https://openraadsinformatie.nl${trimmed}`
  }

  return `https://id.openraadsinformatie.nl/${trimmed.replace(/^\/+/, '')}`
}

export function useRaadsinformatie(gemeenteNaam: string | null) {
  const { accessToken } = useAuth()

  return useQuery<RaadsinformatieResponse, Error>({
    queryKey: ['raadsinformatie', gemeenteNaam],
    queryFn: async () => {
      const response = await apiFetch<RaadsinformatieResponse>(
        `/api/gemeente/${encodeURIComponent(gemeenteNaam!)}/raadsinformatie`,
        { method: 'GET', accessToken },
      )

      return {
        ...response,
        stukken: response.stukken.map((stuk) => ({
          ...stuk,
          bron_url: normalizeRaadsinformatieUrl(stuk.bron_url),
        })),
      }
    },
    staleTime: 10 * 60 * 1000, // 10 min — data changes infrequently
    enabled: !!accessToken && !!gemeenteNaam,
  })
}
