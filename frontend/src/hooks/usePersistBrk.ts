/**
 * usePersistBrk — Write-path React Query mutation for BRK persist.
 *
 * Wraps POST /api/parcels/{parcelId}/brk/persist (M050/S02 write-path).
 *
 * onSuccess responsibilities (eng-plan AD2 cache invalidation):
 *   1. setQueryData(['brk', parcelId], records) — hydrate the read cache
 *      so the next render of fase-2 ContactPhaseView shows the records
 *      without an extra GET round-trip.
 *   2. invalidateQueries(['scan', parcelId]) — schedules a refetch of the
 *      scan endpoint so RescoreProgressBanner can pick up the eventual
 *      cascade_rescored_at flag (kicked off by useRescorePoll separately).
 *
 * Error handling: the hook propagates errors via mutation.error; the
 * consumer (BrkPersistPanel in Plan 08-03) calls mapBrkError(error.status,
 * error.message) to render Dutch copy. Mapping is NOT done inside the hook
 * to keep the data layer free of UX copy.
 *
 * Note on AVG-stripped responses: POST may legitimately return [] when
 * upstream only had natuurlijk-persoon records. The mutation treats this
 * as success; downstream UI shows the "Particuliere eigenaar" empty-state
 * card (eng-plan AD4).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch, ApiError } from '@/lib/api'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

/**
 * Pure mutation function — exported for unit-testing without React/QueryClient.
 */
export async function persistBrkRecords(
  parcelId: string,
  accessToken: string | null,
): Promise<BRKOwnershipRecordRead[]> {
  return apiFetch<BRKOwnershipRecordRead[]>(
    `/api/parcels/${encodeURIComponent(parcelId)}/brk/persist`,
    { method: 'POST', accessToken },
  )
}

export function usePersistBrk(parcelId: string) {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<BRKOwnershipRecordRead[], ApiError | Error, void>({
    mutationFn: () => persistBrkRecords(parcelId, accessToken),
    onSuccess: (records) => {
      // Hydrate read cache (next useBrkRecords render is instant)
      queryClient.setQueryData(['brk', parcelId], records)
      // Trigger refetch of scan endpoint for cascade_rescored_at signal
      queryClient.invalidateQueries({ queryKey: ['scan', parcelId] })
    },
  })
}
