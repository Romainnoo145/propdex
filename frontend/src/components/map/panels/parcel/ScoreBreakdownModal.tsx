/**
 * ScoreBreakdownModal — Shows how the total score is composed
 *
 * Displays potentie vs risico subscores and per-factor breakdown
 * from score_breakdown data (v3.0 format).
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, ShieldAlert, Info, ChevronDown, MapPin, Lock } from 'lucide-react'
import {
  type ScoreFactor,
  parseFactors,
  formatFactorName,
  isWijkBreed,
} from './lib/factor-detail'

/* ── Helpers (exported for reuse) ────────────────────────────── */

export function countMissingFactors(
  breakdown: Record<string, unknown> | null | undefined,
): number {
  if (!breakdown) return 0
  let count = 0
  for (const value of Object.values(breakdown)) {
    if (!value || typeof value !== 'object') continue
    const f = value as Record<string, unknown>
    if (f.missing === true) count++
  }
  return count
}

/* ── Props ────────────────────────────────────────────────────── */

interface ScoreBreakdownModalProps {
  score: number | null
  potentieScore: number | null
  risicScore: number | null
  scoreBreakdown: Record<string, unknown> | null
  /** Phase 04.2: backend stripped factor weights for this caller */
  scoreBreakdownRedacted?: boolean
  address: string | null
  isCustomProfile: boolean
  potentieRisicoBalance: number   // 0.0–1.0 from useOrgScoreWeights
  onClose: () => void
}


/* ── Reduced motion ──────────────────────────────────────────── */

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── Component ────────────────────────────────────────────────── */

export function ScoreBreakdownModal({
  score,
  potentieScore,
  risicScore,
  scoreBreakdown,
  scoreBreakdownRedacted = false,
  address,
  isCustomProfile,
  potentieRisicoBalance,
  onClose,
}: ScoreBreakdownModalProps) {
  const potentiePct = Math.round(potentieRisicoBalance * 100)
  const risicoPct = 100 - potentiePct
  const { potentie, risico } = parseFactors(scoreBreakdown)
  const hasFactors = potentie.length > 0 || risico.length > 0

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="score-breakdown-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[calc(100vh-80px)] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ──────────────────────────────── */}
          <div className="flex items-start justify-between px-8 pt-7 pb-3 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                  Score breakdown
                </h2>
                {isCustomProfile && (
                  <div className="flex items-center gap-1.5 rounded-full bg-[#F2F6F3] px-2.5 py-1">
                    <span className="text-[10px] font-semibold text-[#6B7280]">
                      Custom profiel
                    </span>
                  </div>
                )}
                {scoreBreakdownRedacted && (
                  <div className="flex items-center gap-1.5 rounded-full bg-[#FEF3E2] px-2.5 py-1">
                    <Lock size={11} strokeWidth={2} style={{ color: '#F9A826' }} />
                    <span className="text-[10px] font-semibold text-[#0E1111]">
                      Volledige weights in Pro
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-[#6B7280]">
                {address ?? 'Hoe de totaalscore is opgebouwd'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB] ml-4 mt-0.5"
              aria-label="Sluiten"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* ── Content ────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6">
            {/* Score overview: potentie — totaal — risico */}
            <div className="flex items-center justify-center gap-8 py-6">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1">
                  <TrendingUp size={14} strokeWidth={2} style={{ color: '#22C55E' }} />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]">
                    Potentie
                  </span>
                </div>
                <span
                  className="text-2xl font-black tracking-tighter tabular-nums leading-none"
                  style={{ color: potentieScore !== null ? '#22C55E' : '#cbd5e1' }}
                >
                  {potentieScore !== null ? Math.round(potentieScore) : '—'}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]">
                  Totaal
                </span>
                <span
                  className="text-5xl font-black tracking-tighter tabular-nums leading-none"
                  style={{ color: '#F9A826' }}
                >
                  {score !== null ? Math.round(score) : '—'}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1">
                  <ShieldAlert size={14} strokeWidth={2} style={{ color: '#EF4444' }} />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]">
                    Risico
                  </span>
                </div>
                <span
                  className="text-2xl font-black tracking-tighter tabular-nums leading-none"
                  style={{ color: risicScore !== null ? '#EF4444' : '#cbd5e1' }}
                >
                  {risicScore !== null ? Math.round(risicScore) : '—'}
                </span>
              </div>
            </div>

            {/* Weight distribution blocks */}
            <div className="flex gap-2 mb-6">
              <div
                className="rounded-[16px] p-4 flex items-center justify-between"
                style={{
                  flex: potentiePct,
                  background: 'rgba(249, 168, 38, 0.08)',
                  border: '1px solid rgba(249, 168, 38, 0.3)'
                }}
              >
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#F9A826]">
                  Potentie
                </span>
                <span className="text-2xl font-black tracking-tighter tabular-nums text-[#F9A826]">
                  {potentiePct}%
                </span>
              </div>
              <div
                className="rounded-[16px] p-4 flex items-center justify-between"
                style={{ flex: risicoPct, background: '#F2F6F3', border: '1px solid #EAEFEF' }}
              >
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]">
                  Risico
                </span>
                <span className="text-2xl font-black tracking-tighter tabular-nums text-[#94a3b8]">
                  {risicoPct}%
                </span>
              </div>
            </div>

            {/* Two-column factor breakdown */}
            {!hasFactors ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Info size={32} strokeWidth={1.5} className="text-[#cbd5e1]" />
                <p className="mt-4 text-[13px] text-[#6B7280]">
                  Geen factor breakdown beschikbaar voor dit perceel.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {/* Left: Potentie */}
                <FactorSection
                  title="Potentie"
                  subtitle={potentieScore !== null ? `${Math.round(potentieScore)} / 100` : '—'}
                  color="#22C55E"
                  icon={<TrendingUp size={14} strokeWidth={2} />}
                  factors={potentie}
                />

                {/* Right: Risico */}
                <FactorSection
                  title="Risico"
                  subtitle={risicScore !== null ? `${Math.round(risicScore)} / 100` : '—'}
                  color="#EF4444"
                  icon={<ShieldAlert size={14} strokeWidth={2} />}
                  factors={risico}
                />
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────── */}
          <div className="shrink-0 px-8 pb-6 pt-3 border-t border-[#EAEFEF]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#94a3b8]">
                Score model v3.0
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}


