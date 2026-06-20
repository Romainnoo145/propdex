import { useState, useEffect } from 'react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { Flame, TrendingUp, CircleHelp, type LucideIcon } from 'lucide-react'
import { PageTitleToggle } from '@/components/map/panels/parcel/layers/PageTitleToggle'
import type { ScanResultItem, ScoreBreakdownV3, ScoreFactorV3 } from '@/lib/types/scan'
import { isScoreV3 } from '@/lib/score'
import { WoonvisiePopup, type WijkPolicy } from '../WoonvisiePopup'
import { OmgevingsvisiePopup, type GebiedPolicy, type BeleidsVerdict, type Randvoorwaarde } from '../OmgevingsvisiePopup'
import { GrondprijsPopup } from '../GrondprijsPopup'
import { FactorCard, GhostCard } from '../FactorCard'
import { useParcelProjectType } from '@/hooks/useParcelProjectType'
import { useFactorPins } from '@/hooks/useFactorPins'
import { FACTOR_BRON, buildPages } from '@/lib/factor-groups'
import type { PageCard } from '@/lib/factor-groups'

/* ── Verdict derivation ───────────────────────────────────── */

interface Verdict {
  label: string
  color: string
  badgeColor: string
  barColor: string
  Icon: LucideIcon
}

function deriveVerdict(potentieScore: number | null): Verdict {
  if (potentieScore == null)
    return {
      label: 'ONBEKEND',
      color: 'text-slate-400',
      badgeColor: 'bg-slate-400',
      barColor: 'bg-slate-400',
      Icon: CircleHelp,
    }

  if (potentieScore >= 60)
    return {
      label: 'ZEER KANSRIJK',
      color: 'text-green-600',
      badgeColor: 'bg-green-500',
      barColor: 'bg-green-500',
      Icon: Flame,
    }
  if (potentieScore >= 35)
    return {
      label: 'MOGELIJKHEDEN',
      color: 'text-emerald-500',
      badgeColor: 'bg-emerald-400',
      barColor: 'bg-emerald-400',
      Icon: TrendingUp,
    }
  return {
    label: 'BEPERKT POTENTIEEL',
    color: 'text-slate-400',
    badgeColor: 'bg-slate-300',
    barColor: 'bg-slate-300',
    Icon: CircleHelp,
  }
}

/* ── Factor display mapping ───────────────────────────────── */

/** Map from factor key → human-readable card display */
export const FACTOR_LABELS: Record<string, string> = {
  vrije_grond: 'ONDERBENUTTING',
  optoppotentie: 'HEADROOM',
  bestemming: 'BESTEMMING',
  leegstand: 'ACQUISITIE',
  funda_frictie: 'MARKT',
  perceelgrootte: 'SCHAAL',
  demografie: 'DEMOGRAFIE',
  vergunning_succeskans: 'LEGAL',
  capaciteit: 'CAPACITEIT',
  woonvisie_match: 'WOONVISIE',
  beleidsalignement: 'OMGEVINGSVISIE',
  // M054/S01 grondwaarde_fit — grondprijzenbrief fit
  grondwaarde_fit: 'GRONDWAARDE',
}

