import { TrendingUp, ShieldAlert, BarChart3, Scale } from 'lucide-react'
import { BentoPod } from '@/components/primitives/BentoPod'
import { cn } from '@/lib/utils'
import type { ScanResultItem } from '@/lib/types/scan'
import type { FysiekRisicoProfiel } from '@/lib/types/property'

export type CategoryKey = 'potentie' | 'risico' | 'markt' | 'juridisch'

interface ParcelBentoOverviewProps {
  parcel: ScanResultItem
  riskProfile: FysiekRisicoProfiel | null
  onSelectCategory: (cat: CategoryKey) => void
}

function scoreTextColor(score: number | null): string {
  if (score === null) return 'text-neutral-400'
  if (score >= 70) return 'text-aura-green'
  if (score >= 50) return 'text-aura-amber'
  if (score >= 30) return 'text-amber-500'
  return 'text-neutral-400'
}

function riskDotColor(risk: string | null | undefined): string {
  if (!risk) return 'bg-neutral-300'
  switch (risk) {
    case 'hoog':
      return 'bg-red-500'
    case 'middel':
      return 'bg-amber-500'
    case 'laag':
      return 'bg-aura-green'
    default:
      return 'bg-neutral-300'
  }
}

function primaryBestemming(
  bestemmingen: ScanResultItem['bestemmingen'],
): string {
  if (!bestemmingen || bestemmingen.length === 0) return 'Onbekend'
  const first = bestemmingen[0]
  const naam =
    (first as Record<string, unknown>).naam ??
    (first as Record<string, unknown>).type ??
    (first as Record<string, unknown>).name
  if (typeof naam === 'string' && naam.length > 0) {
    return naam.length > 16 ? naam.slice(0, 15) + '\u2026' : naam
  }
  return 'Onbekend'
}

export function ParcelBentoOverview({
  parcel,
  riskProfile,
  onSelectCategory,
}: ParcelBentoOverviewProps) {
  const listingDays = parcel.market_signals?.listing_duration_days

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {/* Potentie */}
      <BentoPod
        interactive
        size="compact"
        onClick={() => onSelectCategory('potentie')}
      >
        <TrendingUp className="mb-2 h-4 w-4 text-neutral-400" />
        <p
          className={cn(
            'text-2xl tabular-nums font-semibold',
            scoreTextColor(parcel.score),
          )}
        >
          {parcel.score !== null ? parcel.score : '--'}
        </p>
        <p className="text-neutral-500 uppercase tracking-wide text-[11px]">
          Potentie
        </p>
      </BentoPod>

      {/* Risico */}
      <BentoPod
        interactive
        size="compact"
        onClick={() => onSelectCategory('risico')}
      >
        <ShieldAlert className="mb-2 h-4 w-4 text-neutral-400" />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-block h-3 w-3 rounded-full',
              riskDotColor(riskProfile?.overall_risk),
            )}
          />
          <span className="text-sm font-medium text-aura-ink capitalize">
            {riskProfile?.overall_risk ?? 'Onbekend'}
          </span>
        </div>
        <p className="text-neutral-500 uppercase tracking-wide text-[11px]">
          Risico
        </p>
      </BentoPod>

      {/* Markt */}
      <BentoPod
        interactive
        size="compact"
        onClick={() => onSelectCategory('markt')}
      >
        <BarChart3 className="mb-2 h-4 w-4 text-neutral-400" />
        <p className="text-2xl tabular-nums font-semibold text-aura-ink">
          {listingDays != null ? `${listingDays}d` : '--'}
        </p>
        <p className="text-neutral-500 uppercase tracking-wide text-[11px]">
          Markt
        </p>
      </BentoPod>

      {/* Juridisch */}
      <BentoPod
        interactive
        size="compact"
        onClick={() => onSelectCategory('juridisch')}
      >
        <Scale className="mb-2 h-4 w-4 text-neutral-400" />
        <p className="text-sm font-medium text-aura-ink truncate">
          {primaryBestemming(parcel.bestemmingen)}
        </p>
        <p className="text-neutral-500 uppercase tracking-wide text-[11px]">
          Juridisch
        </p>
      </BentoPod>
    </div>
  )
}
