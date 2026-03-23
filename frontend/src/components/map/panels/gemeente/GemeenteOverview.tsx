import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react'
import { useGemeenteProfile, SEVERITY_COLORS } from '@/hooks/useGemeenteProfile'
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { useErfgoed } from '@/hooks/useErfgoed'

interface GemeenteOverviewProps {
  naam: string
  code: string
  gemeenteCode: string
  wijkCount: number
  onSelectWijk: (code: string, naam: string) => void
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

/* ── Haalbaarheid score derivation ─────────────────────────── */

function deriveHaalbaarheidScore(
  approvalRate: number | null,
  doorlooptijd: number | null,
): number | null {
  if (approvalRate == null) return null
  // Approval contributes 60%, doorlooptijd 40%
  let score = Math.round(approvalRate * 0.6)
  if (doorlooptijd != null) {
    // <30d = 40pts, 30-60 = 30, 60-90 = 20, 90-120 = 10, >120 = 0
    const dPts = doorlooptijd < 30 ? 40 : doorlooptijd < 60 ? 30 : doorlooptijd < 90 ? 20 : doorlooptijd < 120 ? 10 : 0
    score += dPts
  }
  return Math.min(100, Math.max(0, score))
}

function scoreColor(score: number | null): string {
  if (score == null) return '#94a3b8'
  if (score >= 70) return '#22C55E'
  if (score >= 40) return '#F9A826'
  return '#EF4444'
}

/* ── Trend helper ──────────────────────────────────────────── */

function trendDirection(bek30: number, bek365: number): 'up' | 'down' | 'stable' {
  const monthly30 = bek30
  const monthly365 = bek365 / 12
  if (monthly365 === 0) return 'stable'
  const ratio = monthly30 / monthly365
  if (ratio > 1.3) return 'up'
  if (ratio < 0.7) return 'down'
  return 'stable'
}

/* ── Component ─────────────────────────────────────────────── */

export function GemeenteOverview({
  naam,
  gemeenteCode,
  wijkCount,
  onSelectWijk,
}: GemeenteOverviewProps) {
  const { data: profile, isLoading } = useGemeenteProfile(naam)
  const { data: hvv } = useHuisvestingsverordening(naam)
  const { data: erfgoed } = useErfgoed(naam)

  const [wijkDropdownOpen, setWijkDropdownOpen] = useState(false)

  const haalbaarheidScore = profile
    ? deriveHaalbaarheidScore(profile.approval_rate_pct, profile.avg_doorlooptijd_days)
    : null
  const hColor = scoreColor(haalbaarheidScore)

  const trend = profile
    ? trendDirection(profile.bekendmakingen_30d, profile.bekendmakingen_365d)
    : 'stable'

  // Ring math
  const r = 48
  const circumference = 2 * Math.PI * r
  const normalised = haalbaarheidScore != null ? haalbaarheidScore / 100 : 0

  // Top permit types for bars
  const permitTypes = useMemo(() => {
    if (!profile?.permit_type_distribution) return []
    return Object.entries(profile.permit_type_distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [profile?.permit_type_distribution])

  const maxPermitCount = permitTypes.length > 0 ? permitTypes[0][1] : 1

  return (
    <motion.div
      className="px-6 pt-4 pb-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* ── 1. Hero: Gemeentelijke Haalbaarheid ──────── */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-[24px] border border-[#EAEFEF] p-6 flex gap-6"
      >
        {/* Left: Score ring */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="h-[130px] w-[130px]" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
              {haalbaarheidScore != null && (
                <motion.circle
                  cx="60" cy="60" r={r} fill="none"
                  stroke={hColor}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: circumference - normalised * circumference }}
                  transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
                />
              )}
            </svg>
            <span
              className="absolute text-[36px] font-black tracking-tighter tabular-nums leading-none"
              style={{ color: haalbaarheidScore != null ? hColor : '#cbd5e1' }}
            >
              {haalbaarheidScore != null ? haalbaarheidScore : '—'}
            </span>
          </div>
          <span
            className="mt-2 text-[10px] font-black uppercase tracking-[0.15em] text-center"
            style={{ color: '#9CA3AF' }}
          >
            Haalbaarheid
          </span>
        </div>

        {/* Right: 2×2 KPI grid */}
        <div className="flex-1 grid grid-cols-2 gap-3 min-w-0">
          {/* Doorlooptijd */}
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400 block mb-1">
              Doorlooptijd
            </span>
            <span className="text-[20px] font-black text-[#0E1111] tracking-tight tabular-nums">
              {isLoading ? '...' : profile?.avg_doorlooptijd_days != null ? `${profile.avg_doorlooptijd_days} dagen` : '—'}
            </span>
            {profile?.sample_size != null && (
              <span className="text-[11px] text-neutral-400 block mt-0.5">
                Gemiddeld (n={profile.sample_size})
              </span>
            )}
          </div>

          {/* Klimaat pill */}
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400 block mb-1">
              Klimaat
            </span>
            {profile?.severity_label && profile.severity_label !== 'Onbekend' ? (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold"
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
          </div>

          {/* Verleend */}
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400 block mb-1">
              Verleend
            </span>
            <span className="text-[20px] font-black text-[#22C55E] tabular-nums">
              {isLoading ? '...' : profile?.approval_rate_pct != null ? `${Math.round(profile.approval_rate_pct)}%` : '—'}
            </span>
          </div>

          {/* Afgewezen */}
          <div>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-neutral-400 block mb-1">
              Afgewezen
            </span>
            <span className="text-[20px] font-black text-[#EF4444] tabular-nums">
              {isLoading ? '...' : profile?.rejection_rate_pct != null ? `${Math.round(profile.rejection_rate_pct)}%` : '—'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── 2. Bekendmakingen & Vergunning-DNA ───────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-1.5 mt-4">
        {/* Kaart 1: Activiteit tegels */}
        <div className="bg-white rounded-[24px] border border-[#EAEFEF] p-5">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 block mb-3">
            Activiteit
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { label: '30D', value: profile?.bekendmakingen_30d, showTrend: true },
              { label: '90D', value: profile?.bekendmakingen_90d, showTrend: false },
              { label: '365D', value: profile?.bekendmakingen_365d, showTrend: false },
            ] as const).map((item) => (
              <div key={item.label} className="bg-[#F2F6F3] rounded-[14px] p-3 text-center">
                <span className="text-[9px] font-black uppercase text-neutral-400 block">
                  {item.label}
                </span>
                <span className="text-[18px] font-black text-[#0E1111] tabular-nums block mt-1">
                  {isLoading ? '...' : item.value ?? '—'}
                </span>
                {item.showTrend && !isLoading && (
                  <span className="flex items-center justify-center mt-1">
                    {trend === 'up' && <TrendingUp size={12} className="text-[#22C55E]" />}
                    {trend === 'down' && <TrendingDown size={12} className="text-[#EF4444]" />}
                    {trend === 'stable' && <Minus size={12} className="text-neutral-400" />}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Kaart 2: Type verdeling */}
        <div className="bg-white rounded-[24px] border border-[#EAEFEF] p-5">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 block mb-3">
            Type verdeling
          </span>
          {permitTypes.length > 0 ? (
            <div className="space-y-2.5">
              {permitTypes.map(([type, count]) => {
                const pct = (count / maxPermitCount) * 100
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-neutral-500 truncate mr-2">
                        {type}
                      </span>
                      <span className="text-[11px] font-bold text-[#0E1111] tabular-nums shrink-0">
                        {count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F2F6F3] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-[#F9A826]"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <span className="text-[12px] text-neutral-400">Geen data beschikbaar</span>
          )}
        </div>
      </motion.div>

      {/* ── 3. Heritage & Lokale Regels ──────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-1.5 mt-4">
        {/* Huisvestingsverordening */}
        <div className="bg-white rounded-[24px] border border-[#EAEFEF] p-5">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 block mb-3">
            Huisvestingsverordening
          </span>
          {hvv?.heeft_verordening ? (
            <>
              <span className="inline-flex items-center rounded-full bg-[#0E1111] text-white px-3 py-1 text-[10px] font-bold">
                ACTIEF
              </span>
              <p className="text-[12px] text-neutral-500 mt-2 leading-relaxed line-clamp-2">
                {hvv.title}
              </p>
              {hvv.url && (
                <a
                  href={hvv.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F9A826] hover:underline mt-2"
                >
                  Bekijk document
                  <ExternalLink size={10} />
                </a>
              )}
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full bg-[#F2F6F3] text-neutral-500 px-3 py-1 text-[10px] font-bold">
                NIET ACTIEF
              </span>
              <p className="text-[12px] text-neutral-400 mt-2">
                Geen actieve huisvestingsverordening.
              </p>
            </>
          )}
        </div>

        {/* Erfgoed */}
        <div className="bg-white rounded-[24px] border border-[#EAEFEF] p-5">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 block mb-3">
            Beschermde gezichten
          </span>
          <span className="text-[28px] font-black text-[#0E1111] tabular-nums block">
            {erfgoed?.total ?? '—'}
          </span>
          {erfgoed?.beschermde_gezichten && erfgoed.beschermde_gezichten.length > 0 ? (
            <div className="mt-2 space-y-1">
              {erfgoed.beschermde_gezichten.slice(0, 3).map((g) => (
                <p key={g.naam} className="text-[11px] text-neutral-500 truncate">
                  {g.naam}
                  {g.oppervlakte_ha != null && (
                    <span className="text-neutral-400"> · {g.oppervlakte_ha} ha</span>
                  )}
                </p>
              ))}
              {erfgoed.beschermde_gezichten.length > 3 && (
                <p className="text-[10px] text-neutral-400">
                  + {erfgoed.beschermde_gezichten.length - 3} meer
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400 mt-1">Geen beschermde gezichten.</p>
          )}
        </div>
      </motion.div>

      {/* ── 4. Wijken Navigatie ──────────────────────── */}
      <motion.div variants={fadeUp} className="mt-4">
        <div className="bg-[#F2F6F3] rounded-[14px] p-4 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[#0E1111]">
            {wijkCount} wijken
          </span>
          <button
            type="button"
            onClick={() => setWijkDropdownOpen(!wijkDropdownOpen)}
            className="flex items-center gap-1.5 bg-[#0E1111] text-white rounded-full px-4 py-2 text-[12px] font-bold hover:bg-neutral-800 transition-colors"
          >
            Kies een wijk
            <ChevronDown size={14} className={`transition-transform ${wijkDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
