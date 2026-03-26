/**
 * Subsidie Explorer — browse national RVO subsidies with sector/doelgroep filters.
 *
 * Design consistent with jurisprudentie page: staggerContainer/fadeUp animations,
 * ResultsShell wrapper, amber filter pills, responsive card grid.
 */

import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { ExternalLink, Landmark, Building2, MapPin } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import {
  CURATED_SUBSIDIES,
  groupByNiveau,
  type CuratedSubsidie,
  type SubsidieNiveau,
} from '@/lib/subsidies/curatedSubsidies'

/* ─── Route ─────────────────────────────────────────────────── */

export const Route = createFileRoute('/_authenticated/subsidies')({
  component: SubsidiesPage,
})

/* ─── Animations ────────────────────────────────────────────── */

/* ─── Niveau config ─────────────────────────────────────────── */

const NIVEAU_CONFIG: Record<SubsidieNiveau, { label: string; icon: typeof Landmark }> = {
  landelijk: { label: 'Landelijk (RVO)', icon: Landmark },
  provinciaal: { label: 'Provinciaal', icon: Building2 },
  gemeentelijk: { label: 'Gemeentelijk', icon: MapPin },
}

/* ─── Curated subsidie card ────────────────────────────────── */

function CuratedCard({ item }: { item: CuratedSubsidie }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div variants={fadeUp}>
      <div
        className="rounded-[24px] border border-[#EAEFEF] bg-white px-6 py-5 transition-shadow hover:shadow-md cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-[#0E1111] leading-snug">
              {item.title}
            </h3>
            <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed line-clamp-2">
              {item.beschrijving}
            </p>
          </div>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#EAEFEF] text-slate-400 transition-colors hover:border-[#0E1111] hover:text-[#0E1111]"
              title="Bekijk regeling"
            >
              <ExternalLink size={16} strokeWidth={2} />
            </a>
          )}
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-[#F2F6F3] px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            {item.doelgroep}
          </span>
          {item.regio && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
              {item.regio}
            </span>
          )}
        </div>

        {/* Expanded: voorwaarden */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-[#EAEFEF]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Voorwaarden</p>
            <p className="text-[12px] text-slate-500 leading-relaxed">{item.voorwaarden}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Page ──────────────────────────────────────────────────── */

function SubsidiesPage() {
  const curatedByNiveau = useMemo(() => groupByNiveau(CURATED_SUBSIDIES), [])

  return (
    <ResultsShell>
      <div className="mx-auto max-w-5xl">
        {/* ── Hero ─────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p
            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Subsidies & regelingen
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="text-[56px] font-black leading-none tracking-tight text-[#0E1111] tabular-nums">
              {CURATED_SUBSIDIES.length}
            </h1>
          </div>
          <p className="mt-1 text-[14px] text-slate-500">
            woningbouw- en verduurzamingsregelingen op landelijk, provinciaal en gemeentelijk niveau
          </p>
        </motion.div>

        {/* ── Subsidies per niveau ──────────────────────────── */}
        <div className="mt-10 space-y-10">
          {(['landelijk', 'provinciaal', 'gemeentelijk'] as SubsidieNiveau[]).map((niveau) => {
            const cfg = NIVEAU_CONFIG[niveau]
            const Icon = cfg.icon
            const items = curatedByNiveau.get(niveau)
            if (!items || items.length === 0) return null

            return (
              <motion.div
                key={niveau}
                variants={fadeUp}
                initial="hidden"
                animate="show"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex size-8 items-center justify-center rounded-full bg-[#0E1111]">
                    <Icon size={14} strokeWidth={2} className="text-[#F9A826]" />
                  </div>
                  <h2 className="text-[16px] font-bold text-[#0E1111]" style={{ textWrap: 'balance' }}>{cfg.label}</h2>
                  <span className="text-[12px] text-slate-400 tabular-nums">{items.length}</span>
                  <div className="h-px flex-1 bg-[#EAEFEF]" />
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {items.map((item) => (
                    <CuratedCard key={item.id} item={item} />
                  ))}
                </motion.div>
              </motion.div>
            )
          })}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Subsidies · {CURATED_SUBSIDIES.length} regelingen
        </p>
      </div>
    </ResultsShell>
  )
}
