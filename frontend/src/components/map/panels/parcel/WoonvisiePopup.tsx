/**
 * WoonvisiePopup — Phase 3 design preview (M048)
 *
 * Minimal, Calm Intelligence aesthetic. One focal point: the beleidstekst.
 * Everything else recedes — wijk-naam as context, segmentmatch as single
 * inline sentence, confidence only when notably low.
 */

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

/* ── Types (matching Phase 6 backend shape) ────────────────────── */

export type WijkPrioriteit = 'groei' | 'krimp' | 'herstructurering' | 'neutraal'
export type Segment = 'sociaal' | 'midden' | 'duur' | 'gemengd'

export interface WijkPolicy {
  wijk_naam: string
  prioriteit: WijkPrioriteit
  gewenste_segmenten: Segment[]
  citaat: string
  pagina: number | null
}

export interface WoonvisiePopupProps {
  isOpen: boolean
  onClose: () => void
  gemeente: string
  periode_start: number
  periode_einde: number
  matched_policy: WijkPolicy | null
  algemeen_citaat: string
  project_type: string
  confidence: number
}

/* ── Prioriteit label (no chip — inline text) ──────────────────── */

const PRIO_LABELS: Record<WijkPrioriteit, string> = {
  groei: 'Groeigebied',
  herstructurering: 'Herstructurering',
  neutraal: 'Neutraal',
  krimp: 'Krimpgebied',
}

const PRIO_DOT: Record<WijkPrioriteit, string> = {
  groei: 'bg-[#22C55E]',
  herstructurering: 'bg-[#F9A826]',
  neutraal: 'bg-[#9CA3AF]',
  krimp: 'bg-[#EF4444]',
}

/* ── Projecttype → preferred segments ──────────────────────────── */

const PROJECTTYPE_SEGMENT_MAP: Record<string, Segment[]> = {
  nieuwbouw_wonen: ['sociaal', 'midden'],
  transformatie_wonen: ['sociaal', 'midden', 'gemengd'],
  optoppen: ['midden', 'duur'],
  splitsen: ['sociaal', 'midden'],
  commercieel_naar_wonen: ['midden', 'gemengd'],
  onbepaald: [],
}

function segmentMatchSentence(
  userSegments: Segment[],
  wijkSegments: Segment[],
): { text: string; tone: 'match' | 'partial' | 'mismatch' | 'none' } {
  if (userSegments.length === 0) {
    return { text: 'Projecttype onbekend — geen segmentvergelijking', tone: 'none' }
  }
  if (wijkSegments.length === 0) {
    return { text: 'Wijk noemt geen voorkeurs-segmenten', tone: 'none' }
  }
  const overlap = userSegments.filter((s) => wijkSegments.includes(s))
  if (overlap.length === userSegments.length) {
    return { text: `Jouw project past volledig binnen ${formatList(wijkSegments)}`, tone: 'match' }
  }
  if (overlap.length > 0) {
    return {
      text: `${formatList(overlap)} sluit aan · ${formatList(userSegments.filter((s) => !wijkSegments.includes(s)))} wijkt af`,
      tone: 'partial',
    }
  }
  return {
    text: `Jouw project (${formatList(userSegments)}) valt buiten ${formatList(wijkSegments)}`,
    tone: 'mismatch',
  }
}

function formatList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} en ${items[1]}`
  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`
}

/* ── Component ─────────────────────────────────────────────────── */

export function WoonvisiePopup({
  isOpen,
  onClose,
  gemeente,
  periode_start,
  periode_einde,
  matched_policy,
  algemeen_citaat,
  project_type,
  confidence,
}: WoonvisiePopupProps) {
  if (!isOpen) return null

  const hasWijkMatch =
    matched_policy != null &&
    typeof matched_policy === 'object' &&
    typeof matched_policy.wijk_naam === 'string'
  const prio = hasWijkMatch ? (matched_policy!.prioriteit ?? 'neutraal') : 'neutraal'
  const userPreferred = PROJECTTYPE_SEGMENT_MAP[project_type] ?? []
  const wijkSegments = hasWijkMatch ? (matched_policy!.gewenste_segmenten ?? []) : []
  const segMatch = segmentMatchSentence(userPreferred, wijkSegments)
  const lowConfidence = confidence < 0.5

  const citaat = hasWijkMatch ? (matched_policy!.citaat ?? algemeen_citaat) : algemeen_citaat
  const bron = hasWijkMatch ? matched_policy!.wijk_naam : 'Gemeente-breed'
  const pagina = hasWijkMatch ? (matched_policy!.pagina ?? null) : null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="woonvisie-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-xl mx-4 max-h-[calc(100vh-80px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close — no header chrome */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#F2F6F3] hover:text-[#0E1111]"
            aria-label="Sluiten"
          >
            <X size={14} strokeWidth={2} />
          </button>

          <div className="flex-1 min-h-0 overflow-y-auto px-12 py-12">
            {/* Meta line — small, single row */}
            <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
              <span>Woonvisie {gemeente}</span>
              <span>·</span>
              <span>{periode_start}–{periode_einde}</span>
              {pagina != null && (
                <>
                  <span>·</span>
                  <span>p. {pagina}</span>
                </>
              )}
            </div>

            {/* Wijk title */}
            <h2 className="mt-3 text-[36px] font-black tracking-[-0.03em] text-[#0E1111] leading-[1.05]">
              {bron}
            </h2>

            {/* Prioriteit — inline, understated */}
            <div className="mt-3 flex items-center gap-2 text-[13px] text-[#6B7280]">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${PRIO_DOT[prio]}`} />
              <span>{PRIO_LABELS[prio]}</span>
              {!hasWijkMatch && (
                <>
                  <span>·</span>
                  <span className="italic">geen wijk-specifieke tekst</span>
                </>
              )}
            </div>

            {/* Citaat — the focal point */}
            <p className="mt-10 text-[15px] leading-[1.75] text-[#1A1C1E] whitespace-pre-line">
              {citaat || 'Geen beleidstekst beschikbaar voor deze gemeente.'}
            </p>

            {/* Segmentmatch — single sentence */}
            {hasWijkMatch && segMatch.tone !== 'none' && (
              <div className="mt-10 pt-8 border-t border-[#F2F6F3]">
                <p className="text-[13px] leading-[1.6] text-[#6B7280]">
                  {segMatch.text}.
                </p>
              </div>
            )}

            {/* Low confidence — only shown when relevant */}
            {lowConfidence && (
              <p className="mt-6 text-[11px] text-[#9CA3AF] italic">
                Extractie-zekerheid laag ({Math.round(confidence * 100)}%) — tekst mogelijk onvolledig geïnterpreteerd.
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