/* ── FactorSection ───────────────────────────────────────────── */

function FactorSection({
  title,
  subtitle,
  color,
  icon,
  factors,
}: {
  title: string
  subtitle: string
  color: string
  icon: React.ReactNode
  factors: { name: string; factor: ScoreFactor }[]
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]">
            {title}
          </span>
        </div>
        <span
          className="text-[13px] font-bold tabular-nums"
          style={{ color }}
        >
          {subtitle}
        </span>
      </div>
      <div className="space-y-1.5">
        {factors.map(({ name, factor }) => (
          <FactorCard key={name} name={name} factor={factor} color={color} />
        ))}
      </div>
    </div>
  )
}

/* ── FactorCard (expandable) ─────────────────────────────────── */

function FactorCard({
  name,
  factor,
  color,
}: {
  name: string
  factor: ScoreFactor
  color: string
}) {
  const [expanded, setExpanded] = useState(false)
  const score = factor.genormaliseerde_score
  const barWidth = score !== null ? Math.min(100, Math.max(0, score)) : 0

  const hasExpandableContent =
    Boolean(factor.toelichting_lang) ||
    (factor.data_bronnen !== null && factor.data_bronnen.length > 0) ||
    (factor.dev_type_ruling_count !== null && factor.total_ruling_count !== null)

  // Missing-factor copy: use succeskans_reason (S01) when available, else "Ontbreekt"
  const missingLabel = factor.succeskans_reason ?? 'Ontbreekt'

  return (
    <div className="rounded-[12px] bg-[#F2F6F3] transition-colors hover:bg-[#ECF1ED]">
      <button
        type="button"
        onClick={() => hasExpandableContent && setExpanded((e) => !e)}
        disabled={!hasExpandableContent}
        className="w-full text-left p-3 disabled:cursor-default"
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12px] font-semibold text-[#0E1111] truncate">
              {formatFactorName(name)}
            </span>
            {factor.missing && (
              <span
                className="text-[9px] font-semibold text-[#94a3b8] bg-[#E8EDEB] rounded-full px-1.5 py-0.5 shrink-0"
                title={missingLabel}
              >
                {factor.succeskans_reason ? 'Reden →' : 'Ontbreekt'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {factor.percentage_of_category !== null && (
              <span className="text-[10px] text-[#94a3b8] tabular-nums">
                {Math.round(factor.percentage_of_category * 100)}%
              </span>
            )}
            <span
              className="text-[13px] font-bold tabular-nums"
              style={{ color: factor.missing ? '#cbd5e1' : color }}
            >
              {score !== null ? Math.round(score) : '—'}
            </span>
            {hasExpandableContent && (
              <ChevronDown
                size={14}
                strokeWidth={2}
                className="text-[#94a3b8] transition-transform"
                style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[#E8EDEB] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: factor.missing ? '#cbd5e1' : color }}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
          />
        </div>
        {/* Short explanation (always visible, non-missing only) */}
        {factor.toelichting_kort && !factor.missing && (
          <p className="mt-1.5 text-[11px] text-[#6B7280] leading-snug">
            {factor.toelichting_kort}
          </p>
        )}
        {/* Missing-factor reason inline (S01: succeskans_reason) */}
        {factor.missing && factor.succeskans_reason && (
          <p className="mt-1.5 text-[11px] text-[#94a3b8] leading-snug italic">
            {factor.succeskans_reason}
          </p>
        )}
      </button>

      {/* Expanded metadata */}
      <AnimatePresence initial={false}>
        {expanded && hasExpandableContent && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-[#E8EDEB]">
              {factor.toelichting_lang && (
                <p className="text-[11px] text-[#475569] leading-relaxed pt-2">
                  {factor.toelichting_lang}
                </p>
              )}
              {/* S01 metadata: ruling-count for vergunning_succeskans / juridisch_klimaat */}
              {factor.dev_type_ruling_count !== null && factor.total_ruling_count !== null && (
                <p className="text-[10px] text-[#6B7280] italic">
                  Gebaseerd op {factor.dev_type_ruling_count} van {factor.total_ruling_count} uitspraken na filtering op dev-types.
                </p>
              )}
              {/* Data-bronnen + wijk-breed tag */}
              {factor.data_bronnen && factor.data_bronnen.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]">
                    Bronnen
                  </span>
                  {factor.data_bronnen.map((bron) => (
                    <span
                      key={bron}
                      className="text-[10px] text-[#475569] bg-white rounded-full px-2 py-0.5 border border-[#E8EDEB]"
                    >
                      {bron}
                    </span>
                  ))}
                  {isWijkBreed(factor.data_bronnen) && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2D5F4C] bg-[#D1E2D8] rounded-full px-2 py-0.5">
                      <MapPin size={10} strokeWidth={2} />
                      wijk-breed
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
