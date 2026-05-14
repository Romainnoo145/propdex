/**
 * TanStack Query hooks for the M049/S03 admin data-sources hub.
 *
 * Backend contract: backend/app/admin/data_sources_router.py (S02 — GA).
 * Cache invalidation: useRefreshDataSource flushes the per-gemeente cache so
 * the row re-renders with the new status returned by the POST mutation.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type {
  DataSourceRow,
  GemeenteDataSourcesPayload,
  GemeenteSummary,
} from '@/lib/types/data-sources-admin'

/** Stable query-key factory — single source of truth for cache invalidation. */
export const dataSourcesAdminKeys = {
  all: ['data-sources-admin'] as const,
  gemeenten: () => [...dataSourcesAdminKeys.all, 'gemeenten'] as const,
  gemeente: (gemeenteCode: string) =>
    [...dataSourcesAdminKeys.all, 'gemeente', gemeenteCode] as const,
}

/** GET /api/admin/data-sources/gemeenten — aggregate per-gemeente status counts. */
export function useGemeentenSummary() {
  const { accessToken } = useAuth()
  return useQuery<GemeenteSummary[]>({
    queryKey: dataSourcesAdminKeys.gemeenten(),
    queryFn: () =>
      apiFetch<GemeenteSummary[]>('/api/admin/data-sources/gemeenten', {
        method: 'GET',
        accessToken,
      }),
    enabled: !!accessToken,
    staleTime: 60 * 1000,
  })
}

/** GET /api/admin/data-sources/{gemeente_code} — 3-section payload. */
export function useGemeenteDataSources(gemeenteCode: string | undefined) {
  const { accessToken } = useAuth()
  return useQuery<GemeenteDataSourcesPayload>({
    queryKey: dataSourcesAdminKeys.gemeente(gemeenteCode ?? ''),
    queryFn: () =>
      apiFetch<GemeenteDataSourcesPayload>(
        `/api/admin/data-sources/${gemeenteCode}`,
        { method: 'GET', accessToken },
      ),
    enabled: !!accessToken && !!gemeenteCode,
    staleTime: 30 * 1000,
  })
}

interface RefreshArgs {
  gemeenteCode: string
  sourceKey: string
  sourceLabel: string // for toast text only
}

/** POST /api/admin/data-sources/{gemeente_code}/{source_key}/refresh — idempotent. */
export function useRefreshDataSource() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  return useMutation<DataSourceRow, Error, RefreshArgs>({
    mutationFn: ({ gemeenteCode, sourceKey }) =>
      apiFetch<DataSourceRow>(
        `/api/admin/data-sources/${gemeenteCode}/${sourceKey}/refresh`,
        { method: 'POST', accessToken },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: dataSourcesAdminKeys.gemeente(vars.gemeenteCode),
      })
      queryClient.invalidateQueries({
        queryKey: dataSourcesAdminKeys.gemeenten(),
      })
      toast.success(`Refresh voltooid voor ${vars.sourceLabel}`)
    },
    onError: (err, vars) => {
      toast.error(
        `Refresh mislukt voor ${vars.sourceLabel}: ${err.message}`,
      )
    },
  })
}
