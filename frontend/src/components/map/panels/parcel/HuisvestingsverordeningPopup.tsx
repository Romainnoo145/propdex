/**
 * HuisvestingsverordeningPopup — M053/S12 splitsingsrisico cascade showcase.
 * Minimal Calm Intelligence: one focal point = the opkoopbescherming verdict.
 * 1:1 clone of the LOCKED OmgevingsvisiePopup drawer pattern; reuses
 * RandvoorwaardenSection from OmgevingsvisiePopup (single source of truth).
 */
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { RandvoorwaardenSection, type Randvoorwaarde } from './OmgevingsvisiePopup'

/* ── Verdict copy (editorial keyline + focal headline) ──────────── */

type VerdictTone = 'amber' | 'red' | 'neutral'

const TONE_KEYLINE: Record<VerdictTone, { border: string; label: string }> = {
  amber: { border: 'border-[#F9A826]', label: 'text-[#B45309]' },
  red: { border: 'border-[#DC2626]', label: 'text-[#DC2626]' },
  neutral: { border: 'border-[#D1D5DB]', label: 'text-[#4B5563]' },
}

/* ── Pure helpers ───────────────────────────────────────────────── */

function formatEur(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export interface HuisvestingsverordeningPopupProps {
  isOpen: boolean
  onClose: () => void
  gemeente?: string
  verdict: string
  buurt_naam?: string | null
  woz_grens_eur?: number | null
  duur_jaren?: number | null
  vergunningplichten?: string[]
  randvoorwaarden?: Randvoorwaarde[]
}

/* ── Detail content (reusable: drawer chrome OR in-panel drill-down) ── */

export interface HuisvestingsverordeningDetailContentProps {
  gemeente?: string
  verdict: string
  buurt_naam?: string | null
  woz_grens_eur?: number | null
  duur_jaren?: number | null
  vergunningplichten?: string[]
  randvoorwaarden?: Randvoorwaarde[]
}

/**
 * The huisvestingsverordening detail body — meta line, focal headline,
 * verdict keyline, and the Randvoorwaarden section. Renders ONLY content
 * (no portal/backdrop/close), so it can live inside the drawer chrome OR
 * inside the parcel detail panel's own scroll + back button.
 */
export function HuisvestingsverordeningDetailContent({
  gemeente,
  verdict,
  buurt_naam,
  woz_grens_eur,
  duur_jaren,
  vergunningplichten,
  randvoorwaarden,
}: HuisvestingsverordeningDetailContentProps) {
  const buurt = buurt_naam || 'Beschermde buurt'

  // Resolve focal headline + verdict keyline per verdict.
  let titel = buurt
  let tone: VerdictTone = 'neutral'
  let keylineLabel = ''
  let keylineLine = ''

  switch (verdict) {
    case 'van_toepassing': {
      tone = 'red'
      keylineLabel = 'Opkoopbescherming'
      const duur = duur_jaren != null ? `Verhuurverbod ${duur_jaren} jaar na aankoop` : 'Verhuurverbod na aankoop'
      const grens = woz_grens_eur != null ? ` voor woningen tot ${formatEur(woz_grens_eur)}` : ''
      keylineLine = `${duur}${grens}.`
      break
    }
    case 'mogelijk_van_toepassing': {
      tone = 'amber'
      keylineLabel = 'Opkoopbescherming'
      const duur = duur_jaren != null ? `Verhuurverbod ${duur_jaren} jaar na aankoop` : 'Verhuurverbod na aankoop'
      const grens = woz_grens_eur != null ? ` voor woningen tot ${formatEur(woz_grens_eur)}` : ''
      keylineLine = `${duur}${grens}. WOZ-waarde is onbekend, dus dit geldt waarschijnlijk onder de grens.`
      break
    }
    case 'vergunningstelsel_voorraad': {
      titel = 'Woonruimtevoorraad'
      tone = 'amber'
      keylineLabel = 'Vergunningplicht'
      const plichten = vergunningplichten && vergunningplichten.length > 0 ? vergunningplichten.join('/') : 'wijzigingen'
      keylineLine = `Vergunningplicht voor ${plichten} — procesrisico, geen verbod.`
      break
    }
    case 'boven_woz_grens': {
      titel = 'Boven de opkoopgrens'
      tone = 'neutral'
      keylineLabel = 'Niet van toepassing'
      const grens = woz_grens_eur != null ? ` (${formatEur(woz_grens_eur)})` : ''
      keylineLine = `WOZ-waarde boven de opkoopgrens${grens} — opkoopbescherming niet van toepassing.`
      break
    }
    case 'buiten_beschermd_gebied': {
      titel = 'Buiten beschermd gebied'
      tone = 'neutral'
      keylineLabel = 'Niet van toepassing'
      keylineLine = 'Buiten de aangewezen opkoopbeschermings-buurten.'
      break
    }
    case 'niet_van_toepassing': {
      titel = 'Onbebouwd perceel'
      tone = 'neutral'
      keylineLabel = 'Niet van toepassing'
      keylineLine = 'Onbebouwd perceel — opkoopbescherming geldt voor bestaande woonruimte.'
      break
    }
    case 'geen_regeling':
    default: {
      titel = 'Geen regeling'
      tone = 'neutral'
      keylineLabel = 'Geen opkoopbescherming'
      keylineLine = 'Geen opkoopbescherming in deze gemeente.'
      break
    }
  }

  const keyline = TONE_KEYLINE[tone]

  return (
    <>
      {/* Meta line — small, single row */}
      <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
        <span>Huisvestingsverordening{gemeente ? ` ${gemeente}` : ''}</span>
      </div>

      {/* Eyebrow — buurt kicker for the protected-buurt verdicts */}
      {(verdict === 'van_toepassing' || verdict === 'mogelijk_van_toepassing') && (
        <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">
          Opkoopbeschermings-buurt
        </div>
      )}

      {/* Focal headline — editorial */}
      <h2 className="mt-2 text-[40px] font-black tracking-[-0.035em] text-[#0E1111] leading-[0.98]">
        {titel}
      </h2>

      {/* Verdict — colored keyline statement (editorial, no box/emoji) */}
      <div className={`mt-7 border-l-[3px] pl-5 ${keyline.border}`}>
        <p className={`text-[20px] font-black tracking-tight ${keyline.label}`}>{keylineLabel}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#374151]">{keylineLine}</p>
      </div>

      {/* Randvoorwaarden — toetsingsregels, grouped by categorie */}
      <RandvoorwaardenSection randvoorwaarden={randvoorwaarden} />
    </>
  )
}

/* ── Component ─────────────────────────────────────────────────── */

export function HuisvestingsverordeningPopup({
  isOpen,
  onClose,
  gemeente,
  verdict,
  buurt_naam,
  woz_grens_eur,
  duur_jaren,
  vergunningplichten,
  randvoorwaarden,
}: HuisvestingsverordeningPopupProps) {
  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="huisvestingsverordening-backdrop"
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
            <HuisvestingsverordeningDetailContent
              gemeente={gemeente}
              verdict={verdict}
              buurt_naam={buurt_naam}
              woz_grens_eur={woz_grens_eur}
              duur_jaren={duur_jaren}
              vergunningplichten={vergunningplichten}
              randvoorwaarden={randvoorwaarden}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
