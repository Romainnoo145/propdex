import { useState, useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { ShieldAlert, ShieldCheck, ShieldQuestion, type LucideIcon } from 'lucide-react'
import type { ScanResultItem, ScoreBreakdownV3, ScoreFactorV3 } from '@/lib/types/scan'
import { isScoreV3 } from '@/lib/score'
import { useParcelEnrichment } from '@/hooks/useScans'
import { FactorKpiCard } from '../FactorKpiCard'
import { FactorDetailDrawer } from '../FactorDetailDrawer'
import { FactorExplainBody } from '../FactorExplainBody'
import { parseFactors, isCascadeFactor, factorInBreakdown } from '../lib/factor-detail'
import { FACTOR_BRON } from '@/lib/factor-groups'
import type { PageCard } from '@/lib/factor-groups'
import { sortByWeight, PLANNED_RISICO } from '../lib/factor-list'
import { HuisvestingsverordeningPopup } from '../HuisvestingsverordeningPopup'
import { ParkeernormenPopup, type Correctie } from '../ParkeernormenPopup'
import type { Randvoorwaarde } from '../OmgevingsvisiePopup'

/* ── Verdict derivation ───────────────────────────────────── */

interface Verdict {
  label: string
  color: string
  badgeColor: string
  barColor: string
  Icon: LucideIcon
}

function deriveVerdict(risicoScore: number | null): Verdict {
  if (risicoScore == null)
    return {
      label: 'ONBEKEND',
      color: 'text-slate-400',
      badgeColor: 'bg-slate-400',
      barColor: 'bg-slate-400',
      Icon: ShieldQuestion,
    }

  if (risicoScore < 30)
    return {
      label: 'LAAG RISICO',
      color: 'text-green-600',
      badgeColor: 'bg-green-500',
      barColor: 'bg-green-500',
      Icon: ShieldCheck,
    }
  if (risicoScore < 60)
    return {
      label: 'GEMIDDELD RISICO',
      color: 'text-amber-500',
      badgeColor: 'bg-amber-500',
      barColor: 'bg-amber-400',
      Icon: ShieldQuestion,
    }
  return {
    label: 'HOOG RISICO',
    color: 'text-red-500',
    badgeColor: 'bg-red-500',
    barColor: 'bg-red-500',
    Icon: ShieldAlert,
  }
}

/* ── Factor display mapping ───────────────────────────────── */

export const FACTOR_LABELS: Record<string, string> = {
  funderingsrisico: 'FUNDERING',
  asbest: 'ASBEST',
  bodemverontreiniging: 'BODEM',
  monument: 'MONUMENT',
  bestemmingswijziging: 'HERBESTEMMING',
  constructieve_staat: 'CONSTRUCTIE',
  juridisch_klimaat: 'JURIDISCH',
  criminaliteit: 'CRIMINALITEIT',
  max_hoogte_bereikt: 'HOOGTE',
  // M050/S03 BRK risico factors (Phase 8 wire-up — backend shipped in 03-02)
  hypotheek_risico: 'HYPOTHEEK',
  eigendoms_complexiteit: 'EIGENDOMSCOMPL.',
  koopwaarde_trend: 'KOOPWAARDE',
  // M053/S12 splitsingsrisico — opkoopbescherming / woonruimtevoorraad
  splitsingsrisico: 'OPKOOP',
  // M054/S02 parkeerdruk — gemeentelijke Nota parkeernormen
  parkeerdruk: 'PARKEERDRUK',
}

function riskLevel(score: number): string {
  if (score >= 0.7) return 'HOOG'
  if (score >= 0.4) return 'GEMIDDELD'
  return 'LAAG'
}

export function formatFactorValue(name: string, factor: ScoreFactorV3): { value: string; sub: string } {
  const w = factor.waarde as Record<string, unknown> | boolean | string | null
  const s = factor.genormaliseerde_score

  switch (name) {
    case 'funderingsrisico': {
      if (factor.missing) return { value: '—', sub: 'Geen funderingsdata' }
      const fgr = typeof w === 'object' && w !== null ? String((w as Record<string, unknown>).fgr ?? '') : ''
      return { value: riskLevel(s), sub: fgr ? `FGR: ${fgr}` : factor.toelichting_kort.slice(0, 40) }
    }
    case 'asbest': {
      if (factor.missing) return { value: '—', sub: 'Geen bouwjaardata' }
      const bj = typeof w === 'object' && w !== null ? (w as Record<string, unknown>).bouwjaar : null
      const label = s >= 0.7 ? 'RISICO' : s > 0 ? 'BEPERKT' : 'VEILIG'
      return { value: label, sub: bj != null ? `Bouwjaar ${bj}` : factor.toelichting_kort.slice(0, 40) }
    }
    case 'bodemverontreiniging': {
      if (factor.missing) return { value: '—', sub: 'Geen bodemdata' }
      const d = typeof w === 'object' && w !== null ? (w as Record<string, unknown>) : {}
      const dossiers = Number(d.dossiers_count ?? 0)
      const contam = Boolean(d.has_known_contamination)
      if (contam) return { value: 'VERVUILD', sub: `${dossiers} dossier(s)` }
      if (dossiers > 0) return { value: `${dossiers} DOSSIER`, sub: 'Geen bekende vervuiling' }
      return { value: 'SCHOON', sub: 'Geen dossiers' }
    }
    case 'monument': {
      if (typeof w === 'boolean') {
        return w
          ? { value: 'BESCHERMD', sub: 'Erfgoedstatus' }
          : { value: 'VRIJ', sub: 'Geen monument' }
      }
      return { value: '—', sub: 'Geen monumentdata' }
    }
    case 'bestemmingswijziging': {
      const btype = typeof w === 'string' ? w : ''
      if (s <= 0) return { value: 'NEE', sub: 'Woonbestemming' }
      if (s <= 0.3) return { value: 'BEPERKT', sub: btype ? btype.slice(0, 16) : 'Gemengd' }
      return { value: 'NODIG', sub: btype ? btype.slice(0, 16) : 'Wijziging vereist' }
    }
    case 'constructieve_staat': {
      if (factor.missing) return { value: '—', sub: 'Geen bouwjaardata' }
      const d = typeof w === 'object' && w !== null ? (w as Record<string, unknown>) : {}
      const bj = d.bouwjaar as number | null
      const ek = d.energieklasse as string | null
      const parts: string[] = []
      if (bj != null) parts.push(`Bj ${bj}`)
      if (ek) parts.push(`Label ${ek.toUpperCase()}`)
      return { value: riskLevel(s), sub: parts.length > 0 ? parts.join(' · ') : 'Onbekend' }
    }
    case 'juridisch_klimaat': {
      if (factor.missing) return { value: '—', sub: 'Geen vergunningdata' }
      const d = typeof w === 'object' && w !== null ? (w as Record<string, unknown>) : {}
      const rate = Number(d.approval_rate ?? 0)
      const pct = Math.round(rate * 100)
      return { value: `${pct}%`, sub: 'Goedkeuring' }
    }
    case 'criminaliteit': {
      if (factor.missing) return { value: '—', sub: 'Geen CBS data' }
      const d = typeof w === 'object' && w !== null ? (w as Record<string, unknown>) : {}
      const per1000 = Number(d.per_1000_inwoners ?? 0)
      return { value: riskLevel(s), sub: `${Math.round(per1000)}/1.000 inw.` }
    }
    case 'max_hoogte_bereikt': {
      if (factor.missing) return { value: '—', sub: 'Geen DSO data' }
      const d = typeof w === 'object' && w !== null ? (w as Record<string, unknown>) : {}
      const atMax = Boolean(d.at_max)
      const detail = String(d.detail ?? '')
      return {
        value: atMax ? 'BEREIKT' : 'RUIMTE',
        sub: detail || (atMax ? 'Max bereikt' : 'Optopping mogelijk'),
      }
    }
    // M050/S03 BRK risico factors (Phase 8 wire-up)
    case 'hypotheek_risico': {
      // backend waarde: {n_with_hypotheek, n_total}; binary semantic = ANY owner mortgaged
      const has =
        factor.waarde === true ||
        factor.waarde === 'ja' ||
        factor.waarde === 'Ja' ||
        (typeof factor.waarde === 'object' &&
          factor.waarde !== null &&
          Number((factor.waarde as Record<string, unknown>).n_with_hypotheek ?? 0) > 0)
      return {
        value: has ? 'Ja' : 'Nee',
        sub: has ? 'Hypotheek-registratie aanwezig' : 'Geen hypotheek',
      }
    }
    case 'eigendoms_complexiteit': {
      // backend waarde: {n_owners} dict OR legacy string ('enkelvoudig' | 'gedeeld' | ...)
      if (
        typeof factor.waarde === 'object' &&
        factor.waarde !== null &&
        'n_owners' in (factor.waarde as object)
      ) {
        const n = Number((factor.waarde as Record<string, unknown>).n_owners ?? 0)
        if (n <= 1) return { value: 'Enkelvoudig', sub: '1 eigenaar' }
        if (n === 2) return { value: 'Gedeeld', sub: '2 eigenaren' }
        return { value: 'Complex', sub: `${n} eigenaren` }
      }
      const v = String(factor.waarde ?? '—')
      return { value: v.charAt(0).toUpperCase() + v.slice(1), sub: '' }
    }
    case 'koopwaarde_trend': {
      // backend waarde: dict {koopjaar, age_jaar?, koopsom} OR int koopjaar fallback
      if (
        factor.waarde &&
        typeof factor.waarde === 'object' &&
        'koopjaar' in (factor.waarde as object)
      ) {
        const v = factor.waarde as { koopjaar: number | null; koopsom: number | null }
        const jaar = v.koopjaar !== null && v.koopjaar !== undefined ? String(v.koopjaar) : '—'
        const sum =
          v.koopsom !== null && v.koopsom !== undefined
            ? new Intl.NumberFormat('nl-NL', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              }).format(v.koopsom)
            : ''
        return { value: jaar, sub: sum }
      }
      return { value: String(factor.waarde ?? '—'), sub: 'koopjaar' }
    }
    // M053/S12 splitsingsrisico — opkoopbescherming verdict
    case 'splitsingsrisico': {
      if (factor.missing) return { value: '—', sub: 'Geen regeling' }
      const d = typeof w === 'object' && w !== null ? (w as Record<string, unknown>) : {}
      const verdict = String(d.verdict ?? '')
      const buurt = typeof d.buurt_naam === 'string' ? d.buurt_naam : null
      switch (verdict) {
        case 'van_toepassing':
          return { value: 'JA', sub: buurt || 'Beschermde buurt' }
        case 'mogelijk_van_toepassing':
          return { value: 'MOGELIJK', sub: buurt || 'Beschermde buurt' }
        case 'vergunningstelsel_voorraad':
          return { value: 'VERGUNNING', sub: 'Voorraadstelsel' }
        case 'boven_woz_grens':
          return { value: 'NEE', sub: 'Boven WOZ-grens' }
        case 'buiten_beschermd_gebied':
          return { value: 'NEE', sub: 'Buiten gebied' }
        case 'niet_van_toepassing':
          return { value: 'N.V.T.', sub: 'Onbebouwd' }
        default:
          return { value: '—', sub: 'Geen regeling' }
      }
    }
    // M054/S02 parkeerdruk — Nota parkeernormen verdict
    case 'parkeerdruk': {
      if (factor.missing) return { value: '—', sub: 'Geen parkeernorm' }
      const d = typeof w === 'object' && w !== null ? (w as Record<string, unknown>) : {}
      const verdict = String(d.verdict ?? '')
      const gebied = typeof d.gebied === 'string' ? d.gebied : null
      const gebiedSub = gebied
        ? ({
            centrum: 'Centrum',
            schil_centrum: 'Centrumschil',
            rest_bebouwde_kom: 'Bebouwde kom',
            buitengebied: 'Buitengebied',
          }[gebied] ?? gebied)
        : null
      switch (verdict) {
        case 'verhoogd':
          return { value: 'VERHOOGD', sub: gebiedSub || 'Zware parkeereis' }
        case 'laag':
          return { value: 'LAAG', sub: gebiedSub || 'Beheersbaar' }
        case 'geen_match':
          return { value: 'N.V.T.', sub: 'Geen normband' }
        default:
          return { value: '—', sub: 'Geen parkeernorm' }
      }
    }
    default:
      return { value: '—', sub: '' }
  }
}

