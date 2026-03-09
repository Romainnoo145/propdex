import type { MonthBucket } from '@/lib/api'

interface TrendTimelineProps {
    months: MonthBucket[]
}

function barColor(score: number): string {
    if (score >= 70) return 'bg-green-400/60'
    if (score >= 40) return 'bg-amber-400/60'
    return 'bg-red-400/60'
}

export function TrendTimeline({ months }: TrendTimelineProps) {
    if (months.length < 3) {
        return (
            <p className="text-xs text-grey-500 py-3 text-center">
                Onvoldoende data voor trendweergave (min. 3 maanden)
            </p>
        )
    }

    const maxTotal = Math.max(...months.map((m) => m.total), 1)

    return (
        <div className="flex items-end gap-1 h-20">
            {months.map((m) => {
                const heightPct = (m.total / maxTotal) * 100
                const monthLabel = m.month.slice(5) // "MM" from "YYYY-MM"

                return (
                    <div
                        key={m.month}
                        className="flex flex-col items-center flex-1 min-w-0"
                    >
                        <div
                            className={`w-full rounded-t min-h-[2px] ${barColor(m.klimaat_score)}`}
                            style={{ height: `${heightPct}%` }}
                            title={`${m.month}: ${m.total} uitspraken, score ${m.klimaat_score}`}
                        />
                        <span className="text-[9px] text-grey-500 mt-1 tabular-nums">
                            {monthLabel}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
