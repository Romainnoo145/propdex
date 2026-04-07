import { useState } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { Grid3x3, TrendingUp, ShieldAlert, ChevronUp, ChevronDown, Search } from 'lucide-react'
import type { ScanResultItem, BekendmakingRecord } from '@/lib/types/scan'
import { ParcelHero } from './ParcelHero'
import { ScoreGauge } from './ScoreGauge'
import { BouwjaarTimeline } from './BouwjaarTimeline'
import { EigendomModal } from './EigendomModal'
import { VergunningenModal } from './VergunningenModal'
import { BestemmingModal } from './BestemmingModal'
import { OnbebouwdModal } from './OnbebouwdModal'
import { ScoreBreakdownModal } from './ScoreBreakdownModal'
import { UseCaseScoreCards } from './UseCaseScoreCards'
import { BeleidscontextCard } from './BeleidscontextCard'
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
  const [showBestemming, setShowBestemming] = useState(false)
  const [showOnbebouwd, setShowOnbebouwd] = useState(false)
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false)
  const { data: weightsData } = useOrgScoreWeights()
  const category = deriveBestemmingCategory(parcel.bestemmingen)
  const bm = parcel.building_metrics
  const vrijPct =
    parcel.area_m2 != null && parcel.area_m2 > 0 && bm?.pand_oppervlakte_m2 != null
      ? Math.round(((parcel.area_m2 - bm.pand_oppervlakte_m2) / parcel.area_m2) * 100)
      : parcel.area_m2 != null && !parcel.has_pand
        ? 100
        : null
  const vrijM2 =
    parcel.area_m2 != null && parcel.area_m2 > 0 && bm?.pand_oppervlakte_m2 != null
      ? Math.round(parcel.area_m2 - bm.pand_oppervlakte_m2)
      : parcel.area_m2 != null && !parcel.has_pand
        ? Math.round(parcel.area_m2)
        : null

  return (
    <motion.div
      className="flex-1 flex flex-col px-8 pb-8"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── Bento Image Grid (3 cards) ───────────────── */}
      <div className="grid grid-cols-3 gap-1.5 mt-4">
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
            setShowBestemming(true)
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
            setShowScoreBreakdown(true)
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
      <div className="mt-3 flex-1 grid grid-cols-3 gap-1.5">
        <ScoreCircleCard
          icon={<TrendingUp size={16} strokeWidth={1.5} />}
          label="Potentie"
          score={parcel.potentie_score ?? null}
          color="#22C55E"
          type="potentie"
          onClick={() => onSelectCategory('potentie')}
        />
        <ScoreCircleCard
          icon={<ShieldAlert size={16} strokeWidth={1.5} />}
          label="Risico"
          score={parcel.risico_score ?? null}
          color="#EF4444"
          type="risico"
          onClick={() => onSelectCategory('risico')}
        />
        <BeschikbaarCard
          percentage={vrijPct}
          m2={vrijM2}
          highlight={vrijPct != null && vrijPct >= 40}
          onClick={() => setShowOnbebouwd(true)}
        />
      </div>

      {/* ── Use-case scores ───────────────────────────── */}
      <UseCaseScoreCards scores={parcel.use_case_scores} />

      {/* ── Gemeente beleidscontext ───────────────────── */}
      {parcel.gemeente_code && (
        <motion.div variants={fadeUp} className="mt-3">
          <BeleidscontextCard gemeenteCode={parcel.gemeente_code} />
        </motion.div>
      )}

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

      {/* Score breakdown modal */}
      <AnimatePresence>
        {showScoreBreakdown && (
          <ScoreBreakdownModal
            score={parcel.score}
            potentieScore={parcel.potentie_score ?? null}
            risicScore={parcel.risico_score ?? null}
            scoreBreakdown={parcel.score_breakdown}
            address={parcel.address}
            isCustomProfile={weightsData?.is_custom ?? false}
            onClose={() => setShowScoreBreakdown(false)}
          />
        )}
      </AnimatePresence>

      {/* Onbebouwd modal */}
      <AnimatePresence>
        {showOnbebouwd && (
          <OnbebouwdModal
            perceelM2={parcel.area_m2}
            gebouwM2={bm?.pand_oppervlakte_m2 ?? null}
            hasPand={parcel.has_pand}
            address={parcel.address}
            onClose={() => setShowOnbebouwd(false)}
          />
        )}
      </AnimatePresence>

      {/* Bestemming modal */}
      <AnimatePresence>
        {showBestemming && (
          <BestemmingModal
            bestemmingen={parcel.bestemmingen}
            address={parcel.address}
            onClose={() => setShowBestemming(false)}
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


/* ── ScoreCircleCard ───────────────────────────────────────── */

function ScoreCircleCard({
  icon,
  label,
  score,
  color,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  score: number | null
  color: string
  type: 'potentie' | 'risico'
  onClick?: () => void
}) {
  const normalised = score !== null ? Math.min(100, Math.max(0, Math.round(score))) : 0
  const r = 48
  const circumference = 2 * Math.PI * r

  return (
    <motion.div
      variants={fadeUp}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      className={`flex flex-col justify-between h-full rounded-[24px] bg-white border border-[#EAEFEF] p-5 transition-colors duration-200 hover:shadow-sm${onClick ? ' cursor-pointer' : ''}`}
    >
      {/* Top: icon + label + chevrons */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          <span
            className="text-[11px] font-extrabold uppercase"
            style={{ letterSpacing: '0.15em', color: '#94a3b8' }}
          >
            {label}
          </span>
        </div>
        <div className="flex flex-col -space-y-1 text-slate-200">
          <ChevronUp size={14} strokeWidth={2} />
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      {/* Middle: score circle — same size as ScoreGauge */}
      <div className="relative flex items-center justify-center my-2">
        <svg viewBox="0 0 120 120" className="h-[140px] w-[140px]" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
          {score !== null && (
            <motion.circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (normalised / 100) * circumference }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
              style={{}}
            />
          )}
        </svg>
        <span
          className="absolute text-5xl font-black tracking-tighter tabular-nums leading-none"
          style={{ color: score !== null ? color : '#cbd5e1' }}
        >
          {score !== null ? Math.round(score) : '—'}
        </span>
      </div>

      {/* Bottom spacer */}
      <div />
    </motion.div>
  )
}


/* ── BeschikbaarCard ───────────────────────────────────────── */

function BeschikbaarCard({
  percentage,
  m2,
  highlight,
  onClick,
}: {
  percentage: number | null
  m2: number | null
  highlight?: boolean
  onClick?: () => void
}) {
  const accentColor = highlight ? '#F9A826' : '#94a3b8'

  return (
    <motion.div
      variants={fadeUp}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      className={`flex flex-col justify-between h-full rounded-[24px] p-5 transition-colors duration-200 hover:shadow-sm${onClick ? ' cursor-pointer' : ''}`}
      style={{
        background: highlight ? 'rgba(249, 168, 38, 0.08)' : '#FFFFFF',
        border: highlight ? '1px solid rgba(249, 168, 38, 0.3)' : '1px solid #EAEFEF',
      }}
    >
      {/* Top: icon + label + chevrons */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: accentColor }}>
            <Grid3x3 size={16} strokeWidth={1.5} />
          </span>
          <span
            className="text-[11px] font-extrabold uppercase"
            style={{ letterSpacing: '0.15em', color: accentColor }}
          >
            Onbebouwd
          </span>
        </div>
        <div className="flex flex-col -space-y-1 text-slate-200">
          <ChevronUp size={14} strokeWidth={2} />
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      {/* Middle: percentage + m² */}
      <div className="flex flex-col items-center gap-1">
        {percentage !== null ? (
          <span
            className="text-5xl font-black tracking-tighter tabular-nums leading-none"
            style={{ color: highlight ? '#F9A826' : '#0E1111' }}
          >
            {percentage}
            <span className="text-3xl">%</span>
          </span>
        ) : (
          <span className="text-5xl font-black tracking-tighter tabular-nums leading-none text-slate-300">
            —
          </span>
        )}
        {m2 !== null ? (
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: highlight ? 'rgba(249, 168, 38, 0.6)' : '#94a3b8' }}
          >
            {m2.toLocaleString('nl-NL')} m²
          </span>
        ) : (
          <span className="text-sm text-slate-300">— m²</span>
        )}
      </div>

      {/* Bottom spacer */}
      <div />
    </motion.div>
  )
}




/* ── KenmerkenCard ─────────────────────────────────────────── */

export function KenmerkenCard({
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

      <div>
        {value !== null ? (
          <span
            className="text-5xl font-black tracking-tighter tabular-nums leading-none"
            style={{ color: highlight ? '#F9A826' : '#0E1111' }}
          >
            {value.toLocaleString('nl-NL')}
          </span>
        ) : (
          <span
            className="text-5xl font-black tracking-tighter tabular-nums leading-none"
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
