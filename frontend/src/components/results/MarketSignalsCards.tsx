import type { MarketSignals } from '@/lib/types/scan'

interface MarketSignalsCardsProps {
  signals: MarketSignals
  compact?: boolean
}

export function MarketSignalsCards({
  signals,
  compact = false,
}: MarketSignalsCardsProps) {
  const cardPadding = compact ? 'p-3' : 'p-4'
  const labelClass = compact ? 'text-[11px]' : 'text-xs'

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className={`bg-grey-850 rounded-md border border-grey-800 ${cardPadding}`}>
        <p className={`${labelClass} text-grey-400 mb-1`}>Te koop sinds</p>
        <p className="text-sm font-medium text-grey-100 tabular-nums">
          {signals.listing_duration_days} dagen
        </p>
      </div>
      <div className={`bg-grey-850 rounded-md border border-grey-800 ${cardPadding}`}>
        <p className={`${labelClass} text-grey-400 mb-1`}>Prijswijzigingen</p>
        <p className="text-sm font-medium text-grey-100 tabular-nums">
          {signals.price_change_count}
        </p>
      </div>
      <div className={`bg-grey-850 rounded-md border border-grey-800 ${cardPadding}`}>
        <p className={`${labelClass} text-grey-400 mb-1`}>Snapshots</p>
        <p className="text-sm font-medium text-grey-100 tabular-nums">
          {signals.listing_snapshots_count}
        </p>
      </div>
      <div className={`bg-grey-850 rounded-md border border-grey-800 ${cardPadding}`}>
        <p className={`${labelClass} text-grey-400 mb-1`}>Laatste waarneming</p>
        <p className="text-sm font-medium text-grey-100 tabular-nums">
          {signals.days_since_last_seen} dagen geleden
        </p>
      </div>
    </div>
  )
}
