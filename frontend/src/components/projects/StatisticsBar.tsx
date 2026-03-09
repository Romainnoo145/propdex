import type { TrendSummary } from '@/lib/api'

interface StatisticsBarProps {
    summary: TrendSummary
}

export function StatisticsBar({ summary }: StatisticsBarProps) {
    const doorlooptijdLabel =
        summary.avg_doorlooptijd != null
            ? `${Math.round(summary.avg_doorlooptijd)} dgn`
            : '--'

    return (
        <div className="flex items-center gap-4 text-xs">
            {/* Totaal */}
            <div className="flex flex-col">
                <span className="text-neutral-500">Totaal</span>
                <span className="font-bold text-aura-ink tabular-nums">
                    {summary.total_rulings}
                </span>
            </div>

            <div className="w-px h-6 bg-neutral-100/10" />

            {/* Gemiddelde doorlooptijd */}
            <div className="flex flex-col">
                <span className="text-neutral-500">Gem. doorlooptijd</span>
                <span className="font-bold text-aura-ink tabular-nums">
                    {doorlooptijdLabel}
                </span>
            </div>

            <div className="w-px h-6 bg-neutral-100/10" />

            {/* Succespercentage */}
            <div className="flex flex-col">
                <span className="text-neutral-500">Succespercentage</span>
                <span className="font-bold text-aura-ink tabular-nums">
                    {Math.round(summary.succes_pct)}%
                </span>
            </div>
        </div>
    )
}
