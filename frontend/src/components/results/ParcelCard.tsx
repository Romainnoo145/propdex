import type { ScanResultItem } from '@/lib/types/scan'

// Score badge — amber-based glow system (matches ResultsTable)
function ScoreBadge({
  score,
  category,
}: {
  score: number | null
  category: string | null
}) {
  if (score === null || category === null) {
    return (
      <span className="inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-grey-800/60 text-grey-600 border border-overlay/5">
        --
      </span>
    )
  }

  const styles = {
    High: 'bg-amber-accent/15 text-amber-accent border-amber-accent/30 shadow-[0_0_8px_rgba(217,170,56,0.15)]',
    Medium: 'bg-amber-accent/8 text-amber-accent/70 border-amber-accent/15',
    Low: 'bg-grey-800/60 text-grey-400 border-overlay/5',
  }

  const style = styles[category as keyof typeof styles] ?? styles.Low

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums border ${style}`}
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
  const address = parcel.address?.trim() || parcel.parcel_code || 'Onbekend'
  const area =
    parcel.area_m2 !== null
      ? `${Math.round(parcel.area_m2).toLocaleString('nl-NL')} m²`
      : '--'
  const rawBestemming =
    (parcel.bestemmingen?.[0] as { type?: string } | undefined)?.type ?? ''
  const bestemming =
    rawBestemming.length > 25
      ? `${rawBestemming.substring(0, 25)}...`
      : rawBestemming
  const vacancyLabel =
    parcel.vacancy_signal === 'leeg_perceel' ? 'Leeg perceel'
      : parcel.vacancy_signal === 'leegstaand_pand' ? 'Leegstaand'
      : parcel.vacancy_signal === 'in_gebruik' ? 'In gebruik'
      : parcel.vacancy_signal === 'onbekend' ? 'Onbekend'
      : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-4 min-h-[72px] transition-colors flex flex-col justify-center gap-1.5 ${
        isSelected
          ? 'bg-amber-accent/[0.06] ring-1 ring-inset ring-amber-accent/20'
          : 'hover:bg-overlay/[0.02]'
      }`}
    >
      {/* Top row: address + score badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-grey-100 truncate min-w-0">
          {address}
        </span>
        <div className="shrink-0">
          <ScoreBadge score={parcel.score} category={parcel.score_category} />
        </div>
      </div>

      {/* Bottom row: area + bestemming */}
      <div className="flex items-center gap-2 text-xs text-grey-600">
        <span className="tabular-nums">{area}</span>
        {bestemming && (
          <>
            <span className="text-grey-700">·</span>
            <span className="truncate text-grey-400">{bestemming}</span>
          </>
        )}
        {vacancyLabel && (
          <>
            <span className="text-grey-700">·</span>
            <span className="truncate text-grey-300">{vacancyLabel}</span>
          </>
        )}
        {parcel.bouwjaar && (
          <>
            <span className="text-grey-700">·</span>
            <span className="tabular-nums text-grey-600">{parcel.bouwjaar}</span>
          </>
        )}
      </div>
    </button>
  )
}
