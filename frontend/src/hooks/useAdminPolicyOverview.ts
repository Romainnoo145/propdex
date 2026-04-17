/**
 * TanStack Query hook for the vendor-only admin policy overview.
 *
 * Returns the full cascade catalog (landelijk + provinciaal + gemeentelijk)
 * with the latest-version slot summary per (entity_type, entity_code,
 * source_key) triple. Used by the admin settings UI to see what has been
 * uploaded and where gaps remain.
 *
 * M045/S05: backing data source for CascadeLevelAccordion.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { AdminPolicyOverviewResponse } from '@/lib/types/policy-admin'

export function useAdminPolicyOverview() {
  const { accessToken } = useAuth()

  return useQuery<AdminPolicyOverviewResponse>({
    queryKey: ['admin-policy-overview'],
    queryFn: () =>
      apiFetch<AdminPolicyOverviewResponse>(
        '/api/policy-documents/admin/overview',
        { method: 'GET', accessToken },
      ),
    enabled: !!accessToken,
    staleTime: 30 * 1000,
  })
}
