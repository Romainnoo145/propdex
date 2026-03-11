/**
 * Ephemeral BRK eigendom lookup hook
 *
 * Manual trigger only (enabled: false) — user must confirm before API call.
 * gcTime: 0 ensures BRK data is garbage collected immediately on unmount
 * (Kadaster Tier 3 never-store compliance).
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { BRKOwnershipResponse } from '@/lib/types/brk'

const SCANS_BASE = '/api/scans'

export function useEigendomLookup(parcelId: string) {
  const { accessToken } = useAuth()

  return useQuery<BRKOwnershipResponse, Error>({
    queryKey: ['brk-eigendom', parcelId],
    queryFn: () =>
      apiFetch<BRKOwnershipResponse>(
        `${SCANS_BASE}/parcels/${parcelId}/eigendom`,
        { accessToken, method: 'GET' },
      ),
    enabled: false, // Manual trigger only via refetch()
    staleTime: 0, // Always stale
    gcTime: 0, // Discard on unmount (Kadaster Tier 3)
    retry: false, // Don't auto-retry paid API calls
  })
}