/* ── v2.1 fallback cards ──────────────────────────────────── */

function deriveV21Cards(parcel: ScanResultItem): Omit<PageCard, 'factor_key' | 'bron'>[] {
  const bj = parcel.bouwjaar
  const pre1994 = bj != null && bj < 1994
  const bm = parcel.building_metrics

  const best = parcel.bestemmingen
  let isMonument = false
  if (Array.isArray(best)) {
    isMonument = best.some((b) => {
      const t = `${(b as { type?: string }).type ?? ''} ${(b as { naam?: string }).naam ?? ''}`.toLowerCase()
      return t.includes('waarde') || t.includes('erfgoed') || t.includes('monument') || t.includes('cultuurhistor')
    })
  }

  const isWonen = Array.isArray(best) && best.some((b) => {
    const t = `${(b as { type?: string }).type ?? ''} ${(b as { naam?: string }).naam ?? ''}`.toLowerCase()
    return ['wonen', 'gemengd', 'centrum'].some((kw) => t.includes(kw))
  })

  const constLabel = bj == null ? '—' : bj < 1940 ? 'HOOG' : bj < 1970 ? 'GEMIDDELD' : 'LAAG'
  const lagenHead = bm?.actual_bouwlagen != null && bm?.max_bouwlagen != null
  const atMax = lagenHead && bm!.actual_bouwlagen! >= bm!.max_bouwlagen!

  return [
    { label: 'FUNDERING', value: '—', sub: 'Niet beschikbaar (v2.1 scan)', pts: 0 },
    { label: 'ASBEST', value: bj == null ? '—' : pre1994 ? 'RISICO' : 'VEILIG', sub: bj != null ? `Bouwjaar ${bj}` : 'Geen bouwjaardata', pts: 0 },
    { label: 'BODEM', value: '—', sub: 'Niet beschikbaar (v2.1 scan)', pts: 0 },
    { label: 'MONUMENT', value: isMonument ? 'BESCHERMD' : 'VRIJ', sub: isMonument ? 'Erfgoedstatus' : 'Geen monument', pts: 0 },
    { label: 'HERBESTEMMING', value: isWonen ? 'NEE' : 'NODIG', sub: isWonen ? 'Woonbestemming' : 'Wijziging vereist', pts: 0 },
    { label: 'CONSTRUCTIE', value: constLabel, sub: bj != null ? `Bouwjaar ${bj}` : 'Geen bouwjaardata', pts: 0 },
    { label: 'JURIDISCH', value: '—', sub: 'Niet beschikbaar (v2.1 scan)', pts: 0 },
    { label: 'CRIMINALITEIT', value: '—', sub: 'Niet beschikbaar (v2.1 scan)', pts: 0 },
    { label: 'HOOGTE', value: lagenHead ? (atMax ? 'BEREIKT' : 'RUIMTE') : '—', sub: lagenHead ? `${bm!.actual_bouwlagen}/${bm!.max_bouwlagen} lagen` : 'Geen DSO data', pts: 0 },
  ]
}

