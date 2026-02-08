import { toast } from 'sonner'
import { useSaveReport } from '@/hooks/useReports'
import type { PropertyReportResponse } from '@/lib/types/property'
import type { ReportSaveRequest } from '@/lib/types/report'

/**
 * Hook for save report flow with toast feedback
 *
 * Handles:
 * - Building ReportSaveRequest from PropertyReportResponse
 * - Calling save mutation
 * - Toast notifications for loading/success/error
 * - Returning saved report ID for further actions
 *
 * Usage:
 * ```ts
 * const { handleSave, isSaving, savedReportId } = useSaveReportFlow(propertyData)
 * ```
 */
export function useSaveReportFlow(propertyData: PropertyReportResponse | null) {
  const saveReport = useSaveReport()

  const handleSave = async () => {
    if (!propertyData) {
      toast.error('Geen rapportgegevens beschikbaar')
      return null
    }

    const toastId = toast.loading('Rapport wordt opgeslagen...')

    try {
      // Build save request from property data
      const request: ReportSaveRequest = {
        report_data: propertyData as unknown as Record<string, unknown>,
        notes: null,
        project_id: null,
      }

      const result = await saveReport.mutateAsync(request)

      toast.success('Rapport opgeslagen', { id: toastId })

      return result.id
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Opslaan mislukt'
      toast.error(message, { id: toastId })
      return null
    }
  }

  return {
    handleSave,
    isSaving: saveReport.isPending,
    savedReportId: saveReport.data?.id || null,
  }
}
