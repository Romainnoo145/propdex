import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/primitives'
import { ParcelEnrichmentCard } from './ParcelEnrichmentCard'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { toast } from 'sonner'
import { FileText } from 'lucide-react'
import type { ScanResultItem } from '@/lib/types/scan'

interface ParcelDetailModalProps {
  parcel: ScanResultItem | null
  isOpen: boolean
  onClose: () => void
}

/**
 * Parcel detail modal with Tier 1 data and on-demand Tier 2 enrichment
 *
 * Shows immediately:
 * - Parcel code, address, gemeente
 * - Area, bebouwd status
 * - Score with breakdown
 * - Bestemmingen list
 *
 * Fetches on open:
 * - Tier 2 enrichment (vergunningen via SRU)
 */
export function ParcelDetailModal({
  parcel,
  isOpen,
  onClose,
}: ParcelDetailModalProps) {
  // Fetch enrichment only when modal is open
  const enrichment = useParcelEnrichment(parcel?.parcel_id ?? null, {
    enabled: isOpen && !!parcel?.parcel_id,
  })

  const generateReport = useGenerateReportFromParcel()

  const handleGenerateReport = async () => {
    if (!parcel?.parcel_id) return
    const toastId = toast.loading('Rapport wordt gegenereerd...')
    try {
      await generateReport.mutateAsync(parcel.parcel_id)
      toast.success('Rapport opgeslagen in Rapporten', { id: toastId })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Genereren mislukt'
      toast.error(message, { id: toastId })
    }
  }

  if (!parcel) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-grey-100">
              {parcel.parcel_code}
            </h2>
            {parcel.address && (
              <p className="text-sm text-grey-400 mt-1">{parcel.address}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-grey-600 hover:text-grey-100 transition-colors"
            aria-label="Sluiten"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Score Section */}
        {parcel.score !== null && (
          <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/20">
                <span className="text-2xl font-bold text-green-300">
                  {parcel.score.toFixed(0)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-grey-100 mb-2">
                  Score breakdown
                </p>
                {parcel.score_breakdown && (
                  <div className="space-y-1">
                    {Object.entries(parcel.score_breakdown).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-grey-400 w-24 truncate">
                          {key}
                        </span>
                        <div className="flex-1 h-1.5 bg-grey-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400/60"
                            style={{
                              width: `${Math.min(
                                100,
                                ((value as number) / 100) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-grey-400 w-8 text-right">
                          {typeof value === 'number' ? value.toFixed(0) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Property Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
            <p className="text-xs text-grey-400 mb-1">Oppervlak</p>
            <p className="text-sm font-medium text-grey-100">
              {parcel.area_m2?.toLocaleString('nl-NL')} m²
            </p>
          </div>
          <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
            <p className="text-xs text-grey-400 mb-1">Bouwjaar</p>
            <p className="text-sm font-medium text-grey-100">
              {parcel.bouwjaar ?? 'Onbekend'}
            </p>
          </div>
          <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
            <p className="text-xs text-grey-400 mb-1">Status</p>
            <p className="text-sm font-medium text-grey-100">
              {parcel.pand_status || 'Onbekend'}
            </p>
          </div>
          {parcel.gemeente_code && (
            <div className="bg-grey-850 rounded-md border border-grey-800 p-4">
              <p className="text-xs text-grey-400 mb-1">Gemeente</p>
              <p className="text-sm font-medium text-grey-100">
                {parcel.gemeente_code}
              </p>
            </div>
          )}
        </div>

        {/* Bestemmingen Section */}
        {parcel.bestemmingen && parcel.bestemmingen.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-grey-100 mb-3">
              Bestemmingen
            </h3>
            <div className="flex flex-wrap gap-2">
              {parcel.bestemmingen.map((bestemming, idx) => (
                <Badge key={idx} variant="teal">
                  {(bestemming as { type?: string }).type ||
                    (bestemming as { naam?: string }).naam ||
                    'Onbekend'}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Vergunningen Section (Tier 2 enrichment) */}
        <div>
          <h3 className="text-sm font-medium text-grey-100 mb-3">
            Vergunningen
          </h3>
          <ParcelEnrichmentCard
            data={enrichment.data}
            isLoading={enrichment.isLoading}
          />
        </div>

        {/* Generate Report Action */}
        <button
          onClick={handleGenerateReport}
          disabled={generateReport.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                     bg-amber-accent text-grey-900 font-medium rounded text-sm
                     hover:bg-amber-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors motion-reduce:transition-none min-h-[44px]"
        >
          <FileText size={14} />
          {generateReport.isPending ? 'Bezig met genereren...' : 'Genereer rapport'}
        </button>
      </div>
    </Modal>
  )
}
