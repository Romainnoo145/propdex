/**
 * useBrkRecords — Read-path React Query hook for persisted BRK records.
 *
 * Wraps GET /api/parcels/{parcelId}/brk (M050/S06 read-path, eng-plan AD2).
 * Returns rechtspersoon + overheid records; never natuurlijk_persoon (AVG strip
 * at persist-time — backend guarantees the shape).
 *
 * Cache key: ['brk', parcelId]  — invalidated by usePersistBrk on success.
 *
 * Project convention: this project uses raw fetch via apiFetch + useAuth
 * (NOT axios/apiClient as referenced in the upstream eng-plan literal text).
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

/**
 * Pure query function — exported for unit-testing without React/QueryClient.
 * Keeps the hook itself thin and testable at the API-call layer.
 */
export async function fetchBrkRecords(
  parcelId: string,
  accessToken: string | null,
): Promise<BRKOwnershipRecordRead[]> {
  return apiFetch<BRKOwnershipRecordRead[]>(
    `/api/parcels/${encodeURIComponent(parcelId)}/brk`,
    { method: 'GET', accessToken },
  )
}

export function useBrkRecords(parcelId: string) {
  const { accessToken } = useAuth()

  return useQuery<BRKOwnershipRecordRead[], Error>({
    queryKey: ['brk', parcelId],
    queryFn: () => fetchBrkRecords(parcelId, accessToken),
    enabled: Boolean(parcelId) && !!accessToken,
    staleTime: 30_000,
  })
}
