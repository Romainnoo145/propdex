import { useState, useEffect } from 'react'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { ShieldAlert, ShieldCheck, ShieldQuestion, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { ScanResultItem, ScoreBreakdownV3, ScoreFactorV3 } from '@/lib/types/scan'
import { isScoreV3 } from '@/lib/score'
import { useParcelEnrichment } from '@/hooks/useScans'
import { TruncatedText } from '../TruncatedText'
import { FactorCard, GhostCard } from '../FactorCard'
import { useFactorPins } from '@/hooks/useFactorPins'
import { FACTOR_BRON, buildPages, CARDS_PER_PAGE } from '@/lib/factor-groups'
import type { PageCard } from '@/lib/factor-groups'

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

/* ── One-liner generation ─────────────────────────────────── */

function generateOneLiner(cards: PageCard[], isV3: boolean): string {
  if (isV3) {
    const top = [...cards]
      .filter((c) => c.pts > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 2)
    if (top.length > 0) return top.map((c) => c.label).join(' · ')
  }
  return 'Heuristisch risicoprofiel'
}

/* ── Factor display mapping ───────────────────────────────── */

const FACTOR_LABELS: Record<string, string> = {
  funderingsrisico: 'FUNDERING',
  asbest: 'ASBEST',
  bodemverontreiniging: 'BODEM',
  monument: 'MONUMENT',
  bestemmingswijziging: 'HERBESTEMMING',
  constructieve_staat: 'CONSTRUCTIE',
  juridisch_klimaat: 'JURIDISCH',
  criminaliteit: 'CRIMINALITEIT',
  max_hoogte_bereikt: 'HOOGTE',
}

function riskLevel(score: number): string {
  if (score >= 0.7) return 'HOOG'
  if (score >= 0.4) return 'GEMIDDELD'
  return 'LAAG'
}

function formatFactorValue(name: string, factor: ScoreFactorV3): { value: string; sub: string } {
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

const RISICO_KEYS = [
  'funderingsrisico', 'asbest', 'bodemverontreiniging',
  'monument', 'bestemmingswijziging', 'constructieve_staat',
  'juridisch_klimaat', 'criminaliteit', 'max_hoogte_bereikt',
] as const

interface RisicoLayerProps {
  parcel: ScanResultItem
}

export function RisicoLayer({ parcel }: RisicoLayerProps) {
  const [page, setPage] = useState(0)
  const risicoScore = parcel.risico_score != null ? Math.round(parcel.risico_score) : null
  const isV3 = isScoreV3(parcel.score_breakdown)
  const verdict = deriveVerdict(risicoScore)
  const enrichmentQuery = useParcelEnrichment(parcel.parcel_id)
  const { pins, toggle, isPinned } = useFactorPins('risico')

  // Build score cards (9 risk factors from registry)
  const scoreCards: PageCard[] = (() => {
    if (isV3 && parcel.score_breakdown) {
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

  // Build env cards (5 environmental enrichment)
  const envCards = deriveEnvCards(enrichmentQuery.data)

  // All cards combined for buildPages
  const allCards: PageCard[] = [...scoreCards, ...envCards]
  const pages = buildPages(allCards, pins.map((p) => ({ id: p.id, factor_key: p.factor_key, position: p.position })))
  const currentPage = pages[page]

  const oneLiner = generateOneLiner(scoreCards, isV3)

  // Animated score bar
  const springVal = useSpring(0, { stiffness: 60, damping: 20 })
  useEffect(() => {
    const timer = setTimeout(() => springVal.set(risicoScore ?? 0), 300)
    return () => clearTimeout(timer)
  }, [risicoScore, springVal])
  const barWidth = useTransform(springVal, (v) => `${v}%`)

  // Keep page in bounds when pages count changes
  useEffect(() => {
    if (page >= pages.length) setPage(Math.max(0, pages.length - 1))
  }, [pages.length, page])

  return (
    <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
      {/* ── Verdict Hero ──────────────────────────────────── */}
      <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-5 rounded-[20px]">
        <div className="flex items-center justify-between">
          <span className="text-7xl font-black tracking-tighter text-slate-900 tabular-nums leading-none">
            {risicoScore ?? '—'}
          </span>

          <div className="flex-1 px-6 min-w-0">
            <p className={`text-xl font-bold uppercase tracking-wide ${verdict.color}`}>
              {verdict.label}
            </p>
            <TruncatedText text={oneLiner} className="text-[13px] text-slate-500 mt-0.5 truncate" />
          </div>

          <div
            className={`size-12 rounded-full flex items-center justify-center shrink-0 ${verdict.badgeColor}`}
          >
            <verdict.Icon className="size-6 text-white" strokeWidth={2.5} />
          </div>
        </div>

        <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${verdict.barColor}`}
            style={{ width: barWidth }}
          />
        </div>
      </div>

      {/* ── Factor Cards Grid with page transition ────────── */}
      <div className="flex-1 mt-4 relative flex flex-col">
        <h3 className="text-[10px] font-black tracking-[0.15em] uppercase text-slate-500 mb-2 pl-6">
          {currentPage?.title ?? ''}
        </h3>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
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
                  tone="negative"
                  isPinned={pinned}
                  isMissing={!!card.missing}
                  onStarClick={() => toggle(card.factor_key)}
                />
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
          {page + 1} / {pages.length}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
          disabled={page >= pages.length - 1}
          className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 transition-colors"
          aria-label="Volgende pagina"
        >
          <ChevronRight className="size-4 text-slate-400" />
        </button>
      </div>
    </div>
  )
}
