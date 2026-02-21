import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { useExportPDF } from '@/hooks/useReports'
import type { PropertyReportResponse } from '@/lib/types/property'

interface PDFExportModalProps {
  reportId: string | null
  propertyData: PropertyReportResponse | null
  isOpen: boolean
  onClose: () => void
  onSaveFirst: () => void
}

/**
 * PDF Export Modal (Tier 3)
 *
 * Modal for exporting saved reports as PDF.
 * If report is not saved yet, prompts user to save first.
 *
 * Flow:
 * 1. If no reportId: Show "save first" message
 * 2. If reportId: Show export options + export button
 * 3. On export: Show loading toast → download file → success toast
 */
export function PDFExportModal({
  reportId,
  propertyData,
  isOpen,
  onClose,
  onSaveFirst,
}: PDFExportModalProps) {
  const exportPDF = useExportPDF()

  const handleExport = async () => {
    if (!reportId) {
      toast.error('Rapport moet eerst worden opgeslagen')
      return
    }

    const toastId = toast.loading('PDF wordt gegenereerd...')

    try {
      const blob = await exportPDF.mutateAsync(reportId)

      // Create download link and trigger download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `rapport-${propertyData?.address?.postcode || 'export'}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('PDF succesvol gedownload', { id: toastId })
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Exporteren mislukt'
      toast.error(message, { id: toastId })
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-grey-100 text-xl font-semibold">
            Rapport exporteren als PDF
          </h2>
          {propertyData?.address && (
            <p className="text-grey-400 text-sm">
              {propertyData.address.straat} {propertyData.address.huisnummer}
              {propertyData.address.huisletter || ''}
              {propertyData.address.toevoeging || ''}
              , {propertyData.address.woonplaats}
            </p>
          )}
        </div>

        {/* Content */}
        {!reportId ? (
          // Not saved yet - prompt to save first
          <div className="bg-amber-accent/10 border border-amber-accent/30 rounded-lg p-4 space-y-3">
            <p className="text-amber-accent text-sm">
              Dit rapport moet eerst worden opgeslagen voordat het geëxporteerd kan worden.
            </p>
            <button
              onClick={() => {
                onClose()
                onSaveFirst()
              }}
              className="w-full py-2 px-4 bg-amber-accent hover:bg-amber-accent-hover text-on-accent rounded-lg transition-colors font-medium"
            >
              Eerst opslaan
            </button>
          </div>
        ) : (
          // Saved - show export options
          <div className="space-y-4">
            <div className="bg-grey-850 rounded-lg p-4 border border-grey-800">
              <p className="text-grey-300 text-sm">
                De PDF bevat alle secties van dit rapport:
              </p>
              <ul className="mt-2 space-y-1 text-grey-400 text-sm">
                <li>• Adresgegevens en bouwjaar</li>
                <li>• Kadastrale informatie</li>
                <li>• Bestemmingsplangegevens</li>
                <li>• Monumentstatus</li>
                <li>• Bronvermeldingen</li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 bg-grey-850 hover:bg-grey-700 text-grey-100 rounded-lg transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleExport}
                disabled={exportPDF.isPending}
                className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportPDF.isPending ? 'Bezig...' : 'Exporteren'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
