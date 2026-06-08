/**
 * WoonvisiePopup — M053/S07 editorial redesign (was: M048 Phase 3 preview).
 *
 * Mirrors OmgevingsvisieDetailContent: a reusable WoonvisieDetailContent body
 * (meta → prioriteit eyebrow → wijk headline → prioriteit keyline + segmentmatch
 * → citaat → Randvoorwaarden) shared by the popup drawer AND the in-panel
 * drill-down inside ParcelDetailPanel. Randvoorwaarden reuse the shared
 * RandvoorwaardenSection from OmgevingsvisiePopup (single source of truth).
 */

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

import { RandvoorwaardenSection, type Randvoorwaarde } from './OmgevingsvisiePopup'

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
  randvoorwaarden?: Randvoorwaarde[]
}

/* ── Prioriteit label + dot (inline kicker, no chip) ───────────── */

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

/**
 * Prioriteit keyline — the directional statement (developer-facing verdict),
 * editorial colored left-rule + label. Mirrors the omgevingsvisie verdict keyline.
 */
const PRIO_KEYLINE: Record<WijkPrioriteit, { border: string; label: string; title: string; line: string }> = {
  groei: {
    border: 'border-[#15803d]',
    label: 'text-[#15803d]',
    title: 'Kansrijk voor woningbouw',
    line: 'De gemeente stuurt hier op groei — ruimte om woningen toe te voegen.',
  },
  herstructurering: {
    border: 'border-[#F9A826]',
    label: 'text-[#B45309]',
    title: 'Transitiegebied',
    line: 'Gebied in herstructurering — sloop-nieuwbouw en verdichting zijn kansrijk.',
  },
  krimp: {
    border: 'border-[#DC2626]',
    label: 'text-[#DC2626]',
    title: 'Restrictief gebied',
    line: 'Krimpbeleid — reken op terughoudendheid bij het toevoegen van woningen.',
  },
  neutraal: {
    border: 'border-[#9CA3AF]',
    label: 'text-[#4B5563]',
    title: 'Neutraal gebied',
    line: 'Stabiel woongebied zonder uitgesproken groei- of krimprichting.',
  },
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

/* ── Detail content (reusable: popup drawer + in-panel drill-down) ── */

export interface WoonvisieDetailContentProps {
  gemeente: string
  periode_start: number
  periode_einde: number
  matched_policy: WijkPolicy | null
  algemeen_citaat: string
  project_type: string
  randvoorwaarden?: Randvoorwaarde[]
}

/**
 * The woonvisie detail body — meta line, prioriteit eyebrow, wijk headline,
 * prioriteit keyline + segmentmatch, citaat and the Randvoorwaarden section.
 * Renders ONLY content (no portal/backdrop/close), so it lives inside the drawer
 * chrome OR the parcel detail panel's own scroll + back button.
 */
export function WoonvisieDetailContent({
  gemeente,
  periode_start,
  periode_einde,
  matched_policy,
  algemeen_citaat,
  project_type,
  randvoorwaarden,
}: WoonvisieDetailContentProps) {
  const hasWijkMatch =
    matched_policy != null &&
    typeof matched_policy === 'object' &&
    typeof matched_policy.wijk_naam === 'string'
  const prio = hasWijkMatch ? (matched_policy!.prioriteit ?? 'neutraal') : 'neutraal'
  const userPreferred = PROJECTTYPE_SEGMENT_MAP[project_type] ?? []
  const wijkSegments = hasWijkMatch ? (matched_policy!.gewenste_segmenten ?? []) : []
  const segMatch = segmentMatchSentence(userPreferred, wijkSegments)

  const citaat = hasWijkMatch ? (matched_policy!.citaat || algemeen_citaat) : algemeen_citaat
  const titel = hasWijkMatch ? matched_policy!.wijk_naam : 'Gemeente-breed'
  const pagina = hasWijkMatch ? (matched_policy!.pagina ?? null) : null
  const keyline = PRIO_KEYLINE[prio]
  const hasPeriode = periode_start > 0 && periode_einde > 0

  return (
    <>
      {/* Meta line — small, single row */}
      <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
        <span>Woonvisie {gemeente}</span>
        {hasPeriode && (
          <>
            <span>·</span>
            <span>
              {periode_start}–{periode_einde}
            </span>
          </>
        )}
        {pagina != null && (
          <>
            <span>·</span>
            <span>p. {pagina}</span>
          </>
        )}
      </div>

      {/* Eyebrow — prioriteit as a colored kicker above the headline */}
      {hasWijkMatch ? (
        <div className="mt-4 flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${PRIO_DOT[prio]}`} />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">
            {PRIO_LABELS[prio]}
            {wijkSegments.length > 0 && (
              <span className="text-[#9CA3AF]"> · {formatList(wijkSegments)}</span>
            )}
          </span>
        </div>
      ) : (
        <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
          Gemeente-breed
        </div>
      )}

      {/* Wijk title — editorial headline */}
      <h2 className="mt-2 text-[40px] font-black tracking-[-0.035em] text-[#0E1111] leading-[0.98]">
        {titel}
      </h2>

      {/* Prioriteit keyline — colored statement (editorial, no box/emoji) */}
      {hasWijkMatch && (
        <div className={`mt-7 border-l-[3px] pl-5 ${keyline.border}`}>
          <p className={`text-[20px] font-black tracking-tight ${keyline.label}`}>{keyline.title}</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#374151]">{keyline.line}</p>
          {segMatch.tone !== 'none' && (
            <p className="mt-2.5 text-[13px] leading-relaxed text-[#6B7280]">{segMatch.text}.</p>
          )}
        </div>
      )}

      {/* Citaat — supporting evidence as a quote block */}
      {citaat && (
        <div className="mt-6 border-l-2 border-[#EAEFEF] pl-4">
          <p className="text-[13px] italic leading-[1.7] text-[#6B7280] whitespace-pre-line">
            {citaat}
          </p>
        </div>
      )}

      {/* Randvoorwaarden — gemeente-brede toetsingsregels (shared section) */}
      <RandvoorwaardenSection randvoorwaarden={randvoorwaarden} />
    </>
  )
}

/* ── Component (popup drawer wrapper) ──────────────────────────── */

export function WoonvisiePopup({
  isOpen,
  onClose,
  gemeente,
  periode_start,
  periode_einde,
  matched_policy,
  algemeen_citaat,
  project_type,
  randvoorwaarden,
}: WoonvisiePopupProps) {
  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="woonvisie-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/30 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex h-full w-full max-w-[680px] flex-col bg-white rounded-l-[32px] shadow-2xl"
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
            <WoonvisieDetailContent
              gemeente={gemeente}
              periode_start={periode_start}
              periode_einde={periode_einde}
              matched_policy={matched_policy}
              algemeen_citaat={algemeen_citaat}
              project_type={project_type}
              randvoorwaarden={randvoorwaarden}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
