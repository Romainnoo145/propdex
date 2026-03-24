import type { MonthBucket } from '@/lib/api'

interface TrendTimelineProps {
  months: MonthBucket[]
}

function barColor(score: number): string {
  if (score >= 70) return 'bg-aura-green/70'
  if (score >= 40) return 'bg-aura-amber/70'
  return 'bg-aura-red/70'
}

export function TrendTimeline({ months }: TrendTimelineProps) {
  if (months.length < 3) {
    return (
      <p className="py-3 text-center text-xs text-neutral-500">
        Onvoldoende data voor trendweergave, minimaal 3 maanden nodig.
      </p>
    )
  }

  const maxTotal = Math.max(...months.map((m) => m.total), 1)

  return (
    <div className="flex gap-1.5">
      {months.map((m) => {
        const heightPct = (m.total / maxTotal) * 100
        const monthLabel = m.month.slice(5)

        return (
          <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex h-16 w-full items-end">
              <div
                className={`min-h-[4px] w-full rounded-t-md ${barColor(m.klimaat_score)}`}
                style={{ height: `${Math.max(heightPct, 6)}%` }}
                title={`${m.month}: ${m.total} uitspraken, score ${m.klimaat_score}`}
              />
            </div>
            <span className="mt-1 text-[10px] tabular-nums text-neutral-500">{monthLabel}</span>
          </div>
        )
      })}
    </div>
  )
}
