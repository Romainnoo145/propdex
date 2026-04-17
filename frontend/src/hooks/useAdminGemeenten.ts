/**
 * TanStack Query hook for the vendor-only gemeente list used by the
 * admin upload modal. Stale-time is long because gemeente_provincie_map
 * only changes on CBS boundary updates (≈ annual).
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export interface AdminGemeente {
  code: string
  naam: string
  provincie_code: string
}

export function useAdminGemeenten(enabled = true) {
  const { accessToken } = useAuth()

  return useQuery<AdminGemeente[]>({
    queryKey: ['admin-gemeenten'],
    queryFn: () =>
      apiFetch<AdminGemeente[]>('/api/policy-documents/admin/gemeenten', {
        method: 'GET',
        accessToken,
      }),
    enabled: enabled && !!accessToken,
    staleTime: 60 * 60 * 1000,
  })
}
