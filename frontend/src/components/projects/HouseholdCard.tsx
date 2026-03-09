import type { CbsHuishoudens, CbsLeeftijdsVerdeling } from '@/lib/types/scan'
import { DoelgroepLabel } from './DoelgroepLabel'

interface HouseholdCardProps {
  huishoudens: CbsHuishoudens
  leeftijdsverdeling?: CbsLeeftijdsVerdeling
}

const COMPOSITION_ROWS: { key: keyof CbsHuishoudens; label: string }[] = [
  { key: 'eenpersoons', label: 'Eenpersoonshuishoudens' },
  { key: 'zonder_kinderen', label: 'Paren zonder kinderen' },
  { key: 'met_kinderen', label: 'Gezinnen met kinderen' },
]

/**
 * Displays CBS household composition percentages and doelgroep badge.
 * Returns null when totaal is null.
 */
export function HouseholdCard({ huishoudens, leeftijdsverdeling }: HouseholdCardProps) {
  if (huishoudens.totaal == null) return null

  const totaal = huishoudens.totaal

  return (
    <section className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-aura-amber/70"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
          Huishoudenssamenstelling
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2.5">
        {/* Total households — hero pill */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-600">Totaal huishoudens</span>
          <span className="inline-flex items-center rounded-full bg-aura-amber/15 border border-aura-amber/25 px-2.5 py-0.5 text-xs font-semibold text-aura-amber">
            {totaal.toLocaleString('nl-NL')}
          </span>
        </div>

        {/* Composition rows */}
        {COMPOSITION_ROWS.map(({ key, label }) => {
          const count = huishoudens[key]
          if (count == null || totaal === 0) return null
          const pct = ((count as number) / totaal) * 100
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">{label}</span>
                <span className="text-xs font-medium text-aura-ink">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-aura-amber/70"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          )
        })}

        {/* Average household size */}
        {huishoudens.gemiddelde_grootte != null && (
          <div className="flex items-center justify-between pt-1 border-t border-neutral-200">
            <span className="text-xs text-neutral-600">Gem. huishoudensgrootte</span>
            <span className="text-xs font-medium text-aura-ink">
              {huishoudens.gemiddelde_grootte.toFixed(1)}
            </span>
          </div>
        )}

        {/* Doelgroep badge */}
        {leeftijdsverdeling && (
          <div className="flex items-center justify-between pt-1 border-t border-neutral-200">
            <span className="text-xs text-neutral-600">Doelgroep</span>
            <DoelgroepLabel
              leeftijdsverdeling={leeftijdsverdeling}
              huishoudens={huishoudens}
            />
          </div>
        )}
      </div>
    </section>
  )
}
