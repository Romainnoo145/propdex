/**
 * TanStack Query hooks for score weight operations
 *
 * Provides hooks for:
 * - Fetching org score weights (GET /api/users/org/score-weights)
 * - Saving org score weights (PUT /api/users/org/score-weights)
 * - Polling re-score job status (GET /api/users/org/score-weights/job/{jobId})
 *
 * All mutations use useMutation (never useQuery for state changes).
 * Follows patterns from useSettings.ts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type {
  ScoreWeightsResponse,
  SaveScoreWeightsRequest,
  RescoreJobStatus,
} from '@/lib/types/scoreWeights'

const USERS_BASE = '/api/users'

/**
 * Fetch org score weights
 *
 * Returns custom weights if set, otherwise DEFAULT_WEIGHTS from backend.
 * Query key: ['org', 'score-weights']
 * Stale time: 5 minutes
 */
export function useOrgScoreWeights() {
  const { accessToken } = useAuth()

  return useQuery<ScoreWeightsResponse, Error>({
    queryKey: ['org', 'score-weights'],
    queryFn: () =>
      apiFetch<ScoreWeightsResponse>(USERS_BASE + '/org/score-weights', {
        accessToken,
        method: 'GET',
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!accessToken,
  })
}

/**
 * Save org score weights
 *
 * PUT /api/users/org/score-weights
 * Validates min 3 active factors per category (backend enforces, frontend pre-validates).
 * Invalidates ['org', 'score-weights'] on success.
 * Returns ScoreWeightsResponse with job_id for polling.
 */
export function useSaveScoreWeights() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<ScoreWeightsResponse, Error, SaveScoreWeightsRequest>({
    mutationFn: (data: SaveScoreWeightsRequest) =>
      apiFetch<ScoreWeightsResponse>(USERS_BASE + '/org/score-weights', {
        accessToken,
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org', 'score-weights'] })
    },
  })
}

/**
 * Poll re-score job status
 *
 * GET /api/users/org/score-weights/job/{jobId}
 * Polls every 2 seconds while status is not 'complete' or 'failed'.
 * Stops automatically when job finishes.
 * Only enabled when jobId is non-null.
 */
export function useRescoreJobStatus(jobId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<RescoreJobStatus, Error>({
    queryKey: ['org', 'rescore-job', jobId],
    queryFn: () =>
      apiFetch<RescoreJobStatus>(
        USERS_BASE + `/org/score-weights/job/${jobId}`,
        {
          accessToken,
          method: 'GET',
        },
      ),
    enabled: !!jobId && !!accessToken,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000
      if (data.status === 'complete' || data.status === 'failed') return false
      return 2000
    },
  })
}