export function formatFactorValue(name: string, factor: ScoreFactorV3, parcel: ScanResultItem): { value: string; sub: string } {
  const w = factor.waarde

  switch (name) {
    case 'vrije_grond': {
      const pct = typeof w === 'number' ? Math.round(w * 100) : null
      const area = parcel.area_m2 ?? 0
      const pandOpp = parcel.building_metrics?.pand_oppervlakte_m2 ?? 0
      const marge = Math.round(Math.max(0, area - pandOpp))
      return {
        value: pct != null ? `${pct}% VRIJ` : '—',
        sub: marge > 0 ? `± ${marge.toLocaleString('nl-NL')} m² marge` : 'Geen marge',
      }
    }
    case 'optoppotentie': {
      const bm = parcel.building_metrics
      const actual = bm?.actual_bouwlagen ?? null
      const max = bm?.max_bouwlagen ?? null
      if (actual != null && max != null && max > actual) {
        return { value: `+${max - actual} LAGEN`, sub: `Max ${bm?.max_bouwhoogte ?? '?'}m toegestaan` }
      }
      const ah = bm?.actual_bouwhoogte ?? null
      const mh = bm?.max_bouwhoogte ?? null
      if (ah != null && mh != null && mh > ah) {
        return { value: `+${Math.round(mh - ah)}M`, sub: `Max ${mh}m vs huidig ${ah}m` }
      }
      return { value: '—', sub: factor.missing ? 'Geen DSO hoogtedata' : 'Max bereikt' }
    }
    case 'bestemming': {
      const best = parcel.bestemmingen
      if (Array.isArray(best) && best.length > 0) {
        const first = best[0] as { type?: string; naam?: string }
        const naam = first.naam ?? first.type ?? 'Onbekend'
        const isWonen = ['wonen', 'gemengd', 'centrum'].some((kw) =>
          `${first.type ?? ''} ${first.naam ?? ''}`.toLowerCase().includes(kw),
        )
        return {
          value: naam.toUpperCase(),
          sub: isWonen ? 'Compatibel' : 'Wijziging nodig',
        }
      }
      return { value: '—', sub: 'Geen bestemmingsdata' }
    }
    case 'leegstand': {
      const signal = parcel.vacancy_signal
      const conf = parcel.vacancy_confidence
      if (signal === 'leeg_perceel') return { value: 'LEEG', sub: `${conf != null ? Math.round(conf * 100) : '?'}% zekerheidsscore` }
      if (signal === 'leegstaand_pand') return { value: 'LEEGSTAND', sub: `${conf != null ? Math.round(conf * 100) : '?'}% zekerheidsscore` }
      if (signal === 'in_gebruik') return { value: 'IN GEBRUIK', sub: 'Geen leegstandsignaal' }
      return { value: 'ONBEKEND', sub: 'Geen leegstanddata' }
    }
    case 'funda_frictie': {
      const ms = parcel.market_signals
      if (ms && ms.listing_duration_days > 0) {
        return { value: `${ms.listing_duration_days} DAGEN`, sub: 'Frictie op Funda' }
      }
      return { value: '—', sub: factor.missing ? 'Niet op Funda' : 'Geen marktsignaal' }
    }
    case 'perceelgrootte': {
      const area = parcel.area_m2
      if (area != null && area > 0) {
        return {
          value: `${area.toLocaleString('nl-NL')} M²`,
          sub: area >= 1000 ? 'Groot perceeloppervlak' : area >= 300 ? 'Gemiddeld oppervlak' : 'Klein perceel',
        }
      }
      return { value: '—', sub: 'Geen oppervlaktedata' }
    }
    case 'demografie': {
      const score = factor.genormaliseerde_score
      if (factor.missing) return { value: '—', sub: 'Geen CBS data' }
      const label = score >= 0.7 ? 'GROEIEND' : score >= 0.4 ? 'STABIEL' : 'KRIMPEND'
      return { value: label, sub: `Score ${Math.round(score * 100)}% (CBS)` }
    }
    case 'vergunning_succeskans': {
      if (factor.missing) return { value: '—', sub: 'Geen vergunningdata' }
      const pct = Math.round(factor.genormaliseerde_score * 100)
      return { value: `${pct}% SUCCES`, sub: 'Vergunningsklimaat' }
    }
    case 'capaciteit':
      return { value: capacityValue(parcel), sub: capacitySub(parcel) }
    case 'woonvisie_match': {
      if (factor.missing) return { value: '—', sub: 'Geen woonvisie beschikbaar' }
      const wv = factor.waarde as { matched_policy?: { prioriteit?: string; wijk_naam?: string } | null; matched_wijk?: string | null } | null
      const matched = wv && typeof wv === 'object' ? wv.matched_policy : null
      const prio = matched && typeof matched === 'object' ? matched.prioriteit : null
      const PRIO_VALUE: Record<string, string> = {
        groei: 'GROEIGEBIED',
        herstructurering: 'HERSTRUCTURERING',
        krimp: 'KRIMP',
        neutraal: 'NEUTRAAL',
      }
      const value = prio && PRIO_VALUE[prio] ? PRIO_VALUE[prio] : 'GEMEENTE-BREED'
      const wijk = matched?.wijk_naam ?? wv?.matched_wijk ?? null
      const sub = wijk ? `Wijk: ${wijk}` : 'Geen wijk-specifiek beleid'
      return { value, sub }
    }
    case 'beleidsalignement': {
      const ba = factor.waarde as { matched_gebied?: string | null; verdict?: string } | null
      if (factor.missing || !ba?.matched_gebied) return { value: 'OMGEVINGSVISIE', sub: 'Geen gebied-specifiek beleid' }
      const verdictLabel: Record<string, string> = {
        kansrijk: 'Kansrijk',
        neutraal: 'Past bij visie',
        strijdig: '⚠ Strijdig met visie',
        geen_beleid: 'Geen beleid',
      }
      return { value: ba.matched_gebied, sub: verdictLabel[ba.verdict ?? ''] ?? 'Past bij visie' }
    }
    case 'grondwaarde_fit': {
      const gf = factor.waarde as {
        verdict?: string
        functiecategorie?: string | null
        prijs_per_m2_min?: number | null
        prijs_per_m2_max?: number | null
      } | null
      if (factor.missing || !gf) return { value: 'GRONDWAARDE', sub: 'Geen grondprijzenbrief' }
      const min = gf.prijs_per_m2_min
      const max = gf.prijs_per_m2_max
      const prijs =
        min != null
          ? max != null && max !== min
            ? `€${Math.round(min)}–${Math.round(max)}/m²`
            : `€${Math.round(min)}/m²`
          : null
      const VERDICT_VALUE: Record<string, string> = {
        passend: 'PASSEND',
        context: 'CONTEXT',
        geen_match: 'GEEN MATCH',
      }
      const value = VERDICT_VALUE[gf.verdict ?? ''] ?? 'GRONDWAARDE'
      const sub = prijs ?? (gf.functiecategorie ? gf.functiecategorie : 'Grondprijsbeleid')
      return { value, sub }
    }
    default:
      return { value: '—', sub: '' }
  }
}

