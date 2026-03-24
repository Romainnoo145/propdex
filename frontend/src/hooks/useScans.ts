/**
 * TanStack Query hooks for scan operations
 *
 * Provides hooks for:
 * - Triggering new area scans
 * - Polling scan status with automatic stop on completion
 * - Cancelling running scans
 * - Fetching scan results with filters
 *
 * All hooks require authentication and manage cache invalidation automatically.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
  triggerScan,
  fetchScanStatus,
  cancelScan,
  fetchScanResults,
  fetchParcelEnrichment,
  fetchParcelRiskProfile,
  fetchParcelScanData,
  fetchAerialCrop,
  fetchScanHistory,
  fetchProjectScans,
} from '@/lib/api'
import type {
  ParcelEnrichmentResponse,
  ParcelRiskProfileResponse,
  ScanCreateRequest,
  ScanResponse,
  ScanStatusResponse,
  ScanResultsResponse,
  ScanResultsFilters,
  ScanListResponse,
  ScanResultItem,
  EnergielabelData,
  WozData,
  BodemData,
  FunderingsrisicoData,
  VergunningenData,
  Natura2000Data,
  OverstromingsrisicoData,
  GeluidData,
  LuchtkwaliteitData,
} from '@/lib/types/scan'

/**
 * Trigger a new area scan for a gemeente
 *
 * Returns mutation with scan_id in response for polling.
 * Mutation pattern for user-triggered scan operations.
 */
export function useTriggerScan() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<ScanResponse, Error, ScanCreateRequest>({
    mutationFn: (request: ScanCreateRequest) => triggerScan(request, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scan-history'] })
      queryClient.invalidateQueries({ queryKey: ['project-scans'] })
    },
  })
}

/**
 * Poll scan status with automatic stop on completion
 *
 * Polls every 2 seconds while scan is running.
 * Stops polling automatically when status is completed, failed, or cancelled.
 * Continues polling in background even if tab is not focused.
 *
 * Query key: ['scan-status', scanId]
 *
 * @param scanId - Scan UUID or null (disabled when null)
 */
export function useScanPolling(scanId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ScanStatusResponse, Error>({
    queryKey: ['scan-status', scanId],
    queryFn: () => fetchScanStatus(scanId!, accessToken),
    enabled: !!scanId && !!accessToken,
    refetchInterval: (query) => {
      // TanStack Query v5: refetchInterval receives query object
      const data = query.state.data
      if (query.state.error) return false

      // Initial poll or no data yet
      if (!data) return 2000

      // Stop polling on terminal states
      if (
        data.status === 'completed' ||
        data.status === 'failed' ||
        data.status === 'cancelled'
      ) {
        return false
      }

      // Continue polling every 2 seconds
      return 2000
    },
    refetchIntervalInBackground: true, // Keep polling even if tab not focused
  })
}

/**
 * Cancel a running scan
 *
 * Invalidates scan-status query on success to trigger re-fetch.
 * Takes scanId as mutation variable.
 */
export function useCancelScan() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<{ message: string; scan_id: string }, Error, string>({
    mutationFn: (scanId: string) => cancelScan(scanId, accessToken),
    onSuccess: (_data, scanId) => {
      // Invalidate scan status to trigger re-fetch
      queryClient.invalidateQueries({ queryKey: ['scan-status', scanId] })
    },
  })
}

/**
 * Fetch scan results with optional filters and pagination
 *
 * Query key: ['scan-results', scanId, filters]
 * Stale time: 30 seconds (results don't change after scan completes)
 *
 * @param scanId - Scan UUID or null (disabled when null)
 * @param filters - Optional filters for has_pand, bestemming_type, area range, score, sort, pagination
 */
export function useScanResults(
  scanId: string | null,
  filters: ScanResultsFilters = {}
) {
  const { accessToken } = useAuth()

  return useQuery<ScanResultsResponse, Error>({
    queryKey: ['scan-results', scanId, filters],
    queryFn: () => fetchScanResults(scanId!, filters, accessToken),
    enabled: !!scanId && !!accessToken,
    staleTime: 30 * 1000, // 30 seconds - results don't change after scan completes
  })
}

/**
 * Fetch fysiek risicoprofiel for a parcel (foundation risk, soil, asbest, contamination)
 *
 * Query key: ['parcel-risk-profile', parcelId]
 * Stale time: 5 minutes (backend caches underlying data)
 *
 * @param parcelId - ParcelCache UUID or null (disabled when null)
 * @param options - Query options (enabled flag)
 */
export function useParcelRiskProfile(
  parcelId: string | null,
  options?: { enabled?: boolean }
) {
  const { accessToken } = useAuth()

  return useQuery<ParcelRiskProfileResponse, Error>({
    queryKey: ['parcel-risk-profile', parcelId],
    queryFn: () => fetchParcelRiskProfile(parcelId!, accessToken),
    enabled: (options?.enabled ?? true) && !!parcelId && !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 min — backend caches underlying data
  })
}

