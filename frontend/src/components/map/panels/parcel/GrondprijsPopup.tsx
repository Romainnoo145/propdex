/**
 * GrondprijsPopup — M054/S01 grondwaarde_fit cascade showcase.
 * Minimal Calm Intelligence: one focal point = the grondprijs-fit verdict.
 * 1:1 clone of the LOCKED HuisvestingsverordeningPopup drawer pattern; reuses
 * RandvoorwaardenSection from OmgevingsvisiePopup (single source of truth).
 */
import { FactorDetailDrawer } from './FactorDetailDrawer'
import { RandvoorwaardenSection, type Randvoorwaarde } from './OmgevingsvisiePopup'

/* ── Verdict copy (editorial keyline + focal headline) ──────────── */

type VerdictTone = 'amber' | 'neutral'

const TONE_KEYLINE: Record<VerdictTone, { border: string; label: string }> = {
  amber: { border: 'border-[#F9A826]', label: 'text-[#B45309]' },
  neutral: { border: 'border-[#D1D5DB]', label: 'text-[#4B5563]' },
}

const FUNCTIE_LABEL: Record<string, string> = {
  sociaal: 'Sociale woningbouw',
  midden: 'Middenhuur/-koop',
  vrij: 'Vrije sector',
  commercieel: 'Commercieel',
  maatschappelijk: 'Maatschappelijk',
  bedrijventerrein: 'Bedrijventerrein',
  overig: 'Overig',
}

const GRONDSLAG_LABEL: Record<string, string> = {
  residueel: 'residueel bepaald',
  comparatief: 'comparatief bepaald',
  vaste_prijs: 'vaste grondprijs',
}

/* ── Pure helpers ───────────────────────────────────────────────── */

function formatEur(value: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function prijsLine(min?: number | null, max?: number | null): string {
  if (min == null) return ''
  if (max != null && max !== min) return `${formatEur(min)}–${formatEur(max)}/m²`
  return `${formatEur(min)}/m²`
}

export interface GrondprijsPopupProps {
  isOpen: boolean
  onClose: () => void
  gemeente?: string
  verdict: string
  grondproduct?: string | null
  functiecategorie?: string | null
  prijs_per_m2_min?: number | null
  prijs_per_m2_max?: number | null
  prijsgrondslag?: string | null
  peiljaar?: number | null
  grondbeleidstype?: string | null
  erfpacht_mogelijk?: boolean | null
  randvoorwaarden?: Randvoorwaarde[]
}

/* ── Detail content (reusable: drawer chrome OR in-panel drill-down) ── */

export interface GrondprijsDetailContentProps {
  gemeente?: string
  verdict: string
  grondproduct?: string | null
  functiecategorie?: string | null
  prijs_per_m2_min?: number | null
  prijs_per_m2_max?: number | null
  prijsgrondslag?: string | null
  peiljaar?: number | null
  grondbeleidstype?: string | null
  erfpacht_mogelijk?: boolean | null
  randvoorwaarden?: Randvoorwaarde[]
}

/**
 * The grondprijs detail body — meta line, focal headline, verdict keyline, and
 * the Randvoorwaarden section. Renders ONLY content (no portal/backdrop/close),
 * so it can live inside the drawer chrome OR inside the parcel detail panel.
 */
export function GrondprijsDetailContent({
  gemeente,
  verdict,
  grondproduct,
  functiecategorie,
  prijs_per_m2_min,
  prijs_per_m2_max,
  prijsgrondslag,
  peiljaar,
  grondbeleidstype,
  erfpacht_mogelijk,
  randvoorwaarden,
}: GrondprijsDetailContentProps) {
  const product = grondproduct || (functiecategorie ? FUNCTIE_LABEL[functiecategorie] : null) || 'Grondprijsband'
  const prijs = prijsLine(prijs_per_m2_min, prijs_per_m2_max)
  const grondslag = prijsgrondslag ? GRONDSLAG_LABEL[prijsgrondslag] ?? prijsgrondslag : ''

  let titel = product
  let tone: VerdictTone = 'neutral'
  let keylineLabel = ''
  let keylineLine = ''

  switch (verdict) {
    case 'passend': {
      tone = 'amber'
      keylineLabel = 'Residuele grondwaarde haalbaar'
      const prijsDeel = prijs ? `Grondprijs ${prijs}` : 'Grondprijs'
      const jaarDeel = peiljaar != null ? ` (${peiljaar})` : ''
      keylineLine = `${prijsDeel}${jaarDeel}, ${grondslag || 'residueel bepaald'}: de grondwaarde volgt het ontwikkelprogramma.`
      break
    }
    case 'context': {
      tone = 'neutral'
      keylineLabel = 'Context'
      const reden = grondbeleidstype === 'faciliterend' || grondbeleidstype === 'passief'
        ? 'de gemeente geeft hier geen grond uit'
        : `${grondslag || 'geen residuele grondslag'} — geen residu-ruimte`
      keylineLine = `${prijs ? `Grondprijsband ${prijs}. ` : ''}Telt als context: ${reden}.`
      break
    }
    case 'geen_match':
    default: {
      titel = 'Geen grondprijsband'
      tone = 'neutral'
      keylineLabel = 'Niet van toepassing'
      keylineLine = 'Geen grondprijsband sluit aan op de bestemming van dit perceel.'
      break
    }
  }

  const keyline = TONE_KEYLINE[tone]

  return (
    <>
      {/* Meta line — small, single row */}
      <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
        <span>Grondprijzen{gemeente ? ` ${gemeente}` : ''}{peiljaar != null ? ` ${peiljaar}` : ''}</span>
      </div>

      {/* Eyebrow — functiecategorie kicker for the matched verdicts */}
      {(verdict === 'passend' || verdict === 'context') && functiecategorie && (
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
        {erfpacht_mogelijk && (
          <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
            Erfpacht wordt als alternatief voor koop aangeboden.
          </p>
        )}
      </div>

      {/* Randvoorwaarden — toetsingsregels, grouped by categorie */}
      <RandvoorwaardenSection randvoorwaarden={randvoorwaarden} />
    </>
  )
}

/* ── Component ─────────────────────────────────────────────────── */

export function GrondprijsPopup({
  isOpen,
  onClose,
  gemeente,
  verdict,
  grondproduct,
  functiecategorie,
  prijs_per_m2_min,
  prijs_per_m2_max,
  prijsgrondslag,
  peiljaar,
  grondbeleidstype,
  erfpacht_mogelijk,
  randvoorwaarden,
}: GrondprijsPopupProps) {
  if (!isOpen) return null

  return (
    <FactorDetailDrawer isOpen={isOpen} onClose={onClose}>
      <GrondprijsDetailContent
        gemeente={gemeente}
        verdict={verdict}
        grondproduct={grondproduct}
        functiecategorie={functiecategorie}
        prijs_per_m2_min={prijs_per_m2_min}
        prijs_per_m2_max={prijs_per_m2_max}
        prijsgrondslag={prijsgrondslag}
        peiljaar={peiljaar}
        grondbeleidstype={grondbeleidstype}
        erfpacht_mogelijk={erfpacht_mogelijk}
        randvoorwaarden={randvoorwaarden}
      />
    </FactorDetailDrawer>
  )
}
