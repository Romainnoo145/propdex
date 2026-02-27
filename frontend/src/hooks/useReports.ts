/**
 * TanStack Query hooks for report operations
 *
 * Provides hooks for:
 * - Fetching report lists with filters
 * - Fetching single report details
 * - Saving new reports
 * - Deleting reports
 * - Checking report freshness
 * - Refreshing reports with latest data
 * - Exporting reports as PDF
 * - Fetching unique cities
 *
 * All hooks require authentication and invalidate relevant caches on mutation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
  fetchReports,
  fetchReport,
  saveReport,
  deleteReport,
  fetchReportFreshness,
  refreshReport,
  exportReportPDF,
  fetchCities,
  generateReportFromParcel,
} from '@/lib/api'
import type {
  GenerateReportFromParcelResponse,
  ReportFilters,
  ReportListResponse,
  ReportDetailResponse,
  ReportSaveRequest,
  ReportFreshnessResponse,
} from '@/lib/types/report'

/**
 * Fetch list of saved reports with optional filters
 *
 * Query key: ['reports', filters]
 * Stale time: 5 minutes (reports don't change frequently)
 *
 * @param filters - Optional filters for city, project, search, sort, pagination
 */
export function useReports(filters: ReportFilters = {}) {
  const { accessToken } = useAuth()

  return useQuery<ReportListResponse, Error>({
    queryKey: ['reports', filters],
    queryFn: () => fetchReports(filters, accessToken),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!accessToken,
  })
}

/**
 * Fetch single report by ID
 *
 * Query key: ['report', reportId]
 * Enabled only when reportId and accessToken exist
 *
 * @param reportId - Report UUID or null
 */
export function useReport(reportId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ReportDetailResponse, Error>({
    queryKey: ['report', reportId],
    queryFn: () => fetchReport(reportId!, accessToken),
    enabled: !!reportId && !!accessToken,
  })
}

/**
 * Save a new property report
 *
 * Invalidates report list cache on success.
 */
export function useSaveReport() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<ReportDetailResponse, Error, ReportSaveRequest>({
    mutationFn: (request: ReportSaveRequest) => saveReport(request, accessToken),
    onSuccess: () => {
      // Invalidate all report lists (filters may vary)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

/**
 * Delete a saved report
 *
 * Invalidates report list cache on success.
 */
export function useDeleteReport() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (reportId: string) => deleteReport(reportId, accessToken),
    onSuccess: () => {
      // Invalidate all report lists
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

/**
 * Check if a report has updates (freshness check)
 *
 * Query key: ['report-freshness', reportId]
 * Enabled only when reportId and accessToken exist
 *
 * @param reportId - Report UUID or null
 */
export function useReportFreshness(reportId: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ReportFreshnessResponse, Error>({
    queryKey: ['report-freshness', reportId],
    queryFn: () => fetchReportFreshness(reportId!, accessToken),
    enabled: !!reportId && !!accessToken,
  })
}

/**
 * Refresh a report with latest data
 *
 * Invalidates both the specific report and all report lists on success.
 */
export function useRefreshReport() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<ReportDetailResponse, Error, string>({
    mutationFn: (reportId: string) => refreshReport(reportId, accessToken),
    onSuccess: (_data, reportId) => {
      // Invalidate the specific report
      queryClient.invalidateQueries({ queryKey: ['report', reportId] })
      // Invalidate all report lists (completeness_score may have changed)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

/**
 * Export report as PDF
 *
 * Returns Blob for download handling (e.g., createObjectURL + anchor click).
 */
export function useExportPDF() {
  const { accessToken } = useAuth()

  return useMutation<Blob, Error, string>({
    mutationFn: (reportId: string) => exportReportPDF(reportId, accessToken),
  })
}

/**
 * Generate a property report from a scan result parcel
 *
 * Calls POST /api/reports/from-parcel.
 * Invalidates report list cache on success so the new report
 * appears immediately in the Rapporten view.
 */
export function useGenerateReportFromParcel() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<GenerateReportFromParcelResponse, Error, string>({
    mutationFn: (parcelId: string) =>
      generateReportFromParcel(parcelId, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

/**
 * Fetch all unique cities from saved reports
 *
 * Query key: ['report-cities']
 * Stale time: 10 minutes (cities change very rarely)
 */
export function useCities() {
  const { accessToken } = useAuth()

  return useQuery<string[], Error>({
    queryKey: ['report-cities'],
    queryFn: () => fetchCities(accessToken),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!accessToken,
  })
}
