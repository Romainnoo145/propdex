import type { ScanResultItem } from '@/lib/types/scan'

// Local score badge — mirrors ResultsTable.ScoreBadge, kept co-located to avoid cross-file coupling
function ScoreBadge({
  score,
  category,
}: {
  score: number | null
  category: string | null
}) {
  if (score === null || category === null) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
        N/A
      </span>
    )
  }

  const colors = {
    High: 'bg-green-500/20 text-green-400 border-green-500/30',
    Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Low: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const colorClass = colors[category as keyof typeof colors] ?? colors.Low

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}
    >
      {score.toFixed(0)}
    </span>
  )
}

interface ParcelCardProps {
  parcel: ScanResultItem
  isSelected: boolean
  onClick: () => void
}

/**
 * Mobile card representation of a single scan result parcel.
 *
 * Renders as a full-width button with 72px min-height (exceeds 44px MOB-03 touch target).
 * Used by ResultsTable in its mobile branch (below 768px).
 */
export function ParcelCard({ parcel, isSelected, onClick }: ParcelCardProps) {
  const address = parcel.address ?? parcel.parcel_code ?? 'Onbekend'
  const area =
    parcel.area_m2 !== null
      ? `${parcel.area_m2.toLocaleString('nl-NL')} m²`
      : '--'
  const rawBestemming =
    (parcel.bestemmingen?.[0] as { type?: string } | undefined)?.type ?? ''
  const bestemming =
    rawBestemming.length > 25
      ? `${rawBestemming.substring(0, 25)}...`
      : rawBestemming

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 min-h-[72px] transition-colors flex flex-col justify-center gap-1 ${
        isSelected
          ? 'bg-grey-850 ring-1 ring-inset ring-amber-accent/30'
          : 'hover:bg-grey-850'
      }`}
    >
      {/* Top row: address + score badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-grey-100 truncate min-w-0">
          {address}
        </span>
        <div className="shrink-0">
          <ScoreBadge score={parcel.score} category={parcel.score_category} />
        </div>
      </div>

      {/* Bottom row: area + bestemming */}
      <div className="flex items-center gap-2 text-xs text-grey-400">
        <span>{area}</span>
        {bestemming && (
          <>
            <span className="text-grey-700">·</span>
            <span className="truncate">{bestemming}</span>
          </>
        )}
      </div>
    </button>
  )
}
