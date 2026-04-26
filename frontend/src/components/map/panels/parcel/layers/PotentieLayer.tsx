import { useState, useEffect } from 'react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { Flame, TrendingUp, CircleHelp, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { ScanResultItem, ScoreBreakdownV3, ScoreFactorV3 } from '@/lib/types/scan'
import { isScoreV3 } from '@/lib/score'
import { TruncatedText } from '../TruncatedText'
import { WoonvisiePopup, type WijkPolicy } from '../WoonvisiePopup'
import { useParcelProjectType } from '@/hooks/useParcelProjectType'

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

/* ── One-liner generation ─────────────────────────────────── */

function generateOneLiner(
  parcel: ScanResultItem,
  cards: CardDisplay[],
  isV3: boolean,
): string {
  if (isV3 && parcel.score_breakdown) {
    // Pick the 2 highest-contributing factors for the one-liner
    const top = [...cards]
      .filter((c) => c.pts > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 2)
    if (top.length > 0) return top.map((c) => `${c.value}`).join(' \u00b7 ')
  }

  // v2.1 fallback
  const parts: string[] = []
  const area = parcel.area_m2 ?? 0
  const pandOpp = parcel.building_metrics?.pand_oppervlakte_m2 ?? 0
  const vrijPct = area > 0 ? Math.round(Math.max(0, (1 - pandOpp / area)) * 100) : null
  if (vrijPct != null && vrijPct > 5) parts.push(`${vrijPct}% vrije ruimte`)

  const best = parcel.bestemmingen
  if (Array.isArray(best) && best.length > 0) {
    const first = best[0] as { type?: string; naam?: string }
    const isWonen = ['wonen', 'gemengd', 'centrum'].some((kw) =>
      `${first.type ?? ''} ${first.naam ?? ''}`.toLowerCase().includes(kw),
    )
    if (isWonen) parts.push('Wonen-bestemming')
  }

  if (parcel.vacancy_signal && parcel.vacancy_signal !== 'onbekend' && parcel.vacancy_signal !== 'in_gebruik') {
    parts.push('leegstandsignaal')
  }

  if (parts.length === 0) {
    return parcel.bouwjaar != null ? `Bouwjaar ${parcel.bouwjaar} \u2014 heuristiek` : 'Beperkte data'
  }
  return parts.slice(0, 2).join(' \u00b7 ')
}

/* ── Factor display mapping ───────────────────────────────── */

interface CardDisplay {
  label: string
  value: string
  sub: string
  pts: number
}

/** Map from factor key → human-readable card display */
const FACTOR_LABELS: Record<string, string> = {
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
}

