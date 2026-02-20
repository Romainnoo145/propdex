/**
 * TanStack Query hooks for change notification operations
 *
 * Provides hooks for:
 * - Fetching unread notification counts (polled every 60 seconds)
 * - Fetching change history for a project (with optional match enrichment)
 * - Fetching bekendmakingen for a specific parcel
 * - Marking a project as viewed (clears unread badge)
 *
 * All hooks require authentication and invalidate relevant caches on mutation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
  fetchUnreadCounts,
  fetchProjectChanges,
  fetchChangesForParcel,
  markProjectViewed,
} from '@/lib/api'
import type {
  ChangeRecord,
  UnreadDetailResponse,
  ChangeRecordListResponse,
} from '@/lib/types/monitoring'

/**
 * Fetch unread change notification counts
 *
 * Query key: ['notifications', 'unread']
 * Polling interval: 60 seconds (to detect new changes)
 * Stale time: 30 seconds (balance freshness vs unnecessary refetches)
 */
export function useUnreadCounts() {
  const { accessToken } = useAuth()

  return useQuery<UnreadDetailResponse, Error>({
    queryKey: ['notifications', 'unread'],
    queryFn: () => fetchUnreadCounts(accessToken),
    refetchInterval: 60_000, // Poll every 60 seconds
    staleTime: 30_000,
    enabled: !!accessToken,
  })
}

/**
 * Fetch change history for a specific project
 *
 * Query key: ['changes', projectId, includeMatches]
 * Stale time: 60 seconds (changes detected by background jobs, not real-time)
 */
export function useProjectChanges(
  projectId: string | null,
  includeMatches = false
) {
  const { accessToken } = useAuth()

  return useQuery<ChangeRecordListResponse, Error>({
    queryKey: ['changes', projectId, includeMatches],
    queryFn: () =>
      fetchProjectChanges(projectId!, accessToken, 50, 0, includeMatches),
    enabled: !!accessToken && !!projectId,
    staleTime: 60_000,
  })
}

/**
 * Fetch bekendmakingen matching a parcel's address postcode
 *
 * Query key: ['parcel-changes', parcelId]
 * Only fetches when parcelId is provided.
 */
export function useParcelChanges(parcelId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ChangeRecord[], Error>({
    queryKey: ['parcel-changes', parcelId],
    queryFn: () => fetchChangesForParcel(parcelId!, accessToken),
    enabled: !!accessToken && !!parcelId,
    staleTime: 60_000,
  })
}

/**
 * Mark a project's changes as viewed (clears unread badge)
 *
 * Invalidates unread counts cache on success.
 */
export function useMarkViewed() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (projectId: string) => markProjectViewed(projectId, accessToken),
    onSuccess: () => {
      // Invalidate unread counts (badge should update)
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
    },
  })
}
