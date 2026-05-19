/**
 * BrkKoopwaardeTimeline — koopjaar + koopsom historie display.
 *
 * Eng-plan AD6 rules:
 *   - Filter records to those with koopjaar !== null
 *   - Sort by koopjaar ascending
 *   - Render timeline: koopjaar (bold 16px) + nl-NL EUR formatted koopsom OR
 *     "Bedrag niet beschikbaar" placeholder
 *   - Empty (no koopjaar data anywhere): "Geen koophistorie beschikbaar"
 *
 * Aura tokens per DESIGN.md: Pure Glass card, Warm Amber for intelligence accents.
 */
import { TrendingUp } from 'lucide-react'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

export interface BrkKoopwaardeTimelineProps {
  records: BRKOwnershipRecordRead[]
}

const EUR_FORMATTER = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function formatKoopsom(koopsom: number | string | null): string {
  if (koopsom === null || koopsom === '' || koopsom === undefined) {
    return 'Bedrag niet beschikbaar'
  }
  const numeric = typeof koopsom === 'number' ? koopsom : Number(koopsom)
  if (Number.isNaN(numeric) || numeric === 0) {
    return 'Bedrag niet beschikbaar'
  }
  return EUR_FORMATTER.format(numeric)
}

export function BrkKoopwaardeTimeline({ records }: BrkKoopwaardeTimelineProps) {
  if (records.length === 0) return null

  const timelineEntries = records
    .filter((r) => r.koopjaar !== null)
    .sort((a, b) => (a.koopjaar ?? 0) - (b.koopjaar ?? 0))

  return (
    <div className="bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-6 mb-4">
      <h3 className="text-[11px] uppercase tracking-wide text-slate-500 font-medium mb-3">
        Koopwaarde-historie
      </h3>

      {timelineEntries.length === 0 ? (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 shrink-0">
            <TrendingUp size={18} strokeWidth={1.5} className="text-slate-400" />
          </div>
          <p className="text-[13px] text-slate-500">Geen koophistorie beschikbaar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {timelineEntries.map((rec) => (
            <div key={rec.id} className="flex items-baseline gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 shrink-0">
                <span className="text-[11px] font-semibold text-amber-700">
                  {String(rec.koopjaar).slice(-2)}
                </span>
              </div>
              <div className="flex-1 flex items-baseline justify-between gap-3">
                <p className="text-[16px] font-semibold text-aura-ink">
                  {rec.koopjaar}
                </p>
                <p className="text-[14px] text-slate-700 font-mono">
                  {formatKoopsom(rec.koopsom)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
