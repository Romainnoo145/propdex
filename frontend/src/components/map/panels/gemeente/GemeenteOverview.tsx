import { useMemo } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  ChevronUp,
  ChevronDown,
  Search,
  Heart,
  Bell,
} from 'lucide-react'
import { useGemeenteProfile } from '@/hooks/useGemeenteProfile'
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { useGemeenteAnalysisStatus } from '@/hooks/useJurisprudence'
import { useRaadsinformatie } from '@/hooks/useRaadsinformatie'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { useUnreadCounts } from '@/hooks/useNotifications'

interface GemeenteOverviewProps {
  naam: string
  code: string
  gemeenteCode: string
  wijkCount: number
  stedelijkheid: string | null
  onSelectWijk: (code: string, naam: string) => void
  onSwitchToVergunningen: () => void
  onSwitchToRegelgeving: () => void
  onSwitchToBeleid: () => void
  onSwitchToActiviteit: () => void
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

/* ── Stedelijkheid image mapping ───────────────────────────── */

const STEDELIJKHEID_IMAGES: Record<string, string> = {
  'Zeer sterk stedelijk': '/images/stedelijkheid/zeer-sterk-stedelijk.jpg',
  'Sterk stedelijk': '/images/stedelijkheid/sterk-stedelijk.jpg',
  'Matig stedelijk': '/images/stedelijkheid/matig-stedelijk.jpg',
  'Weinig stedelijk': '/images/stedelijkheid/weinig-stedelijk.jpg',
  'Niet stedelijk': '/images/stedelijkheid/niet-stedelijk.jpg',
}

/* ── CardLabelBar ──────────────────────────────────────────── */

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

/* ── BekendmakingenDivider ─────────────────────────────────── */

function BekendmakingenDivider({ total, approvalPct, topTypes }: { total: number; approvalPct: number | null; topTypes: [string, number][] }) {
  return (
    <div className="w-full py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-black text-slate-400 uppercase"
          style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Vergunningen
        </span>
        <span
          className="bg-black text-white text-[10px] px-2.5 py-1 rounded-full font-black tabular-nums"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {total} totaal
        </span>
      </div>

      {/* Etched track — amber fill = approval rate */}
      <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{ left: `${(i + 1) * 10}%`, width: '1px', background: 'rgba(255,255,255,0.7)', zIndex: 2 }}
          />
        ))}
        {approvalPct != null && (
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              width: `${approvalPct}%`,
              background: '#F9A826',
              boxShadow: '0 0 8px rgba(249,168,38,0.3)',
              zIndex: 1,
            }}
          />
        )}
      </div>

      {/* Labels under track */}
      {topTypes.length > 0 && (
        <div className="flex items-center justify-between mt-2">
          {topTypes.map(([type, count]) => (
            <span
              key={type}
              className="text-[9px] font-bold tabular-nums text-slate-400"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {type} ({count})
            </span>
          ))}
        </div>
      )}
    </div>
  )
}


/* ── ScoreCircleCard ────────────────────────────────────────── */

function ScoreCircleCard({
  icon, label, score, color, suffix, onClick,
}: {
  icon: React.ReactNode; label: string; score: number | null; color: string; suffix?: string; onClick?: () => void
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
          <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.15em', color: '#94a3b8' }}>{label}</span>
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
            <motion.circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference - (normalised / 100) * circumference }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
            />
          )}
        </svg>
        <span className="absolute text-5xl font-black tracking-tighter tabular-nums leading-none" style={{ color: score !== null ? color : '#cbd5e1' }}>
          {score !== null ? `${Math.round(score)}${suffix ?? ''}` : '—'}
        </span>
      </div>
      <div />
    </motion.div>
  )
}

/* ── SecondaryField ────────────────────────────────────────── */