/* ── Capacity (9th card) helpers ───────────────────────────── */

function capacityValue(parcel: ScanResultItem): string {
  const bm = parcel.building_metrics
  const area = parcel.area_m2 ?? 0
  const pandOpp = bm?.pand_oppervlakte_m2 ?? 0
  const vrij = Math.max(0, area - pandOpp)
  const maxLagen = bm?.max_bouwlagen ?? null
  if (vrij > 0 && maxLagen != null && maxLagen > 0) {
    const gbo = vrij * maxLagen * 0.8 // 80% BVO→GBO
    const units = Math.floor(gbo / 80) // 80m² per unit
    return units > 0 ? `${units} UNITS` : '—'
  }
  return '—'
}

function capacitySub(parcel: ScanResultItem): string {
  const bm = parcel.building_metrics
  const area = parcel.area_m2 ?? 0
  const pandOpp = bm?.pand_oppervlakte_m2 ?? 0
  const vrij = Math.max(0, area - pandOpp)
  const maxLagen = bm?.max_bouwlagen ?? null
  if (vrij > 0 && maxLagen != null && maxLagen > 0) {
    const gbo = Math.round(vrij * maxLagen * 0.8)
    return `± ${gbo.toLocaleString('nl-NL')} m² GBO`
  }
  return 'Onvoldoende data'
}

/* ── v2.1 fallback cards ──────────────────────────────────── */