/* ── Environmental enrichment cards ──────────────────────── */

function deriveEnvCards(enrichment: ReturnType<typeof useParcelEnrichment>['data']): PageCard[] {
  /**
   * label → factor_key mapping for env cards.
   * bodemtype is UI-only (funderingsrisico enrichment) — added to FACTOR_BRON in factor-groups.ts.
   */
  const keyMap: Record<string, string> = {
    'NATURA 2000': 'natura2000',
    OVERSTROMING: 'overstromingsrisico',
    GELUID: 'geluid',
    LUCHTKWALITEIT: 'luchtkwaliteit',
    BODEMTYPE: 'bodemtype',
  }

  const rawCards: Omit<PageCard, 'factor_key' | 'bron'>[] = []

  // Natura 2000
  const n2k = enrichment?.natura2000_data
  if (n2k) {
    rawCards.push({
      label: 'NATURA 2000',
      value: n2k.binnen_5km ? 'NABIJ' : 'VRIJ',
      sub: n2k.naam ? n2k.naam.slice(0, 24) : (n2k.binnen_5km ? 'Binnen 5 km' : 'Buiten 5 km'),
      pts: 0,
    })
  } else {
    rawCards.push({ label: 'NATURA 2000', value: '—', sub: 'Natura 2000 niet beschikbaar', pts: 0 })
  }

  // Overstromingsrisico
  const ov = enrichment?.overstromingsrisico_data
  if (ov) {
    rawCards.push({
      label: 'OVERSTROMING',
      value: ov.in_risk_zone ? 'RISICOZONE' : 'VEILIG',
      sub: ov.description ? ov.description.slice(0, 28) : (ov.in_risk_zone ? 'In risicogebied' : 'Buiten zone'),
      pts: 0,
    })
  } else {
    rawCards.push({ label: 'OVERSTROMING', value: '—', sub: 'Geen overstromingsdata', pts: 0 })
  }

  // Geluid
  const gl = enrichment?.geluid_data
  if (gl) {
    rawCards.push({
      label: 'GELUID',
      value: `${Math.round(gl.lden_db)} DB`,
      sub: gl.boven_grenswaarde ? 'Boven grenswaarde' : gl.classification || 'Onder grenswaarde',
      pts: 0,
    })
  } else {
    rawCards.push({ label: 'GELUID', value: '—', sub: 'Geen RIVM geluiddata', pts: 0 })
  }

  // Luchtkwaliteit
  const lk = enrichment?.luchtkwaliteit_data
  if (lk) {
    rawCards.push({
      label: 'LUCHTKWALITEIT',
      value: lk.boven_grenswaarde ? 'SLECHT' : 'GOED',
      sub: `NO₂ ${Math.round(lk.no2_ugm3)} · PM10 ${Math.round(lk.pm10_ugm3)}`,
      pts: 0,
    })
  } else {
    rawCards.push({ label: 'LUCHTKWALITEIT', value: '—', sub: 'Geen RIVM luchtkwaliteitdata', pts: 0 })
  }

  // Bodemtype (from funderingsrisico enrichment)
  const fr = enrichment?.funderingsrisico_data
  if (fr && fr.fgr) {
    rawCards.push({
      label: 'BODEMTYPE',
      value: fr.fgr.toUpperCase().slice(0, 10),
      sub: fr.legenda ? fr.legenda.slice(0, 28) : 'Funderingsgebied',
      pts: 0,
    })
  } else {
    rawCards.push({ label: 'BODEMTYPE', value: '—', sub: 'Geen funderingsgebieddata', pts: 0 })
  }

  return rawCards.map((c) => {
    const fk = keyMap[c.label] ?? c.label.toLowerCase()
    return {
      ...c,
      factor_key: fk,
      bron: FACTOR_BRON[fk] ?? 'fysiek',
    }
  })
}

