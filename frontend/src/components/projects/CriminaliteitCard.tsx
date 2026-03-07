import type { CbsCriminaliteit } from '@/lib/types/scan'

interface CriminaliteitCardProps {
  criminaliteit: CbsCriminaliteit
}

const CATEGORIES: { key: keyof CbsCriminaliteit['categorien']; label: string }[] = [
  { key: 'vermogensdelicten', label: 'Vermogensdelicten' },
  { key: 'vernieling', label: 'Vernieling' },
  { key: 'geweld', label: 'Geweld' },
]

/**
 * Returns Tailwind text color class based on crime rate per 1000 inhabitants.
 * green < 30, amber 30-60, red > 60, grey for null
 */
function crimeColor(per1000: number | null): string {
  if (per1000 == null) return 'text-grey-500'
  if (per1000 < 30) return 'text-green-400'
  if (per1000 <= 60) return 'text-amber-400'
  return 'text-red-400'
}

/**
 * Displays CBS crime statistics per wijk with color-coded severity.
 * Shows total misdrijven per 1000 inwoners plus category breakdown.
 */
export function CriminaliteitCard({ criminaliteit }: CriminaliteitCardProps) {
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
      <div className="p-4 space-y-3">
        {/* Hero metric */}
        <div className="text-center">
          <p className={`text-2xl font-semibold ${crimeColor(criminaliteit.per_1000_inwoners)}`}>
            {criminaliteit.per_1000_inwoners != null
              ? criminaliteit.per_1000_inwoners.toFixed(1)
              : '--'}
          </p>
          <p className="text-[10px] text-grey-500 mt-0.5">misdrijven per 1.000 inwoners</p>
          {criminaliteit.totaal_misdrijven != null && (
            <p className="text-[10px] text-grey-600 mt-0.5">
              totaal: {criminaliteit.totaal_misdrijven.toLocaleString('nl-NL')}
            </p>
          )}
        </div>

        {/* Category breakdown */}
        <div className="space-y-2 pt-1">
          {CATEGORIES.map(({ key, label }) => {
            const cat = criminaliteit.categorien[key]
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-grey-400">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-grey-600">
                    {cat.aantal != null ? cat.aantal.toLocaleString('nl-NL') : '--'}
                  </span>
                  <span className={`text-xs font-medium ${crimeColor(cat.per_1000)}`}>
                    {cat.per_1000 != null ? cat.per_1000.toFixed(1) : '--'}
                  </span>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      cat.per_1000 == null
                        ? 'bg-grey-600'
                        : crimeColor(cat.per_1000).replace('text-', 'bg-')
                    }`}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Source footer */}
        <div className="pt-1.5 border-t border-overlay/5">
          <span className="text-[10px] text-grey-600">
            Bron: {criminaliteit.bron} {criminaliteit.peiljaar}
          </span>
        </div>
      </div>
    </section>
  )
}