function formatFactorValue(name: string, factor: ScoreFactorV3, parcel: ScanResultItem): { value: string; sub: string } {
  const w = factor.waarde

  switch (name) {
    case 'vrije_grond': {
      const pct = typeof w === 'number' ? Math.round(w * 100) : null
      const area = parcel.area_m2 ?? 0
      const pandOpp = parcel.building_metrics?.pand_oppervlakte_m2 ?? 0
      const marge = Math.round(Math.max(0, area - pandOpp))
      return {
        value: pct != null ? `${pct}% VRIJ` : '\u2014',
        sub: marge > 0 ? `\u00b1 ${marge.toLocaleString('nl-NL')} m\u00b2 marge` : 'Geen marge',
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
      return { value: '\u2014', sub: factor.missing ? 'Geen DSO hoogtedata' : 'Max bereikt' }
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
      return { value: '\u2014', sub: 'Geen bestemmingsdata' }
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
      return { value: '\u2014', sub: factor.missing ? 'Niet op Funda' : 'Geen marktsignaal' }
    }
    case 'perceelgrootte': {
      const area = parcel.area_m2
      if (area != null && area > 0) {
        return {
          value: `${area.toLocaleString('nl-NL')} M\u00b2`,
          sub: area >= 1000 ? 'Groot perceeloppervlak' : area >= 300 ? 'Gemiddeld oppervlak' : 'Klein perceel',
        }
      }
      return { value: '\u2014', sub: 'Geen oppervlaktedata' }
    }
    case 'demografie': {
      const score = factor.genormaliseerde_score
      if (factor.missing) return { value: '\u2014', sub: 'Geen CBS data' }
      const label = score >= 0.7 ? 'GROEIEND' : score >= 0.4 ? 'STABIEL' : 'KRIMPEND'
      return { value: label, sub: `Score ${Math.round(score * 100)}% (CBS)` }
    }
    case 'vergunning_succeskans': {
      if (factor.missing) return { value: '\u2014', sub: 'Geen vergunningdata' }
      const pct = Math.round(factor.genormaliseerde_score * 100)
      return { value: `${pct}% SUCCES`, sub: 'Vergunningsklimaat' }
    }
    case 'capaciteit':
      return { value: capacityValue(parcel), sub: capacitySub(parcel) }
    case 'woonvisie_match': {
      if (factor.missing) return { value: '—', sub: 'Geen woonvisie beschikbaar' }
      const w = factor.waarde as { matched_policy?: { prioriteit?: string; wijk_naam?: string } | null; matched_wijk?: string | null } | null
      const matched = w && typeof w === 'object' ? w.matched_policy : null
      const prio = matched && typeof matched === 'object' ? matched.prioriteit : null
      const PRIO_VALUE: Record<string, string> = {
        groei: 'GROEIGEBIED',
        herstructurering: 'HERSTRUCTURERING',
        krimp: 'KRIMP',
        neutraal: 'NEUTRAAL',
      }
      const value = prio && PRIO_VALUE[prio] ? PRIO_VALUE[prio] : 'GEMEENTE-BREED'
      const wijk = matched?.wijk_naam ?? w?.matched_wijk ?? null
      const sub = wijk ? `Wijk: ${wijk}` : 'Geen wijk-specifiek beleid'
      return { value, sub }
    }
    default:
      return { value: '\u2014', sub: '' }
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
    return units > 0 ? `${units} UNITS` : '\u2014'
  }
  return '\u2014'
}

function capacitySub(parcel: ScanResultItem): string {
  const bm = parcel.building_metrics
  const area = parcel.area_m2 ?? 0
  const pandOpp = bm?.pand_oppervlakte_m2 ?? 0
  const vrij = Math.max(0, area - pandOpp)
  const maxLagen = bm?.max_bouwlagen ?? null
  if (vrij > 0 && maxLagen != null && maxLagen > 0) {
    const gbo = Math.round(vrij * maxLagen * 0.8)
    return `\u00b1 ${gbo.toLocaleString('nl-NL')} m\u00b2 GBO`
  }
  return 'Onvoldoende data'
}

/* ── v2.1 fallback cards ──────────────────────────────────── */

function deriveV21Cards(parcel: ScanResultItem): CardDisplay[] {
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
  const fundaVal = ms && ms.listing_duration_days > 0 ? `${ms.listing_duration_days} DAGEN` : '\u2014'
  const fundaSub = ms && ms.listing_duration_days > 0 ? 'Frictie op Funda' : 'Niet op Funda'

  return [
    { label: 'ONDERBENUTTING', value: vrijPct != null ? `${vrijPct}% VRIJ` : '\u2014', sub: `\u00b1 ${vrijM2.toLocaleString('nl-NL')} m\u00b2 marge`, pts: 0 },
    { label: 'HEADROOM', value: lagenHead != null ? `+${lagenHead} LAGEN` : '\u2014', sub: lagenHead != null ? `Max ${bm?.max_bouwlagen} vs huidig ${bm?.actual_bouwlagen}` : 'Geen DSO data', pts: 0 },
    { label: 'BESTEMMING', value: bestNaam, sub: isWonen ? 'Compatibel' : 'Wijziging nodig', pts: 0 },
    { label: 'ACQUISITIE', value: leegVal, sub: leegSub, pts: 0 },
    { label: 'MARKT', value: fundaVal, sub: fundaSub, pts: 0 },
    { label: 'SCHAAL', value: area > 0 ? `${area.toLocaleString('nl-NL')} M\u00b2` : '\u2014', sub: area >= 1000 ? 'Groot perceeloppervlak' : area >= 300 ? 'Gemiddeld oppervlak' : 'Klein perceel', pts: 0 },
    { label: 'DEMOGRAFIE', value: '\u2014', sub: 'Niet beschikbaar (v2.1 scan)', pts: 0 },
    { label: 'LEGAL', value: '\u2014', sub: 'Niet beschikbaar (v2.1 scan)', pts: 0 },
    { label: 'CAPACITEIT', value: capacityValue(parcel), sub: capacitySub(parcel), pts: 0 },
  ]
}

/* ── Main component ───────────────────────────────────────── */

interface PotentieLayerProps {
  parcel: ScanResultItem
  gemeenteNaam: string
}

const CARDS_PER_PAGE = 9

export function PotentieLayer({ parcel, gemeenteNaam }: PotentieLayerProps) {
  const [page, setPage] = useState(0)
  const [woonvisieOpen, setWoonvisieOpen] = useState(false)
  const { data: projectTypeData } = useParcelProjectType(parcel.parcel_id)
  const projectType = projectTypeData?.project_type ?? 'onbepaald'

  // Extract woonvisie factor data for popup. Phase 6 factor.waarde shape:
  // { matched_wijk, matched_policy, prioritized_segment, algemeen_citaat } | null
  const woonvisieFactor = (parcel.score_breakdown as ScoreBreakdownV3 | null)?.['woonvisie_match']
  const woonvisieWaarde = woonvisieFactor?.waarde as {
    matched_wijk: string | null
    matched_policy: WijkPolicy | null
    prioritized_segment: string | null
    algemeen_citaat: string
  } | null
  const hasWoonvisieData = woonvisieWaarde !== null && woonvisieWaarde !== undefined
  const isV3 = isScoreV3(parcel.score_breakdown)
  const potentieScore = parcel.potentie_score != null
    ? Math.round(parcel.potentie_score)
    : parcel.score != null ? Math.round(parcel.score) : null
  const verdict = deriveVerdict(potentieScore)

  const POTENTIE_KEYS = [
    'vrije_grond', 'optoppotentie', 'bestemming', 'leegstand',
    'funda_frictie', 'perceelgrootte', 'demografie', 'vergunning_succeskans',
    'capaciteit', 'woonvisie_match',
  ] as const

  const allCards: CardDisplay[] = (() => {
    if (isV3 && parcel.score_breakdown) {
      const breakdown = parcel.score_breakdown as ScoreBreakdownV3
      return POTENTIE_KEYS.map((key) => {
        const factor = breakdown[key]
        if (factor) {
          const { value, sub } = formatFactorValue(key, factor, parcel)
          return { label: FACTOR_LABELS[key] ?? key.toUpperCase(), value, sub, pts: Math.round(factor.bijdrage * 10) / 10 }
        }
        if (key === 'capaciteit') {
          return { label: FACTOR_LABELS[key] ?? key.toUpperCase(), value: capacityValue(parcel), sub: capacitySub(parcel), pts: 0 }
        }
        return { label: FACTOR_LABELS[key] ?? key.toUpperCase(), value: '—', sub: 'Data niet beschikbaar', pts: 0 }
      })
    }
    return deriveV21Cards(parcel)
  })()

  const totalPages = Math.ceil(allCards.length / CARDS_PER_PAGE)
  const pageCards = allCards.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE)
  const oneLiner = generateOneLiner(parcel, allCards, isV3)

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
            <p className={`text-xl font-bold uppercase tracking-wide ${verdict.color}`}>
              {verdict.label}
            </p>
            <TruncatedText text={oneLiner} className="text-[13px] text-slate-500 mt-0.5 truncate" />
          </div>

          <div className={`size-12 rounded-full flex items-center justify-center shrink-0 ${verdict.badgeColor}`}>
            <verdict.Icon className="size-6 text-white" strokeWidth={2.5} />
          </div>
        </div>

        <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
          <motion.div className={`h-full rounded-full ${verdict.barColor}`} style={{ width: barWidth }} />
        </div>
      </div>

      {/* ── 3x3 Intelligence Grid with page transition ───── */}
      <div className="flex-1 mt-4 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-3 gap-1.5 auto-rows-fr h-full"
          >
            {pageCards.map((card) => {
              if (card.label === 'WOONVISIE' && hasWoonvisieData) {
                return (
                  <button
                    key={card.label}
                    type="button"
                    onClick={() => setWoonvisieOpen(true)}
                    className="bg-white border border-slate-100 rounded-[24px] p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow overflow-hidden text-left cursor-pointer"
                  >
                    <div className="flex justify-between items-start gap-1">
                      <TruncatedText text={card.label} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-tight line-clamp-1 pr-1" />
                      <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-black shrink-0">
                        {card.pts > 0 ? `+${card.pts}` : '—'}
                      </span>
                    </div>

                    <div className="flex-1 flex items-center min-w-0">
                      <TruncatedText text={card.value} className="text-2xl font-black text-slate-900 tracking-tight leading-[1.05] line-clamp-2 break-words pr-1" />
                    </div>

                    <div className="border-t border-slate-50 pt-3 min-w-0">
                      <TruncatedText text={card.sub} className="text-[11px] font-bold text-slate-400 leading-tight line-clamp-2 pr-1" />
                    </div>
                  </button>
                )
              }
              return (
                <div
                  key={card.label}
                  className="bg-white border border-slate-100 rounded-[24px] p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="flex justify-between items-start gap-1">
                    <TruncatedText text={card.label} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-tight line-clamp-1 pr-1" />
                    <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-black shrink-0">
                      {card.pts > 0 ? `+${card.pts}` : '—'}
                    </span>
                  </div>

                  <div className="flex-1 flex items-center min-w-0">
                    <TruncatedText text={card.value} className="text-2xl font-black text-slate-900 tracking-tight leading-[1.05] line-clamp-2 break-words pr-1" />
                  </div>

                  <div className="border-t border-slate-50 pt-3 min-w-0">
                    <TruncatedText text={card.sub} className="text-[11px] font-bold text-slate-400 leading-tight line-clamp-2 pr-1" />
                  </div>
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Pagination Footer ──────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 transition-colors"
          aria-label="Vorige pagina"
        >
          <ChevronLeft className="size-4 text-slate-400" />
        </button>
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 transition-colors"
          aria-label="Volgende pagina"
        >
          <ChevronRight className="size-4 text-slate-400" />
        </button>
      </div>

      {hasWoonvisieData && (
        <WoonvisiePopup
          isOpen={woonvisieOpen}
          onClose={() => setWoonvisieOpen(false)}
          gemeente={gemeenteNaam}
          periode_start={0}
          periode_einde={0}
          matched_policy={woonvisieWaarde!.matched_policy}
          algemeen_citaat={woonvisieWaarde!.algemeen_citaat ?? ''}
          project_type={projectType}
          confidence={1.0}
        />
      )}
    </div>
  )
}
