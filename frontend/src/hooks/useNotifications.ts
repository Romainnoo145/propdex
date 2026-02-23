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
  fetchAllChanges,
  fetchProjectChanges,
  fetchChangesForParcel,
  markProjectViewed,
  markChangeRead as apiMarkChangeRead,
  markAllChangesRead as apiMarkAllChangesRead,
} from '@/lib/api'
import type {
  ChangeRecord,
  MarkAllReadResponse,
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
 * Fetch all change history across the organization
 *
 * Query key: ['changes', 'all', includeMatches, gemeenteNaam]
 * Stale time: 60 seconds
 */
export function useAllChanges(includeMatches = true, gemeenteNaam?: string) {
  const { accessToken } = useAuth()

  return useQuery<ChangeRecordListResponse, Error>({
    queryKey: ['changes', 'all', includeMatches, gemeenteNaam],
    queryFn: () => fetchAllChanges(accessToken, 100, 0, includeMatches, gemeenteNaam),
    enabled: !!accessToken,
    staleTime: 60_000,
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

type ChangesSnapshot = { queryKey: readonly unknown[]; data: ChangeRecordListResponse | undefined }

/**
 * Mark a single change as read (server-backed, with optimistic update)
 *
 * Optimistically adds changeId to read_change_ids in all ['changes', ...] caches.
 * On success: invalidates unread counts for fresh server badge counts.
 * On error: rolls back optimistic update.
 */
export function useMarkChangeRead() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, { snapshots: ChangesSnapshot[] }>({
    mutationFn: (changeId: string) => apiMarkChangeRead(changeId, accessToken),
    onMutate: async (changeId: string) => {
      // Snapshot all changes caches for rollback
      const allEntries = queryClient.getQueriesData<ChangeRecordListResponse>({ queryKey: ['changes'] })

      const snapshots: ChangesSnapshot[] = allEntries.map(([queryKey, data]) => ({
        queryKey: queryKey as readonly unknown[],
        data,
      }))

      // Optimistically update all changes caches to include the new read ID
      for (const { queryKey, data } of snapshots) {
        if (data !== undefined) {
          queryClient.setQueryData<ChangeRecordListResponse>(queryKey, {
            changes: data.changes,
            total: data.total,
            read_change_ids: [...(data.read_change_ids ?? []), changeId],
          })
        }
      }

      return { snapshots }
    },
    onSuccess: () => {
      // Refresh server-side unread counts (badge numbers)
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
    },
    onError: (_error, _changeId, context) => {
      // Roll back all optimistic updates
      if (context?.snapshots) {
        for (const { queryKey, data } of context.snapshots) {
          queryClient.setQueryData(queryKey, data)
        }
      }
    },
  })
}

/**
 * Mark all changes as read (bulk action)
 *
 * On success: invalidates both unread counts and all changes caches
 * so read_change_ids is refreshed from server.
 * No optimistic update needed — full invalidation is appropriate for bulk action.
 *
 * @param projectId - Optional project filter (omit to mark all org changes)
 */
export function useMarkAllRead(projectId?: string) {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<MarkAllReadResponse, Error, void>({
    mutationFn: () => apiMarkAllChangesRead(accessToken, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
      queryClient.invalidateQueries({ queryKey: ['changes'] })
    },
  })
}
