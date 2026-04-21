/**
 * TanStack Query hooks for per-parcel project type (read + optimistic mutation).
 *
 * GET /api/parcels/{parcelId}/project-type → ProjectTypeResponse
 * PUT /api/parcels/{parcelId}/project-type → ProjectTypeResponse
 *
 * Follows the useChecklistProgress pattern 1:1.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { fetchProjectType, updateProjectType } from '@/lib/api/projectType'
import type { ProjectType, ProjectTypeResponse } from '@/lib/types/projectType'

export function useParcelProjectType(parcelId: string | undefined) {
  const { accessToken } = useAuth()

  return useQuery<ProjectTypeResponse, Error>({
    queryKey: ['parcel-project-type', parcelId],
    queryFn: () => fetchProjectType(parcelId!, accessToken!),
    enabled: !!parcelId && !!accessToken,
    staleTime: 60 * 1000, // 1 min — projecttype wijzigt zelden
  })
}

export function useUpdateParcelProjectType() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    ProjectTypeResponse,
    Error,
    { parcelId: string; projectType: ProjectType }
  >({
    mutationFn: (vars) =>
      updateProjectType(vars.parcelId, vars.projectType, accessToken!),
    onMutate: async (vars) => {
      const key = ['parcel-project-type', vars.parcelId]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ProjectTypeResponse>(key)
      // Optimistic: assume set_at is "now"; set_by_user_id unknown → keep previous or null
      queryClient.setQueryData<ProjectTypeResponse>(key, {
        parcel_id: vars.parcelId,
        project_type: vars.projectType,
        set_at: new Date().toISOString(),
        set_by_user_id: previous?.set_by_user_id ?? null,
      })
      return { previous, key }
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context && 'previous' in context && 'key' in context) {
        const ctx = context as { previous: ProjectTypeResponse | undefined; key: string[] }
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['parcel-project-type', vars.parcelId] })
      // Future-proof: when S03 live, score-query must refresh on type-change
      queryClient.invalidateQueries({ queryKey: ['scan-score', vars.parcelId] })
    },
  })
}
