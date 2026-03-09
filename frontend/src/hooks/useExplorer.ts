/**
 * TanStack Query hook for the Jurisprudentie Explorer.
 *
 * Provides infinite-scroll pagination and cross-faceted filter counts
 * for the /jurisprudentie route.
 */

import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
  fetchExplorerResults,
  type ExplorerResponse,
  type ExplorerFilters,
} from '@/lib/api'

export type { ExplorerFilters, ExplorerResponse }
export type { ExplorerRuling, FacetItem } from '@/lib/api'

const PAGE_SIZE = 20

/**
 * Infinite-scroll hook for explorer results.
 *
 * Query key includes all active filters so that changing any filter
 * resets pagination automatically.
 *
 * Facets are taken from the latest page (they reflect cross-filtered
 * counts that update as filters change).
 */
export function useExplorerResults(filters: ExplorerFilters) {
  const { accessToken } = useAuth()

  return useInfiniteQuery<ExplorerResponse, Error>({
    queryKey: ['explorer', filters],
    queryFn: ({ pageParam = 0 }) =>
      fetchExplorerResults(accessToken!, filters, PAGE_SIZE, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.has_more) {
        return (lastPageParam as number) + PAGE_SIZE
      }
      return undefined
    },
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
  })
}
