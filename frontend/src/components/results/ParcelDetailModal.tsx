import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/primitives'
import { ParcelEnrichmentCard } from './ParcelEnrichmentCard'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { useParcelChanges } from '@/hooks/useNotifications'
import { toast } from 'sonner'
import { FileText, Info, MapPin } from 'lucide-react'
import type { ScanResultItem } from '@/lib/types/scan'

/** Dutch labels for score factors */
const FACTOR_LABELS: Record<string, string> = {
  pand_status_signal: 'Pandstatus',
  building_age: 'Bouwjaar',
  zoning_value: 'Bestemming',
  footprint_size: 'Oppervlakte',
  underutilization: 'Onderbenutting',
}

/** Max points per factor (for progress bar scaling) */
const FACTOR_MAX: Record<string, number> = {
  pand_status_signal: 30,
  building_age: 20,
  zoning_value: 25,
  footprint_size: 15,
  underutilization: 10,
}

interface ParcelDetailModalProps {
  parcel: ScanResultItem | null
  isOpen: boolean
  onClose: () => void
  onViewOnMap?: () => void
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
  onViewOnMap,
}: ParcelDetailModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Fetch enrichment only when modal is open
  const enrichment = useParcelEnrichment(parcel?.parcel_id ?? null, {
    enabled: isOpen && !!parcel?.parcel_id,
  })

  const generateReport = useGenerateReportFromParcel()

  // Fetch matching bekendmakingen for this parcel's postcode
  const parcelChanges = useParcelChanges(
    isOpen && parcel?.parcel_id ? parcel.parcel_id : null
  )

  const handleGenerateReport = async () => {
    if (!parcel?.parcel_id) return
    const toastId = toast.loading('Rapport wordt gegenereerd...')
    try {
      const report = await generateReport.mutateAsync(parcel.parcel_id)
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Rapport opgeslagen', { id: toastId })
      onClose()
      void navigate({ to: '/rapport/$id', params: { id: String(report.id) } })
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
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success/15 border border-success/20">
                <span className="text-2xl font-bold text-success">
                  {parcel.score.toFixed(0)}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-sm font-medium text-grey-100">
                    Score opbouw
                  </p>
                  <div className="group relative">
                    <Info size={13} className="text-grey-600 cursor-help" />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-grey-800 bg-grey-950 px-3 py-2 text-xs text-grey-300 opacity-0 transition-opacity group-hover:opacity-100">
                      Score 0-100 op basis van pandstatus,<br />bouwjaar, bestemming, oppervlakte<br />en onderbenutting
                    </div>
                  </div>
                </div>
                {parcel.score_breakdown && (
                  <div className="space-y-1">
                    {Object.entries(
                      (parcel.score_breakdown as { factors?: Record<string, number> }).factors ?? parcel.score_breakdown
                    )
                      .filter(([, v]) => typeof v === 'number')
                      .map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-grey-400 w-24 truncate">
                          {FACTOR_LABELS[key] ?? key}
                        </span>
                        <div className="flex-1 h-1.5 bg-grey-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-success/60"
                            style={{
                              width: `${Math.min(100, ((value as number) / (FACTOR_MAX[key] ?? 100)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-grey-400 w-8 text-right">
                          {(value as number).toFixed(0)}
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

        {/* Meldingen Section — only shown when matching bekendmakingen exist */}
        {parcelChanges.data && parcelChanges.data.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-grey-100 mb-3">
              Meldingen
            </h3>
            <div className="space-y-2">
              {parcelChanges.data.map((change) => (
                <div
                  key={change.id}
                  className="flex items-start gap-2.5 rounded-md border border-grey-800 bg-grey-850 px-3 py-2.5"
                >
                  <div
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      change.change_type === 'permit'
                        ? 'bg-info'
                        : 'bg-success'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-grey-300 line-clamp-2">
                      {change.title}
                    </p>
                    <p className="mt-0.5 text-xs text-grey-400">
                      {new Intl.DateTimeFormat('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }).format(new Date(change.change_date))}
                    </p>
                  </div>
                  {change.source_url && (
                    <a
                      href={change.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-grey-400 hover:text-info transition-colors"
                      title="Bekijk publicatie"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onViewOnMap && (
            <button
              onClick={() => { onClose(); onViewOnMap(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4
                         border border-grey-800 text-grey-300 font-medium rounded text-sm
                         hover:bg-grey-850 hover:text-grey-100
                         transition-colors motion-reduce:transition-none min-h-[44px]"
            >
              <MapPin size={14} />
              Bekijk op kaart
            </button>
          )}
          <button
            onClick={handleGenerateReport}
            disabled={generateReport.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4
                       bg-amber-accent text-on-accent font-medium rounded text-sm
                       hover:bg-amber-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors motion-reduce:transition-none min-h-[44px]"
          >
            <FileText size={14} />
            {generateReport.isPending ? 'Bezig met genereren...' : 'Genereer rapport'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
