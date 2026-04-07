/**
 * useAdminAiUsage — React Query hook for the admin AI usage summary endpoint.
 *
 * Replaces the manual useState/useEffect fetch in the admin dashboard route.
 * Types are exported so the dashboard component can use them without duplication.
 */

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'

/* ─── Types ──────────────────────────────────────────────────── */

export interface CostByDay {
  date: string
  total_cost: number
  total_calls: number
}

export interface CostByCallSite {
  call_site: string
  total_cost: number
  total_calls: number
}

export interface CostByUser {
  email: string | null
  total_cost: number
  total_calls: number
}

export interface AiUsageSummary {
  cost_by_day: CostByDay[]
  cost_by_call_site: CostByCallSite[]
  cost_by_user: CostByUser[]
}

/* ─── Hook ───────────────────────────────────────────────────── */

export function useAdminAiUsage() {
  const { accessToken } = useAuth()

  return useQuery<AiUsageSummary, Error>({
    queryKey: ['admin-ai-usage-summary'],
    queryFn: () =>
      apiFetch<AiUsageSummary>('/api/admin/ai-usage/summary', {
        method: 'GET',
        accessToken,
      }),
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5,
  })
}
