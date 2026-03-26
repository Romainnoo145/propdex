import { useState, useMemo } from 'react'
import { AMBER, GREEN, RED, OBSIDIAN, SLATE_MUTED } from '@/lib/tokens'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Clock,
  FileText,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { VerdictHero } from './VerdictHero'
import { JuridischKlimaatModal } from './JuridischKlimaatModal'
import { staggerContainer, fadeUp } from './animations'
import { useGemeenteProfile } from '@/hooks/useGemeenteProfile'
import { useGemeenteAnalysisStatus, useDoorlooptijdStats } from '@/hooks/useJurisprudence'

interface KlimaatLayerProps {
  gemeenteNaam: string
  gemeenteCode: string
}

/* ── Score + verdict derivation ────────────────────────────── */

function deriveKlimaatScore(severity: string | null, approvalRate: number | null, doorlooptijd: number | null): number | null {
  if (!severity || severity === 'Onbekend') return null
  const pts: Record<string, number> = { 'Gunstig': 40, 'Gemiddeld': 25, 'Ongunstig': 10, 'Zeer ongunstig': 0 }
  let score = pts[severity] ?? 15
  if (approvalRate != null) score += Math.round((approvalRate / 100) * 40)
  if (doorlooptijd != null) {
    if (doorlooptijd < 30) score += 20
    else if (doorlooptijd < 60) score += 15
    else if (doorlooptijd < 90) score += 10
    else if (doorlooptijd < 120) score += 5
  }
  return Math.min(100, Math.max(0, score))
}

interface Verdict { score: number | null; label: string; color: string; Icon: LucideIcon; subtitle: string }

function deriveVerdict(score: number | null): Verdict {
  if (score == null) return { score: null, label: 'ONBEKEND', color: SLATE_MUTED, Icon: ShieldQuestion, subtitle: 'Onvoldoende data beschikbaar' }
  if (score >= 70) return { score, label: 'ONTWIKKELKANSRIJK', color: GREEN, Icon: ShieldCheck, subtitle: 'Soepel klimaat · hoge goedkeuring · korte doorlooptijd' }
  if (score >= 40) return { score, label: 'GEMIDDELD KLIMAAT', color: AMBER.base, Icon: Scale, subtitle: 'Standaard vergunningstraject · let op doorlooptijd' }
  return { score, label: 'LASTIG KLIMAAT', color: RED, Icon: ShieldAlert, subtitle: 'Streng beleid · langere trajecten · meer bezwaren' }
}

function trendDirection(bek30: number, bek365: number): { label: string; color: string } {
  const monthly365 = bek365 / 12
  if (monthly365 === 0) return { label: 'Geen data', color: SLATE_MUTED }
  const ratio = bek30 / monthly365
  if (ratio > 1.3) return { label: '↑ Stijgend', color: GREEN }
  if (ratio < 0.7) return { label: '↓ Dalend', color: RED }
  return { label: '→ Stabiel', color: SLATE_MUTED }
}

/* ── Section header ────────────────────────────────────────── */

function SectionHeader({ icon, label, children }: { icon: React.ReactNode; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-black text-slate-400 uppercase" style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
      </div>
      {children}
    </div>
  )
}

/* ── Horizontal bar ────────────────────────────────────────── */

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold text-slate-500 w-[120px] truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        />
      </div>
      <span className="text-[11px] font-black text-slate-600 tabular-nums w-[36px] text-right">{value}</span>
    </div>
  )
}

/* ── Stat card (compact) ───────────────────────────────────── */

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <motion.div variants={fadeUp} className="bg-white border border-[#EAEFEF] rounded-[16px] p-4">
      <span className="text-[10px] font-black text-slate-400 uppercase block" style={{ letterSpacing: '0.15em' }}>{label}</span>
      <span className="text-[22px] font-black tracking-tighter tabular-nums leading-none mt-2 block" style={{ color: color ?? OBSIDIAN }}>{value}</span>
      {sub && <span className="text-[10px] text-slate-400 mt-1 block">{sub}</span>}
    </motion.div>
  )
}

/* ── Main component ────────────────────────────────────────── */

