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
    // Wallet/money bag — property crime (diefstal, inbraak, fraude)
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 1 0 0 4h4v-4z" />
      </svg>
    ),
  },
  {
    key: 'vernieling',
    label: 'Vernieling',
    // Flame — destruction/vandalism
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
  },
  {
    key: 'geweld',
    label: 'Geweld',
    // Circle-alert — violence
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
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
  if (per1000 == null) return { color: 'text-neutral-500', bg: 'bg-neutral-300', label: 'Onbekend' }
  if (per1000 < 30) return { color: 'text-green-400', bg: 'bg-green-400/15', label: 'Laag' }
  if (per1000 <= 60) return { color: 'text-amber-400', bg: 'bg-amber-400/15', label: 'Gemiddeld' }
  if (per1000 <= 100) return { color: 'text-orange-400', bg: 'bg-orange-400/15', label: 'Hoog' }
  return { color: 'text-red-400', bg: 'bg-red-400/15', label: 'Zeer hoog' }
}

/** Bar width as percentage relative to max category rate */
function barWidth(per1000: number | null, max: number): string {
  if (per1000 == null || max === 0) return '0%'
  return `${Math.min(100, (per1000 / max) * 100)}%`
}

export function CriminaliteitCard({ criminaliteit }: CriminaliteitCardProps) {
  const totalSev = severity(criminaliteit.per_1000_inwoners)

  const maxCatRate = Math.max(
    ...CATEGORIES.map(({ key }) => criminaliteit.categorien[key].per_1000 ?? 0),
    1,
  )

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
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
          Criminaliteit
        </span>
        <span className="ml-auto rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-500">
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
            <p className="text-xs text-neutral-700">
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
                <span className="text-[10px] text-neutral-500">
                  ({criminaliteit.totaal_misdrijven.toLocaleString('nl-NL')}{' '}
                  totaal)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Category breakdown — per 1.000 inwoners */}
        <div className="space-y-2.5">
          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Per 1.000 inwoners</p>
          {CATEGORIES.map(({ key, label, icon }) => {
            const cat = criminaliteit.categorien[key]
            const catSev = severity(cat.per_1000)
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`${catSev.color} opacity-60`}>{icon}</span>
                    <span className="text-xs text-neutral-600">{label}</span>
                  </div>
                  <span className={`text-xs font-medium tabular-nums ${catSev.color}`}>
                    {cat.per_1000 != null ? cat.per_1000.toFixed(1) : '--'}
                  </span>
                </div>
                {/* Bar */}
                <div className="h-1 rounded-full bg-neutral-200 overflow-hidden">
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
        <p className="text-[10px] text-neutral-500 leading-relaxed">
          Geregistreerde misdrijven (CBS/Politie). Totaal omvat ook overige
          categorie&euml;n zoals drugs, verkeer en overige.
        </p>

        {/* Source footer */}
        <div className="pt-1 border-t border-neutral-200">
          <span className="text-[10px] text-neutral-500">
            Bron: {criminaliteit.bron} {criminaliteit.peiljaar}
          </span>
        </div>
      </div>
    </section>
  )
}
