/**
 * useAdminPromptImprovement — React Query hook for admin prompt improvement endpoint.
 *
 * Replaces the manual useState/handler for POST /api/admin/improve-prompts
 * in the admin dashboard route.
 * Types are exported so the dashboard component can use them without duplication.
 */

import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'

/* ─── Types ──────────────────────────────────────────────────── */

export interface PromptSuggestion {
  category: string
  description: string
  current_weakness: string
  suggested_improvement: string
}

export interface ImprovePromptsResult {
  suggestions: PromptSuggestion[]
  analyzed_count: number
  prompt_analyzed: string
}

/* ─── Hook ───────────────────────────────────────────────────── */

/** Triggers prompt analysis (POST /api/admin/improve-prompts). */
export function useImprovePrompts() {
  const { accessToken } = useAuth()

  return useMutation<ImprovePromptsResult, Error>({
    mutationFn: () =>
      apiFetch<ImprovePromptsResult>('/api/admin/improve-prompts', {
        method: 'POST',
        accessToken,
      }),
  })
}
