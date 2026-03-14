import { useState, useEffect } from 'react'
import { motion, useSpring, useTransform, AnimatePresence, type Variants } from 'framer-motion'
import { Grid3x3, Building2, LandPlot, ChevronUp, ChevronDown, Search } from 'lucide-react'
import type { ScanResultItem, BekendmakingRecord } from '@/lib/types/scan'
import { ParcelHero } from './ParcelHero'
import { ScoreGauge } from './ScoreGauge'
import { BouwjaarTimeline } from './BouwjaarTimeline'
import { EigendomModal } from './EigendomModal'
import { VergunningenModal } from './VergunningenModal'
import { useOrgScoreWeights } from '@/hooks/useScoreWeights'

export type CategoryKey = 'potentie' | 'risico' | 'dossiers'

interface ParcelBentoOverviewProps {
  parcel: ScanResultItem
  onSelectCategory: (cat: CategoryKey) => void
  meldingenCount: number | null
  vergunningen: BekendmakingRecord[]
}

/* ── Helpers ───────────────────────────────────────────────── */

type BestemmingCategory =
  | 'wonen'
  | 'commercieel'
  | 'centrum'
  | 'maatschappelijk'
  | 'groen'
  | 'industrie'
  | 'gemengd'

const BESTEMMING_META: Record<BestemmingCategory, { label: string; image: string }> = {
  wonen: { label: 'Wonen', image: '/images/bestemmingen/wonen.jpg' },
  commercieel: { label: 'Commercieel', image: '/images/bestemmingen/commercieel.jpg' },
  centrum: { label: 'Centrum', image: '/images/bestemmingen/centrum.jpg' },
  maatschappelijk: { label: 'Maatschappelijk', image: '/images/bestemmingen/maatschappelijk.jpg' },
  groen: { label: 'Groen', image: '/images/bestemmingen/groen.jpg' },
  industrie: { label: 'Industrie', image: '/images/bestemmingen/industrie.jpg' },
  gemengd: { label: 'Gemengd', image: '/images/bestemmingen/gemengd.jpg' },
}

function deriveBestemmingCategory(
  bestemmingen: ScanResultItem['bestemmingen'],
): BestemmingCategory {
  if (!bestemmingen || bestemmingen.length === 0) return 'gemengd'
  const text = JSON.stringify(bestemmingen).toLowerCase()

  // Specific categories first (most precise match wins)
  if (text.includes('maatschappelijk')) return 'maatschappelijk'
  if (text.includes('groen') || text.includes('natuur') || text.includes('bos')) return 'groen'
  if (text.includes('bedrijf') || text.includes('bedrijventerrein')) return 'industrie'
  if (text.includes('centrum') || text.includes('centrumgebied')) return 'centrum'
  if (text.includes('detailhandel') || text.includes('kantoor') || text.includes('horeca')) return 'commercieel'

  const hasWonen = text.includes('wonen') || text.includes('woongebied')
  const hasMix = text.includes('gemengd')
  if (hasWonen && hasMix) return 'gemengd'
  if (hasWonen) return 'wonen'
  return 'gemengd'
}

function formatPandStatus(status: string | null): string {
  if (!status) return 'Onbekend'
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── Bento Grid card types ─────────────────────────────────── */

type BentoCard = 'aerial' | 'bestemming' | 'score'


/* ── Card Label Bar ────────────────────────────────────────── */

function CardLabelBar({ label, isActive }: { label: string; isActive: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        height: 28,
        background: isActive ? '#F9A826' : '#F2F6F3',
      }}
    >
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: isActive ? '#FFFFFF' : '#8A948D',
          textTransform: 'uppercase',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.2em',
        }}
      >
        {label}
      </span>
    </div>
  )
}

/* ── Stagger animation ─────────────────────────────────────── */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

/* ── Component ─────────────────────────────────────────────── */

