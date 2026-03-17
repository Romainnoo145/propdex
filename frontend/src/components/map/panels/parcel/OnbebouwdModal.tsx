/**
 * OnbebouwdModal — Shows breakdown of available land and development potential
 *
 * Displays perceel vs gebouw calculation and a staffel showing
 * what can realistically be built on different amounts of land.
 */

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  LandPlot,
  Building2,
  Grid3x3,
  ArrowRight,
  Home,
  Building,
  Hotel,
  Warehouse,
} from 'lucide-react'

/* ── Staffel tiers ───────────────────────────────────────────── */

interface StaffelTier {
  range: string
  minM2: number
  maxM2: number
  icon: typeof Home
  color: string
  label: string
  examples: string
}

const STAFFEL: StaffelTier[] = [
  {
    range: '0 – 50',
    minM2: 0,
    maxM2: 50,
    icon: Grid3x3,
    color: '#94a3b8',
    label: 'Zeer beperkt',
    examples: 'Berging, fietsenstalling, kleine aanbouw',
  },
  {
    range: '50 – 150',
    minM2: 50,
    maxM2: 150,
    icon: Home,
    color: '#F59E0B',
    label: 'Klein project',
    examples: 'Tiny house, tuinkamer, praktijkruimte',
  },
  {
    range: '150 – 500',
    minM2: 150,
    maxM2: 500,
    icon: Building2,
    color: '#22C55E',
    label: 'Woningbouw',
    examples: '1–3 woningen, twee-onder-een-kap, groot bijgebouw',
  },
  {
    range: '500 – 1.500',
    minM2: 500,
    maxM2: 1500,
    icon: Building,
    color: '#3B82F6',
    label: 'Klein complex',
    examples: '4–12 appartementen, rijtjeswoningen, bedrijfsunit',
  },
  {
    range: '1.500 – 5.000',
    minM2: 1500,
    maxM2: 5000,
    icon: Hotel,
    color: '#8B5CF6',
    label: 'Middelgroot project',
    examples: 'Appartementencomplex, zorgwoningen, kantoorgebouw',
  },
  {
    range: '5.000+',
    minM2: 5000,
    maxM2: Infinity,
    icon: Warehouse,
    color: '#EC4899',
    label: 'Groot project',
    examples: 'Woonwijk, bedrijventerrein, mixed-use ontwikkeling',
  },
]

function getActiveTier(m2: number): StaffelTier | null {
  return STAFFEL.find((t) => m2 >= t.minM2 && m2 < t.maxM2) ?? null
}

/* ── Props ────────────────────────────────────────────────────── */

interface OnbebouwdModalProps {
  perceelM2: number | null
  gebouwM2: number | null
  hasPand: boolean
  address: string | null
  onClose: () => void
}

/* ── Reduced motion ──────────────────────────────────────────── */

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── Component ────────────────────────────────────────────────── */