function deriveV21Cards(parcel: ScanResultItem): Omit<PageCard, 'factor_key' | 'bron'>[] {
  const area = parcel.area_m2 ?? 0
  const pandOpp = parcel.building_metrics?.pand_oppervlakte_m2 ?? 0
  const vrijPct = area > 0 ? Math.round(Math.max(0, (1 - pandOpp / area)) * 100) : null
  const vrijM2 = Math.round(Math.max(0, area - pandOpp))

  const bm = parcel.building_metrics
  const lagenHead = bm?.actual_bouwlagen != null && bm?.max_bouwlagen != null && bm.max_bouwlagen > bm.actual_bouwlagen
    ? bm.max_bouwlagen - bm.actual_bouwlagen : null

  const best = parcel.bestemmingen
  const bestNaam = Array.isArray(best) && best.length > 0
    ? ((best[0] as { naam?: string }).naam ?? 'Onbekend').toUpperCase()
    : 'ONBEKEND'
  const isWonen = Array.isArray(best) && best.some((b) => {
    const t = `${(b as { type?: string }).type ?? ''} ${(b as { naam?: string }).naam ?? ''}`.toLowerCase()
    return ['wonen', 'gemengd', 'centrum'].some((kw) => t.includes(kw))
  })

  const signal = parcel.vacancy_signal
  const conf = parcel.vacancy_confidence
  let leegVal = 'ONBEKEND'
  let leegSub = 'Geen leegstanddata'
  if (signal === 'leeg_perceel') { leegVal = 'LEEG'; leegSub = `${conf != null ? Math.round(conf * 100) : '?'}% zekerheid` }
  else if (signal === 'leegstaand_pand') { leegVal = 'LEEGSTAND'; leegSub = `${conf != null ? Math.round(conf * 100) : '?'}% zekerheid` }
  else if (signal === 'in_gebruik') { leegVal = 'IN GEBRUIK'; leegSub = 'Geen leegstandsignaal' }

  const ms = parcel.market_signals
  const fundaVal = ms && ms.listing_duration_days > 0 ? `${ms.listing_duration_days} DAGEN` : '—'
  const fundaSub = ms && ms.listing_duration_days > 0 ? 'Frictie op Funda' : 'Niet op Funda'

  return [
    { label: 'ONDERBENUTTING', value: vrijPct != null ? `${vrijPct}% VRIJ` : '—', sub: `± ${vrijM2.toLocaleString('nl-NL')} m² marge`, pts: 0 },
    { label: 'HEADROOM', value: lagenHead != null ? `+${lagenHead} LAGEN` : '—', sub: lagenHead != null ? `Max ${bm?.max_bouwlagen} vs huidig ${bm?.actual_bouwlagen}` : 'Geen DSO data', pts: 0 },
    { label: 'BESTEMMING', value: bestNaam, sub: isWonen ? 'Compatibel' : 'Wijziging nodig', pts: 0 },
    { label: 'ACQUISITIE', value: leegVal, sub: leegSub, pts: 0 },
    { label: 'MARKT', value: fundaVal, sub: fundaSub, pts: 0 },
    { label: 'SCHAAL', value: area > 0 ? `${area.toLocaleString('nl-NL')} M²` : '—', sub: area >= 1000 ? 'Groot perceeloppervlak' : area >= 300 ? 'Gemiddeld oppervlak' : 'Klein perceel', pts: 0 },
    { label: 'DEMOGRAFIE', value: '—', sub: 'Niet beschikbaar (v2.1 scan)', pts: 0 },
    { label: 'LEGAL', value: '—', sub: 'Niet beschikbaar (v2.1 scan)', pts: 0 },
    { label: 'CAPACITEIT', value: capacityValue(parcel), sub: capacitySub(parcel), pts: 0 },
  ]
}

/* ── Main component ───────────────────────────────────────── */

