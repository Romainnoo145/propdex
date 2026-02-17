import { useEscapeKey } from '@/hooks/useEscapeKey'
import { X } from 'lucide-react'
import type { ScanResultItem } from '@/lib/types/scan'

interface InspectorPanelProps {
  isOpen: boolean
  onClose: () => void
  parcel: ScanResultItem | null
}

/**
 * Right-edge slide-over panel that shows parcel details from scan results.
 *
 * Design decisions:
 * - No backdrop — map stays fully interactive underneath
 * - CSS translate-x animation for slide-in/out from right edge
 * - z-index --z-property-panel (300) — above map controls, below modals
 * - Escape key to close via useEscapeKey hook
 * - Width: w-80 (320px) with max-w-[90vw] for small screens
 */
export function InspectorPanel({ isOpen, onClose, parcel }: InspectorPanelProps) {
  useEscapeKey(onClose, isOpen)

  return (
    <div
      className={`absolute right-0 top-0 h-full w-80 max-w-[90vw]
                  bg-grey-900/90 backdrop-blur-xl border-l border-white/10
                  shadow-lg flex flex-col
                  transition-transform duration-300 ease-out
                  ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ zIndex: 'var(--z-property-panel)' }}
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-sm font-semibold text-grey-100">Perceeldetails</span>
        <button
          onClick={onClose}
          className="text-grey-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
          aria-label="Sluiten"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {parcel ? (
          <div className="space-y-4">
            {/* Parcel ID */}
            <div>
              <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Perceel ID</p>
              <p className="text-sm text-grey-100 font-mono mt-0.5 break-all">{parcel.parcel_id}</p>
            </div>

            {/* Parcel Code (Kadaster) */}
            {parcel.parcel_code && (
              <div>
                <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Kadaster</p>
                <p className="text-sm text-grey-100 font-mono mt-0.5">{parcel.parcel_code}</p>
              </div>
            )}

            {/* Address */}
            {parcel.address && (
              <div>
                <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Adres</p>
                <p className="text-sm text-grey-100 mt-0.5">{parcel.address}</p>
              </div>
            )}

            {/* Area */}
            {parcel.area_m2 != null && (
              <div>
                <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Oppervlakte</p>
                <p className="text-sm text-grey-100 mt-0.5">
                  {parcel.area_m2.toLocaleString('nl-NL')} m&sup2;
                </p>
              </div>
            )}

            {/* Has building */}
            <div>
              <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Bebouwing</p>
              <p className="text-sm text-grey-100 mt-0.5">
                {parcel.has_pand ? 'Ja — pand aanwezig' : 'Nee — onbebouwd'}
              </p>
            </div>

            {/* Building year */}
            {parcel.bouwjaar != null && (
              <div>
                <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Bouwjaar</p>
                <p className="text-sm text-grey-100 mt-0.5">{parcel.bouwjaar}</p>
              </div>
            )}

            {/* Building status */}
            {parcel.pand_status && (
              <div>
                <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Pandstatus</p>
                <p className="text-sm text-grey-100 mt-0.5 capitalize">{parcel.pand_status}</p>
              </div>
            )}

            {/* Score */}
            {parcel.score != null && (
              <div>
                <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Kanscore</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-grey-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-accent rounded-full transition-all"
                      style={{ width: `${Math.round(parcel.score)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-grey-100 tabular-nums">
                    {Math.round(parcel.score)}
                  </span>
                </div>
              </div>
            )}

            {/* Score category */}
            {parcel.score_category && (
              <div>
                <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Categorie</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-amber-accent/20 text-amber-accent text-xs font-medium rounded">
                  {parcel.score_category}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-grey-400">Selecteer een perceel op de kaart</p>
          </div>
        )}
      </div>
    </div>
  )
}