/* ── Main component ───────────────────────────────────────── */

export const RISICO_KEYS = [
  'funderingsrisico', 'asbest', 'bodemverontreiniging',
  'monument', 'bestemmingswijziging', 'constructieve_staat',
  'juridisch_klimaat', 'criminaliteit', 'max_hoogte_bereikt',
  'splitsingsrisico', 'parkeerdruk',
] as const

/**
 * Build the full risico card list: V3 score-card path (RISICO_KEYS) +
 * environmental enrichment cards, with a v2.1 fallback. Extracted so the
 * per-tab weight-sorted scroll list reuses the SAME pipeline.
 * `pts` = weighted contribution (`bijdrage`).
 */
export function buildRisicoCards(
  parcel: ScanResultItem,
  enrichmentData: ReturnType<typeof useParcelEnrichment>['data'],
): PageCard[] {
  const scoreCards: PageCard[] = (() => {
    if (isScoreV3(parcel.score_breakdown) && parcel.score_breakdown) {
      const breakdown = parcel.score_breakdown as ScoreBreakdownV3
      return RISICO_KEYS.map((key) => {
        const factor = breakdown[key]
        const bron = FACTOR_BRON[key] ?? 'fysiek'
        if (factor) {
          const { value, sub } = formatFactorValue(key, factor)
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
      factor_key: RISICO_KEYS[i] ?? `v21-${i}`,
      bron: FACTOR_BRON[RISICO_KEYS[i] ?? ''] ?? 'fysiek',
    }))
  })()

  const envCards = deriveEnvCards(enrichmentData)
  return [...scoreCards, ...envCards]
}

/** splitsingsrisico factor.waarde shape (M053/S12). */
interface SplitsingsrisicoWaarde {
  verdict: string
  buurt_naam?: string | null
  woz_grens_eur?: number | null
  duur_jaren?: number | null
  vergunningplichten?: string[]
  randvoorwaarden?: Randvoorwaarde[]
}

/** Verdicts that carry popup content (clickable). */
const SPLITS_ACTIVE_VERDICTS = new Set([
  'van_toepassing', 'mogelijk_van_toepassing', 'vergunningstelsel_voorraad',
  'boven_woz_grens', 'buiten_beschermd_gebied',
])

/** parkeerdruk factor.waarde shape (M054/S02). */
interface ParkeerdrukWaarde {
  verdict: string
  peiljaar?: number | null
  functie?: string | null
  functiecategorie?: string | null
  gebied?: string | null
  auto_norm_per_eenheid?: number | null
  eenheid?: string | null
  fiets_norm_per_eenheid?: number | null
  parkeerregulering_van_toepassing?: boolean | null
  openbare_ruimte_drempel_pct?: number | null
  centrum_uitgesloten?: boolean | null
  fietsnorm_harde_eis?: boolean | null
  nul_norm_sociale_huur_mogelijk?: boolean | null
  mobiliteitscorrecties?: Correctie[]
  randvoorwaarden?: Randvoorwaarde[]
}

/** Verdicts that carry popup content (clickable). */
const PARKEER_ACTIVE_VERDICTS = new Set(['verhoogd', 'laag'])

interface RisicoLayerProps {
  parcel: ScanResultItem
}

export function RisicoLayer({ parcel }: RisicoLayerProps) {
  const [activeFactorKey, setActiveFactorKey] = useState<string | null>(null)

  // M053/S12 splitsingsrisico — opkoopbescherming popup data
  const splitsFactor = (parcel.score_breakdown as ScoreBreakdownV3 | null)?.['splitsingsrisico']
  const splitsWaarde = splitsFactor?.waarde as SplitsingsrisicoWaarde | null
  const hasSplitsData =
    splitsWaarde != null && SPLITS_ACTIVE_VERDICTS.has(splitsWaarde.verdict)

  // M054/S02 parkeerdruk — Nota parkeernormen popup data
  const parkeerFactor = (parcel.score_breakdown as ScoreBreakdownV3 | null)?.['parkeerdruk']
  const parkeerWaarde = parkeerFactor?.waarde as ParkeerdrukWaarde | null
  const hasParkeerData =
    parkeerWaarde != null && PARKEER_ACTIVE_VERDICTS.has(parkeerWaarde.verdict)

  const risicoScore = parcel.risico_score != null ? Math.round(parcel.risico_score) : null
  const verdict = deriveVerdict(risicoScore)
  const enrichmentQuery = useParcelEnrichment(parcel.parcel_id)

  // Weight-sorted factor list (score factors + env enrichment), no pagination.
  const sortedCards: PageCard[] = sortByWeight(buildRisicoCards(parcel, enrichmentQuery.data))


  function cardClick(card: PageCard): (() => void) | undefined {
    if (isCascadeFactor(card.factor_key)) {
      // Cascade cards: only clickable when their editorial data is present.
      if (card.factor_key === 'splitsingsrisico' && !hasSplitsData) return undefined
      if (card.factor_key === 'parkeerdruk' && !hasParkeerData) return undefined
      return () => setActiveFactorKey(card.factor_key)
    }
    // Non-cascade cards: only clickable when the key resolves in score_breakdown.
    if (!factorInBreakdown(parcel.score_breakdown as Record<string, unknown> | null, card.factor_key)) return undefined
    return () => setActiveFactorKey(card.factor_key)
  }

  const close = () => setActiveFactorKey(null)

  // Parse factors once for the generic explain drawer
  const factors = parseFactors(parcel.score_breakdown as Record<string, unknown> | null)
  const activeFactor = activeFactorKey
    ? factors.risico.find((f) => f.name === activeFactorKey)?.factor ?? null
    : null

  // Animated score bar
  const springVal = useSpring(0, { stiffness: 60, damping: 20 })
  useEffect(() => {
    const timer = setTimeout(() => springVal.set(risicoScore ?? 0), 300)
    return () => clearTimeout(timer)
  }, [risicoScore, springVal])
  const barWidth = useTransform(springVal, (v) => `${v}%`)

  return (
    <div className="flex flex-col flex-1 min-h-0 pt-4 pb-4">
      {/* ── Verdict Hero (sticky top of tab, does not scroll) ── */}
      <div className="shrink-0 px-6">
        <div className="bg-slate-50/50 border border-slate-100 px-5 py-4 rounded-[20px]">
          <div className="flex items-center justify-between">
            <span className="text-6xl font-black tracking-tighter text-slate-900 tabular-nums leading-none">
              {risicoScore ?? '—'}
            </span>

            <div className="flex-1 px-5 min-w-0">
              <p className={`text-lg font-bold uppercase tracking-wide ${verdict.color}`}>
                {verdict.label}
              </p>
            </div>

            <div className={`size-11 rounded-full flex items-center justify-center shrink-0 ${verdict.badgeColor}`}>
              <verdict.Icon className="size-5 text-white" strokeWidth={2.5} />
            </div>
          </div>

          <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <motion.div className={`h-full rounded-full ${verdict.barColor}`} style={{ width: barWidth }} />
          </div>
        </div>
      </div>

      {/* ── Factor list — one continuous, weight-sorted scroll ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 mt-3 flex flex-col gap-2">
        {sortedCards.map((card) => (
          <FactorKpiCard
            key={card.factor_key}
            card={card}
            tone="risico"
            onClick={cardClick(card)}
          />
        ))}

        {/* Geplande risico-cascades — dashed "binnenkort" placeholders */}
        <div className="shrink-0 mt-3 mb-1 flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Binnenkort</span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>
        {PLANNED_RISICO.map((planned) => (
          <FactorKpiCard
            key={planned.key}
            comingSoon
            tone="risico"
            card={{ label: planned.label, value: 'Binnenkort', sub: planned.source, pts: 0, factor_key: planned.key, bron: planned.bron }}
          />
        ))}
      </div>

      {/* Cascades: their own editorial popup, opened when their key is active */}
      {hasSplitsData && (
        <HuisvestingsverordeningPopup
          isOpen={activeFactorKey === 'splitsingsrisico'}
          onClose={close}
          verdict={splitsWaarde!.verdict}
          buurt_naam={splitsWaarde!.buurt_naam}
          woz_grens_eur={splitsWaarde!.woz_grens_eur}
          duur_jaren={splitsWaarde!.duur_jaren}
          vergunningplichten={splitsWaarde!.vergunningplichten}
          randvoorwaarden={splitsWaarde!.randvoorwaarden}
        />
      )}

      {hasParkeerData && (
        <ParkeernormenPopup
          isOpen={activeFactorKey === 'parkeerdruk'}
          onClose={close}
          verdict={parkeerWaarde!.verdict}
          peiljaar={parkeerWaarde!.peiljaar}
          functie={parkeerWaarde!.functie}
          functiecategorie={parkeerWaarde!.functiecategorie}
          gebied={parkeerWaarde!.gebied}
          auto_norm_per_eenheid={parkeerWaarde!.auto_norm_per_eenheid}
          eenheid={parkeerWaarde!.eenheid}
          fiets_norm_per_eenheid={parkeerWaarde!.fiets_norm_per_eenheid}
          parkeerregulering_van_toepassing={parkeerWaarde!.parkeerregulering_van_toepassing}
          openbare_ruimte_drempel_pct={parkeerWaarde!.openbare_ruimte_drempel_pct}
          centrum_uitgesloten={parkeerWaarde!.centrum_uitgesloten}
          fietsnorm_harde_eis={parkeerWaarde!.fietsnorm_harde_eis}
          nul_norm_sociale_huur_mogelijk={parkeerWaarde!.nul_norm_sociale_huur_mogelijk}
          mobiliteitscorrecties={parkeerWaarde!.mobiliteitscorrecties}
          randvoorwaarden={parkeerWaarde!.randvoorwaarden}
        />
      )}

      {/* Generic factors: one shared explain-drawer */}
      {activeFactorKey && !isCascadeFactor(activeFactorKey) && activeFactor && (
        <FactorDetailDrawer isOpen onClose={close}>
          <FactorExplainBody name={activeFactorKey} factor={activeFactor} />
        </FactorDetailDrawer>
      )}
    </div>
  )
}