interface PotentieLayerProps {
  parcel: ScanResultItem
  gemeenteNaam: string
  /**
   * When provided, the omgevingsvisie card drills down in-panel (handled by
   * the parent ParcelDetailPanel view-stack) instead of opening the standalone
   * OmgevingsvisiePopup drawer. Absent → old popup behavior (back-compat).
   */
  onOpenOmgevingsvisie?: () => void
  /**
   * When provided, the woonvisie card drills down in-panel (handled by the parent
   * ParcelDetailPanel view-stack) instead of opening the standalone WoonvisiePopup
   * drawer. Absent → old popup behavior (back-compat).
   */
  onOpenWoonvisie?: () => void
}

export const POTENTIE_KEYS = [
  'vrije_grond', 'optoppotentie', 'bestemming', 'leegstand',
  'funda_frictie', 'perceelgrootte', 'demografie', 'vergunning_succeskans',
  'capaciteit', 'woonvisie_match', 'beleidsalignement', 'grondwaarde_fit',
] as const

/**
 * Build the full potentie card list (V3 score_breakdown → typed cards, with a
 * v2.1 fallback). Extracted so both the paginated grid (legacy) and the
 * single-scroll ParcelFactorList consume the SAME pipeline. Cards keep their
 * `factor_key`, `bron` and `pts` (= weighted contribution `bijdrage`).
 */
export function buildPotentieCards(parcel: ScanResultItem): PageCard[] {
  if (isScoreV3(parcel.score_breakdown) && parcel.score_breakdown) {
    const breakdown = parcel.score_breakdown as ScoreBreakdownV3
    return POTENTIE_KEYS.map((key) => {
      const factor = breakdown[key]
      const bron = FACTOR_BRON[key] ?? 'fysiek'
      if (factor) {
        const { value, sub } = formatFactorValue(key, factor, parcel)
        return {
          label: FACTOR_LABELS[key] ?? key.toUpperCase(),
          value,
          sub,
          pts: Math.round(factor.bijdrage * 10) / 10,
          factor_key: key,
          bron,
          missing: factor.missing,
        }
      }
      if (key === 'capaciteit') {
        return {
          label: FACTOR_LABELS[key] ?? key.toUpperCase(),
          value: capacityValue(parcel),
          sub: capacitySub(parcel),
          pts: 0,
          factor_key: key,
          bron,
        }
      }
      return {
        label: FACTOR_LABELS[key] ?? key.toUpperCase(),
        value: '—',
        sub: 'Data niet beschikbaar',
        pts: 0,
        factor_key: key,
        bron,
        missing: true,
      }
    })
  }
  // v2.1 fallback — wrap deriveV21Cards results with factor_key + bron
  return deriveV21Cards(parcel).map((c, i) => ({
    ...c,
    factor_key: POTENTIE_KEYS[i] ?? `v21-${i}`,
    bron: FACTOR_BRON[POTENTIE_KEYS[i] ?? ''] ?? 'fysiek',
  }))
}

/** grondwaarde_fit factor.waarde shape (M054/S01). */
interface GrondwaardeFitWaarde {
  verdict: string
  peiljaar?: number | null
  grondbeleidstype?: string | null
  grondproduct?: string | null
  functiecategorie?: string | null
  prijs_per_m2_min?: number | null
  prijs_per_m2_max?: number | null
  prijsgrondslag?: string | null
  erfpacht_mogelijk?: boolean | null
  randvoorwaarden?: Randvoorwaarde[]
}

/** Verdicts that carry popup content (clickable). */
const GRONDPRIJS_ACTIVE_VERDICTS = new Set(['passend', 'context'])

