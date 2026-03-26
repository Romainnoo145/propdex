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
    <div className="rounded-2xl border border-neutral-200 bg-aura-glass-white/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clock size={14} className="text-aura-amber" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
          Doorlooptijd per type
        </p>
        <span className="text-[11px] text-slate-400 ml-1">Gemiddeld aantal dagen</span>
      </div>
      <div className="space-y-3">
        {withAvg
          .sort((a, b) => (b.avg_dagen ?? 0) - (a.avg_dagen ?? 0))
          .map((d) => {
            const pct = maxDays > 0 ? ((d.avg_dagen ?? 0) / maxDays) * 100 : 0
            const weeks = Math.round((d.avg_dagen ?? 0) / 7)
            return (
              <div key={d.vergunningstype} className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-aura-obsidian">
                    {TYPE_LABELS[d.vergunningstype] ?? d.vergunningstype}
                  </span>
                  <span className="text-[11px] tabular-nums text-slate-500">
                    {d.avg_dagen}d ({weeks}w)
                    <span className="ml-1.5 text-slate-300">
                      n={d.count}
                    </span>
                  </span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-aura-canvas">
                  <div
                    className="rounded-full bg-aura-amber/60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {d.min_dagen != null && d.max_dagen != null && (
                  <p className="text-[10px] text-slate-400">
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
