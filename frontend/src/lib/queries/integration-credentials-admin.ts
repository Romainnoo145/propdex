/**
 * TanStack Query hooks for the M049/S05 admin integration-credentials API.
 *
 * Backend contract: backend/app/admin/integration_credentials_router.py
 *   GET    /api/admin/integration-credentials/{source_key} -> list[CredentialEntryRead]
 *   POST   /api/admin/integration-credentials              -> CredentialEntryRead
 *   DELETE /api/admin/integration-credentials/{id}         -> 204
 *
 * Cache invalidation: mutations invalidate the per-source_key list so the
 * modal's filled/empty state repaints after every save/rotate.
 *
 * GET shape NEVER includes plaintext or ciphertext — see
 * `frontend/src/lib/types/integration-credentials.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type {
  CredentialCreate,
  CredentialEntryRead,
} from '@/lib/types/integration-credentials'

/** Stable query-key factory — single source of truth for cache invalidation. */
export const integrationCredentialsKeys = {
  all: ['integration-credentials'] as const,
  forSource: (sourceKey: string) =>
    [...integrationCredentialsKeys.all, sourceKey] as const,
}

/** GET /api/admin/integration-credentials/{source_key} */
export function useCredentialsForSource(sourceKey: string | undefined) {
  const { accessToken } = useAuth()
  return useQuery<CredentialEntryRead[]>({
    queryKey: integrationCredentialsKeys.forSource(sourceKey ?? ''),
    queryFn: () =>
      apiFetch<CredentialEntryRead[]>(
        `/api/admin/integration-credentials/${sourceKey}`,
        { method: 'GET', accessToken },
      ),
    enabled: !!accessToken && !!sourceKey,
    staleTime: 30 * 1000,
  })
}

/** POST /api/admin/integration-credentials */
export function useCreateCredential() {
  const { accessToken } = useAuth()
  const qc = useQueryClient()
  return useMutation<CredentialEntryRead, Error, CredentialCreate>({
    mutationFn: (body) =>
      apiFetch<CredentialEntryRead>('/api/admin/integration-credentials', {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({
        queryKey: integrationCredentialsKeys.forSource(data.source_key),
      })
      toast.success('Credential opgeslagen')
    },
    onError: (err: Error) => {
      toast.error(`Opslaan mislukt: ${err.message}`)
    },
  })
}

/** DELETE /api/admin/integration-credentials/{id} */
export function useDeleteCredential() {
  const { accessToken } = useAuth()
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; sourceKey: string }>({
    mutationFn: ({ id }) =>
      apiFetch<void>(`/api/admin/integration-credentials/${id}`, {
        method: 'DELETE',
        accessToken,
      }),
    onSuccess: (_void, { sourceKey }) => {
      qc.invalidateQueries({
        queryKey: integrationCredentialsKeys.forSource(sourceKey),
      })
      toast.success('Credential verwijderd')
    },
    onError: (err: Error) => {
      toast.error(`Verwijderen mislukt: ${err.message}`)
    },
  })
}
