/**
 * TanStack Query hook for development subsidies from RVO.
 *
 * Fetches from: GET /api/gemeente/subsidies/development
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface SubsidieResponse {
  id: string
  title: string
  intro: string | null
  url: string | null
  sectors: string[]
  targets: string[]
}

export interface SubsidiesResponse {
  subsidies: SubsidieResponse[]
  total: number
  source: string
}

export function useSubsidies() {
  const { accessToken } = useAuth()

  return useQuery<SubsidiesResponse, Error>({
    queryKey: ['subsidies-development'],
    queryFn: () =>
      apiFetch<SubsidiesResponse>(
        '/api/gemeente/subsidies/development',
        { method: 'GET', accessToken },
      ),
    staleTime: 30 * 60 * 1000, // 30 min — subsidies change infrequently
    enabled: !!accessToken,
  })
}