/** Scan flags that may contain pre-cached enrichment data */
export interface ScanEnrichmentFlags {
  vergunningen?: VergunningenData
  energielabel?: EnergielabelData
  woz?: WozData
  bodem?: BodemData
  funderingsrisico?: FunderingsrisicoData
  natura2000?: Natura2000Data
  overstromingsrisico?: OverstromingsrisicoData
  geluid?: GeluidData
  luchtkwaliteit?: LuchtkwaliteitData
}

/**
 * Fetch on-demand enrichment for a parcel (vergunningen via SRU)
 *
 * When `flags` option contains pre-cached enrichment data (e.g., from a recent scan),
 * the hook returns that data directly without making an API call. This eliminates
 * unnecessary network requests for parcels in enriched scans.
 *
 * Query key: ['parcel-enrichment-v2', parcelId]
 * Stale time: 7 days (matches backend cache duration)
 *
 * @param parcelId - ParcelCache UUID or null (disabled when null)
 * @param options - Query options (enabled flag, optional pre-cached flags)
 */
export function useParcelEnrichment(
  parcelId: string | null,
  options?: { enabled?: boolean; flags?: ScanEnrichmentFlags }
) {
  const { accessToken } = useAuth()

  // If flags contain pre-cached vergunningen, build a synthetic response
  // to avoid unnecessary API calls for parcels in enriched scans
  const flagsData = options?.flags
  const hasCachedEnrichment = flagsData?.vergunningen !== undefined

  const placeholderData: ParcelEnrichmentResponse | undefined = hasCachedEnrichment && parcelId
    ? {
        parcel_id: parcelId,
        enrichment_data: {
          vergunningen: (flagsData.vergunningen?.records ?? []).map((r) => ({
            title: r.title,
            identifier: '',
            type: r.type,
            date: r.date,
            municipality: '',
            url: r.url,
          })),
        },
        enriched_at: null,
        is_cached: true,
        energielabel: flagsData.energielabel,
        woz_data: flagsData.woz,
        bodem_data: flagsData.bodem,
        funderingsrisico_data: flagsData.funderingsrisico,
        natura2000_data: flagsData.natura2000,
        overstromingsrisico_data: flagsData.overstromingsrisico,
        geluid_data: flagsData.geluid,
        luchtkwaliteit_data: flagsData.luchtkwaliteit,
      }
    : undefined

  return useQuery<ParcelEnrichmentResponse, Error>({
    queryKey: ['parcel-enrichment-v2', parcelId],
    queryFn: () => fetchParcelEnrichment(parcelId!, accessToken),
    // Skip API call when pre-cached flags provide enrichment data
    enabled: (options?.enabled ?? true) && !!parcelId && !!accessToken && !hasCachedEnrichment,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days (matches backend cache)
    placeholderData,
  })
}

/**
 * Fetch paginated scan history for the authenticated organization
 *
 * Query key: ['scan-history', params]
 * Stale time: 5 minutes
 */
export function useScanHistory(params?: { offset?: number; limit?: number; status?: string }) {
  const { accessToken } = useAuth()

  return useQuery<ScanListResponse, Error>({
    queryKey: ['scan-history', params],
    queryFn: () => fetchScanHistory(accessToken, params),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch scans for a specific project
 *
 * Query key: ['project-scans', projectId, params]
 * Stale time: 5 minutes
 * Disabled when projectId is null (only fetches when a wijk row is expanded)
 */
export function useProjectScans(
  projectId: string | null,
  params?: { offset?: number; limit?: number }
) {
  const { accessToken } = useAuth()

  return useQuery<ScanListResponse, Error>({
    queryKey: ['project-scans', projectId, params],
    queryFn: () => fetchProjectScans(projectId!, accessToken, params),
    enabled: !!accessToken && !!projectId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch aerial crop image for a parcel as a blob URL
 *
 * Returns a blob URL for use as an <img> src attribute.
 * Backed by PDOK WMS aerial imagery via backend proxy.
 *
 * Query key: ['aerial-crop', parcelId]
 * Stale time: 24 hours (aerial images rarely change)
 *
 * @param parcelId - ParcelCache UUID or null (disabled when null)
 */
export function useAerialCrop(parcelId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<string | null, Error>({
    queryKey: ['aerial-crop', parcelId],
    queryFn: () => fetchAerialCrop(parcelId!, accessToken),
    enabled: !!parcelId && !!accessToken,
    staleTime: 24 * 60 * 60 * 1000, // 24h — aerial images don't change often
    retry: 1, // PDOK may be slow; one retry is enough
  })
}

/**
 * Fetch the full scan result data for a single parcel (score breakdown, building metrics, etc.)
 *
 * Used by portfolio workspace to power potentie/risico detail modals.
 *
 * Query key: ['parcel-scan-data', parcelCacheId]
 * Stale time: 5 minutes
 *
 * @param parcelCacheId - ParcelCache UUID or null (disabled when null)
 */
export function useParcelScanData(parcelCacheId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ScanResultItem, Error>({
    queryKey: ['parcel-scan-data', parcelCacheId],
    queryFn: () => fetchParcelScanData(parcelCacheId!, accessToken),
    enabled: !!parcelCacheId && !!accessToken,
    staleTime: 5 * 60 * 1000,
  })
}
