import { useMemo, useState } from 'react'
import { AMBER, GREEN, RED, OBSIDIAN, SLATE_MUTED } from '@/lib/tokens'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Banknote,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Newspaper,
  BookOpen,
  ShieldCheck,
  ShieldQuestion,
  type LucideIcon,
} from 'lucide-react'
import { VerdictHero } from './VerdictHero'
import { staggerContainer, fadeUp } from './animations'
import { useRaadsinformatie, type RaadsstukResponse } from '@/hooks/useRaadsinformatie'
import { useSubsidies, type SubsidieResponse } from '@/hooks/useSubsidies'

interface BeleidNieuwsLayerProps {
  gemeenteNaam: string
}

/* ── Verdict ───────────────────────────────────────────────── */

interface BeleidVerdict {
  score: number | null
  label: string
  color: string
  Icon: LucideIcon
  subtitle: string
}

function deriveVerdict(
  raadsDekking: boolean | null,
  raadsCount: number,
  subsidieCount: number,
): BeleidVerdict {
  let score = 0
  let signals = 0

  if (raadsDekking === true) { score += 35; signals++ }
  if (raadsCount > 0) score += Math.min(25, raadsCount * 3)
  if (subsidieCount > 0) { score += 20; signals++ }

  score += signals * 10
  score = Math.min(100, score)

  if (signals === 0) {
    return {
      score: null,
      label: 'GEEN DATA',
      color: SLATE_MUTED,
      Icon: ShieldQuestion,
      subtitle: 'Beleidsinformatie niet beschikbaar',
    }
  }
  if (score >= 50) {
    return {
      score,
      label: 'GOED INZICHT',
      color: AMBER.base,
      Icon: ShieldCheck,
      subtitle: 'Raadsinformatie en subsidies beschikbaar',
    }
  }
  return {
    score,
    label: 'BEPERKT INZICHT',
    color: AMBER.base,
    Icon: BookOpen,
    subtitle: 'Gedeeltelijke beleidsinformatie',
  }
}

/* ── Raadsstuk type badge ──────────────────────────────────── */

const TYPE_COLORS: Record<string, string> = {
  motie: AMBER.base,
  raadsbrief: OBSIDIAN,
  besluit: AMBER.base,
  amendement: AMBER.base,
  initiatiefvoorstel: OBSIDIAN,
}

function typeBadgeColor(type: string | null): string {
  if (!type) return SLATE_MUTED
  const lower = type.toLowerCase()
  for (const [key, color] of Object.entries(TYPE_COLORS)) {
    if (lower.includes(key)) return color
  }
  return SLATE_MUTED
}

/* ── Section header ────────────────────────────────────────── */

