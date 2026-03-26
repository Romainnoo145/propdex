/**
 * Subsidie Explorer — browse national RVO subsidies.
 *
 * Design: ResultsShell wrapper, amber count rings, modal detail view,
 * uniform card heights, clean two-color palette (obsidian + amber).
 */

import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { ExternalLink, Landmark, Building2, MapPin, X, Calendar, Banknote } from 'lucide-react'
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

/* ─── Niveau config ─────────────────────────────────────────── */

const NIVEAU_CONFIG: Record<SubsidieNiveau, { label: string; icon: typeof Landmark }> = {
  landelijk: { label: 'Landelijk (RVO)', icon: Landmark },
  provinciaal: { label: 'Provinciaal', icon: Building2 },
  gemeentelijk: { label: 'Gemeentelijk', icon: MapPin },
}

/* ─── Subsidie detail modal ─────────────────────────────────── */

function SubsidieModal({ item, onClose }: { item: CuratedSubsidie; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[24px] border border-[#EAEFEF] bg-white p-6 shadow-xl"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-[#EAEFEF] text-slate-400 transition-colors hover:border-[#0E1111] hover:text-[#0E1111]"
        >
          <X size={14} />
        </button>

        {/* Regio pill */}
        {item.regio && (
          <span className="inline-flex items-center rounded-full bg-[#F9A826] px-3 py-1 text-[11px] font-bold text-[#0E1111] mb-3">
            {item.regio}
          </span>
        )}

        <h3 className="text-[18px] font-bold text-[#0E1111] leading-snug pr-10" style={{ textWrap: 'balance' }}>
          {item.title}
        </h3>

        <p className="mt-3 text-[13px] text-slate-600 leading-relaxed">
          {item.beschrijving}
        </p>

        {/* Key facts */}
        {(item.budget || item.maxBedrag || item.deadline) && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {item.budget && (
              <div className="rounded-xl bg-[#F2F6F3] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote size={12} className="text-[#F9A826]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Budget</span>
                </div>
                <p className="text-[13px] font-semibold text-[#0E1111]">{item.budget}</p>
              </div>
            )}
            {item.maxBedrag && (
              <div className="rounded-xl bg-[#F2F6F3] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote size={12} className="text-[#F9A826]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Max bedrag</span>
                </div>
                <p className="text-[13px] font-semibold text-[#0E1111]">{item.maxBedrag}</p>
              </div>
            )}
            {item.deadline && (
              <div className="rounded-xl bg-[#F2F6F3] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar size={12} className="text-[#F9A826]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deadline</span>
                </div>
                <p className="text-[13px] font-semibold text-[#0E1111]">{item.deadline}</p>
              </div>
            )}
          </div>
        )}

        {/* Voorwaarden */}
        <div className="mt-5 pt-4 border-t border-[#EAEFEF]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Voorwaarden</p>
          <p className="text-[13px] text-slate-600 leading-relaxed">{item.voorwaarden}</p>
        </div>

        {/* Doelgroep */}
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Doelgroep</p>
          <span className="inline-flex items-center rounded-full bg-[#F2F6F3] px-3 py-1 text-[12px] font-medium text-[#0E1111]">
            {item.doelgroep}
          </span>
        </div>

        {/* Link */}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0E1111] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Bekijk regeling <ExternalLink size={14} />
          </a>
        )}
      </motion.div>
    </div>
  )
}

/* ─── Curated subsidie card ────────────────────────────────── */

function CuratedCard({ item, onSelect }: { item: CuratedSubsidie; onSelect: (item: CuratedSubsidie) => void }) {
  return (
    <motion.div variants={fadeUp} className="h-full">
      <div
        className="flex h-full flex-col rounded-[24px] border border-[#EAEFEF] bg-white px-6 py-5 transition-shadow hover:shadow-md cursor-pointer"
        onClick={() => onSelect(item)}
      >
        {/* Eyebrow: regio or doelgroep */}
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#F9A826] mb-1.5 line-clamp-1">
          {item.regio ?? item.doelgroep}
        </p>

        {/* Title */}
        <h3 className="text-[14px] font-semibold text-[#0E1111] leading-snug">
          {item.title}
        </h3>

        {/* Description */}
        <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed line-clamp-3">
          {item.beschrijving}
        </p>
      </div>
    </motion.div>
  )
}

/* ─── Page ──────────────────────────────────────────────────── */

function SubsidiesPage() {
  const curatedByNiveau = useMemo(() => groupByNiveau(CURATED_SUBSIDIES), [])
  const [selectedSubsidie, setSelectedSubsidie] = useState<CuratedSubsidie | null>(null)

  const handleClose = useCallback(() => setSelectedSubsidie(null), [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedSubsidie(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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
                  {/* Amber count ring */}
                  <div className="flex size-9 items-center justify-center rounded-full border-[2.5px] border-[#F9A826]">
                    <span className="text-[13px] font-bold text-[#0E1111] tabular-nums">{items.length}</span>
                  </div>
                  <h2 className="text-[16px] font-bold text-[#0E1111]" style={{ textWrap: 'balance' }}>{cfg.label}</h2>
                  <div className="h-px flex-1 bg-[#EAEFEF]" />
                  {/* Icon far right */}
                  <div className="flex size-8 items-center justify-center rounded-full bg-[#0E1111]">
                    <Icon size={14} strokeWidth={2} className="text-[#F9A826]" />
                  </div>
                </div>
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {items.map((item) => (
                    <CuratedCard key={item.id} item={item} onSelect={setSelectedSubsidie} />
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

      {/* ── Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedSubsidie && (
          <SubsidieModal item={selectedSubsidie} onClose={handleClose} />
        )}
      </AnimatePresence>
    </ResultsShell>
  )
}
