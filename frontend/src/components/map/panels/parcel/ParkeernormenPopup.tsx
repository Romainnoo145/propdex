/**
 * ParkeernormenPopup — M054/S02 parkeerdruk cascade showcase.
 * Minimal Calm Intelligence: one focal point = the parkeerdruk-risico verdict.
 * 1:1 clone of the GrondprijsPopup drawer pattern; reuses RandvoorwaardenSection
 * from OmgevingsvisiePopup (single source of truth).
 */
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { RandvoorwaardenSection, type Randvoorwaarde } from './OmgevingsvisiePopup'

/* ── Verdict copy (editorial keyline + focal headline) ──────────── */

type VerdictTone = 'amber' | 'neutral'

const TONE_KEYLINE: Record<VerdictTone, { border: string; label: string }> = {
  amber: { border: 'border-[#F9A826]', label: 'text-[#B45309]' },
  neutral: { border: 'border-[#D1D5DB]', label: 'text-[#4B5563]' },
}

const FUNCTIE_LABEL: Record<string, string> = {
  wonen: 'Wonen',
  winkelen: 'Winkelen',
  werken: 'Werken',
  sport_cultuur: 'Sport & cultuur',
  horeca_recreatie: 'Horeca & recreatie',
  zorg_voorzieningen: 'Zorg & voorzieningen',
  onderwijs: 'Onderwijs',
  overig: 'Overig',
}

const GEBIED_LABEL: Record<string, string> = {
  centrum: 'Centrum',
  schil_centrum: 'Centrumschil',
  rest_bebouwde_kom: 'Bebouwde kom',
  buitengebied: 'Buitengebied',
}

/* ── Pure helpers ───────────────────────────────────────────────── */

export interface Correctie {
  type: string
  max_reductie_pct?: number | null
  voorwaarde?: string | null
  citaat?: string | null
}

function normLine(auto?: number | null, eenheid?: string | null): string {
  if (auto == null) return ''
  const unit = eenheid ? ` ${eenheid}` : ''
  return `${auto}${unit}`
}

export interface ParkeernormenPopupProps {
  isOpen: boolean
  onClose: () => void
  gemeente?: string
  verdict: string
  functie?: string | null
  functiecategorie?: string | null
  gebied?: string | null
  auto_norm_per_eenheid?: number | null
  eenheid?: string | null
  fiets_norm_per_eenheid?: number | null
  peiljaar?: number | null
  parkeerregulering_van_toepassing?: boolean | null
  openbare_ruimte_drempel_pct?: number | null
  centrum_uitgesloten?: boolean | null
  fietsnorm_harde_eis?: boolean | null
  nul_norm_sociale_huur_mogelijk?: boolean | null
  mobiliteitscorrecties?: Correctie[]
  randvoorwaarden?: Randvoorwaarde[]
}

/* ── Detail content (reusable: drawer chrome OR in-panel drill-down) ── */

export interface ParkeernormenDetailContentProps {
  gemeente?: string
  verdict: string
  functie?: string | null
  functiecategorie?: string | null
  gebied?: string | null
  auto_norm_per_eenheid?: number | null
  eenheid?: string | null
  fiets_norm_per_eenheid?: number | null
  peiljaar?: number | null
  parkeerregulering_van_toepassing?: boolean | null
  openbare_ruimte_drempel_pct?: number | null
  centrum_uitgesloten?: boolean | null
  fietsnorm_harde_eis?: boolean | null
  nul_norm_sociale_huur_mogelijk?: boolean | null
  mobiliteitscorrecties?: Correctie[]
  randvoorwaarden?: Randvoorwaarde[]
}

/**
 * The parkeernormen detail body — meta line, focal headline, verdict keyline, and
 * the Randvoorwaarden section. Renders ONLY content (no portal/backdrop/close),
 * so it can live inside the drawer chrome OR inside the parcel detail panel.
 */
