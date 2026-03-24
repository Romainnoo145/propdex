import { Clock } from 'lucide-react'
import { Skeleton } from '@/components/feedback/Skeleton'
import type { DoorlooptijdStats, WinLossRatio } from '@/lib/api'

interface JuridischKlimaatCardProps {
  isLoading: boolean
  doorlooptijd?: Record<string, DoorlooptijdStats> | null
  winLoss?: WinLossRatio | null
  analyzedCount?: number
  totalCount?: number
  pendingCount?: number
}

/**
 * Severity based on rejection rate across ALL outcomes (including onbekend).
 * This avoids the misleading "100% afgewezen" when half is unknown.
 */
function overallSeverity(winLoss: WinLossRatio): {
  color: string
  bg: string
  label: string
} {
  const pctAfgewezen = Math.round((winLoss.afgewezen / winLoss.total) * 100)
  if (pctAfgewezen < 15) return { color: 'text-aura-green', bg: 'bg-aura-green', label: 'Gunstig' }
  if (pctAfgewezen <= 35) return { color: 'text-aura-amber-dark', bg: 'bg-aura-amber', label: 'Gemiddeld' }
  if (pctAfgewezen <= 55) return { color: 'text-aura-amber-dark', bg: 'bg-aura-amber-dark', label: 'Ongunstig' }
  return { color: 'text-aura-red', bg: 'bg-aura-red', label: 'Zeer ongunstig' }
}

const OUTCOME_CONFIG = [
  { key: 'toegewezen' as const, label: 'Toegewezen', color: 'bg-aura-green/70', dot: 'bg-aura-green' },
  { key: 'gedeeltelijk' as const, label: 'Gedeeltelijk', color: 'bg-aura-amber/70', dot: 'bg-aura-amber' },
  { key: 'afgewezen' as const, label: 'Afgewezen', color: 'bg-aura-red/70', dot: 'bg-aura-red' },
  { key: 'onbekend' as const, label: 'Onbekend', color: 'bg-neutral-300', dot: 'bg-neutral-300' },
]

/**
 * Juridisch Klimaat dashboard card.
 * Shows ruling outcomes as a stacked bar with severity indicator.
 */
export function JuridischKlimaatCard({
  isLoading,
  doorlooptijd,
  winLoss,
  analyzedCount,
  totalCount,
  pendingCount,
}: JuridischKlimaatCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-aura-amber/80 animate-pulse">Analyseren...</span>
        </div>
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    )
  }

  if (!winLoss || winLoss.total === 0) return null

  const sev = overallSeverity(winLoss)
  const segments = OUTCOME_CONFIG
    .map(cfg => ({ ...cfg, count: winLoss[cfg.key] }))
    .filter(s => s.count > 0)

  const doorlooptijdEntries = doorlooptijd ? Object.values(doorlooptijd) : []
  const hasDoorlooptijd = doorlooptijdEntries.some(s => !s.insufficient_data)
  const firstDoorlooptijd = doorlooptijdEntries.find(s => !s.insufficient_data)

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-600">
          <span className="text-sm font-bold text-aura-ink tabular-nums">{winLoss.total}</span>
          {' '}uitspraken
        </p>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${sev.bg}`} />
          <span className={`text-label ${sev.color}`}>{sev.label}</span>
        </div>
      </div>

      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`${seg.color} first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${(seg.count / winLoss.total) * 100}%` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1 text-xs text-neutral-500">
            <span className={`h-1.5 w-1.5 rounded-full ${seg.dot}`} />
            {seg.count} {seg.label}
          </span>
        ))}
      </div>

      {hasDoorlooptijd && firstDoorlooptijd?.avg_dagen != null && (
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 pt-1 border-t border-neutral-200">
          <Clock className="w-3 h-3" />
          <span>Gem. doorlooptijd</span>
          <span className="font-medium tabular-nums text-neutral-700">{firstDoorlooptijd.avg_dagen} dgn</span>
        </div>
      )}

      {hasDoorlooptijd && doorlooptijdEntries.filter(s => !s.insufficient_data).length > 1 && (
        <div className="space-y-1">
          {doorlooptijdEntries.filter(s => !s.insufficient_data).map((stat) => (
            <div key={stat.vergunningstype} className="flex items-center justify-between text-xs">
              <span className="text-neutral-600 truncate mr-2">{stat.vergunningstype}</span>
              <span className="font-medium tabular-nums whitespace-nowrap text-neutral-700">
                {stat.avg_dagen} dgn
                <span className="text-neutral-500 font-normal ml-1">
                  ({stat.min_dagen}–{stat.max_dagen})
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {(pendingCount ?? 0) > 0 && (
        <p className="text-label text-neutral-500">
          {analyzedCount} van {totalCount} uitspraken geanalyseerd
        </p>
      )}
    </div>
  )
}
