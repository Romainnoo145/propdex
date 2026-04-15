/**
 * TanStack Query hooks for per-parcel checklist progress (checked items).
 *
 * GET /api/checklist-progress/{parcelId}/{useCase} → { checked_items: string[] }
 * PUT /api/checklist-progress/{parcelId}/{useCase} → { checked_items: string[] }
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { ChecklistProgressResponse } from '@/lib/types/checklist'

export function useChecklistProgress(parcelId: string | undefined, useCase: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ChecklistProgressResponse, Error>({
    queryKey: ['checklist-progress', parcelId, useCase],
    queryFn: () =>
      apiFetch<ChecklistProgressResponse>(
        `/api/checklist-progress/${parcelId}/${useCase}`,
        { method: 'GET', accessToken }
      ),
    enabled: !!parcelId && !!useCase && !!accessToken,
    staleTime: 30 * 1000,
  })
}

export function useUpdateChecklistProgress() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    ChecklistProgressResponse,
    Error,
    { parcelId: string; useCase: string; checkedItems: string[]; uploadedDocuments?: Record<string, string> }
  >({
    mutationFn: (vars) =>
      apiFetch<ChecklistProgressResponse>(
        `/api/checklist-progress/${vars.parcelId}/${vars.useCase}`,
        {
          method: 'PUT',
          accessToken,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checked_items: vars.checkedItems,
            uploaded_documents: vars.uploadedDocuments ?? {},
          }),
        }
      ),
    onMutate: async (vars) => {
      // Optimistic update
      const key = ['checklist-progress', vars.parcelId, vars.useCase]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ChecklistProgressResponse>(key)
      queryClient.setQueryData<ChecklistProgressResponse>(key, {
        checked_items: vars.checkedItems,
        uploaded_documents: vars.uploadedDocuments ?? previous?.uploaded_documents ?? {},
      })
      return { previous, key }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context && 'previous' in context && 'key' in context) {
        const ctx = context as { previous: ChecklistProgressResponse | undefined; key: string[] }
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['checklist-progress', vars.parcelId, vars.useCase],
      })
      // M045/S04: refresh org-view so teammates see Bob's new vinkje
      queryClient.invalidateQueries({
        queryKey: ['checklist-org-links', vars.parcelId],
      })
    },
  })
}
