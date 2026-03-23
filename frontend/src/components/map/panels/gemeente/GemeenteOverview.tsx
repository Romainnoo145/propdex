import { useMemo } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  CheckCircle2,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
  Search,
  MapPin,
  FileText,
  Landmark,
  Banknote,
} from 'lucide-react'
import { useGemeenteProfile } from '@/hooks/useGemeenteProfile'
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { useErfgoed } from '@/hooks/useErfgoed'
import { useSubsidies } from '@/hooks/useSubsidies'

interface GemeenteOverviewProps {
  naam: string
  code: string
  gemeenteCode: string
  wijkCount: number
  onSelectWijk: (code: string, naam: string) => void
  onSwitchToVergunningen: () => void
  onSwitchToRegelgeving: () => void
}

/* ── Animation ─────────────────────────────────────────────── */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

/* ── Score derivation ──────────────────────────────────────── */

function deriveScore(approval: number | null, doorlooptijd: number | null): number | null {
  if (approval == null) return null
  let s = Math.round(approval * 0.6)
  if (doorlooptijd != null) {
    s += doorlooptijd < 30 ? 40 : doorlooptijd < 60 ? 30 : doorlooptijd < 90 ? 20 : doorlooptijd < 120 ? 10 : 0
  }
  return Math.min(100, Math.max(0, s))
}

function scoreColor(s: number | null): string {
  if (s == null) return '#94a3b8'
  if (s >= 70) return '#22C55E'
  if (s >= 40) return '#F9A826'
  return '#EF4444'
}

/* ── CardLabelBar (matches parcel panel exactly) ───────────── */

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

/* ── ScoreGauge (matches parcel panel ScoreGauge) ──────────── */

function ScoreGauge({ score, color }: { score: number | null; color: string }) {
  const r = 48
  const circumference = 2 * Math.PI * r
  const normalised = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {score != null && (
          <motion.circle
            cx="60" cy="60" r={r} fill="none"
            stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - normalised * circumference }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          />
        )}
      </svg>
      <span
        className="absolute text-5xl font-black tracking-tighter tabular-nums leading-none"
        style={{ color: score != null ? color : '#cbd5e1' }}
      >
        {score != null ? Math.round(score) : '—'}
      </span>
    </div>
  )
}

/* ── ScoreCircleCard (matches parcel panel exactly) ────────── */

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
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.15em', color: '#94a3b8' }}>
            {label}
          </span>
        </div>
        <div className="flex flex-col -space-y-1 text-slate-200">
          <ChevronUp size={14} strokeWidth={2} />
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      <div className="relative flex items-center justify-center my-2">
        <svg viewBox="0 0 120 120" className="h-[140px] w-[140px]" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
          {score !== null && (
            <motion.circle
              cx="60" cy="60" r={r} fill="none"
              stroke={color} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (normalised / 100) * circumference }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
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
      <div />
    </motion.div>
  )
}

/* ── BekendmakingenTimeline (replaces BouwjaarTimeline) ───── */

