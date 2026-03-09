import { BentoPod } from '@/components/primitives/BentoPod'
import { PillBadge } from '@/components/primitives/PillBadge'
import type { ScanResultItem } from '@/lib/types/scan'

interface MarktLayerProps {
  parcel: ScanResultItem
}

export function MarktLayer({ parcel }: MarktLayerProps) {
  const signals = parcel.market_signals
  const actionableOpportunitySignals = (parcel.opportunity_signals ?? []).filter((s) => {
    const n = s.toLowerCase()
    return !n.includes('pand momenteel in gebruik') && !n.includes('leegstand onbekend')
  })
  const vacancyReasons = parcel.vacancy_reasons ?? []
  const hasKansen = actionableOpportunitySignals.length > 0 || vacancyReasons.length > 0

  if (!signals && !hasKansen) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-neutral-400">Geen marktsignalen beschikbaar</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4 pb-4">
      {/* Market signals KPI grid */}
      {signals && (
        <BentoPod>
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Marktsignalen</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-[11px] text-neutral-400">Te koop sinds</p>
              <p className="text-lg font-semibold tabular-nums text-aura-ink">{signals.listing_duration_days}d</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-400">Prijswijzigingen</p>
              <p className="text-lg font-semibold tabular-nums text-aura-ink">{signals.price_change_count}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-400">Snapshots</p>
              <p className="text-lg font-semibold tabular-nums text-aura-ink">{signals.listing_snapshots_count}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-400">Laatste waarneming</p>
              <p className="text-lg font-semibold tabular-nums text-aura-ink">{signals.days_since_last_seen}d</p>
            </div>
          </div>
        </BentoPod>
      )}

      {/* Kansen & aandachtspunten as pill tags */}
      {hasKansen && (
        <BentoPod>
          <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Kansen & aandachtspunten</p>
          <div className="flex flex-wrap gap-2">
            {actionableOpportunitySignals.slice(0, 5).map((signal) => (
              <PillBadge key={`opp-${signal}`} variant="amber">
                {signal}
              </PillBadge>
            ))}
            {vacancyReasons.slice(0, 3).map((reason) => (
              <PillBadge key={`risk-${reason}`} variant="default">
                {reason}
              </PillBadge>
            ))}
          </div>
        </BentoPod>
      )}
    </div>
  )
}