export function PotentieLayer({ parcel, gemeenteNaam, onOpenOmgevingsvisie, onOpenWoonvisie }: PotentieLayerProps) {
  const [page, setPage] = useState(0)
  const [woonvisieOpen, setWoonvisieOpen] = useState(false)
  const [omgevingsvisieOpen, setOmgevingsvisieOpen] = useState(false)
  const [grondprijsOpen, setGrondprijsOpen] = useState(false)
  const { data: projectTypeData } = useParcelProjectType(parcel.parcel_id)
  const projectType = projectTypeData?.project_type ?? 'onbepaald'
  const { pins, toggle, isPinned } = useFactorPins('potentie')

  // Extract woonvisie factor data for popup. Phase 6 factor.waarde shape:
  // { matched_wijk, matched_policy, prioritized_segment, algemeen_citaat } | null
  const woonvisieFactor = (parcel.score_breakdown as ScoreBreakdownV3 | null)?.['woonvisie_match']
  const woonvisieWaarde = woonvisieFactor?.waarde as {
    matched_wijk: string | null
    matched_policy: WijkPolicy | null
    prioritized_segment: string | null
    algemeen_citaat: string
    periode_start?: number
    periode_einde?: number
    randvoorwaarden?: Randvoorwaarde[]
  } | null
  const hasWoonvisieData = woonvisieWaarde !== null && woonvisieWaarde !== undefined

  const omgevingsvisieFactor = (parcel.score_breakdown as ScoreBreakdownV3 | null)?.['beleidsalignement']
  const omgevingsvisieWaarde = omgevingsvisieFactor?.waarde as {
    matched_gebied: string | null
    matched_policy: GebiedPolicy | null
    algemeen_citaat: string
    tijdshorizon: number
    verdict?: string
    randvoorwaarden?: Randvoorwaarde[]
  } | null
  const hasOmgevingsvisieData = omgevingsvisieWaarde !== null && omgevingsvisieWaarde !== undefined

  const grondprijsFactor = (parcel.score_breakdown as ScoreBreakdownV3 | null)?.['grondwaarde_fit']
  const grondprijsWaarde = grondprijsFactor?.waarde as GrondwaardeFitWaarde | null
  const hasGrondprijsData =
    grondprijsWaarde != null && GRONDPRIJS_ACTIVE_VERDICTS.has(grondprijsWaarde.verdict)

  const potentieScore = parcel.potentie_score != null
    ? Math.round(parcel.potentie_score)
    : parcel.score != null ? Math.round(parcel.score) : null
  const potentieVerdict = deriveVerdict(potentieScore)

  const allCards: PageCard[] = buildPotentieCards(parcel)

  const pages = buildPages(allCards, pins.map((p) => ({ id: p.id, factor_key: p.factor_key, position: p.position })))
  // Clamp the active page during render instead of correcting via effect.
  const safePage = Math.min(page, Math.max(0, pages.length - 1))
  const currentPage = pages[safePage]

  const springVal = useSpring(0, { stiffness: 60, damping: 20 })
  useEffect(() => {
    const timer = setTimeout(() => springVal.set(potentieScore ?? 0), 300)
    return () => clearTimeout(timer)
  }, [potentieScore, springVal])
  const barWidth = useTransform(springVal, (v) => `${v}%`)

  return (
    <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
      {/* ── Verdict Hero ──────────────────────────────────── */}
      <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-5 rounded-[20px]">
        <div className="flex items-center justify-between">
          <span className="text-7xl font-black tracking-tighter text-slate-900 tabular-nums leading-none">
            {potentieScore ?? '—'}
          </span>

          <div className="flex-1 px-6 min-w-0">
            <p className={`text-xl font-bold uppercase tracking-wide ${potentieVerdict.color}`}>
              {potentieVerdict.label}
            </p>
          </div>

          <div className={`size-12 rounded-full flex items-center justify-center shrink-0 ${potentieVerdict.badgeColor}`}>
            <potentieVerdict.Icon className="size-6 text-white" strokeWidth={2.5} />
          </div>
        </div>

        <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
          <motion.div className={`h-full rounded-full ${potentieVerdict.barColor}`} style={{ width: barWidth }} />
        </div>
      </div>

      {/* ── Factor Cards Grid with page transition ────────── */}
      <div className="flex-1 mt-4 relative flex flex-col">
        <PageTitleToggle pages={pages} activeIndex={safePage} onSelect={setPage} />
        <AnimatePresence mode="wait">
          <motion.div
            key={safePage}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 grid-rows-2 gap-1.5 auto-rows-fr flex-1"
          >
            {(currentPage?.cards ?? []).map((slot, idx) => {
              if ('kind' in slot && slot.kind === 'ghost') {
                return <GhostCard key={`ghost-${idx}`} />
              }
              const card = slot as PageCard
              const pinned = isPinned(card.factor_key)
              return (
                <FactorCard
                  key={card.factor_key}
                  card={{ label: card.label, value: card.value, sub: card.sub, pts: card.pts }}
                  tone="positive"
                  isPinned={pinned}
                  isMissing={!!card.missing}
                  onStarClick={() => toggle(card.factor_key)}
                  onCardClick={
                    card.factor_key === 'woonvisie_match' && hasWoonvisieData
                      ? onOpenWoonvisie ?? (() => setWoonvisieOpen(true))
                      : card.factor_key === 'beleidsalignement' && hasOmgevingsvisieData
                        ? onOpenOmgevingsvisie ?? (() => setOmgevingsvisieOpen(true))
                        : card.factor_key === 'grondwaarde_fit' && hasGrondprijsData
                          ? () => setGrondprijsOpen(true)
                          : undefined
                  }
                />
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {hasWoonvisieData && !onOpenWoonvisie && (
        <WoonvisiePopup
          isOpen={woonvisieOpen}
          onClose={() => setWoonvisieOpen(false)}
          gemeente={gemeenteNaam}
          periode_start={woonvisieWaarde!.periode_start ?? 0}
          periode_einde={woonvisieWaarde!.periode_einde ?? 0}
          matched_policy={woonvisieWaarde!.matched_policy}
          algemeen_citaat={woonvisieWaarde!.algemeen_citaat ?? ''}
          project_type={projectType}
          randvoorwaarden={woonvisieWaarde!.randvoorwaarden}
        />
      )}

      {hasOmgevingsvisieData && !onOpenOmgevingsvisie && (
        <OmgevingsvisiePopup
          isOpen={omgevingsvisieOpen}
          onClose={() => setOmgevingsvisieOpen(false)}
          gemeente={gemeenteNaam}
          tijdshorizon={omgevingsvisieWaarde!.tijdshorizon ?? 0}
          matched_policy={omgevingsvisieWaarde!.matched_policy}
          algemeen_citaat={omgevingsvisieWaarde!.algemeen_citaat ?? ''}
          project_type={projectType}
          verdict={omgevingsvisieWaarde!.verdict as BeleidsVerdict | undefined}
          randvoorwaarden={omgevingsvisieWaarde?.randvoorwaarden}
        />
      )}

      {hasGrondprijsData && (
        <GrondprijsPopup
          isOpen={grondprijsOpen}
          onClose={() => setGrondprijsOpen(false)}
          gemeente={gemeenteNaam}
          verdict={grondprijsWaarde!.verdict}
          grondproduct={grondprijsWaarde!.grondproduct}
          functiecategorie={grondprijsWaarde!.functiecategorie}
          prijs_per_m2_min={grondprijsWaarde!.prijs_per_m2_min}
          prijs_per_m2_max={grondprijsWaarde!.prijs_per_m2_max}
          prijsgrondslag={grondprijsWaarde!.prijsgrondslag}
          peiljaar={grondprijsWaarde!.peiljaar}
          grondbeleidstype={grondprijsWaarde!.grondbeleidstype}
          erfpacht_mogelijk={grondprijsWaarde!.erfpacht_mogelijk}
          randvoorwaarden={grondprijsWaarde!.randvoorwaarden}
        />
      )}
    </div>
  )
}
