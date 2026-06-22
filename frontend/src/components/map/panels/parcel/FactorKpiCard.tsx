/**
 * FactorKpiCard — robust per-factor card row for the Potentie/Risico tabs.
 *
 * Amber icon tile + label kicker + measurement KPI + contribution pill.
 * Replaces the bijdrage-bar: magnitude reads from the pill + weight-ordering,
 * not a full-width bar. Whole card is the drill-down trigger.
 */

import { createElement } from 'react'
import { iconForFactor } from './lib/factor-icons'
import type { PageCard } from '@/lib/factor-groups'

export type CardTone = 'potentie' | 'risico'

interface FactorKpiCardProps {
  card: PageCard
  /** Which tab — drives the contribution pill colour (green vs red). */
  tone: CardTone
  onClick?: () => void
  comingSoon?: boolean
}

export function FactorKpiCard({ card, tone, onClick, comingSoon = false }: FactorKpiCardProps) {
  const iconNode = createElement(iconForFactor(card.factor_key, card.bron), {
    size: 20,
    strokeWidth: 1.5,
  })
  const isInteractive = !comingSoon && !!onClick

  const ptsLabel =
    card.pts > 0 ? `+${card.pts}` : card.pts < 0 ? `−${Math.abs(card.pts)}` : '—'

  const pillColor =
    comingSoon || card.pts === 0
      ? 'text-slate-300 bg-slate-100'
      : tone === 'risico'
        ? 'text-red-700 bg-red-50'
        : 'text-green-700 bg-green-50'

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
      className={`flex items-center gap-3.5 rounded-[18px] border bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors ${
        comingSoon ? 'border-dashed border-slate-200 bg-white/45' : 'border-slate-100'
      } ${isInteractive ? 'cursor-pointer hover:border-slate-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : ''}`}
    >
      {/* Icon tile — amber intelligence accent */}
      <span
        className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] ${
          comingSoon ? 'bg-slate-100 text-slate-300' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {iconNode}
      </span>

      {/* Meat — label kicker + measurement KPI + caption */}
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-extrabold uppercase tracking-[0.1em] ${comingSoon ? 'text-slate-300' : 'text-slate-400'}`}>
          {card.label}
        </p>
        <p className={`mt-0.5 truncate text-[19px] font-extrabold leading-tight tracking-[-0.02em] ${comingSoon ? 'text-slate-300' : 'text-[#0E1111]'}`}>
          {card.value}
        </p>
        {card.sub && (
          <p className="mt-0.5 truncate text-[12px] text-slate-500">{card.sub}</p>
        )}
      </div>

      {/* Contribution pill */}
      <span className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[12px] font-extrabold tabular-nums ${pillColor}`}>
        {ptsLabel}
      </span>
    </div>
  )
}