export function KlimaatLayer({ gemeenteNaam, gemeenteCode }: KlimaatLayerProps) {
  const { data: profile, isLoading } = useGemeenteProfile(gemeenteNaam)
  const { data: analysis } = useGemeenteAnalysisStatus(gemeenteNaam)
  const { data: doorlooptijdData } = useDoorlooptijdStats(gemeenteNaam)
  const [showModal, setShowModal] = useState(false)

  const klimaatScore = profile
    ? deriveKlimaatScore(profile.severity_label, profile.approval_rate_pct, profile.avg_doorlooptijd_days)
    : null
  const verdict = deriveVerdict(klimaatScore)

  const trend = profile
    ? trendDirection(profile.bekendmakingen_30d, profile.bekendmakingen_365d)
    : { label: 'Laden...', color: SLATE_MUTED }

  // Permit type distribution sorted
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const permitTypes = useMemo(() => {
    if (!profile?.permit_type_distribution) return []
    return Object.entries(profile.permit_type_distribution)
      .filter(([k]) => k !== 'Overig')
      .sort((a, b) => b[1] - a[1])
  }, [profile?.permit_type_distribution])

  const maxPermitCount = permitTypes.length > 0 ? permitTypes[0][1] : 1

  // Doorlooptijd per type
  const doorlooptijdTypes = useMemo(() => {
    if (!doorlooptijdData) return []
    return Object.values(doorlooptijdData)
      .filter((d) => d.avg_dagen != null && !d.insufficient_data)
      .sort((a, b) => (b.avg_dagen ?? 0) - (a.avg_dagen ?? 0))
      .slice(0, 5)
  }, [doorlooptijdData])

  const maxDoorlooptijd = doorlooptijdTypes.length > 0 ? Math.max(...doorlooptijdTypes.map(d => d.avg_dagen ?? 0)) : 1

  // Ruling count
  const rulingCount = analysis?.total_count ?? 0
  const succeskans = analysis?.vergunnings_succeskans ?? null

  return (
    <>
      <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
        <VerdictHero
          score={isLoading ? null : verdict.score}
          label={isLoading ? 'LADEN...' : verdict.label}
          subtitle={isLoading ? 'Vergunningdata ophalen...' : verdict.subtitle}
          color={verdict.color}
          icon={<verdict.Icon className="size-6 text-white" strokeWidth={2.5} />}
        />

        {/* ── Key metrics row ────────────────────────── */}
        <motion.div className="mt-6 grid grid-cols-3 gap-1.5" variants={staggerContainer} initial="hidden" animate="show">
          <StatCard
            label="Goedgekeurd"
            value={profile?.approval_rate_pct != null ? `${Math.round(profile.approval_rate_pct)}%` : '—'}
            sub={profile?.sample_size ? `n=${profile.sample_size}` : undefined}
            color={profile?.approval_rate_pct != null ? (profile.approval_rate_pct >= 80 ? GREEN : profile.approval_rate_pct >= 50 ? AMBER.base : RED) : undefined}
          />
          <StatCard
            label="Doorlooptijd"
            value={profile?.avg_doorlooptijd_days != null ? `~${profile.avg_doorlooptijd_days}d` : '—'}
            sub="gem. afhandeling"
            color={profile?.avg_doorlooptijd_days != null ? (profile.avg_doorlooptijd_days <= 30 ? GREEN : profile.avg_doorlooptijd_days <= 90 ? AMBER.base : RED) : undefined}
          />
          <StatCard
            label="Trend"
            value={trend.label}
            sub={`${profile?.bekendmakingen_30d ?? 0} / 30d`}
            color={trend.color}
          />
        </motion.div>

        {/* ── Permit type verdeling ───────────────────── */}
        {permitTypes.length > 0 && (
          <motion.div className="mt-6" variants={staggerContainer} initial="hidden" animate="show">
            <SectionHeader icon={<FileText size={14} className="text-slate-400" />} label="Verdeling per type">
              <span className="text-[9px] text-slate-300 tabular-nums">{profile?.bekendmakingen_365d ?? 0} / 12m</span>
            </SectionHeader>
            <div className="space-y-2.5 bg-white border border-[#EAEFEF] rounded-[16px] p-4">
              {permitTypes.map(([type, count]) => (
                <HBar key={type} label={type} value={count} max={maxPermitCount} color="#F9A826" />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Doorlooptijd per type ──────────────────── */}
        {doorlooptijdTypes.length > 0 && (
          <motion.div className="mt-6" variants={staggerContainer} initial="hidden" animate="show">
            <SectionHeader icon={<Clock size={14} className="text-slate-400" />} label="Doorlooptijd per type" />
            <div className="space-y-2.5 bg-white border border-[#EAEFEF] rounded-[16px] p-4">
              {doorlooptijdTypes.map((d) => (
                <HBar
                  key={d.vergunningstype}
                  label={d.vergunningstype}
                  value={Math.round(d.avg_dagen ?? 0)}
                  max={maxDoorlooptijd}
                  color={d.avg_dagen != null ? (d.avg_dagen <= 30 ? GREEN : d.avg_dagen <= 90 ? AMBER.base : RED) : SLATE_MUTED}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Jurisprudentie link ────────────────────── */}
        <motion.div className="mt-6" variants={staggerContainer} initial="hidden" animate="show">
          <SectionHeader icon={<Scale size={14} className="text-slate-400" />} label="Jurisprudentie">
            {rulingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 tabular-nums">{rulingCount}</span>
            )}
          </SectionHeader>

          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => setShowModal(true)}
            className="w-full rounded-[16px] p-4 border border-[#EAEFEF] bg-white text-left transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[14px] font-bold text-[#0E1111]">
                  {rulingCount > 0 ? `${rulingCount} rechtszaken geanalyseerd` : 'Rechtszaken bekijken'}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {succeskans != null
                    ? `Winkans bezwaar: ${Math.round(succeskans)}%`
                    : 'AI-analyse van jurisprudentie in deze gemeente'
                  }
                </p>
              </div>
              <ExternalLink size={14} className="text-slate-300 shrink-0" />
            </div>
          </motion.button>
        </motion.div>

        {/* ── Trust metadata ──────────────────────────── */}
        <motion.div variants={fadeUp} className="mt-6 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider text-slate-300">
            Bron: KOOP · Rechtspraak.nl · Claude AI
          </span>
          <span className="text-[9px] uppercase tracking-wider text-slate-300">
            {profile?.data_coverage ?? '—'} dekking
          </span>
        </motion.div>
      </div>

      {/* Juridisch klimaat modal */}
      <AnimatePresence>
        {showModal && (
          <JuridischKlimaatModal
            gemeenteNaam={gemeenteNaam}
            gemeenteCode={gemeenteCode}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
