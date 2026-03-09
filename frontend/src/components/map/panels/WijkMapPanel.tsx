import { MapPanelShell } from './MapPanelShell'
import { CbsNeighborhoodCard } from '@/components/projects/CbsNeighborhoodCard'
import { JurisprudenceSection } from '@/components/projects/JurisprudenceSection'
import type { ScanListItem } from '@/lib/types/scan'

interface WijkMapPanelProps {
  naam: string
  gemeenteNaam: string
  latestScan: ScanListItem | null
  onClose: () => void
  onBack: () => void
  onStartScan: () => void
  onViewResults: (scanId: string) => void
}

export function WijkMapPanel({
  naam,
  gemeenteNaam,
  latestScan,
  onClose,
  onBack,
  onStartScan,
  onViewResults,
}: WijkMapPanelProps) {
  const hasCompletedScan = latestScan?.status === 'completed'

  return (
    <MapPanelShell onClose={onClose}>
      <div className="p-4">
        {/* Breadcrumb + Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <button
              onClick={onBack}
              className="text-xs text-aura-amber hover:text-aura-amber-hover transition-colors mb-1 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {gemeenteNaam}
            </button>
            <h2 className="text-lg font-semibold text-aura-ink">{naam}</h2>
            <p className="text-xs text-neutral-600 mt-0.5">Wijk</p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-600 hover:text-aura-ink transition-colors p-1"
            aria-label="Sluiten"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scan summary */}
        <div className="mb-4 rounded-lg border border-neutral-200 bg-aura-glass-white/40 p-3">
          {hasCompletedScan ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Laatste scan</span>
                <span className="text-xs text-neutral-700">
                  {new Date(latestScan.scan_date).toLocaleDateString('nl-NL')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Percelen</span>
                <span className="text-xs text-neutral-700">{latestScan.parcel_count}</span>
              </div>
              <button
                onClick={() => onViewResults(latestScan.scan_id)}
                className="w-full mt-1 py-1.5 px-3 text-xs font-medium text-aura-obsidian bg-aura-amber hover:bg-aura-amber-hover rounded transition-colors"
              >
                Bekijk resultaten
              </button>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-neutral-600 mb-2">Nog niet gescand</p>
              <button
                onClick={onStartScan}
                className="w-full py-1.5 px-3 text-xs font-medium text-aura-obsidian bg-aura-amber hover:bg-aura-amber-hover rounded transition-colors"
              >
                Start scan
              </button>
            </div>
          )}
        </div>

        {/* CBS Neighborhood Metrics */}
        {hasCompletedScan && latestScan.neighborhood_metrics && (
          <div className="mb-4">
            <CbsNeighborhoodCard metrics={latestScan.neighborhood_metrics} />
          </div>
        )}

        {/* Jurisprudence */}
        <div className="mb-4">
          <JurisprudenceSection gemeenteNaam={gemeenteNaam} wijkNaam={naam} />
        </div>
      </div>
    </MapPanelShell>
  )
}
