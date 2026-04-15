/**
 * TanStack Query hook for org-aggregated checklist activity.
 *
 * GET /api/checklist-progress/{parcelId}/org → ChecklistLinksBundle
 *
 * Returns team attribution for all 4 use cases in one call. Used by
 * TeamAttributionBadge on the checklist surfaces (rapport section +
 * dedicated route). Write path remains useChecklistProgress (user-scoped).
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { ChecklistLinksBundle } from '@/lib/types/checklist'

export function useOrgChecklistLinks(parcelId: string | undefined) {
  const { accessToken } = useAuth()

  return useQuery<ChecklistLinksBundle, Error>({
    queryKey: ['checklist-org-links', parcelId],
    queryFn: () =>
      apiFetch<ChecklistLinksBundle>(
        `/api/checklist-progress/${parcelId}/org`,
        { method: 'GET', accessToken },
      ),
    enabled: !!parcelId && !!accessToken,
    staleTime: 30 * 1000,
  })
}