function SecondaryField({ value, onClick }: { value: string; onClick?: () => void }) {
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

/* ── Main Component ────────────────────────────────────────── */

export function GemeenteOverview({
  naam,
  stedelijkheid,
  wijkCount,
  onSelectWijk,
  onSwitchToVergunningen,
  onSwitchToRegelgeving,
  onSwitchToBeleid,
  onSwitchToActiviteit,
}: GemeenteOverviewProps) {
  const { data: profile } = useGemeenteProfile(naam)
  const { data: hvv } = useHuisvestingsverordening(naam)
  const { data: analysis } = useGemeenteAnalysisStatus(naam)
  const { data: raadsData } = useRaadsinformatie(naam)
  const { data: favorites } = useParcelFavorites()
  const { data: unreadData } = useUnreadCounts()

  const succeskans = analysis?.vergunnings_succeskans ?? null
  const approvalPct = profile?.approval_rate_pct ?? null
  const doorlooptijd = profile?.avg_doorlooptijd_days ?? null

  // Unread notifications (total across all projects)
  const totalUnread = unreadData?.total_unread ?? 0

  // Favorieten in deze gemeente
  const favCount = useMemo(() => {
    if (!favorites) return 0
    return favorites.filter((f) => f.gemeente_naam?.toLowerCase() === naam.toLowerCase()).length
  }, [favorites, naam])

  // Top types excluding Overig + Vergunningbesluit
  const topTypes = useMemo(() => {
    if (!profile?.permit_type_distribution) return []
    return Object.entries(profile.permit_type_distribution)
      .filter(([k]) => k !== 'Overig' && k !== 'Vergunningbesluit')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [profile?.permit_type_distribution])

  const stedelijkheidImage = stedelijkheid ? (STEDELIJKHEID_IMAGES[stedelijkheid] ?? STEDELIJKHEID_IMAGES['Matig stedelijk']) : STEDELIJKHEID_IMAGES['Matig stedelijk']

  return (
    <motion.div
      className="flex-1 flex flex-col px-8 pb-8"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── 3 Bento Cards ────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1.5 mt-6">
        {/* Card 1: Stedelijkheid foto — ACTIVE STATE (amber border) */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col rounded-[20px] overflow-hidden border-2 border-[#F9A826]"
        >
          <div className="relative aspect-[5/6] overflow-hidden">
            <img
              src={stedelijkheidImage}
              alt={stedelijkheid ?? 'Stedelijkheid'}
              className="h-full w-full object-cover"
            />
          </div>
          <CardLabelBar label={stedelijkheid ?? 'Onbekend'} isActive />
        </motion.div>

        {/* Card 2: Meldingen — ongelezen bekendmakingen (animated count) */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={onSwitchToActiviteit}
          className="group flex flex-col rounded-[20px] overflow-hidden border-2 border-transparent transition-all duration-200 hover:border-[#EAEFEF]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="aspect-[5/6] flex flex-col items-center justify-center bg-[#F8FAF9] gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.3 }}
            >
              <Bell size={28} className="text-[#F9A826]" />
            </motion.div>
            <motion.span
              className="text-[42px] font-black tracking-tighter tabular-nums leading-none"
              style={{ color: totalUnread > 0 ? '#0E1111' : '#cbd5e1' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              {totalUnread > 0 ? totalUnread : '—'}
            </motion.span>
            {totalUnread > 0 && (
              <motion.span
                className="text-[10px] font-bold text-[#F9A826]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                ongelezen
              </motion.span>
            )}
          </div>
          <CardLabelBar label="Meldingen" isActive={false} />
        </motion.button>

        {/* Card 3: Favorieten — link naar percelen in deze gemeente */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={onSwitchToActiviteit}
          className="group flex flex-col rounded-[20px] overflow-hidden border-2 border-transparent transition-all duration-200 hover:border-[#EAEFEF]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="aspect-[5/6] flex flex-col items-center justify-center bg-[#F8FAF9] gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.4 }}
            >
              <Heart size={40} fill="#EF4444" className="text-[#EF4444]" />
            </motion.div>
            {favCount > 0 && (
              <span className="text-[16px] font-black tabular-nums text-[#0E1111]">
                {favCount}
              </span>
            )}
          </div>
          <CardLabelBar label={`Favorieten${favCount > 0 ? ` (${favCount})` : ''}`} isActive={false} />
        </motion.button>
      </div>

      {/* ── Bekendmakingen divider ────────────────────── */}
      <motion.div variants={fadeUp} className="mt-2">
        <BekendmakingenDivider
          total={profile?.sample_size ?? 0}
          approvalPct={approvalPct}
          topTypes={topTypes}
        />
      </motion.div>

      {/* ── Bottom row: 3 stat cards ────────────────── */}
      <div className="mt-2 flex-1 grid grid-cols-3 gap-1.5">
        {/* Raadsstukken — animated count card */}
        <motion.div
          variants={fadeUp}
          role="button"
          tabIndex={0}
          onClick={onSwitchToBeleid}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSwitchToBeleid() }}
          className="flex flex-col justify-between h-full rounded-[24px] bg-white border border-[#EAEFEF] p-5 cursor-pointer transition-shadow hover:shadow-sm"
        >
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
            <span className="text-[11px] font-extrabold uppercase text-slate-400" style={{ letterSpacing: '0.15em' }}>Raadsstukken</span>
          </div>
          <div className="flex items-center justify-center flex-1">
            <motion.span
              className="text-5xl font-black tracking-tighter tabular-nums leading-none"
              style={{ color: raadsData?.total_found ? '#0E1111' : '#cbd5e1' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              {raadsData?.total_found ?? '—'}
            </motion.span>
          </div>
          {raadsData?.dekking === false && (
            <span className="text-[10px] font-bold text-slate-400 text-center">Niet bij ORI</span>
          )}
          {raadsData?.dekking && raadsData.total_found > 0 && (
            <span className="text-[10px] font-bold text-slate-400 text-center">stukken gevonden</span>
          )}
          <div />
        </motion.div>

        {/* Winkans bezwaar — cirkel (is een percentage) */}
        <ScoreCircleCard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
          label="Winkans bezwaar"
          score={succeskans != null ? Math.round(succeskans) : null}
          color={succeskans != null ? (succeskans >= 60 ? '#22C55E' : succeskans >= 30 ? '#F9A826' : '#EF4444') : '#94a3b8'}
          suffix="%"
          onClick={onSwitchToVergunningen}
        />

        {/* Doorlooptijd — animated dagen card */}
        <motion.div
          variants={fadeUp}
          role="button"
          tabIndex={0}
          onClick={onSwitchToVergunningen}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSwitchToVergunningen() }}
          className="flex flex-col justify-between h-full rounded-[24px] bg-white border border-[#EAEFEF] p-5 cursor-pointer transition-shadow hover:shadow-sm"
        >
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={doorlooptijd != null ? (doorlooptijd <= 30 ? '#22C55E' : doorlooptijd <= 90 ? '#F9A826' : '#EF4444') : '#94a3b8'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="text-[11px] font-extrabold uppercase text-slate-400" style={{ letterSpacing: '0.15em' }}>Doorlooptijd</span>
          </div>
          <div className="flex flex-col items-center justify-center flex-1 gap-1">
            <motion.span
              className="text-5xl font-black tracking-tighter tabular-nums leading-none"
              style={{ color: doorlooptijd != null ? '#0E1111' : '#cbd5e1' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.5 }}
            >
              {doorlooptijd != null ? `~${doorlooptijd}` : '—'}
            </motion.span>
            {doorlooptijd != null && (
              <motion.span
                className="text-[12px] font-bold"
                style={{ color: doorlooptijd <= 30 ? '#22C55E' : doorlooptijd <= 90 ? '#F9A826' : '#EF4444' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                dagen
              </motion.span>
            )}
          </div>
          <div />
        </motion.div>
      </div>

      {/* ── Secondary Fields ─────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-4 grid grid-cols-2 gap-1.5">
        <SecondaryField
          value={hvv?.heeft_verordening ? 'Splitsingsverordening actief' : 'Geen splitsingsverordening'}
          onClick={onSwitchToRegelgeving}
        />
        <SecondaryField
          value={`${wijkCount} wijken`}
          onClick={() => onSelectWijk('', '')}
        />
      </motion.div>

      {/* ── Trust Metadata ───────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-4 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          Bron: KOOP · Rechtspraak · ORI
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          {profile?.data_coverage ?? '—'} dekking
        </span>
      </motion.div>
    </motion.div>
  )
}