export function OnbebouwdModal({
  perceelM2,
  gebouwM2,
  hasPand,
  address,
  onClose,
}: OnbebouwdModalProps) {
  const beschikbaarM2 =
    perceelM2 != null && perceelM2 > 0 && gebouwM2 != null
      ? Math.round(perceelM2 - gebouwM2)
      : perceelM2 != null && !hasPand
        ? Math.round(perceelM2)
        : null

  const percentage =
    perceelM2 != null && perceelM2 > 0 && beschikbaarM2 != null
      ? Math.round((beschikbaarM2 / perceelM2) * 100)
      : null

  const activeTier = beschikbaarM2 != null && beschikbaarM2 > 0 ? getActiveTier(beschikbaarM2) : null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="onbebouwd-backdrop"
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
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[calc(100vh-80px)] mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ──────────────────────────────── */}
          <div className="flex items-start justify-between px-8 pt-7 pb-3 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                  Onbebouwde grond
                </h2>
                {percentage !== null && (
                  <div
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                    style={{
                      background: percentage >= 40 ? 'rgba(249, 168, 38, 0.1)' : '#F2F6F3',
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: percentage >= 40 ? '#F9A826' : '#6B7280' }}
                    >
                      {percentage}% onbebouwd
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-[#6B7280]">
                {address ?? 'Beschikbare ruimte op dit perceel'}
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

          {/* ── Content (scrollable) ────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6">
            {/* Calculation breakdown */}
            <div className="flex items-center gap-3 py-5">
              <MetricBlock
                icon={<LandPlot size={18} strokeWidth={1.5} />}
                label="Perceel"
                value={perceelM2 != null ? `${Math.round(perceelM2).toLocaleString('nl-NL')} m²` : '—'}
                color="#0E1111"
              />
              <span className="text-[#94a3b8] text-lg font-bold shrink-0">−</span>
              <MetricBlock
                icon={<Building2 size={18} strokeWidth={1.5} />}
                label="Gebouw"
                value={gebouwM2 != null ? `${Math.round(gebouwM2).toLocaleString('nl-NL')} m²` : hasPand ? '—' : '0 m²'}
                color="#0E1111"
              />
              <span className="text-[#94a3b8] text-lg font-bold shrink-0">=</span>
              <MetricBlock
                icon={<Grid3x3 size={18} strokeWidth={1.5} />}
                label="Beschikbaar"
                value={beschikbaarM2 != null ? `${beschikbaarM2.toLocaleString('nl-NL')} m²` : '—'}
                color="#F9A826"
                highlight
              />
            </div>

            {/* Staffel */}
            <div className="mt-2">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#94a3b8] mb-3">
                Wat past op deze grond?
              </h3>
              <div className="space-y-2">
                {STAFFEL.map((tier) => {
                  const isActive = activeTier === tier
                  const Icon = tier.icon

                  return (
                    <div
                      key={tier.range}
                      className="flex items-center gap-4 rounded-[16px] p-4 transition-colors"
                      style={{
                        background: isActive ? 'rgba(249, 168, 38, 0.08)' : '#F2F6F3',
                        border: isActive ? '1px solid rgba(249, 168, 38, 0.3)' : '1px solid transparent',
                      }}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{ background: isActive ? '#F9A826' : '#EAEFEF' }}
                      >
                        <Icon
                          size={18}
                          strokeWidth={1.5}
                          style={{ color: isActive ? '#0E1111' : '#94a3b8' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[13px] font-bold"
                            style={{ color: isActive ? '#0E1111' : '#6B7280' }}
                          >
                            {tier.label}
                          </span>
                          {isActive && (
                            <ArrowRight size={14} strokeWidth={2} className="text-[#F9A826]" />
                          )}
                        </div>
                        <p
                          className="text-[12px] mt-0.5 leading-snug"
                          style={{ color: isActive ? '#4B5563' : '#94a3b8' }}
                        >
                          {tier.examples}
                        </p>
                      </div>
                      <span
                        className="text-[11px] font-bold tabular-nums shrink-0"
                        style={{ color: isActive ? '#F9A826' : '#94a3b8' }}
                      >
                        {tier.range} m²
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Disclaimer */}
            <p className="mt-4 text-[11px] text-[#94a3b8] leading-relaxed">
              Deze indicatie is gebaseerd op het onbebouwde grondoppervlak. Werkelijke bouwmogelijkheden
              zijn afhankelijk van het bestemmingsplan, bebouwingspercentage, bouwlagen en lokale regelgeving.
            </p>
          </div>

          {/* ── Footer ──────────────────────────────── */}
          <div className="shrink-0 px-8 pb-6 pt-3 border-t border-[#EAEFEF]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#94a3b8]">
                Bron: Kadaster · BAG
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* ── MetricBlock ─────────────────────────────────────────────── */

function MetricBlock({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className="flex-1 flex flex-col items-center gap-2 rounded-[16px] py-4 px-3"
      style={{
        background: highlight ? 'rgba(249, 168, 38, 0.08)' : '#F2F6F3',
        border: highlight ? '1px solid rgba(249, 168, 38, 0.3)' : '1px solid transparent',
      }}
    >
      <span style={{ color: highlight ? '#F9A826' : '#94a3b8' }}>{icon}</span>
      <span
        className="text-[10px] font-extrabold uppercase tracking-[0.15em]"
        style={{ color: highlight ? '#F9A826' : '#94a3b8' }}
      >
        {label}
      </span>
      <span
        className="text-lg font-black tracking-tighter tabular-nums"
        style={{ color: highlight ? '#F9A826' : color }}
      >
        {value}
      </span>
    </div>
  )
}
