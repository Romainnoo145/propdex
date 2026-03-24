import type { TrendSummary } from '@/lib/api'

interface StatisticsBarProps {
  summary: TrendSummary
}

export function StatisticsBar({ summary }: StatisticsBarProps) {
  const doorlooptijdLabel =
    summary.avg_doorlooptijd != null
      ? `${Math.round(summary.avg_doorlooptijd)} dgn`
      : '—'

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-lg border border-neutral-200 bg-aura-glass-white/40 px-3 py-2.5">
        <span className="text-label text-neutral-500">Totaal</span>
        <p className="mt-1 text-sm font-semibold tracking-tight text-aura-ink tabular-nums">
          {summary.total_rulings}
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-aura-glass-white/40 px-3 py-2.5">
        <span className="text-label text-neutral-500">Gem. doorlooptijd</span>
        <p className="mt-1 text-sm font-semibold tracking-tight text-aura-ink tabular-nums">
          {doorlooptijdLabel}
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-aura-glass-white/40 px-3 py-2.5">
        <span className="text-label text-neutral-500">Succespercentage</span>
        <p className="mt-1 text-sm font-semibold tracking-tight text-aura-ink tabular-nums">
          {Math.round(summary.succes_pct)}%
        </p>
      </div>
    </div>
  )
}
