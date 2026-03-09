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
      <span className="inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-200/60 text-neutral-500 border border-neutral-200">
        --
      </span>
    )
  }

  const styles = {
    High: 'bg-aura-amber/15 text-aura-amber border-aura-amber/30 shadow-[0_0_8px_rgba(217,170,56,0.15)]',
    Medium: 'bg-aura-amber/8 text-aura-amber/70 border-aura-amber/15',
    Low: 'bg-neutral-200/60 text-neutral-600 border-neutral-200',
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
  const isLeeg = !parcel.has_pand
  const topVacancyReason =
    parcel.vacancy_reasons && parcel.vacancy_reasons.length > 0
      ? parcel.vacancy_reasons[0]
      : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-4 min-h-[72px] transition-colors flex flex-col justify-center gap-1.5 ${
        isSelected
          ? 'bg-aura-amber/[0.06] ring-1 ring-inset ring-aura-amber/20'
          : 'hover:bg-neutral-100/[0.02]'
      }`}
    >
      {/* Top row: address + score badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-aura-ink truncate min-w-0">
          {address}
        </span>
        <div className="shrink-0">
          <ScoreBadge score={parcel.score} category={parcel.score_category} />
        </div>
      </div>

      {/* Bottom row: area + bestemming */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="tabular-nums">{area}</span>
        {bestemming && (
          <>
            <span className="text-neutral-400">·</span>
            <span className="truncate text-neutral-600">{bestemming}</span>
          </>
        )}
        <span className="text-neutral-400">·</span>
        <span className={`text-xs font-medium ${isLeeg ? 'text-aura-amber' : 'text-neutral-500'}`}>
          {isLeeg ? 'Leeg' : 'Bebouwd'}
        </span>
        {parcel.bouwjaar && (
          <>
            <span className="text-neutral-400">·</span>
            <span className="tabular-nums text-neutral-500">{parcel.bouwjaar}</span>
          </>
        )}
      </div>

      {topVacancyReason && (
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="truncate">{topVacancyReason}</span>
        </div>
      )}

    </button>
  )
}
