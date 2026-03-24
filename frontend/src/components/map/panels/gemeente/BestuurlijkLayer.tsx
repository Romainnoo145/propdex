import { useMemo } from 'react'
import { AMBER, GREEN, RED, OBSIDIAN, SLATE_MUTED } from '@/lib/tokens'
import {
  ScrollText,
  Landmark,
  BookOpen,
  ShieldCheck,
  ShieldQuestion,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { VerdictHero } from './VerdictHero'
import { staggerContainer, fadeUp } from './animations'
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { useErfgoed, type BeschermdGezichtResponse } from '@/hooks/useErfgoed'

interface BestuurlijkLayerProps {
  gemeenteNaam: string
}

/* ── Verdict derivation ────────────────────────────────────── */

interface RegelgevingVerdict {
  score: number | null
  label: string
  color: string
  Icon: LucideIcon
  subtitle: string
}

function deriveVerdict(
  heeftHvv: boolean | null,
  erfgoedCount: number,
): RegelgevingVerdict {
  let score = 0
  let dataPoints = 0

  // HVV is a dealbreaker — high weight
  if (heeftHvv != null) {
    dataPoints++
    score += 30
    if (heeftHvv) score += 20 // verordening present = more regulatory complexity = higher score
  }

  // Erfgoed presence
  if (erfgoedCount > 0) {
    dataPoints++
    score += Math.min(30, 15 + erfgoedCount * 5) // more gezichten = more complexity
  }

  score += dataPoints * 10
  score = Math.min(100, score)

  if (dataPoints === 0) {
    return {
      score: null,
      label: 'GEEN DATA',
      color: SLATE_MUTED,
      Icon: ShieldQuestion,
      subtitle: 'Regelgeving-informatie wordt opgehaald',
    }
  }

  // For regelgeving, higher score = more regulations present = more to watch out for
  if (heeftHvv && erfgoedCount > 0) {
    return {
      score,
      label: 'EXTRA REGELGEVING',
      color: AMBER.base,
      Icon: ScrollText,
      subtitle: 'Splitsingsverordening en erfgoed aanwezig — let op extra eisen',
    }
  }
  if (heeftHvv) {
    return {
      score,
      label: 'SPLITSINGSVERORDENING',
      color: AMBER.base,
      Icon: ScrollText,
      subtitle: 'Regels voor woningsplitsing en kamerverhuur actief',
    }
  }
  if (erfgoedCount > 0) {
    return {
      score,
      label: 'ERFGOED AANWEZIG',
      color: AMBER.base,
      Icon: Landmark,
      subtitle: `${erfgoedCount} beschermd${erfgoedCount > 1 ? 'e' : ''} gezicht${erfgoedCount > 1 ? 'en' : ''} — strengere welstandseisen`,
    }
  }
  return {
    score,
    label: 'STANDAARD KADER',
    color: AMBER.base,
    Icon: ShieldCheck,
    subtitle: 'Geen extra verordeningen — standaard vergunningstraject',
  }
}

/* ── Section header ────────────────────────────────────────── */

function SectionHeader({ icon, label, children }: {
  icon: React.ReactNode
  label: string
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
      </div>
      {children}
    </div>
  )
}

/* ── HVV card ──────────────────────────────────────────────── */

function HvvCard({ heeftVerordening, title, url }: {
  heeftVerordening: boolean
  title: string | null
  url: string | null
}) {
  const active = heeftVerordening

  return (
    <motion.div
      variants={fadeUp}
      className="rounded-[16px] p-5 border transition-shadow"
      style={{
        background: active ? 'rgba(249, 168, 38, 0.04)' : 'white',
        borderColor: active ? 'rgba(249, 168, 38, 0.25)' : '#EAEFEF',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
              style={{
                color: active ? AMBER.base : SLATE_MUTED,
                backgroundColor: active ? 'rgba(249, 168, 38, 0.1)' : '#f8fafc',
              }}
            >
              {active ? 'ACTIEF' : 'NIET AANWEZIG'}
            </span>
          </div>

          <h4 className="text-[14px] font-bold text-[#0E1111] leading-snug">
            Huisvestingsverordening
          </h4>
          <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
            {active
              ? 'Regels voor woningsplitsing, kamerverhuur en onttrekking aan de woningvoorraad.'
              : 'Geen huisvestingsverordening — splitsing en kamerverhuur volgen standaard regels.'}
          </p>

          {title && (
            <p className="text-[11px] font-semibold text-slate-600 mt-2 line-clamp-2">
              {title}
            </p>
          )}
        </div>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-full bg-[#F2F6F3] text-slate-400 hover:text-[#F9A826] transition-colors shrink-0 ml-3"
            aria-label="Open verordening"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </motion.div>
  )
}

/* ── Erfgoed gezicht card ──────────────────────────────────── */

function ErfgoedGezichtCard({ gezicht }: { gezicht: BeschermdGezichtResponse }) {
  const isStad = gezicht.type === 'stadsgezicht'

  return (
    <motion.div
      variants={fadeUp}
      className="bg-white border border-[#EAEFEF] rounded-[16px] p-4 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase"
              style={{
                color: isStad ? AMBER.base : OBSIDIAN,
                backgroundColor: isStad ? 'rgba(249, 168, 38, 0.1)' : 'rgba(14, 17, 17, 0.06)',
              }}
            >
              {isStad ? 'Stadsgezicht' : 'Dorpsgezicht'}
            </span>
            {gezicht.aangewezen && (
              <span className="text-[10px] text-slate-400 tabular-nums">
                {gezicht.aangewezen}
              </span>
            )}
          </div>

          <h4 className="text-[13px] font-bold text-[#0E1111] leading-snug">
            {gezicht.naam}
          </h4>

          {gezicht.oppervlakte_ha != null && (
            <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
              {gezicht.oppervlakte_ha.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} ha
            </p>
          )}
        </div>

        <Landmark size={16} className="text-slate-300 shrink-0 mt-1" />
      </div>
    </motion.div>
  )
}

/* ── Roadmap items placeholder ─────────────────────────────── */

function RoadmapSection() {
  const items = [
    { naam: 'Omgevingsvisie', beschrijving: 'Strategische visie op de leefomgeving' },
    { naam: 'Parkeerbeleid', beschrijving: 'Parkeernormen per stedelijkheidszone' },
    { naam: 'Duurzaamheidsbeleid', beschrijving: 'Extra eisen boven het Bouwbesluit' },
    { naam: 'Leegstandsverordening', beschrijving: 'Regels voor leegstaande panden' },
    { naam: 'Erfgoedverordening', beschrijving: 'Lokale monumenten naast rijksmonumenten' },
    { naam: 'Welstandsnota', beschrijving: 'Eisen aan uiterlijk en materialen' },
  ]

  return (
    <motion.div variants={fadeUp} className="mt-6">
      <SectionHeader
        icon={<BookOpen size={14} className="text-slate-300" />}
        label="Binnenkort"
      />
      <div className="grid grid-cols-2 gap-1.5">
        {items.map(({ naam, beschrijving }) => (
          <div
            key={naam}
            className="bg-[#F8FAF9] border border-dashed border-[#EAEFEF] rounded-[12px] p-3"
          >
            <span className="text-[11px] font-bold text-slate-500 block">{naam}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{beschrijving}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* ── Main component ────────────────────────────────────────── */

export function BestuurlijkLayer({ gemeenteNaam }: BestuurlijkLayerProps) {
  const { data: hvvData, isLoading: hvvLoading } = useHuisvestingsverordening(gemeenteNaam)
  const { data: erfgoedData, isLoading: erfgoedLoading } = useErfgoed(gemeenteNaam)

  const isLoading = hvvLoading || erfgoedLoading

  const verdict = deriveVerdict(
    hvvData?.heeft_verordening ?? null,
    erfgoedData?.total ?? 0,
  )

  return (
    <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
      <VerdictHero
        score={isLoading ? null : verdict.score}
        label={isLoading ? 'LADEN...' : verdict.label}
        subtitle={isLoading ? 'Regelgeving ophalen...' : verdict.subtitle}
        color={verdict.color}
        icon={<verdict.Icon className="size-6 text-white" strokeWidth={2.5} />}
      />

      {/* ── Huisvestingsverordening ──────────────────── */}
      <motion.div
        className="mt-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <SectionHeader
          icon={<ScrollText size={14} className="text-slate-400" />}
          label="Splitsingsregels"
        >
          <span className="text-[9px] text-slate-300 uppercase tracking-wider">KOOP</span>
        </SectionHeader>

        {!hvvLoading && hvvData && (
          <HvvCard
            heeftVerordening={hvvData.heeft_verordening}
            title={hvvData.title}
            url={hvvData.url}
          />
        )}
      </motion.div>

      {/* ── Beschermd Erfgoed ────────────────────────── */}
      <motion.div
        className="mt-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <SectionHeader
          icon={<Landmark size={14} className="text-slate-400" />}
          label="Beschermd erfgoed"
        >
          {erfgoedData?.total != null && erfgoedData.total > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums" style={{ color: AMBER.base, backgroundColor: 'rgba(249, 168, 38, 0.1)' }}>
              {erfgoedData.total}
            </span>
          )}
        </SectionHeader>

        {!erfgoedLoading && erfgoedData?.total === 0 && (
          <motion.div
            variants={fadeUp}
            className="bg-green-50/50 border border-green-100 rounded-[16px] p-4 text-center"
          >
            <p className="text-[13px] font-semibold text-green-700">
              Geen beschermde gezichten
            </p>
            <p className="text-[11px] text-green-600/60 mt-0.5">
              Geen extra erfgoed-eisen bij verbouw of nieuwbouw.
            </p>
          </motion.div>
        )}

        {erfgoedData?.beschermde_gezichten && erfgoedData.beschermde_gezichten.length > 0 && (
          <div className="space-y-1.5">
            {erfgoedData.beschermde_gezichten.map((gezicht) => (
              <ErfgoedGezichtCard key={gezicht.naam} gezicht={gezicht} />
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Roadmap — upcoming data ──────────────────── */}
      <RoadmapSection />

      {/* ── Trust metadata ───────────────────────────── */}
      <motion.div variants={fadeUp} className="mt-6 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-slate-300">
          Bron: KOOP · RCE
        </span>
      </motion.div>
    </div>
  )
}