export function ParcelBentoOverview({
  parcel,
  onSelectCategory,
  meldingenCount,
  vergunningen,
}: ParcelBentoOverviewProps) {
  const [activeCard, setActiveCard] = useState<BentoCard>('aerial')
  const [showEigendom, setShowEigendom] = useState(false)
  const [showVergunningen, setShowVergunningen] = useState(false)
  const { data: weightsData } = useOrgScoreWeights()
  const category = deriveBestemmingCategory(parcel.bestemmingen)
  const bm = parcel.building_metrics
  const vrijPct =
    parcel.area_m2 != null && parcel.area_m2 > 0 && bm?.pand_oppervlakte_m2 != null
      ? Math.round(((parcel.area_m2 - bm.pand_oppervlakte_m2) / parcel.area_m2) * 100)
      : parcel.area_m2 != null && !parcel.has_pand
        ? 100
        : null

  return (
    <motion.div
      className="flex-1 flex flex-col px-8 pb-8"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── Bento Image Grid (3 cards) ───────────────── */}
      <div className="grid grid-cols-3 gap-1.5 mt-6">
        {/* Card 1: Aerial View */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={() => setActiveCard('aerial')}
          className="group flex flex-col rounded-[20px] overflow-hidden transition-all duration-200"
          style={{
            border: activeCard === 'aerial' ? '2px solid #F9A826' : '2px solid transparent',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="relative aspect-[5/6] overflow-hidden">
            <div className="h-full w-full transition-transform duration-500 group-hover:scale-105">
              <ParcelHero parcelId={parcel.parcel_id} />
            </div>
          </div>
          <CardLabelBar label="Satelliet" isActive={activeCard === 'aerial'} />
        </motion.button>

        {/* Card 2: Bestemming type */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={() => {
            setActiveCard('bestemming')
            onSelectCategory('dossiers')
          }}
          className="group flex flex-col rounded-[20px] overflow-hidden transition-all duration-200"
          style={{
            border: activeCard === 'bestemming' ? '2px solid #F9A826' : '2px solid transparent',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="relative aspect-[5/6] overflow-hidden">
            <img
              src={BESTEMMING_META[category].image}
              alt={BESTEMMING_META[category].label}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
          <CardLabelBar label={BESTEMMING_META[category].label} isActive={activeCard === 'bestemming'} />
        </motion.button>

        {/* Card 3: Score gauge */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={() => {
            setActiveCard('score')
            onSelectCategory('potentie')
          }}
          className="group flex flex-col rounded-[20px] overflow-hidden transition-all duration-200"
          style={{
            border: activeCard === 'score' ? '2px solid #F9A826' : '2px solid transparent',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="aspect-[5/6] flex items-center justify-center bg-[#F8FAF9]">
            <ScoreGauge score={parcel.score} />
          </div>
          <CardLabelBar label="Score" isActive={activeCard === 'score'} />
        </motion.button>
      </div>

      {/* Custom profiel badge — only when org uses non-default weights */}
      {weightsData?.is_custom && (
        <motion.div variants={fadeUp} className="mt-2 flex justify-center">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500 bg-[#F2F6F3] rounded-full px-2 py-0.5">
            Custom profiel
          </span>
        </motion.div>
      )}

      {/* ── Bouwjaar divider ──────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-2">
        <BouwjaarTimeline bouwjaar={parcel.bouwjaar} />
      </motion.div>

      {/* ── Kenmerken (flex filler) ────────────────── */}
      <div className="mt-6 flex-1 grid grid-cols-3 gap-1.5">
        <KenmerkenCard
          icon={<LandPlot size={16} strokeWidth={1.5} />}
          label="Perceel"
          value={parcel.area_m2 != null ? Math.round(parcel.area_m2) : null}
          unit="m²"
        />
        <KenmerkenCard
          icon={<Building2 size={16} strokeWidth={1.5} />}
          label="Gebouw"
          value={bm?.pand_oppervlakte_m2 ? Math.round(bm.pand_oppervlakte_m2) : null}
          unit="m²"
        />
        <KenmerkenCard
          icon={<Grid3x3 size={16} strokeWidth={1.5} />}
          label="Beschikbaar"
          value={vrijPct}
          unit="%"
          highlight={vrijPct != null && vrijPct >= 40}
        />
      </div>

      {/* ── Secondary Fields ──────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-4 grid grid-cols-2 gap-1.5">
        <SecondaryField
          value={parcel.has_pand ? formatPandStatus(parcel.pand_status) : 'Leeg perceel'}
          onClick={() => setShowEigendom(true)}
        />
        <SecondaryField
          value={
            meldingenCount === null
              ? '...'
              : meldingenCount === 0
                ? 'Geen vergunningen'
                : `${meldingenCount} vergunning${meldingenCount === 1 ? '' : 'en'}`
          }
          onClick={meldingenCount != null && meldingenCount > 0 ? () => setShowVergunningen(true) : undefined}
        />
      </motion.div>

      {/* Eigendom modal */}
      <AnimatePresence>
        {showEigendom && (
          <EigendomModal
            parcel={parcel}
            onClose={() => setShowEigendom(false)}
          />
        )}
      </AnimatePresence>

      {/* Vergunningen modal */}
      <AnimatePresence>
        {showVergunningen && (
          <VergunningenModal
            records={vergunningen}
            address={parcel.address}
            onClose={() => setShowVergunningen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Trust Metadata ───────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-4 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          Bron: Kadaster · BAG · DSO
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          {parcel.parcel_code}
        </span>
      </motion.div>
    </motion.div>
  )
}

/* ── Animated Number ───────────────────────────────────────── */

function AnimatedNumber({ value, color }: { value: number; color: string }) {
  const spring = useSpring(0, { stiffness: 50, damping: 18 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('nl-NL'))
  const [text, setText] = useState('0')

  useEffect(() => { spring.set(value) }, [value, spring])
  useEffect(() => {
    const unsub = display.on('change', (v) => setText(v))
    return unsub
  }, [display])

  return (
    <span
      className="text-3xl font-black tracking-tighter tabular-nums leading-none"
      style={{ color }}
    >
      {text}
    </span>
  )
}

/* ── KenmerkenCard ─────────────────────────────────────────── */

function KenmerkenCard({
  icon,
  label,
  value,
  unit,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: number | null
  unit?: string
  highlight?: boolean
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col justify-between h-full rounded-[24px] p-5 transition-colors duration-200 hover:shadow-sm"
      style={{
        background: highlight ? 'rgba(249, 168, 38, 0.08)' : '#FFFFFF',
        border: highlight ? '1px solid rgba(249, 168, 38, 0.3)' : '1px solid #EAEFEF',
      }}
    >
      {/* Top: icon + label + chevrons */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: highlight ? '#F9A826' : '#cbd5e1' }}>{icon}</span>
          <span
            className="text-[11px] font-extrabold uppercase"
            style={{
              letterSpacing: '0.15em',
              color: highlight ? '#F9A826' : '#94a3b8',
            }}
          >
            {label}
          </span>
        </div>
        <div className="flex flex-col -space-y-1 text-slate-200">
          <ChevronUp size={14} strokeWidth={2} />
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      {/* Bottom: big value with count-up animation */}
      <div>
        {value !== null ? (
          <AnimatedNumber
            value={value}
            color={highlight ? '#F9A826' : '#0E1111'}
          />
        ) : (
          <span
            className="text-3xl font-black tracking-tighter tabular-nums leading-none"
            style={{ color: '#cbd5e1' }}
          >
            —
          </span>
        )}
        {unit && (
          <span
            className="text-[10px] font-bold uppercase mt-1 block"
            style={{ color: highlight ? 'rgba(249, 168, 38, 0.6)' : '#cbd5e1' }}
          >
            {unit}
          </span>
        )}
      </div>
    </motion.div>
  )
}

/* ── SecondaryField ────────────────────────────────────────── */

function SecondaryField({
  value,
  onClick,
}: {
  value: string
  onClick?: () => void
}) {
  const interactive = !!onClick
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
      className={`flex items-center justify-center gap-1.5 h-[40px] rounded-[14px] bg-[#F2F6F3] ${
        interactive ? 'cursor-pointer transition-colors hover:bg-[#E8EDEB]' : ''
      }`}
    >
      <span className="text-[13px] font-semibold text-[#0E1111]">{value}</span>
      {interactive && <Search size={12} strokeWidth={2} className="text-[#94a3b8]" />}
    </div>
  )
}
