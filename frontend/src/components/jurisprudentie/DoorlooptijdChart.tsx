import { Clock } from 'lucide-react'
import type { DoorlooptijdPerType } from '@/hooks/useExplorer'

const TYPE_LABELS: Record<string, string> = {
  nieuwbouw: 'Nieuwbouw',
  verbouw: 'Verbouw',
  dakopbouw: 'Dakopbouw',
  uitbreiding: 'Uitbreiding',
  sloop: 'Sloop',
  bestemmingswijziging: 'Bestemmingswijziging',
  milieu: 'Milieu',
  monumenten: 'Monumenten',
  overig: 'Overig',
}

interface DoorlooptijdChartProps {
  data: DoorlooptijdPerType[]
}

export default function DoorlooptijdChart({ data }: DoorlooptijdChartProps) {
  const withAvg = data.filter((d) => d.avg_dagen != null)
  if (withAvg.length === 0) return null

  const maxDays = Math.max(...withAvg.map((d) => d.avg_dagen!))

  return (
    <div className="rounded-lg border border-grey-800 bg-grey-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock size={16} className="text-amber-500/60" />
        <h3 className="text-sm font-semibold text-grey-200">
          Doorlooptijd per type
        </h3>
        <span className="text-xs text-grey-500">Gemiddeld aantal dagen</span>
      </div>
      <div className="space-y-2">
        {withAvg
          .sort((a, b) => (b.avg_dagen ?? 0) - (a.avg_dagen ?? 0))
          .map((d) => {
            const pct = maxDays > 0 ? ((d.avg_dagen ?? 0) / maxDays) * 100 : 0
            const weeks = Math.round((d.avg_dagen ?? 0) / 7)
            return (
              <div key={d.vergunningstype} className="space-y-0.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-grey-300">
                    {TYPE_LABELS[d.vergunningstype] ?? d.vergunningstype}
                  </span>
                  <span className="text-xs tabular-nums text-grey-400">
                    {d.avg_dagen}d ({weeks}w)
                    <span className="ml-1 text-grey-600">
                      n={d.count}
                    </span>
                  </span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-grey-800">
                  <div
                    className="rounded-full bg-amber-500/50"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {d.min_dagen != null && d.max_dagen != null && (
                  <p className="text-[10px] text-grey-600">
                    {d.min_dagen}d – {d.max_dagen}d
                  </p>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
