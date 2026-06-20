/**
 * M048 Phase 7 — Shared FactorCard for Potentie + Risico layers.
 *
 * Two layouts:
 *  - `grid` (default): the square 3×3 intelligence-grid card (legacy paginated view).
 *  - `row`: a compact horizontal card for the single-scroll ParcelDetailPanel
 *    (Optie B). A left accent bar carries the potentie/risico tone so colour
 *    still encodes meaning in a weight-sorted, tab-less list.
 *
 * `comingSoon` renders the dashed "binnenkort" placeholder for roadmap cascades
 * not yet in the registry (reuses the missing-card visual language).
 *
 * The wrapping element is a `div[role=button]` so card-body click works
 * keyboard-accessible; Star is a nested button with stopPropagation.
 */

import { ArrowRight, Star } from 'lucide-react'
import { TruncatedText } from './TruncatedText'

export type CardTone = 'positive' | 'negative'
export type CardLayout = 'grid' | 'row'

export interface FactorCardData {
  label: string
  value: string
  sub: string
  pts: number
}

interface FactorCardProps {
  card: FactorCardData
  tone: CardTone
  layout?: CardLayout
  /** Roadmap placeholder — dashed border + amber "binnenkort" pill, non-interactive. */
  comingSoon?: boolean
  isPinned?: boolean
  isMissing?: boolean
  onStarClick?: () => void
  onCardClick?: () => void
}

export function FactorCard({
  card,
  tone,
  layout = 'grid',
  comingSoon = false,
  isPinned = false,
  isMissing = false,
  onStarClick,
  onCardClick,
}: FactorCardProps) {
  const ptsBadge =
    tone === 'positive'
      ? 'text-green-600 bg-green-50'
      : 'text-red-600 bg-red-50'

  const borderClass = isMissing || comingSoon
    ? 'border-dashed border-slate-200'
    : 'border-slate-100'

  const valueColor = isMissing || comingSoon ? 'text-slate-300' : 'text-slate-900'

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (onStarClick) onStarClick()
  }

  const handleCardClick = () => {
    if (onCardClick) onCardClick()
  }

  const isInteractive = !comingSoon && !!onCardClick

  /** Accessible name for the clickable card (the whole card is the button). */
  const interactiveLabel = isInteractive
    ? `${card.label}: ${card.value} — bekijk details`
    : undefined

  /** Shared pts / "binnenkort" pill. */
  const pill = comingSoon ? (
    <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[10px] font-black leading-none uppercase tracking-wide shrink-0">
      Binnenkort
    </span>
  ) : (
    <span className={`${ptsBadge} px-2 py-0.5 rounded-full text-[10px] font-black leading-none shrink-0`}>
      {card.pts > 0 ? `+${card.pts}` : card.pts < 0 ? `−${Math.abs(card.pts)}` : '—'}
    </span>
  )

  /* ── Row layout (single-scroll list) ──────────────────────── */
  if (layout === 'row') {
    const accent = comingSoon
      ? 'bg-slate-200'
      : tone === 'positive'
        ? 'bg-aura-green'
        : 'bg-red-400'
    return (
      <div
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={interactiveLabel}
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
        data-testid={comingSoon ? 'factor-card-coming-soon' : isMissing ? 'factor-card-missing' : 'factor-card'}
        className={`group relative shrink-0 flex items-stretch gap-3 bg-white border ${borderClass} rounded-[18px] pl-0 pr-4 py-3 shadow-sm transition-shadow overflow-hidden ${
          isInteractive ? 'cursor-pointer text-left hover:shadow-md' : ''
        }`}
      >
        {/* Tone accent bar — colour = meaning */}
        <div className={`w-1 rounded-full ml-2 my-0.5 shrink-0 ${accent}`} aria-hidden="true" />

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <TruncatedText
              text={card.label}
              className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-tight line-clamp-1 pr-1"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {pill}
              {!comingSoon && (onStarClick !== undefined || isPinned) && (
                <button
                  type="button"
                  onClick={handleStarClick}
                  data-testid={isPinned ? 'pin-star-filled' : 'pin-star-button'}
                  data-pinned={isPinned ? 'true' : 'false'}
                  aria-label={isPinned ? 'Unpin factor' : 'Pin factor'}
                  className="p-0.5 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <Star
                    className={`size-4 ${isPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`}
                    strokeWidth={2}
                  />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <TruncatedText
              text={comingSoon ? '—' : card.value}
              className={`text-[17px] font-black ${valueColor} tracking-tight leading-tight line-clamp-1 pr-1`}
            />
            {isInteractive && !isMissing && (
              <ArrowRight
                data-testid="factor-card-drill-down"
                aria-hidden="true"
                className="size-3.5 text-slate-300 shrink-0"
                strokeWidth={2}
              />
            )}
          </div>
          <TruncatedText
            text={comingSoon ? card.sub : isMissing ? 'Geen data' : card.sub}
            className="text-[11px] font-bold text-slate-400 leading-tight line-clamp-1 pr-1"
          />
        </div>
      </div>
    )
  }

  /* ── Grid layout (legacy 3×3 intelligence grid) ───────────── */
  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={interactiveLabel}
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
      data-testid={comingSoon ? 'factor-card-coming-soon' : isMissing ? 'factor-card-missing' : 'factor-card'}
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
          {pill}
          {!comingSoon && (onStarClick !== undefined || isPinned) && (
            <button
              type="button"
              onClick={handleStarClick}
              data-testid={isPinned ? 'pin-star-filled' : 'pin-star-button'}
              data-pinned={isPinned ? 'true' : 'false'}
              aria-label={isPinned ? 'Unpin factor' : 'Pin factor'}
              className="p-0.5 rounded-full hover:bg-slate-50 transition-colors"
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
          text={comingSoon ? '—' : card.value}
          className={`text-2xl font-black ${valueColor} tracking-tight leading-[1.05] line-clamp-2 break-words pr-1`}
        />
      </div>

      {/* Bottom: sub + drill-down indicator on clickable cards */}
      <div className="border-t border-slate-50 pt-3 min-w-0 flex items-end justify-between gap-2">
        <TruncatedText
          text={isMissing && !comingSoon ? 'Geen data' : card.sub}
          className="text-[11px] font-bold text-slate-400 leading-tight line-clamp-2 pr-1"
        />
        {isInteractive && !isMissing && (
          <ArrowRight
            data-testid="factor-card-drill-down"
            aria-hidden="true"
            className="size-3 text-slate-300 shrink-0 mb-0.5"
            strokeWidth={2}
          />
        )}
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
