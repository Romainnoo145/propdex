/**
 * AanpakCard — "Volgende stap" insight card with next-step CTA + action buttons.
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split,
 * M050/S06 cont.).
 *
 * Plan 08-07 (M050/S06 cont., AD1): BRK persist CTA on fase-1 is replaced by a
 * Contact-handoff Link to /opgeslagen/perceel/$parcelId/$phase with
 * phase='2-contact'. BRK lives on fase-2; the fase-overgang IS the gate
 * (no score threshold). The card renders the Contact-handoff CTA when
 * deriveNextStep returns kind === 'contact-handoff'.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ClipboardCheck, FileText, Loader2, Mail, Sparkles, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { FavoriteResponse } from '@/lib/types/portfolio'
import type { NextStep } from '@/lib/cockpit/cockpit-derivations'

interface AanpakCardProps {
  nextStep: NextStep
  favorite: FavoriteResponse
  parcelId: string
  onGenerateReport: () => void
  onOpenContact: () => void
  isGeneratingReport: boolean
}

function WorkspaceInsightCard({
  title,
  kicker,
  Icon,
  children,
  className = '',
  index = 0,
}: {
  title: string
  kicker: string
  Icon: LucideIcon
  children: ReactNode
  className?: string
  index?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-[24px] border border-[#EAEFEF] bg-white p-5 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            {kicker}
          </p>
          <h3 className="mt-2 text-[18px] font-bold tracking-tight text-[#0E1111]">{title}</h3>
        </div>
        <motion.div
          whileHover={{ scale: 1.08, rotate: 6 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0E1111]"
        >
          <Icon className="size-5 text-[#F9A826]" strokeWidth={2.2} />
        </motion.div>
      </div>
      <div className="mt-4">{children}</div>
    </motion.section>
  )
}

export function AanpakCard({
  nextStep,
  favorite,
  parcelId,
  onGenerateReport,
  onOpenContact,
  isGeneratingReport,
}: AanpakCardProps) {
  return (
    <WorkspaceInsightCard kicker="Aanpak" title="Volgende stap" Icon={ClipboardCheck} index={0}>
      <div className="rounded-[20px] border border-[#F1E1B0] bg-[#FFF8E8] px-4 py-4">
        <p className="text-[16px] font-bold tracking-tight text-[#0E1111]">{nextStep.title}</p>
        <p className="mt-2 text-[14px] leading-6 text-slate-600">{nextStep.detail}</p>
        {nextStep.kind === 'contact-handoff' ? (
          // Plan 08-07 / AD1: fase-1 → fase-2 handoff CTA. NO score-threshold gate.
          // BRK persist now lives on fase-2 (Contact); this Link is the only fase-1
          // CTA when kind === 'contact-handoff'. Target: { phase: '2-contact' }
          // (literal value sourced via nextStep.cta.params.phase — see deriveNextStep
          // in @/lib/cockpit/cockpit-derivations as single source of truth).
          <Link
            to={nextStep.cta.to}
            params={{ parcelId, phase: nextStep.cta.params.phase }}
            search={{ stage: undefined }}
            className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#0E1111] bg-[#F9A826] px-5 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F4B44A]"
          >
            <ArrowRight size={14} />
            {nextStep.cta.label}
          </Link>
        ) : !favorite.has_report ? (
          <motion.button
            type="button"
            onClick={onGenerateReport}
            disabled={isGeneratingReport || !favorite.parcel_cache_id}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#0E1111] bg-[#F9A826] px-5 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F4B44A] disabled:opacity-50"
          >
            <AnimatePresence mode="wait">
              {isGeneratingReport ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Loader2 size={14} className="animate-spin" />
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Sparkles size={14} />
                </motion.span>
              )}
            </AnimatePresence>
            {isGeneratingReport ? 'Rapport genereren...' : 'Genereer rapport'}
          </motion.button>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <motion.button
              type="button"
              onClick={onGenerateReport}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-5 text-[13px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
            >
              <FileText size={14} />
              Bekijk rapport
            </motion.button>
            <motion.button
              type="button"
              onClick={onOpenContact}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#0E1111] bg-white px-5 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-slate-50"
            >
              <Mail size={14} />
              Neem contact op
            </motion.button>
          </div>
        )}
      </div>
    </WorkspaceInsightCard>
  )
}

// Re-export shared insight-card primitive for OnderzoekPhaseView (activity card reuse)
export { WorkspaceInsightCard, ScrollText }
