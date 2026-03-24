import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { staggerContainer, fadeUp } from './animations'

export interface IntelCard {
  key: string
  label: string
  value: string
  sub: string
  /** Optional accent for the pts badge (e.g. "#F9A826" for amber) */
  accentColor?: string
  /** Badge text (e.g. "+2.4", "JA", "—") */
  badge?: string
  /** Score points for this card (shown as pill) */
  scorePts?: number | null
  /** Whether points are positive (potentie) or negative (risico) */
  scorePositive?: boolean
  onClick?: () => void
}

interface IntelligenceGridProps {
  cards: IntelCard[]
  /** Cards per page (default 9 for 3×3) */
  perPage?: number
  page?: number
  onPageChange?: (page: number) => void
}

/**
 * 3×3 intelligence grid — matches PotentieLayer/RisicoLayer card pattern.
 * Each card: label (10px uppercase) + badge (top-right pill) + value (text-2xl font-black) + sub insight (11px below divider).
 * Supports pagination with slide animation.
 */
export function IntelligenceGrid({ cards, perPage = 9, page = 0, onPageChange }: IntelligenceGridProps) {
  const totalPages = Math.ceil(cards.length / perPage)
  const pageCards = cards.slice(page * perPage, (page + 1) * perPage)

  return (
    <>
      <div className="flex-1 mt-4 relative min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-3 gap-1.5 flex-1"
            style={{ gridTemplateRows: `repeat(${Math.ceil(pageCards.length / 3)}, minmax(140px, 1fr))` }}
          >
            {pageCards.map((card) => (
              <IntelCardComponent key={card.key} card={card} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 transition-colors"
            aria-label="Vorige pagina"
          >
            <ChevronLeft className="size-4 text-slate-400" />
          </button>
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 transition-colors"
            aria-label="Volgende pagina"
          >
            <ChevronRight className="size-4 text-slate-400" />
          </button>
        </div>
      )}

      {totalPages <= 1 && (
        <div className="flex justify-center gap-4 mt-4">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">
            1 / 1
          </span>
        </div>
      )}
    </>
  )
}

/* ── Single intelligence card ──────────────────────────────── */

function IntelCardComponent({ card }: { card: IntelCard }) {
  const interactive = !!card.onClick

  // Determine pill display: scorePts takes priority over badge
  const showScorePill = card.scorePts != null && card.scorePts > 0
  const pillColor = showScorePill
    ? card.scorePositive
      ? 'text-amber-700 bg-amber-100'
      : 'text-slate-500 bg-slate-100'
    : undefined

  return (
    <motion.div
      variants={fadeUp}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={card.onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') card.onClick?.() } : undefined}
      className={`bg-white border border-slate-100 rounded-[24px] p-6 flex flex-col justify-between shadow-sm transition-shadow overflow-hidden ${
        interactive ? 'cursor-pointer hover:shadow-md' : 'hover:shadow-sm'
      }`}
      whileHover={interactive ? { scale: 1.02 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Top: label + score pill or badge */}
      <div className="flex justify-between items-start gap-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-tight truncate">
          {card.label}
        </span>
        {showScorePill ? (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${pillColor}`}>
            +{card.scorePts}
          </span>
        ) : card.badge != null ? (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-black shrink-0"
            style={{
              color: card.accentColor ?? '#94a3b8',
              backgroundColor: card.accentColor ? `${card.accentColor}15` : '#f8fafc',
            }}
          >
            {card.badge}
          </span>
        ) : null}
      </div>

      {/* Middle: value */}
      <div className="flex-1 flex items-center min-w-0">
        <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none truncate">
          {card.value}
        </span>
      </div>

      {/* Bottom: insight */}
      <div className="border-t border-slate-50 pt-3 min-w-0">
        <span className="text-[11px] font-bold text-slate-400 leading-tight truncate block">
          {card.sub}
        </span>
      </div>
    </motion.div>
  )
}
