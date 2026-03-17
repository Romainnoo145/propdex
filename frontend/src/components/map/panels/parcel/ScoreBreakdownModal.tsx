/**
 * ScoreBreakdownModal — Shows how the total score is composed
 *
 * Displays potentie vs risico subscores and per-factor breakdown
 * from score_breakdown data (v3.0 format).
 */

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, ShieldAlert, Info } from 'lucide-react'

/* ── Types ───────────────────────────────────────────────────── */

interface ScoreFactor {
  categorie: 'potentie' | 'risico'
  waarde: unknown
  genormaliseerde_score: number | null
  gewicht: number | null
  bijdrage: number | null
  toelichting_kort: string | null
  toelichting_lang: string | null
  missing: boolean
}

/* ── Props ────────────────────────────────────────────────────── */

interface ScoreBreakdownModalProps {
  score: number | null
  potentieScore: number | null
  risicScore: number | null
  scoreBreakdown: Record<string, unknown> | null
  address: string | null
  isCustomProfile: boolean
  onClose: () => void
}

/* ── Helpers ──────────────────────────────────────────────────── */

function parseFactors(breakdown: Record<string, unknown> | null): {
  potentie: { name: string; factor: ScoreFactor }[]
  risico: { name: string; factor: ScoreFactor }[]
} {
  const potentie: { name: string; factor: ScoreFactor }[] = []
  const risico: { name: string; factor: ScoreFactor }[] = []

  if (!breakdown) return { potentie, risico }

  for (const [name, value] of Object.entries(breakdown)) {
    if (!value || typeof value !== 'object') continue
    const f = value as Record<string, unknown>
    if (!('categorie' in f)) continue

    const factor: ScoreFactor = {
      categorie: f.categorie === 'risico' ? 'risico' : 'potentie',
      waarde: f.waarde ?? null,
      genormaliseerde_score: typeof f.genormaliseerde_score === 'number' ? f.genormaliseerde_score : null,
      gewicht: typeof f.gewicht === 'number' ? f.gewicht : null,
      bijdrage: typeof f.bijdrage === 'number' ? f.bijdrage : null,
      toelichting_kort: typeof f.toelichting_kort === 'string' ? f.toelichting_kort : null,
      toelichting_lang: typeof f.toelichting_lang === 'string' ? f.toelichting_lang : null,
      missing: f.missing === true,
    }

    if (factor.categorie === 'risico') {
      risico.push({ name, factor })
    } else {
      potentie.push({ name, factor })
    }
  }

  // Sort by bijdrage descending
  potentie.sort((a, b) => (b.factor.bijdrage ?? 0) - (a.factor.bijdrage ?? 0))
  risico.sort((a, b) => (b.factor.bijdrage ?? 0) - (a.factor.bijdrage ?? 0))

  return { potentie, risico }
}

function formatFactorName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
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
  address,
  isCustomProfile,
  onClose,
}: ScoreBreakdownModalProps) {
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
                className="flex-[6] rounded-[16px] p-4 flex items-center justify-between"
                style={{ background: 'rgba(249, 168, 38, 0.08)', border: '1px solid rgba(249, 168, 38, 0.3)' }}
              >
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#F9A826]">
                  Potentie
                </span>
                <span className="text-2xl font-black tracking-tighter tabular-nums text-[#F9A826]">
                  60%
                </span>
              </div>
              <div
                className="flex-[4] rounded-[16px] p-4 flex items-center justify-between"
                style={{ background: '#F2F6F3', border: '1px solid #EAEFEF' }}
              >
                <span className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8]">
                  Risico
                </span>
                <span className="text-2xl font-black tracking-tighter tabular-nums text-[#94a3b8]">
                  40%
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
          <FactorRow key={name} name={name} factor={factor} color={color} />
        ))}
      </div>
    </div>
  )
}

/* ── FactorRow ───────────────────────────────────────────────── */

function FactorRow({
  name,
  factor,
  color,
}: {
  name: string
  factor: ScoreFactor
  color: string
}) {
  const score = factor.genormaliseerde_score
  const barWidth = score !== null ? Math.min(100, Math.max(0, score)) : 0

  return (
    <div className="rounded-[12px] bg-[#F2F6F3] p-3 transition-colors hover:bg-[#ECF1ED]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[12px] font-semibold text-[#0E1111] truncate"
          >
            {formatFactorName(name)}
          </span>
          {factor.missing && (
            <span className="text-[9px] font-semibold text-[#94a3b8] bg-[#E8EDEB] rounded-full px-1.5 py-0.5 shrink-0">
              Ontbreekt
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {factor.gewicht !== null && (
            <span className="text-[10px] text-[#94a3b8] tabular-nums">
              ×{factor.gewicht}
            </span>
          )}
          <span
            className="text-[13px] font-bold tabular-nums"
            style={{ color: factor.missing ? '#cbd5e1' : color }}
          >
            {score !== null ? Math.round(score) : '—'}
          </span>
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
      {/* Short explanation */}
      {factor.toelichting_kort && !factor.missing && (
        <p className="mt-1.5 text-[11px] text-[#6B7280] leading-snug">
          {factor.toelichting_kort}
        </p>
      )}
    </div>
  )
}
