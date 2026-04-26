/**
 * M048 Phase 7 — Shared FactorCard for Potentie + Risico layers.
 *
 * Replaces inline card markup in PotentieLayer + RisicoCard component.
 * Adds pin-star UI (UI-01, PIN-01).
 *
 * The wrapping element is a `div[role=button]` so card-body click works
 * keyboard-accessible; Star is a nested button with stopPropagation.
 */

import { Star } from 'lucide-react'
import { TruncatedText } from './TruncatedText'

export type CardTone = 'positive' | 'negative'

export interface FactorCardData {
  label: string
  value: string
  sub: string
  pts: number
}

interface FactorCardProps {
  card: FactorCardData
  tone: CardTone
  isPinned?: boolean
  isMissing?: boolean
  onStarClick?: () => void
  onCardClick?: () => void
}

export function FactorCard({
  card,
  tone,
  isPinned = false,
  isMissing = false,
  onStarClick,
  onCardClick,
}: FactorCardProps) {
  const ptsBadge =
    tone === 'positive'
      ? 'text-green-600 bg-green-50'
      : 'text-red-600 bg-red-50'

  const borderClass = isMissing
    ? 'border-dashed border-slate-200'
    : 'border-slate-100'

  const valueColor = isMissing ? 'text-slate-300' : 'text-slate-900'

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (onStarClick) onStarClick()
  }

  const handleCardClick = () => {
    if (onCardClick) onCardClick()
  }

  const isInteractive = !!onCardClick

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? handleCardClick : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleCardClick()
              }
            }
          : undefined
      }
      data-testid={isMissing ? 'factor-card-missing' : 'factor-card'}
      className={`group relative bg-white border ${borderClass} rounded-[24px] p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
        isInteractive ? 'cursor-pointer text-left' : ''
      }`}
    >
      {/* Top: label + pts badge + pin star (right-cluster keeps badge & star aligned) */}
      <div className="flex justify-between items-center gap-2">
        <TruncatedText
          text={card.label}
          className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-tight line-clamp-1 pr-1"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`${ptsBadge} px-2 py-0.5 rounded-full text-[10px] font-black leading-none`}
          >
            {card.pts > 0 ? `+${card.pts}` : '—'}
          </span>
          {(onStarClick !== undefined || isPinned) && (
            <button
              type="button"
              onClick={handleStarClick}
              data-testid={isPinned ? 'pin-star-filled' : 'pin-star-button'}
              data-pinned={isPinned ? 'true' : 'false'}
              aria-label={isPinned ? 'Unpin factor' : 'Pin factor'}
              className={`p-0.5 rounded-full hover:bg-slate-50 transition-opacity duration-150 ${
                isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <Star
                className={`size-4 ${
                  isPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                }`}
                strokeWidth={2}
              />
            </button>
          )}
        </div>
      </div>

      {/* Middle: value */}
      <div className="flex-1 flex items-center min-w-0 mt-2">
        <TruncatedText
          text={card.value}
          className={`text-2xl font-black ${valueColor} tracking-tight leading-[1.05] line-clamp-2 break-words pr-1`}
        />
      </div>

      {/* Bottom: sub */}
      <div className="border-t border-slate-50 pt-3 min-w-0">
        <TruncatedText
          text={isMissing ? 'Geen data' : card.sub}
          className="text-[11px] font-bold text-slate-400 leading-tight line-clamp-2 pr-1"
        />
      </div>
    </div>
  )
}

/** Ghost slot rendered when pinned-page is partial (< CARDS_PER_PAGE pins). */
interface GhostCardProps {
  onClick?: () => void
}

export function GhostCard({ onClick }: GhostCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-slate-50/50 border border-dashed border-slate-200 rounded-[24px] p-6 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors text-slate-400 cursor-pointer"
    >
      <Star className="size-5 text-slate-300" strokeWidth={1.5} />
      <span className="text-[11px] font-bold uppercase tracking-wider">
        Pin een factor
      </span>
    </button>
  )
}