function BekendmakingenTimeline({ total, topTypes }: { total: number; topTypes: [string, number][] }) {
  const maxCount = topTypes.length > 0 ? topTypes[0][1] : 1

  return (
    <div className="relative flex flex-col items-center py-3">
      {/* Center line with total */}
      <div className="flex items-center w-full gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#EAEFEF]" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F2F6F3]">
          <span className="text-[11px] font-black text-[#0E1111] tabular-nums">{total}</span>
          <span className="text-[10px] text-neutral-400 font-medium">bekendmakingen</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#EAEFEF]" />
      </div>

      {/* Type distribution as mini horizontal bars below the line */}
      {topTypes.length > 0 && (
        <div className="flex items-center gap-1 mt-2 w-full max-w-[80%]">
          {topTypes.map(([type, count]) => {
            const pct = Math.max(4, (count / maxCount) * 100)
            return (
              <div
                key={type}
                className="group relative h-[6px] rounded-full bg-[#F9A826] transition-all hover:h-[8px]"
                style={{ width: `${pct}%`, opacity: 0.3 + (count / maxCount) * 0.7 }}
                title={`${type}: ${count}`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── SecondaryField (matches parcel panel exactly) ─────────── */

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

/* ── Vergunning Type Cards (replaces UseCaseScoreCards) ───── */

function VergunningTypeCards({ types }: { types: [string, number][] }) {
  if (types.length === 0) return null

  return (
    <motion.div variants={fadeUp} className="mt-4">
      <div className="grid grid-cols-2 gap-1.5">
        {types.map(([type, count]) => (
          <div
            key={type}
            className="flex items-center justify-between rounded-[14px] bg-[#F2F6F3] px-4 py-3"
          >
            <span className="text-[11px] font-semibold text-[#0E1111] truncate mr-2">{type}</span>
            <span className="text-[14px] font-black text-[#F9A826] tabular-nums shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ── Main Component ────────────────────────────────────────── */

export function GemeenteOverview({
  naam,
  wijkCount,
  onSelectWijk,
  onSwitchToVergunningen,
  onSwitchToRegelgeving,
}: GemeenteOverviewProps) {
  const { data: profile, isLoading } = useGemeenteProfile(naam)
  const { data: hvv } = useHuisvestingsverordening(naam)
  const { data: erfgoed } = useErfgoed(naam)
  const { data: subsidies } = useSubsidies()

  const hScore = profile ? deriveScore(profile.approval_rate_pct, profile.avg_doorlooptijd_days) : null
  const hColor = scoreColor(hScore)

  const approvalRate = profile?.approval_rate_pct
  const rejectionRate = profile?.rejection_rate_pct

  // Top types excluding Overig
  const topTypes = useMemo(() => {
    if (!profile?.permit_type_distribution) return []
    return Object.entries(profile.permit_type_distribution)
      .filter(([k]) => k !== 'Overig')
      .sort((a, b) => b[1] - a[1])
  }, [profile?.permit_type_distribution])

  const hvvCount = hvv?.heeft_verordening ? 1 : 0
  const erfgoedCount = erfgoed?.total ?? null
  const subsidieCount = subsidies?.total ?? null

  return (
    <motion.div
      className="flex-1 flex flex-col px-8 pb-8"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── 3 Bento Cards (like Satelliet/Bestemming/Score) ── */}
      <div className="grid grid-cols-3 gap-1.5 mt-6">
        {/* Card 1: Haalbaarheid score */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={onSwitchToVergunningen}
          className="group flex flex-col rounded-[20px] overflow-hidden border-2 border-[#F9A826] transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="aspect-[5/6] flex items-center justify-center bg-[#F8FAF9]">
            <ScoreGauge score={hScore} color={hColor} />
          </div>
          <CardLabelBar label="Haalbaarheid" isActive />
        </motion.button>

        {/* Card 2: Verleend % */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={onSwitchToVergunningen}
          className="group flex flex-col rounded-[20px] overflow-hidden border-2 border-transparent transition-all duration-200 hover:border-[#EAEFEF]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="aspect-[5/6] flex items-center justify-center bg-[#F8FAF9]">
            <div className="flex flex-col items-center">
              <span className="text-[48px] font-black tracking-tighter tabular-nums leading-none text-[#22C55E]">
                {approvalRate != null ? `${Math.round(approvalRate)}` : '—'}
              </span>
              {approvalRate != null && (
                <span className="text-[20px] font-black text-[#22C55E]/60 -mt-1">%</span>
              )}
            </div>
          </div>
          <CardLabelBar label="Verleend" isActive={false} />
        </motion.button>

        {/* Card 3: Afgewezen % */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={onSwitchToVergunningen}
          className="group flex flex-col rounded-[20px] overflow-hidden border-2 border-transparent transition-all duration-200 hover:border-[#EAEFEF]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="aspect-[5/6] flex items-center justify-center bg-[#F8FAF9]">
            <div className="flex flex-col items-center">
              <span className={`text-[48px] font-black tracking-tighter tabular-nums leading-none ${rejectionRate != null ? 'text-[#EF4444]' : 'text-neutral-300'}`}>
                {rejectionRate != null ? `${Math.round(rejectionRate)}` : '—'}
              </span>
              {rejectionRate != null && (
                <span className="text-[20px] font-black text-[#EF4444]/60 -mt-1">%</span>
              )}
            </div>
          </div>
          <CardLabelBar label="Afgewezen" isActive={false} />
        </motion.button>
      </div>

      {/* ── Bekendmakingen divider (like BouwjaarTimeline) ── */}
      <motion.div variants={fadeUp} className="mt-2">
        <BekendmakingenTimeline
          total={profile?.sample_size ?? 0}
          topTypes={topTypes.slice(0, 5)}
        />
      </motion.div>

      {/* ── 3 Circle Cards (like Potentie/Risico/Onbebouwd) ── */}
      <div className="mt-2 flex-1 grid grid-cols-3 gap-1.5">
        <ScoreCircleCard
          icon={<FileText size={16} strokeWidth={1.5} />}
          label="HVV"
          score={hvvCount * 100}
          color={hvvCount > 0 ? '#F9A826' : '#94a3b8'}
          onClick={onSwitchToRegelgeving}
        />
        <ScoreCircleCard
          icon={<Landmark size={16} strokeWidth={1.5} />}
          label="Erfgoed"
          score={erfgoedCount}
          color={erfgoedCount != null && erfgoedCount > 0 ? '#F9A826' : '#94a3b8'}
          onClick={onSwitchToRegelgeving}
        />
        <ScoreCircleCard
          icon={<Banknote size={16} strokeWidth={1.5} />}
          label="Subsidies"
          score={subsidieCount}
          color={subsidieCount != null && subsidieCount > 0 ? '#22C55E' : '#94a3b8'}
          onClick={onSwitchToRegelgeving}
        />
      </div>

      {/* ── Vergunning types (like UseCaseScoreCards) ────── */}
      <VergunningTypeCards types={topTypes.slice(0, 4)} />

      {/* ── Secondary Fields (like pandstatus/vergunningen) ── */}
      <motion.div variants={fadeUp} className="mt-4 grid grid-cols-2 gap-1.5">
        <SecondaryField
          value={profile?.severity_label && profile.severity_label !== 'Onbekend'
            ? `${profile.severity_label} vergunningsbeleid`
            : isLoading ? '...' : 'Geen data'}
          onClick={onSwitchToVergunningen}
        />
        <SecondaryField
          value={profile?.avg_doorlooptijd_days != null && profile.avg_doorlooptijd_days > 0
            ? `~${profile.avg_doorlooptijd_days} dagen doorlooptijd`
            : isLoading ? '...' : 'Geen doorlooptijd data'}
          onClick={onSwitchToVergunningen}
        />
      </motion.div>

      {/* ── Row 6: Wijken ────────────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-1.5 grid grid-cols-1">
        <SecondaryField
          value={`${wijkCount} wijken`}
          onClick={() => onSelectWijk('', '')}
        />
      </motion.div>

      {/* ── Trust Metadata ───────────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-4 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          Bron: KOOP · Rechtspraak · RCE · RVO
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          {profile?.data_coverage ?? '—'} dekking
        </span>
      </motion.div>
    </motion.div>
  )
}
