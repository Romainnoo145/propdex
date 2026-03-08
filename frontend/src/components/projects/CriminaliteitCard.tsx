import type { CbsCriminaliteit } from '@/lib/types/scan'

interface CriminaliteitCardProps {
  criminaliteit: CbsCriminaliteit
}

const CATEGORIES: {
  key: keyof CbsCriminaliteit['categorien']
  label: string
  icon: React.ReactNode
}[] = [
  {
    key: 'vermogensdelicten',
    label: 'Vermogensdelicten',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    key: 'vernieling',
    label: 'Vernieling',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    key: 'geweld',
    label: 'Geweld',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
]

/**
 * Severity level based on crime rate per 1000 inhabitants.
 * Thresholds based on Dutch national averages (~50 per 1000).
 */
function severity(per1000: number | null): {
  color: string
  bg: string
  label: string
} {
  if (per1000 == null) return { color: 'text-grey-500', bg: 'bg-grey-700', label: 'Onbekend' }
  if (per1000 < 30) return { color: 'text-green-400', bg: 'bg-green-400/15', label: 'Laag' }
  if (per1000 <= 60) return { color: 'text-amber-400', bg: 'bg-amber-400/15', label: 'Gemiddeld' }
  if (per1000 <= 100) return { color: 'text-orange-400', bg: 'bg-orange-400/15', label: 'Hoog' }
  return { color: 'text-red-400', bg: 'bg-red-400/15', label: 'Zeer hoog' }
}

/** Max per_1000 for category bar width scaling */
function barWidth(per1000: number | null, max: number): string {
  if (per1000 == null || max === 0) return '0%'
  return `${Math.min(100, (per1000 / max) * 100)}%`
}

/**
 * Displays CBS crime statistics per wijk with color-coded severity,
 * category breakdown with horizontal bars, and contextual labels.
 */
export function CriminaliteitCard({ criminaliteit }: CriminaliteitCardProps) {
  const totalSev = severity(criminaliteit.per_1000_inwoners)

  // Find max per_1000 across categories for bar scaling
  const maxCatRate = Math.max(
    ...CATEGORIES.map(({ key }) => criminaliteit.categorien[key].per_1000 ?? 0),
    1,
  )

  return (
    <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-accent/70"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">
          Criminaliteit
        </span>
        <span className="ml-auto rounded bg-grey-800 px-1.5 py-0.5 text-[10px] text-grey-500">
          {criminaliteit.peiljaar}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Hero metric */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${totalSev.bg}`}
          >
            <span className={`text-lg font-bold ${totalSev.color}`}>
              {criminaliteit.per_1000_inwoners != null
                ? Math.round(criminaliteit.per_1000_inwoners)
                : '--'}
            </span>
          </div>
          <div>
            <p className="text-xs text-grey-300">
              misdrijven per 1.000 inwoners
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${totalSev.color.replace('text-', 'bg-')}`}
              />
              <span className={`text-[10px] font-medium ${totalSev.color}`}>
                {totalSev.label}
              </span>
              {criminaliteit.totaal_misdrijven != null && (
                <span className="text-[10px] text-grey-600">
                  ({criminaliteit.totaal_misdrijven.toLocaleString('nl-NL')}{' '}
                  totaal)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Category breakdown with bars */}
        <div className="space-y-2.5">
          {CATEGORIES.map(({ key, label, icon }) => {
            const cat = criminaliteit.categorien[key]
            const catSev = severity(cat.per_1000)
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`${catSev.color} opacity-60`}>{icon}</span>
                    <span className="text-xs text-grey-400">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {cat.per_1000 != null && (
                      <span className={`text-xs font-medium tabular-nums ${catSev.color}`}>
                        {cat.per_1000.toFixed(1)}
                      </span>
                    )}
                    {cat.aantal != null && (
                      <span className="text-[10px] text-grey-600 tabular-nums">
                        ({cat.aantal.toLocaleString('nl-NL')})
                      </span>
                    )}
                    {cat.per_1000 == null && cat.aantal != null && (
                      <span className="text-xs text-grey-500 tabular-nums">
                        {cat.aantal.toLocaleString('nl-NL')}
                      </span>
                    )}
                    {cat.per_1000 == null && cat.aantal == null && (
                      <span className="text-xs text-grey-600">--</span>
                    )}
                  </div>
                </div>
                {/* Bar */}
                <div className="h-1 rounded-full bg-grey-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${catSev.color.replace('text-', 'bg-')} opacity-60`}
                    style={{ width: barWidth(cat.per_1000, maxCatRate) }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Context note */}
        <p className="text-[10px] text-grey-600 leading-relaxed">
          Geregistreerde misdrijven (CBS/Politie). Totaal omvat ook overige
          categorie&euml;n zoals drugs, verkeer en overige.
        </p>

        {/* Source footer */}
        <div className="pt-1 border-t border-overlay/5">
          <span className="text-[10px] text-grey-600">
            Bron: {criminaliteit.bron} {criminaliteit.peiljaar}
          </span>
        </div>
      </div>
    </section>
  )
}
