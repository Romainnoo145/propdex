import { barGeometry } from './lib/factor-detail'
import type { PageCard } from '@/lib/factor-groups'

interface BijdrageBarProps {
  card: PageCard
  tone: 'positive' | 'negative'
  /** Max |pts| across the current list — normalises bar width. */
  maxAbs: number
  onClick?: () => void
  comingSoon?: boolean
}

export function BijdrageBar({ card, tone: _tone, maxAbs, onClick, comingSoon = false }: BijdrageBarProps) {
  const { side, widthPct } = barGeometry(card.pts, maxAbs)
  const isInteractive = !comingSoon && !!onClick

  const fillColor =
    comingSoon
      ? 'bg-slate-200'
      : side === 'pos'
        ? 'bg-gradient-to-r from-green-500/20 to-green-500/85'
        : side === 'neg'
          ? 'bg-gradient-to-l from-red-500/20 to-red-500/85'
          : 'bg-slate-200'

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
      className={`grid grid-cols-[92px_1fr] items-center gap-2 py-1.5 ${
        isInteractive ? 'cursor-pointer rounded-lg hover:bg-white/60' : ''
      } ${comingSoon ? 'opacity-60' : ''}`}
    >
      <span className="text-right text-[10px] font-extrabold uppercase tracking-wide leading-tight text-slate-500">
        {card.label}
      </span>
      <div className="relative h-[30px]">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200" />
        <div
          className={`absolute top-1 h-[22px] rounded-[7px] flex items-center ${fillColor} ${
            side === 'neg' ? 'right-1/2 justify-end' : 'left-1/2'
          }`}
          style={{ width: `${widthPct / 2}%` }}
        >
          <span className="px-2 text-[11px] font-extrabold text-white whitespace-nowrap">{ptsLabel}</span>
        </div>
      </div>
    </div>
  )
}
