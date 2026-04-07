/**
 * useAdminEval — React Query hooks for admin chat evaluation endpoints.
 *
 * Replaces the manual useState/useEffect fetch + mutation handlers
 * for eval-results and eval-chats in the admin dashboard route.
 * Types are exported so the dashboard component can use them without duplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'

/* ─── Types ──────────────────────────────────────────────────── */

export interface EvalResultEntry {
  id: string
  started_at: string | null
  last_message_at: string | null
  message_count: number
  eval_scores: Record<string, number> | null
  eval_pass: boolean | null
  eval_at: string | null
}

export interface EvalConversationResult {
  conversation_id: string
  status: string
  eval_pass: boolean
  scores: {
    conversation_completeness?: number
    turn_relevancy?: number
    role_adherence?: number
  }
  reason?: string
}

export interface EvalRunResult {
  total: number
  passed: number
  failed: number
  errors: number
  results: EvalConversationResult[]
}

/* ─── Query key ──────────────────────────────────────────────── */

const EVAL_RESULTS_KEY = ['admin-eval-results'] as const

/* ─── Hooks ──────────────────────────────────────────────────── */

/** Fetches previous eval results (GET /api/admin/eval-results). */
export function useAdminEvalResults() {
  const { accessToken } = useAuth()

  return useQuery<EvalResultEntry[], Error>({
    queryKey: [...EVAL_RESULTS_KEY],
    queryFn: () =>
      apiFetch<EvalResultEntry[]>('/api/admin/eval-results', {
        method: 'GET',
        accessToken,
      }),
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5,
  })
}

/** Triggers a new evaluation run (POST /api/admin/eval-chats), then invalidates cached results. */
export function useEvalChats() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<EvalRunResult, Error>({
    mutationFn: () =>
      apiFetch<EvalRunResult>('/api/admin/eval-chats', {
        method: 'POST',
        accessToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...EVAL_RESULTS_KEY] })
    },
  })
}
