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

import { useMemo } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
  fetchUnreadCounts,
  fetchAllChanges,
  fetchProjectChanges,
  fetchChangesForParcel,
  refreshMonitoring as apiRefreshMonitoring,
  setGemeenteMonitoringSubscription,
  markProjectViewed,
  markChangeRead as apiMarkChangeRead,
  markAllChangesRead as apiMarkAllChangesRead,
} from '@/lib/api'
import { normalizeGemeenteCode } from '@/lib/geo/normalizers'
import type {
  ChangeRecord,
  MarkAllReadResponse,
  MonitoringSubscriptionRequest,
  MonitoringSubscriptionResponse,
  UnreadDetailResponse,
  ChangeRecordListResponse,
} from '@/lib/types/monitoring'
import { useMonitoredProjects } from './useProjects'

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
 * Resolve monitored-project context for a municipality.
 *
 * Combines the monitored project tree with unread counts so gemeente-focused
 * panels can show and mutate scoped notification state instead of org-wide totals.
 */
export function useGemeenteMonitoringState(gemeenteCode: string | null | undefined) {
  const normalizedCode = normalizeGemeenteCode(gemeenteCode)
  const { data: unreadData } = useUnreadCounts()
  const { data: monitoredProjects } = useMonitoredProjects()

  return useMemo(() => {
    if (!normalizedCode) {
      return {
        projectId: null,
        unreadCount: 0,
        isMonitored: false,
      }
    }

    const project = monitoredProjects?.projects.find(
      (candidate) => normalizeGemeenteCode(candidate.gemeente_code) === normalizedCode
    ) ?? null

    if (!project) {
      return {
        projectId: null,
        unreadCount: 0,
        isMonitored: false,
      }
    }

    const unreadCount =
      unreadData?.per_project.find((entry) => entry.project_id === project.id)?.unread_count ?? 0

    return {
      projectId: project.id,
      unreadCount,
      isMonitored: true,
    }
  }, [monitoredProjects?.projects, normalizedCode, unreadData?.per_project])
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

const PAGE_SIZE = 25

/**
 * Infinite scroll hook for all change history across the organization
 *
 * Query key: ['changes', 'all-infinite', includeMatches, gemeenteNaam]
 * Page size: 25 records
 * Stale time: 60 seconds
 *
 * Stops fetching when has_more=false (backend signals no more pages).
 */
export function useInfiniteAllChanges(
  includeMatches = true,
  gemeenteNaam?: string
) {
  const { accessToken } = useAuth()

  return useInfiniteQuery<ChangeRecordListResponse, Error>({
    queryKey: ['changes', 'all-infinite', includeMatches, gemeenteNaam],
    queryFn: ({ pageParam = 0 }) =>
      fetchAllChanges(
        accessToken,
        PAGE_SIZE,
        pageParam as number,
        includeMatches,
        gemeenteNaam
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.has_more) {
        return (lastPageParam as number) + PAGE_SIZE
      }
      return undefined // No more pages
    },
    enabled: !!accessToken,
    staleTime: 60_000,
  })
}

/**
 * Infinite scroll hook for project-scoped change history.
 *
 * Uses the same pagination shape as the org-wide feed, but keeps the query
 * scoped to a single monitored project so gemeente drill-downs do not depend
 * on the broader organization feed path.
 */
export function useInfiniteProjectChanges(
  projectId: string | null,
  includeMatches = false
) {
  const { accessToken } = useAuth()

  return useInfiniteQuery<ChangeRecordListResponse, Error>({
    queryKey: ['changes', 'project-infinite', projectId, includeMatches],
    queryFn: ({ pageParam = 0 }) =>
      fetchProjectChanges(
        projectId!,
        accessToken,
        PAGE_SIZE,
        pageParam as number,
        includeMatches
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.has_more) {
        return (lastPageParam as number) + PAGE_SIZE
      }
      return undefined
    },
    enabled: !!accessToken && !!projectId,
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

type ChangesQueryData =
  | ChangeRecordListResponse
  | InfiniteData<ChangeRecordListResponse>
  | undefined
type ChangesSnapshot = { queryKey: readonly unknown[]; data: ChangesQueryData }

function appendReadId(
  page: ChangeRecordListResponse,
  changeId: string
): ChangeRecordListResponse {
  const readIds = new Set(page.read_change_ids ?? [])
  readIds.add(changeId)
  return {
    ...page,
    read_change_ids: [...readIds],
  }
}

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
      const allEntries = queryClient.getQueriesData<ChangesQueryData>({
        queryKey: ['changes'],
      })

      const snapshots: ChangesSnapshot[] = allEntries.map(([queryKey, data]) => ({
        queryKey: queryKey as readonly unknown[],
        data,
      }))

      // Optimistically update all changes caches to include the new read ID.
      // Important: keep InfiniteQuery shape intact ({ pages, pageParams }).
      for (const { queryKey, data } of snapshots) {
        if (data === undefined) continue

        const infinite = data as InfiniteData<ChangeRecordListResponse>
        if (Array.isArray(infinite.pages)) {
          queryClient.setQueryData<InfiniteData<ChangeRecordListResponse>>(
            queryKey,
            {
              ...infinite,
              pages: infinite.pages.map((page) => appendReadId(page, changeId)),
            }
          )
          continue
        }

        const single = data as ChangeRecordListResponse
        if (Array.isArray(single.changes)) {
          queryClient.setQueryData<ChangeRecordListResponse>(
            queryKey,
            appendReadId(single, changeId)
          )
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

/**
 * Trigger on-demand monitoring refresh for a monitored gemeente project.
 *
 * Invalidates unread + changes caches so UI updates immediately after refresh.
 */
export function useRefreshMonitoring() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    { status: string; new_changes: number; total_detected: number },
    Error,
    string
  >({
    mutationFn: (projectId: string) =>
      apiRefreshMonitoring(accessToken, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
      queryClient.invalidateQueries({ queryKey: ['changes'] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'monitored'] })
    },
  })
}

/**
 * Enable/disable monitoring for a single gemeente.
 *
 * Invalidates project and monitoring caches so UI picks up the new scope
 * immediately (project cards, unread counters, and monitored list).
 */
export function useSetGemeenteMonitoringSubscription() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    MonitoringSubscriptionResponse,
    Error,
    MonitoringSubscriptionRequest
  >({
    mutationFn: (input) => setGemeenteMonitoringSubscription(accessToken, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', 'monitored'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
      queryClient.invalidateQueries({ queryKey: ['changes'] })
    },
  })
}
