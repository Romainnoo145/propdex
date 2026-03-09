import type { CbsLeeftijdsVerdeling } from '@/lib/types/scan'

interface AgeDistributionCardProps {
  leeftijdsverdeling: CbsLeeftijdsVerdeling
}

const AGE_GROUPS: { key: keyof CbsLeeftijdsVerdeling; label: string }[] = [
  { key: 'perc_0_14', label: '0-14 jaar' },
  { key: 'perc_15_24', label: '15-24 jaar' },
  { key: 'perc_25_44', label: '25-44 jaar' },
  { key: 'perc_45_64', label: '45-64 jaar' },
  { key: 'perc_65_plus', label: '65+ jaar' },
]

/**
 * Derive vergrijzing/verjonging direction from age distribution.
 * ratio = 65+ / (0-14 + 15-24)
 */
function deriveVergrijzing(lv: CbsLeeftijdsVerdeling): {
  label: string
  color: string
  arrow: string
} | null {
  if (lv.perc_65_plus == null) return null
  const young = (lv.perc_0_14 ?? 0) + (lv.perc_15_24 ?? 0)
  const ratio = lv.perc_65_plus / (young || 1)

  if (ratio > 1.5) return { label: 'Vergrijzend', color: 'text-orange-400', arrow: '\u2191' }
  if (ratio < 0.6) return { label: 'Verjongend', color: 'text-green-400', arrow: '\u2193' }
  return { label: 'Stabiel', color: 'text-neutral-600', arrow: '\u2194' }
}

/**
 * Displays CBS age distribution as horizontal percentage bars.
 * Returns null when ALL 5 age group values are null.
 */
export function AgeDistributionCard({ leeftijdsverdeling }: AgeDistributionCardProps) {
  const hasAnyData = AGE_GROUPS.some((g) => leeftijdsverdeling[g.key] != null)
  if (!hasAnyData) return null

  const vergrijzing = deriveVergrijzing(leeftijdsverdeling)

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
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
          Leeftijdsverdeling
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2.5">
        {AGE_GROUPS.map(({ key, label }) => {
          const value = leeftijdsverdeling[key]
          if (value == null) return null
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">{label}</span>
                <span className="text-xs font-medium text-aura-ink">{value}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-aura-amber/70"
                  style={{ width: `${Math.min(value, 100)}%` }}
                />
              </div>
            </div>
          )
        })}

        {/* Vergrijzing/verjonging indicator */}
        {vergrijzing && (
          <div className="flex items-center justify-between pt-1 border-t border-neutral-200">
            <span className="text-xs text-neutral-600">Leeftijdstrend</span>
            <span className={`text-xs font-medium ${vergrijzing.color}`}>
              {vergrijzing.arrow} {vergrijzing.label}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