export function ParkeernormenDetailContent({
  gemeente,
  verdict,
  functie,
  functiecategorie,
  gebied,
  auto_norm_per_eenheid,
  eenheid,
  fiets_norm_per_eenheid,
  peiljaar,
  parkeerregulering_van_toepassing,
  openbare_ruimte_drempel_pct,
  centrum_uitgesloten,
  fietsnorm_harde_eis,
  nul_norm_sociale_huur_mogelijk,
  mobiliteitscorrecties,
  randvoorwaarden,
}: ParkeernormenDetailContentProps) {
  const gebiedLabel = gebied ? GEBIED_LABEL[gebied] ?? gebied : ''
  const norm = normLine(auto_norm_per_eenheid, eenheid)

  let titel = functie || 'Parkeereis'
  let tone: VerdictTone = 'neutral'
  let keylineLabel = ''
  let keylineLine = ''

  switch (verdict) {
    case 'verhoogd': {
      tone = 'amber'
      keylineLabel = 'Verhoogd parkeerdruk-risico'
      const normDeel = norm ? `Parkeernorm ${norm}` : 'De parkeereis'
      const gebiedDeel = gebiedLabel ? ` in ${gebiedLabel.toLowerCase()}` : ''
      keylineLine = `${normDeel}${gebiedDeel} vormt een reëel ontwikkelrisico: de eis is lastig of duur op te lossen.`
      break
    }
    case 'laag': {
      tone = 'neutral'
      keylineLabel = 'Beheersbare parkeereis'
      const gebiedDeel = gebiedLabel ? ` in ${gebiedLabel.toLowerCase()}` : ''
      keylineLine = `${norm ? `Parkeernorm ${norm}` : 'De parkeereis'}${gebiedDeel} is beheersbaar: er is ruimte om de eis op te lossen. Telt als context.`
      break
    }
    case 'geen_match':
    default: {
      titel = 'Geen parkeernorm'
      tone = 'neutral'
      keylineLabel = 'Niet van toepassing'
      keylineLine = 'Geen parkeernorm-band sluit aan op de bestemming van dit perceel.'
      break
    }
  }

  const keyline = TONE_KEYLINE[tone]
  const showDetail = verdict === 'verhoogd' || verdict === 'laag'

  return (
    <>
      {/* Meta line — small, single row */}
      <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
        <span>Parkeernormen{gemeente ? ` ${gemeente}` : ''}{peiljaar != null ? ` ${peiljaar}` : ''}</span>
      </div>

      {/* Eyebrow — functiecategorie kicker for the matched verdicts */}
      {showDetail && functiecategorie && (
        <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">
          {FUNCTIE_LABEL[functiecategorie] ?? functiecategorie}
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
        {showDetail && fiets_norm_per_eenheid != null && fietsnorm_harde_eis && (
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
            Fietsparkeernorm {fiets_norm_per_eenheid} is een harde eis (weigeringsgrond bij niet-oplosbaar).
          </p>
        )}
        {showDetail && centrum_uitgesloten && gebied === 'centrum' && (
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
            In het centrum is parkeren in de openbare ruimte uitgesloten.
          </p>
        )}
        {showDetail && parkeerregulering_van_toepassing && (
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
            Gereguleerd gebied
            {openbare_ruimte_drempel_pct != null
              ? ` — openbare-ruimte-drempel ${openbare_ruimte_drempel_pct}% parkeerdruk.`
              : '.'}
          </p>
        )}
        {showDetail && nul_norm_sociale_huur_mogelijk && (
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
            Sociale huur door een corporatie kan kosteloos van de parkeereis af.
          </p>
        )}
        {showDetail && mobiliteitscorrecties && mobiliteitscorrecties.length > 0 && (
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
            Mobiliteitscorrecties beschikbaar:{' '}
            {mobiliteitscorrecties
              .map((c) => (c.max_reductie_pct != null ? `${c.type} (${c.max_reductie_pct}%)` : c.type))
              .join(', ')}
            .
          </p>
        )}
      </div>

      {/* Randvoorwaarden — toetsingsregels, grouped by categorie */}
      <RandvoorwaardenSection randvoorwaarden={randvoorwaarden} />
    </>
  )
}

/* ── Component ─────────────────────────────────────────────────── */

export function ParkeernormenPopup({
  isOpen,
  onClose,
  gemeente,
  verdict,
  functie,
  functiecategorie,
  gebied,
  auto_norm_per_eenheid,
  eenheid,
  fiets_norm_per_eenheid,
  peiljaar,
  parkeerregulering_van_toepassing,
  openbare_ruimte_drempel_pct,
  centrum_uitgesloten,
  fietsnorm_harde_eis,
  nul_norm_sociale_huur_mogelijk,
  mobiliteitscorrecties,
  randvoorwaarden,
}: ParkeernormenPopupProps) {
  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="parkeernormen-backdrop"
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
            <ParkeernormenDetailContent
              gemeente={gemeente}
              verdict={verdict}
              functie={functie}
              functiecategorie={functiecategorie}
              gebied={gebied}
              auto_norm_per_eenheid={auto_norm_per_eenheid}
              eenheid={eenheid}
              fiets_norm_per_eenheid={fiets_norm_per_eenheid}
              peiljaar={peiljaar}
              parkeerregulering_van_toepassing={parkeerregulering_van_toepassing}
              openbare_ruimte_drempel_pct={openbare_ruimte_drempel_pct}
              centrum_uitgesloten={centrum_uitgesloten}
              fietsnorm_harde_eis={fietsnorm_harde_eis}
              nul_norm_sociale_huur_mogelijk={nul_norm_sociale_huur_mogelijk}
              mobiliteitscorrecties={mobiliteitscorrecties}
              randvoorwaarden={randvoorwaarden}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
