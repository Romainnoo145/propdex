/**
 * TanStack Query hook for the vendor-only per-slot version history.
 *
 * Fetches all versions of a single (entity_type, entity_code, source_key)
 * triple, newest first. Used when the admin UI expands a row to reveal
 * the version history + download links.
 *
 * M045/S05: backing data source for VersionHistoryPanel. Disabled until
 * all three params are defined so the query is only fired on explicit
 * row expansion.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { AdminPolicyVersionsResponse } from '@/lib/types/policy-admin'

interface VersionsParams {
  entityType: string | undefined
  entityCode: string | undefined
  sourceKey: string | undefined
}

export function useAdminPolicyVersions(params: VersionsParams) {
  const { accessToken } = useAuth()
  const { entityType, entityCode, sourceKey } = params

  return useQuery<AdminPolicyVersionsResponse>({
    queryKey: ['admin-policy-versions', entityType, entityCode, sourceKey],
    queryFn: () => {
      const qs = new URLSearchParams({
        entity_type: entityType!,
        entity_code: entityCode!,
        source_key: sourceKey!,
      })
      return apiFetch<AdminPolicyVersionsResponse>(
        `/api/policy-documents/admin/versions?${qs}`,
        { method: 'GET', accessToken },
      )
    },
    enabled: !!accessToken && !!entityType && !!entityCode && !!sourceKey,
    staleTime: 30 * 1000,
  })
}
