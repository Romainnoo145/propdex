import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Scale,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileText,
  Landmark,
  MapPin,
} from 'lucide-react'
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'
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

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

/* ── Haalbaarheid score ────────────────────────────────────── */

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

function trendDir(b30: number, b365: number): 'up' | 'down' | 'stable' {
  const m365 = b365 / 12
  if (m365 === 0) return 'stable'
  const r = b30 / m365
  return r > 1.3 ? 'up' : r < 0.7 ? 'down' : 'stable'
}

/* ── Animated Score Ring ───────────────────────────────────── */

function ScoreRing({ score, color, size = 140 }: { score: number | null; color: string; size?: number }) {
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const norm = score != null ? score / 100 : 0
  const vb = size
  const cx = vb / 2
  const sw = size * 0.09

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox={`0 0 ${vb} ${vb}`} style={{ width: size, height: size, transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {score != null && (
          <motion.circle
            cx={cx} cy={cx} r={r} fill="none"
            stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - norm * circ }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
          />
        )}
      </svg>
      <span
        className="absolute font-black tracking-tighter tabular-nums leading-none"
        style={{ color: score != null ? color : '#cbd5e1', fontSize: size * 0.28 }}
      >
        {score ?? '—'}
      </span>
    </div>
  )
}

/* ── Clickable Stat Card ───────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color?: string
  onClick?: () => void
}) {
  return (
    <motion.button
      variants={fadeUp}
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col justify-between rounded-[24px] bg-white border border-[#EAEFEF] p-5 text-left transition-all duration-200 h-full ${onClick ? 'cursor-pointer hover:shadow-md hover:border-[#DDE3E3]' : ''}`}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span style={{ color: color ?? '#94a3b8' }}>{icon}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">{label}</span>
        </div>
        {onClick && <ChevronRight size={14} className="text-neutral-300" />}
      </div>
      <span className="text-[24px] font-black tracking-tight tabular-nums text-[#0E1111] leading-none">
        {value}
      </span>
      {sub && <span className="text-[11px] text-neutral-400 mt-1.5 block">{sub}</span>}
    </motion.button>
  )
}

/* ── Component ─────────────────────────────────────────────── */

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

  const score = profile ? deriveScore(profile.approval_rate_pct, profile.avg_doorlooptijd_days) : null
  const sColor = scoreColor(score)
  const trend = profile ? trendDir(profile.bekendmakingen_30d, profile.bekendmakingen_365d) : 'stable'

  // Top 4 permit types (exclude "Overig" — not useful for overview)
  const topTypes = useMemo(() => {
    if (!profile?.permit_type_distribution) return []
    return Object.entries(profile.permit_type_distribution)
      .filter(([k]) => k !== 'Overig')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [profile?.permit_type_distribution])

  const maxTypeCount = topTypes.length > 0 ? topTypes[0][1] : 1

  return (
    <motion.div
      className="px-6 pt-4 pb-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── Row 1: Score Ring + Verleend/Afgewezen ────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-1.5">
        {/* Big score ring card */}
        <motion.button
          type="button"
          onClick={onSwitchToVergunningen}
          className="col-span-1 flex flex-col items-center justify-center rounded-[24px] bg-white border border-[#EAEFEF] p-5 cursor-pointer hover:shadow-md hover:border-[#DDE3E3] transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ScoreRing score={score} color={sColor} size={120} />
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 mt-2">
            Haalbaarheid
          </span>
        </motion.button>

        {/* Verleend + Afgewezen stacked */}
        <div className="col-span-1 flex flex-col gap-1.5">
          <StatCard
            icon={<CheckCircle2 size={14} strokeWidth={2} />}
            label="Verleend"
            value={profile?.approval_rate_pct != null ? `${Math.round(profile.approval_rate_pct)}%` : '—'}
            sub={profile?.sample_size ? `n=${profile.sample_size}` : undefined}
            color="#22C55E"
            onClick={onSwitchToVergunningen}
          />
          <StatCard
            icon={<ShieldAlert size={14} strokeWidth={2} />}
            label="Afgewezen"
            value={profile?.rejection_rate_pct != null ? `${Math.round(profile.rejection_rate_pct)}%` : '—'}
            color="#EF4444"
            onClick={onSwitchToVergunningen}
          />
        </div>

        {/* Doorlooptijd + Klimaat stacked */}
        <div className="col-span-1 flex flex-col gap-1.5">
          <StatCard
            icon={<Clock size={14} strokeWidth={2} />}
            label="Doorlooptijd"
            value={profile?.avg_doorlooptijd_days != null && profile.avg_doorlooptijd_days > 0 ? `${profile.avg_doorlooptijd_days}d` : '—'}
            sub="Gemiddeld"
            color="#F9A826"
            onClick={onSwitchToVergunningen}
          />
          <motion.button
            type="button"
            onClick={onSwitchToVergunningen}
            className="flex flex-col justify-between rounded-[24px] bg-white border border-[#EAEFEF] p-5 text-left cursor-pointer hover:shadow-md hover:border-[#DDE3E3] transition-all h-full"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Scale size={14} strokeWidth={2} className="text-neutral-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">Klimaat</span>
              </div>
              <ChevronRight size={14} className="text-neutral-300" />
            </div>
            {profile?.severity_label && profile.severity_label !== 'Onbekend' ? (
              <span
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold self-start"
                style={{
                  backgroundColor: '#0E1111',
                  color: SEVERITY_COLORS[profile.severity_label] ?? '#fff',
                }}
              >
                {profile.severity_label}
              </span>
            ) : (
              <span className="text-[20px] font-black text-neutral-300">—</span>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Row 2: Vergunning-DNA (type bars + activiteit) ── */}
      <motion.div variants={fadeUp} className="mt-4">
        <motion.button
          type="button"
          onClick={onSwitchToVergunningen}
          className="w-full bg-white rounded-[24px] border border-[#EAEFEF] p-5 text-left cursor-pointer hover:shadow-md hover:border-[#DDE3E3] transition-all"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
              Vergunning-DNA
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-[#0E1111] tabular-nums">
                {profile?.sample_size ?? '—'} bekendmakingen
              </span>
              <span className="flex items-center gap-1">
                {trend === 'up' && <TrendingUp size={14} className="text-[#22C55E]" />}
                {trend === 'down' && <TrendingDown size={14} className="text-[#EF4444]" />}
                {trend === 'stable' && <Minus size={14} className="text-neutral-400" />}
              </span>
              <ChevronRight size={14} className="text-neutral-300" />
            </div>
          </div>

          {topTypes.length > 0 ? (
            <div className="space-y-2">
              {topTypes.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-neutral-500 w-[140px] shrink-0 truncate">{type}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-[#F2F6F3] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[#F9A826]"
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxTypeCount) * 100}%` }}
                      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
                    />
                  </div>
                  <span className="text-[12px] font-bold text-[#0E1111] tabular-nums w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[12px] text-neutral-400">Nog geen vergunningsdata beschikbaar</span>
          )}
        </motion.button>
      </motion.div>

      {/* ── Row 3: Heritage + HVV + Subsidies (3 col) ───── */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-1.5 mt-4">
        {/* Huisvestingsverordening */}
        <motion.button
          type="button"
          onClick={onSwitchToRegelgeving}
          className="flex flex-col rounded-[24px] bg-white border border-[#EAEFEF] p-5 text-left cursor-pointer hover:shadow-md hover:border-[#DDE3E3] transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <FileText size={14} strokeWidth={2} className="text-neutral-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400">HVV</span>
          </div>
          {hvv?.heeft_verordening ? (
            <>
              <span className="inline-flex items-center rounded-full bg-[#0E1111] text-white px-2.5 py-1 text-[9px] font-bold self-start">
                ACTIEF
              </span>
              <span className="text-[10px] text-neutral-400 mt-2 line-clamp-2 leading-relaxed">{hvv.title}</span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full bg-[#F2F6F3] text-neutral-500 px-2.5 py-1 text-[9px] font-bold self-start">
                NIET ACTIEF
              </span>
              <span className="text-[10px] text-neutral-400 mt-2">Geen verordening</span>
            </>
          )}
        </motion.button>

        {/* Erfgoed */}
        <motion.button
          type="button"
          onClick={onSwitchToRegelgeving}
          className="flex flex-col rounded-[24px] bg-white border border-[#EAEFEF] p-5 text-left cursor-pointer hover:shadow-md hover:border-[#DDE3E3] transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <Landmark size={14} strokeWidth={2} className="text-neutral-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400">Erfgoed</span>
          </div>
          <span className="text-[28px] font-black text-[#0E1111] tabular-nums leading-none">
            {erfgoed?.total ?? '—'}
          </span>
          <span className="text-[10px] text-neutral-400 mt-1.5">
            {erfgoed?.total ? `beschermde gezichten` : 'Geen data'}
          </span>
        </motion.button>

        {/* Subsidies */}
        <motion.button
          type="button"
          onClick={onSwitchToRegelgeving}
          className="flex flex-col rounded-[24px] bg-white border border-[#EAEFEF] p-5 text-left cursor-pointer hover:shadow-md hover:border-[#DDE3E3] transition-all"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp size={14} strokeWidth={2} className="text-[#22C55E]" />
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400">Subsidies</span>
          </div>
          <span className="text-[28px] font-black text-[#0E1111] tabular-nums leading-none">
            {subsidies?.total ?? '—'}
          </span>
          <span className="text-[10px] text-neutral-400 mt-1.5">regelingen (NL)</span>
        </motion.button>
      </motion.div>

      {/* ── Row 4: Wijken nav ───────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-4">
        <button
          type="button"
          onClick={() => onSelectWijk('', '')}
          className="w-full flex items-center justify-between bg-[#0E1111] rounded-[18px] px-5 py-4 group hover:bg-neutral-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <MapPin size={18} className="text-[#F9A826]" />
            <div className="text-left">
              <span className="text-[14px] font-bold text-white block">{wijkCount} wijken</span>
              <span className="text-[11px] text-neutral-400">Klik om een wijk te kiezen</span>
            </div>
          </div>
          <ChevronRight size={18} className="text-neutral-500 group-hover:text-white transition-colors" />
        </button>
      </motion.div>
    </motion.div>
  )
}