function SectionHeader({ icon, label, count, children }: {
  icon: React.ReactNode
  label: string
  count?: number
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <span
          className="text-[10px] font-black text-slate-400 uppercase"
          style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {label}
        </span>
        {count != null && count > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 tabular-nums">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/* ── Raadsstuk card ────────────────────────────────────────── */

function RaadsstukCard({ stuk }: { stuk: RaadsstukResponse }) {
  const color = typeBadgeColor(stuk.type)
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      variants={fadeUp}
      className="bg-white border border-[#EAEFEF] rounded-[16px] p-4 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Type badge + date */}
          <div className="flex items-center gap-2 mb-1.5">
            {stuk.type && (
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase"
                style={{ color, backgroundColor: `${color}15` }}
              >
                {stuk.type}
              </span>
            )}
            {stuk.datum && (
              <span className="text-[10px] text-slate-400 tabular-nums">
                {new Date(stuk.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-[13px] font-bold text-[#0E1111] leading-snug line-clamp-2">
            {stuk.titel}
          </h4>
        </div>

        {/* External link */}
        {stuk.bron_url && (
          <a
            href={stuk.bron_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-7 w-7 rounded-full bg-[#F2F6F3] text-slate-400 hover:text-[#F9A826] transition-colors shrink-0"
            aria-label="Open bron"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Expandable summary */}
      {stuk.samenvatting && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Minder' : 'Samenvatting'}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[12px] text-slate-500 leading-relaxed mt-2 overflow-hidden"
              >
                {stuk.samenvatting}
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}

/* ── Subsidie card ─────────────────────────────────────────── */

function SubsidieCard({ subsidie }: { subsidie: SubsidieResponse }) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-white border border-[#EAEFEF] rounded-[16px] p-4 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-bold text-[#0E1111] leading-snug line-clamp-2">
            {subsidie.title}
          </h4>
          {subsidie.intro && (
            <p className="text-[11px] text-slate-500 leading-relaxed mt-1 line-clamp-2">
              {subsidie.intro}
            </p>
          )}

          {/* Sector/target tags */}
          {(subsidie.sectors.length > 0 || subsidie.targets.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {subsidie.sectors.slice(0, 2).map((s) => (
                <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-slate-400 bg-slate-50">
                  {s}
                </span>
              ))}
              {subsidie.targets.slice(0, 2).map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-[#F9A826] bg-[#F9A826]/10">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {subsidie.url && (
          <a
            href={subsidie.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-7 w-7 rounded-full bg-[#F2F6F3] text-slate-400 hover:text-[#F9A826] transition-colors shrink-0"
            aria-label="Meer info"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </motion.div>
  )
}

/* ── No ORI coverage state ─────────────────────────────────── */

function NoOriCoverage() {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-[#F8FAF9] border border-dashed border-[#EAEFEF] rounded-[16px] p-5 text-center"
    >
      <Newspaper size={24} className="text-slate-300 mx-auto mb-2" />
      <p className="text-[13px] font-semibold text-slate-500">
        Niet aangesloten bij ORI
      </p>
      <p className="text-[11px] text-slate-400 mt-1">
        Deze gemeente publiceert geen raadsinformatie via Open Raadsinformatie.
      </p>
    </motion.div>
  )
}

/* ── Main component ────────────────────────────────────────── */

export function BeleidNieuwsLayer({ gemeenteNaam }: BeleidNieuwsLayerProps) {
  const { data: raadsData, isLoading: raadsLoading } = useRaadsinformatie(gemeenteNaam)
  const { data: subsidieData, isLoading: subsidieLoading } = useSubsidies()
  const [showAllRaads, setShowAllRaads] = useState(false)
  const [showAllSubsidies, setShowAllSubsidies] = useState(false)

  const isLoading = raadsLoading || subsidieLoading

  const verdict = deriveVerdict(
    raadsData?.dekking ?? null,
    raadsData?.total_found ?? 0,
    subsidieData?.total ?? 0,
  )

  // Sort raadsstukken by date descending
  const sortedStukken = useMemo(() => {
    if (!raadsData?.stukken) return []
    return [...raadsData.stukken].sort((a, b) => {
      if (!a.datum && !b.datum) return 0
      if (!a.datum) return 1
      if (!b.datum) return -1
      return b.datum.localeCompare(a.datum)
    })
  }, [raadsData?.stukken])

  const visibleStukken = showAllRaads ? sortedStukken : sortedStukken.slice(0, 5)
  const visibleSubsidies = showAllSubsidies
    ? (subsidieData?.subsidies ?? [])
    : (subsidieData?.subsidies ?? []).slice(0, 4)

  // Raadsstuk type summary
  const typeSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sortedStukken) {
      const t = s.type ?? 'Overig'
      counts[t] = (counts[t] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [sortedStukken])

  return (
    <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
      <VerdictHero
        score={isLoading ? null : verdict.score}
        label={isLoading ? 'LADEN...' : verdict.label}
        subtitle={isLoading ? 'Beleidsinformatie ophalen...' : verdict.subtitle}
        color={verdict.color}
        icon={<verdict.Icon className="size-6 text-white" strokeWidth={2.5} />}
      />

      {/* ── Raadsinformatie ──────────────────────────── */}
      <motion.div
        className="mt-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <SectionHeader
          icon={<FileText size={14} className="text-slate-400" />}
          label="Raadsinformatie"
          count={raadsData?.total_found}
        >
          {raadsData?.dekking && (
            <span className="px-2 py-0.5 rounded-full bg-green-50 text-[9px] font-black text-green-600 uppercase">
              ORI
            </span>
          )}
        </SectionHeader>

        {/* Type summary pills */}
        {typeSummary.length > 0 && (
          <motion.div variants={fadeUp} className="flex flex-wrap gap-1.5 mb-3">
            {typeSummary.map(([type, count]) => {
              const color = typeBadgeColor(type)
              return (
                <span
                  key={type}
                  className="px-2 py-1 rounded-full text-[10px] font-bold tabular-nums"
                  style={{ color, backgroundColor: `${color}10` }}
                >
                  {type} ({count})
                </span>
              )
            })}
          </motion.div>
        )}

        {raadsData?.dekking === false && <NoOriCoverage />}

        {raadsData?.dekking && sortedStukken.length === 0 && (
          <motion.div variants={fadeUp} className="text-[12px] text-slate-400 text-center py-4">
            Geen relevante raadsstukken gevonden.
          </motion.div>
        )}

        <div className="space-y-1.5">
          {visibleStukken.map((stuk) => (
            <RaadsstukCard key={stuk.doc_id} stuk={stuk} />
          ))}
        </div>

        {sortedStukken.length > 5 && (
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => setShowAllRaads(!showAllRaads)}
            className="w-full mt-2 py-2 text-[11px] font-bold text-slate-400 hover:text-[#0E1111] transition-colors"
          >
            {showAllRaads ? 'Minder tonen' : `Alle ${sortedStukken.length} stukken tonen`}
          </motion.button>
        )}
      </motion.div>

      {/* ── Subsidies ────────────────────────────────── */}
      <motion.div
        className="mt-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <SectionHeader
          icon={<Banknote size={14} className="text-slate-400" />}
          label="Subsidies (landelijk)"
          count={subsidieData?.total}
        >
          <span className="px-2 py-0.5 rounded-full bg-slate-50 text-[9px] font-black text-slate-400 uppercase">
            RVO
          </span>
        </SectionHeader>

        <div className="space-y-1.5">
          {visibleSubsidies.map((subsidie) => (
            <SubsidieCard key={subsidie.id} subsidie={subsidie} />
          ))}
        </div>

        {(subsidieData?.subsidies?.length ?? 0) > 4 && (
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => setShowAllSubsidies(!showAllSubsidies)}
            className="w-full mt-2 py-2 text-[11px] font-bold text-slate-400 hover:text-[#0E1111] transition-colors"
          >
            {showAllSubsidies ? 'Minder tonen' : `Alle ${subsidieData?.subsidies?.length ?? 0} regelingen tonen`}
          </motion.button>
        )}
      </motion.div>

      {/* ── Trust metadata ───────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-6 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          Bron: ORI · RVO
        </span>
      </motion.div>
    </div>
  )
}
