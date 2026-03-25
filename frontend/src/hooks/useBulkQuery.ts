/**
 * TanStack Query hooks for the bulk query / Verkenner feature.
 *
 * Provides:
 * - useBulkQuery: submit a natural-language query
 * - useBulkQueryHistory: paginated list of past queries
 * - useBulkQueryDetail: full results for a single query
 * - useBulkRequest: submit a manual request for unsupported queries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

const AGENTS_BASE = '/api/agents'

/* ─── Types ─────────────────────────────────────────────────── */

export interface ParsedQuery {
  municipality?: string | null
  build_year_min?: number | null
  build_year_max?: number | null
  area_min?: number | null
  area_max?: number | null
  bestemming?: string | null
  pand_status?: string | null
}

export interface BulkResult {
  parcel_id: string
  address?: string | null
  municipality?: string | null
  build_year?: number | null
  area_m2?: number | null
  bestemming?: string | null
  pand_status?: string | null
}

export interface BulkQueryResponse {
  type: 'results' | 'unsupported'
  query_id: string
  results: BulkResult[]
  total: number
  parsed?: ParsedQuery | null
  reason?: string | null
}

export interface BulkQuerySummary {
  id: string
  query_text: string
  result_count: number
  status: string
  created_at: string
}

export interface BulkQueryHistoryResponse {
  queries: BulkQuerySummary[]
  total: number
}

export interface BulkQueryDetailResponse {
  id: string
  query_text: string
  result_count: number
  status: string
  parsed?: ParsedQuery | null
  results: BulkResult[]
  created_at: string
}

/* ─── Hooks ─────────────────────────────────────────────────── */

/** Submit a new natural-language query. */
export function useBulkQuery() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<BulkQueryResponse, Error, string>({
    mutationFn: (query: string) =>
      apiFetch<BulkQueryResponse>(`${AGENTS_BASE}/bulk-query`, {
        method: 'POST',
        body: JSON.stringify({ query }),
        accessToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-queries'] })
    },
  })
}

/** Fetch paginated history of past queries. */
export function useBulkQueryHistory(offset = 0, limit = 20) {
  const { accessToken } = useAuth()

  return useQuery<BulkQueryHistoryResponse, Error>({
    queryKey: ['bulk-queries', offset, limit],
    queryFn: () =>
      apiFetch<BulkQueryHistoryResponse>(
        `${AGENTS_BASE}/bulk-queries?offset=${offset}&limit=${limit}`,
        { method: 'GET', accessToken },
      ),
    staleTime: 30_000,
    enabled: !!accessToken,
  })
}

/** Fetch full results for a single past query. */
export function useBulkQueryDetail(queryId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<BulkQueryDetailResponse, Error>({
    queryKey: ['bulk-query-detail', queryId],
    queryFn: () =>
      apiFetch<BulkQueryDetailResponse>(
        `${AGENTS_BASE}/bulk-queries/${queryId}`,
        { method: 'GET', accessToken },
      ),
    enabled: !!accessToken && !!queryId,
  })
}

/** Submit a manual request for an unsupported query. */
export function useBulkRequest() {
  const { accessToken } = useAuth()

  return useMutation({
    mutationFn: (queryText: string) =>
      apiFetch(`${AGENTS_BASE}/bulk-request`, {
        method: 'POST',
        body: JSON.stringify({ query_text: queryText }),
        accessToken,
      }),
  })
}

/** Get CSV download URL for a query. */
export function getBulkQueryCsvUrl(queryId: string): string {
  return `${AGENTS_BASE}/bulk-queries/${queryId}/csv`
}
