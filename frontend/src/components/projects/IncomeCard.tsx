import type { CbsInkomen } from '@/lib/types/scan'

interface IncomeCardProps {
  inkomen: CbsInkomen
  wozWaarde: number | null
}

const eurFmt = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const INCOME_ROWS: { key: keyof CbsInkomen; label: string }[] = [
  { key: 'gem_per_ontvanger', label: 'Gem. inkomen (ontvanger)' },
  { key: 'gem_per_inwoner', label: 'Gem. inkomen (inwoner)' },
  { key: 'gem_gestandaardiseerd', label: 'Gem. huishoudinkomen (gestd.)' },
]

/**
 * Derive WOZ/inkomen ratio and market pressure indicator.
 * WOZ is in thousands in CBS data.
 */
function deriveWozRatio(
  wozWaarde: number | null,
  gemPerOntvanger: number | null,
): { ratio: number; label: string; color: string } | null {
  if (wozWaarde == null || gemPerOntvanger == null || gemPerOntvanger === 0) return null
  const ratio = (wozWaarde * 1000) / gemPerOntvanger
  if (ratio > 8) return { ratio, label: 'Hoge marktdruk', color: 'text-orange-400' }
  if (ratio < 5) return { ratio, label: 'Betaalbaar', color: 'text-green-400' }
  return { ratio, label: 'Gemiddeld', color: 'text-neutral-700' }
}

/**
 * Displays CBS income metrics, distribution, and WOZ/inkomen ratio.
 * Returns null when ALL income values are null.
 */
export function IncomeCard({ inkomen, wozWaarde }: IncomeCardProps) {
  const hasAnyData = INCOME_ROWS.some((r) => inkomen[r.key] != null) ||
    inkomen.perc_laagste_40 != null ||
    inkomen.perc_hoogste_20 != null

  if (!hasAnyData) return null

  const wozRatio = deriveWozRatio(wozWaarde, inkomen.gem_per_ontvanger)

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
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
          Inkomen & Vermogen
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2.5">
        {/* Income metrics */}
        {INCOME_ROWS.map(({ key, label }) => {
          const value = inkomen[key]
          if (value == null) return null
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-neutral-600">{label}</span>
              <span className="text-xs font-medium text-aura-ink">
                {eurFmt.format(value as number)}
              </span>
            </div>
          )
        })}

        {/* Income distribution */}
        {(inkomen.perc_laagste_40 != null || inkomen.perc_hoogste_20 != null) && (
          <div className="pt-1 border-t border-neutral-200 space-y-1.5">
            <span className="text-xs text-neutral-500 font-medium">Inkomensverdeling</span>
            {inkomen.perc_laagste_40 != null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Laagste 40%</span>
                <span className="text-xs font-medium text-aura-ink">
                  {inkomen.perc_laagste_40.toFixed(1)}% van personen
                </span>
              </div>
            )}
            {inkomen.perc_hoogste_20 != null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Hoogste 20%</span>
                <span className="text-xs font-medium text-aura-ink">
                  {inkomen.perc_hoogste_20.toFixed(1)}% van personen
                </span>
              </div>
            )}
          </div>
        )}

        {/* WOZ/Inkomen ratio */}
        {wozRatio && (
          <div className="flex items-center justify-between pt-1 border-t border-neutral-200">
            <span className="text-xs text-neutral-600">WOZ/Inkomen ratio</span>
            <span className={`text-xs font-medium ${wozRatio.color}`}>
              {wozRatio.ratio.toFixed(1)} &middot; {wozRatio.label}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
