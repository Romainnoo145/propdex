import { barGeometry } from './lib/factor-detail'
import type { PageCard } from '@/lib/factor-groups'

export type BarTone = 'potentie' | 'risico'

interface BijdrageBarProps {
  card: PageCard
  /** Which tab — drives the fill + value color (groen vs rood). */
  tone: BarTone
  /** Max |pts| across the current list — normalises bar width. */
  maxAbs: number
  onClick?: () => void
  comingSoon?: boolean
}

export function BijdrageBar({ card, tone, maxAbs, onClick, comingSoon = false }: BijdrageBarProps) {
  const { widthPct } = barGeometry(card.pts, maxAbs)
  const isInteractive = !comingSoon && !!onClick

  // Same gradient variant for both tabs — green for potentie, red for risico.
  const fillColor = comingSoon
    ? 'bg-slate-200'
    : tone === 'risico'
      ? 'bg-gradient-to-r from-red-500/20 to-red-500/85'
      : 'bg-gradient-to-r from-green-500/20 to-green-500/85'

  const valueColor = comingSoon
    ? 'text-slate-300'
    : tone === 'risico'
      ? 'text-red-600'
      : 'text-green-600'

  const ptsLabel =
    card.pts > 0 ? `+${card.pts}` : card.pts < 0 ? `−${Math.abs(card.pts)}` : '—'

  const handleKey = (e: React.KeyboardEvent) => {
    if (!isInteractive) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? `${card.label}: ${card.value} — bekijk details` : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={handleKey}
      className={`grid grid-cols-[96px_1fr_44px] items-center gap-3 py-1.5 px-2 ${
        isInteractive ? 'cursor-pointer rounded-xl hover:bg-white/65' : ''
      } ${comingSoon ? 'opacity-60' : ''}`}
    >
      <span className="text-left text-[11px] font-bold uppercase tracking-wide leading-tight text-slate-700 truncate">
        {card.label}
      </span>
      <div className="relative h-3.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`absolute left-0 top-0 bottom-0 rounded-full ${fillColor}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className={`text-right text-[12px] font-extrabold tabular-nums ${valueColor}`}>
        {ptsLabel}
      </span>
    </div>
  )
}
