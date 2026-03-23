import { useMemo } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  ChevronUp,
  ChevronDown,
  Search,
  Heart,
} from 'lucide-react'
import { useGemeenteProfile } from '@/hooks/useGemeenteProfile'
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { useSubsidies } from '@/hooks/useSubsidies'
import { useGemeenteAnalysisStatus } from '@/hooks/useJurisprudence'
import { useParcelFavorites } from '@/hooks/useFavorites'

interface GemeenteOverviewProps {
  naam: string
  code: string
  gemeenteCode: string
  wijkCount: number
  stedelijkheid: string | null
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

/* ── Stedelijkheid image mapping ───────────────────────────── */

const STEDELIJKHEID_IMAGES: Record<string, string> = {
  'Zeer sterk stedelijk': '/images/stedelijkheid/zeer-sterk-stedelijk.svg',
  'Sterk stedelijk': '/images/stedelijkheid/sterk-stedelijk.svg',
  'Matig stedelijk': '/images/stedelijkheid/matig-stedelijk.svg',
  'Weinig stedelijk': '/images/stedelijkheid/weinig-stedelijk.svg',
  'Niet stedelijk': '/images/stedelijkheid/niet-stedelijk.svg',
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

function BekendmakingenDivider({ total, topTypes }: { total: number; topTypes: [string, number][] }) {
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

      {/* Slick type legenda — small dots + labels */}
      {topTypes.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-2">
          {topTypes.map(([type, count], i) => {
            const opacity = 0.4 + (1 - i / topTypes.length) * 0.6
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#F9A826', opacity }}
                />
                <span className="text-[9px] text-neutral-400 font-medium">{type}</span>
                <span className="text-[9px] font-bold text-neutral-500 tabular-nums">{count}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── WinkansCard (BeschikbaarCard stijl) ───────────────────── */

function WinkansCard({ percentage, onClick }: { percentage: number | null; onClick?: () => void }) {
  const hasData = percentage != null
  const color = hasData ? (percentage >= 60 ? '#22C55E' : percentage >= 30 ? '#F9A826' : '#EF4444') : '#94a3b8'
  const highlight = hasData && percentage < 30

  return (
    <motion.div
      variants={fadeUp}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      className={`flex flex-col justify-between h-full rounded-[24px] p-5 transition-colors duration-200 hover:shadow-sm${onClick ? ' cursor-pointer' : ''}`}
      style={{
        background: highlight ? 'rgba(239, 68, 68, 0.06)' : '#FFFFFF',
        border: highlight ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid #EAEFEF',
      }}
    >
      {/* Top: label + chevrons */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </span>
          <span className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.15em', color }}>
            Winkans
          </span>
        </div>
        <div className="flex flex-col -space-y-1 text-slate-200">
          <ChevronUp size={14} strokeWidth={2} />
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      {/* Middle: big number */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-5xl font-black tracking-tighter tabular-nums leading-none"
          style={{ color: hasData ? color : '#cbd5e1' }}
        >
          {hasData ? percentage : '—'}
        </span>
      </div>

      {/* Bottom: percentage label */}
      {hasData && (
        <span
          className="text-[10px] font-bold uppercase block text-center"
          style={{ color: `${color}99` }}
        >
          % winkans bezwaar
        </span>
      )}
      {!hasData && <div />}
    </motion.div>
  )
}

/* ── Placeholder card for empty slots ──────────────────────── */

function PlaceholderCard() {
  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col justify-between h-full rounded-[24px] bg-white border border-[#EAEFEF] border-dashed p-5"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-extrabold uppercase text-neutral-300" style={{ letterSpacing: '0.15em' }}>
          Binnenkort
        </span>
      </div>
      <div className="flex-1" />
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
}: GemeenteOverviewProps) {
  const { data: profile, isLoading } = useGemeenteProfile(naam)
  const { data: hvv } = useHuisvestingsverordening(naam)
  const { data: subsidies } = useSubsidies()
  const { data: analysis } = useGemeenteAnalysisStatus(naam)
  const { data: favorites } = useParcelFavorites()

  const succeskans = analysis?.vergunnings_succeskans ?? null

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
        {/* Card 1: Stedelijkheid foto */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col rounded-[20px] overflow-hidden border-2 border-transparent"
        >
          <div className="relative aspect-[5/6] overflow-hidden">
            <img
              src={stedelijkheidImage}
              alt={stedelijkheid ?? 'Stedelijkheid'}
              className="h-full w-full object-cover"
            />
          </div>
          <CardLabelBar label={stedelijkheid ?? 'Onbekend'} isActive={false} />
        </motion.div>

        {/* Card 2: Favorieten */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={onSwitchToRegelgeving}
          className="group flex flex-col rounded-[20px] overflow-hidden border-2 border-transparent transition-all duration-200 hover:border-[#EAEFEF]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="aspect-[5/6] flex flex-col items-center justify-center bg-[#F8FAF9]">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.4 }}
            >
              <Heart size={48} fill="#EF4444" className="text-[#EF4444]" />
            </motion.div>
          </div>
          <CardLabelBar label={`Favorieten${favCount > 0 ? ` (${favCount})` : ''}`} isActive={false} />
        </motion.button>

        {/* Card 3: Subsidies */}
        <motion.button
          variants={fadeUp}
          type="button"
          onClick={onSwitchToRegelgeving}
          className="group flex flex-col rounded-[20px] overflow-hidden border-2 border-[#F9A826] transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="aspect-[5/6] flex flex-col items-center justify-center bg-[#F8FAF9]">
            <span className="text-[48px] font-black tracking-tighter tabular-nums leading-none text-[#0E1111]">
              {subsidies?.total ?? '—'}
            </span>
          </div>
          <CardLabelBar label="Subsidies" isActive />
        </motion.button>
      </div>

      {/* ── Bekendmakingen divider ────────────────────── */}
      <motion.div variants={fadeUp} className="mt-2">
        <BekendmakingenDivider
          total={profile?.sample_size ?? 0}
          topTypes={topTypes}
        />
      </motion.div>

      {/* ── 3 Circle Cards ───────────────────────────── */}
      <div className="mt-2 flex-1 grid grid-cols-3 gap-1.5">
        <PlaceholderCard />
        <PlaceholderCard />
        <WinkansCard
          percentage={succeskans != null ? Math.round(succeskans) : null}
          onClick={onSwitchToVergunningen}
        />
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
          Bron: KOOP · Rechtspraak · RCE · RVO
        </span>
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          {profile?.data_coverage ?? '—'} dekking
        </span>
      </motion.div>
    </motion.div>
  )
}
