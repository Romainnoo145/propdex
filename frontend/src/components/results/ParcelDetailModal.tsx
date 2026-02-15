import { Modal } from '@/components/ui/Modal'
import { ParcelEnrichmentCard } from './ParcelEnrichmentCard'
import { useParcelEnrichment } from '@/hooks/useScans'
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

  if (!parcel) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white/90">
              {parcel.parcel_code}
            </h2>
            {parcel.address && (
              <p className="text-sm text-white/60 mt-1">{parcel.address}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors"
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
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30">
                <span className="text-2xl font-bold text-green-300">
                  {parcel.score.toFixed(0)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white/80 mb-2">
                  Score breakdown
                </p>
                {parcel.score_breakdown && (
                  <div className="space-y-1">
                    {Object.entries(parcel.score_breakdown).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs text-white/50 w-24 truncate">
                          {key}
                        </span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
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
                        <span className="text-xs text-white/60 w-8 text-right">
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
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <p className="text-xs text-white/50 mb-1">Oppervlak</p>
            <p className="text-sm font-medium text-white/80">
              {parcel.area_m2?.toLocaleString('nl-NL')} m²
            </p>
          </div>
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <p className="text-xs text-white/50 mb-1">Bebouwd</p>
            <p className="text-sm font-medium text-white/80">
              {parcel.has_pand ? 'Ja' : 'Nee'}
            </p>
          </div>
          {parcel.gemeente_code && (
            <div className="bg-white/5 rounded-lg border border-white/10 p-4">
              <p className="text-xs text-white/50 mb-1">Gemeente</p>
              <p className="text-sm font-medium text-white/80">
                {parcel.gemeente_code}
              </p>
            </div>
          )}
        </div>

        {/* Bestemmingen Section */}
        {parcel.bestemmingen && parcel.bestemmingen.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-white/80 mb-3">
              Bestemmingen
            </h3>
            <div className="flex flex-wrap gap-2">
              {parcel.bestemmingen.map((bestemming, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-blue-500/10 border border-blue-400/30 rounded-full text-xs text-blue-300"
                >
                  {(bestemming as { type?: string }).type ||
                    (bestemming as { naam?: string }).naam ||
                    'Onbekend'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Vergunningen Section (Tier 2 enrichment) */}
        <div>
          <h3 className="text-sm font-medium text-white/80 mb-3">
            Vergunningen
          </h3>
          <ParcelEnrichmentCard
            data={enrichment.data}
            isLoading={enrichment.isLoading}
          />
        </div>
      </div>
    </Modal>
  )
}
