import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { CheckCircle2, CircleHelp, XCircle, type LucideIcon } from 'lucide-react'
import type { ScanResultItem, BuildingMetrics, ScoreBreakdownV3, ScoreFactorV3 } from '@/lib/types/scan'
import { isScoreV3, getPotentieFactors, getRisicoFactors } from '@/lib/score'

/* ── Verdict derivation ───────────────────────────────────── */

interface Verdict {
  label: string
  action: string
  color: string
  badgeColor: string
  barColor: string
  Icon: LucideIcon
}

function deriveVerdict(
  score: number | null,
  potentieScore?: number | null,
  risicoScore?: number | null,
): Verdict {
  if (score == null)
    return {
      label: 'ONBEKEND',
      action: 'ONDERZOEK',
      color: 'text-slate-400',
      badgeColor: 'bg-slate-400',
      barColor: 'bg-slate-400',
      Icon: CircleHelp,
    }

  // v3.0 dual-score logic when both subscores available
  if (potentieScore != null && risicoScore != null) {
    if (potentieScore > 60 && risicoScore < 30)
      return {
        label: 'ZEER KANSRIJK',
        action: 'GO',
        color: 'text-green-600',
        badgeColor: 'bg-green-500',
        barColor: 'bg-green-500',
        Icon: CheckCircle2,
      }
    if (potentieScore > 40)
      return {
        label: 'MOGELIJKHEDEN',
        action: 'ONDERZOEK',
        color: 'text-amber-500',
        badgeColor: 'bg-amber-500',
        barColor: 'bg-amber-400',
        Icon: CircleHelp,
      }
    return {
      label: 'BEPERKT POTENTIEEL',
      action: 'NO-GO',
      color: 'text-red-500',
      badgeColor: 'bg-red-500',
      barColor: 'bg-red-500',
      Icon: XCircle,
    }
  }

  // v2.1 fallback: single score thresholds
  if (score >= 75)
    return {
      label: 'ZEER KANSRIJK',
      action: 'GO',
      color: 'text-green-600',
      badgeColor: 'bg-green-500',
      barColor: 'bg-green-500',
      Icon: CheckCircle2,
    }
  if (score >= 50)
    return {
      label: 'MOGELIJKHEDEN',
      action: 'ONDERZOEK',
      color: 'text-amber-500',
      badgeColor: 'bg-amber-500',
      barColor: 'bg-amber-400',
      Icon: CircleHelp,
    }
  return {
    label: 'BEPERKT POTENTIEEL',
    action: 'NO-GO',
    color: 'text-red-500',
    badgeColor: 'bg-red-500',
    barColor: 'bg-red-500',
    Icon: XCircle,
  }
}

/* ── Bestemming helpers ───────────────────────────────────── */

const WONEN_KEYWORDS = ['wonen', 'gemengd', 'centrum']
const EASY_TRANSFORM = ['gemengd', 'centrum']
const HARD_TRANSFORM = ['maatschappelijk', 'bedrijf', 'bedrijven', 'kantoor']

function hasResidentialMixedBestemming(
  bestemmingen: ScanResultItem['bestemmingen'],
): boolean {
  if (!Array.isArray(bestemmingen)) return false
  return bestemmingen.some((b) => {
    const type = (b as { type?: string | null }).type ?? ''
    const naam = (b as { naam?: string | null }).naam ?? ''
    const candidate = `${type} ${naam}`.toLowerCase()
    return WONEN_KEYWORDS.some((kw) => candidate.includes(kw))
  })
}

function getBestemmingDisplay(bestemmingen: ScanResultItem['bestemmingen']): {
  naam: string
  type: string
  compatible: boolean
  transformLabel: string
} {
  if (!Array.isArray(bestemmingen) || bestemmingen.length === 0) {
    return { naam: 'Onbekend', type: '', compatible: false, transformLabel: 'Geen bestemmingsdata' }
  }
  const first = bestemmingen[0] as { naam?: string | null; type?: string | null }
  const naam = first.naam ?? 'Onbekend'
  const type = first.type ?? ''
  const compatible = hasResidentialMixedBestemming(bestemmingen)
  const lower = `${type} ${naam}`.toLowerCase()

  let transformLabel: string
  if (WONEN_KEYWORDS.some((kw) => lower.includes(kw))) {
    transformLabel = 'functiewijziging ok'
  } else if (EASY_TRANSFORM.some((kw) => lower.includes(kw))) {
    transformLabel = 'functiewijziging ok'
  } else if (HARD_TRANSFORM.some((kw) => lower.includes(kw))) {
    transformLabel = 'beperkt'
  } else if (lower.includes('industrie') || lower.includes('agrarisch')) {
    transformLabel = 'beperkt'
  } else {
    transformLabel = 'nader onderzoek'
  }

  return { naam, type, compatible, transformLabel }
}

/* ── Score mapping helpers ────────────────────────────────── */

interface ScoreFactors {
  underutilization: number
  footprint_size: number
  building_age: number
  zoning_value: number
  pand_status_signal: number
}

/** v3.0 named factor with metadata for display */
interface NamedFactorV3 extends ScoreFactorV3 {
  name: string
}

function extractFactors(
  scoreBreakdown: Record<string, unknown> | null,
): ScoreFactors | null {
  if (!scoreBreakdown) return null

  // v3.0: factors have full metadata — skip v2.1 extraction
  if (isScoreV3(scoreBreakdown)) return null

  // v2.1 fallback
  const factors = scoreBreakdown.factors as Record<string, number> | undefined
  if (!factors) return null
  return {
    underutilization: factors.underutilization ?? 0,
    footprint_size: factors.footprint_size ?? 0,
    building_age: factors.building_age ?? 0,
    zoning_value: factors.zoning_value ?? 0,
    pand_status_signal: factors.pand_status_signal ?? 0,
  }
}

/**
 * Extract v3.0 factors with names, grouped by categorie.
 * Returns null for v2.1 breakdowns.
 */
function extractFactorsV3(
  scoreBreakdown: Record<string, unknown> | null,
): { potentie: NamedFactorV3[]; risico: NamedFactorV3[] } | null {
  if (!scoreBreakdown || !isScoreV3(scoreBreakdown)) return null
  const breakdown = scoreBreakdown as ScoreBreakdownV3
  const potentie = getPotentieFactors(breakdown).map((f) => ({
    ...f,
    name: Object.entries(breakdown).find(([, v]) => v === f)?.[0] ?? '',
  }))
  const risico = getRisicoFactors(breakdown).map((f) => ({
    ...f,
    name: Object.entries(breakdown).find(([, v]) => v === f)?.[0] ?? '',
  }))
  return { potentie, risico }
}

/* ── One-liner generation ─────────────────────────────────── */

function generateOneLiner(
  vrijePct: number | null,
  lagenHeadroom: number | null,
  hoogteHeadroom: number | null,
  compatible: boolean,
  vacancySignal: string | null,
  bouwjaar: number | null,
): string {
  const parts: string[] = []
  if (vrijePct != null && vrijePct > 5) parts.push(`${Math.round(vrijePct)}% vrije ruimte`)
  if (lagenHeadroom != null && lagenHeadroom > 0) parts.push(`+${lagenHeadroom} lagen headroom`)
  else if (hoogteHeadroom != null && hoogteHeadroom > 0) parts.push(`+${hoogteHeadroom}m headroom`)
  if (compatible) parts.push('Wonen-bestemming')
  if (
    vacancySignal != null &&
    vacancySignal !== '' &&
    vacancySignal !== 'onbekend' &&
    vacancySignal !== 'in_gebruik'
  )
    parts.push('leegstandsignaal')
  if (parts.length === 0) {
    if (bouwjaar != null) return `Bouwjaar ${bouwjaar} \u2014 heuristiek`
    return 'Beperkte data \u2014 bouwjaar-heuristiek'
  }
  return parts.slice(0, 2).join(' \u00b7 ')
}

/* ── Optoppotentie derivation ─────────────────────────────── */

function deriveOptoppotentie(metrics: BuildingMetrics | null): {
  lagenHeadroom: number | null
  hoogteHeadroom: number | null
  actualHoogte: number | null
  maxHoogte: number | null
  actualLagen: number | null
  maxLagen: number | null
  reason: string
} {
  const actualLagen = metrics?.actual_bouwlagen ?? null
  const maxLagen = metrics?.max_bouwlagen ?? null
  const actualHoogte = metrics?.actual_bouwhoogte ?? null
  const maxHoogte = metrics?.max_bouwhoogte ?? null

  const lagenHeadroom =
    actualLagen != null && maxLagen != null && maxLagen > actualLagen
      ? maxLagen - actualLagen
      : null

  const hoogteHeadroom =
    actualHoogte != null && maxHoogte != null && maxHoogte > actualHoogte
      ? Math.round(maxHoogte - actualHoogte)
      : null

  let reason = 'Geen DSO data'
  if (lagenHeadroom != null && lagenHeadroom > 0) {
    reason = `Max. ${maxLagen} vs. huidig ${actualLagen}`
  } else if (hoogteHeadroom != null && hoogteHeadroom > 0) {
    reason = `Max. ${maxHoogte}m vs. huidig ${actualHoogte}m`
  } else if (maxLagen != null && actualLagen != null && maxLagen <= actualLagen) {
    reason = 'Max hoogte bereikt'
  } else if (maxHoogte != null && actualHoogte != null && maxHoogte <= actualHoogte) {
    reason = 'Max hoogte bereikt'
  }

  return { lagenHeadroom, hoogteHeadroom, actualHoogte, maxHoogte, actualLagen, maxLagen, reason }
}

/* ── Signal helpers ───────────────────────────────────────── */

interface Signal {
  dot: string
  text: string
}

function deriveSignals(
  parcel: ScanResultItem,
  score: number | null,
): Signal[] {
  const signals: Signal[] = []

  // Market friction — only when listing exists
  if (
    parcel.market_signals != null &&
    parcel.market_signals.listing_duration_days > 0
  ) {
    signals.push({
      dot: 'bg-amber-400',
      text: `${parcel.market_signals.listing_duration_days} dagen op Funda (Frictie gedetecteerd)`,
    })
  }

  // Vacancy — only when detected
  if (
    parcel.vacancy_signal != null &&
    parcel.vacancy_signal !== '' &&
    parcel.vacancy_signal !== 'onbekend' &&
    parcel.vacancy_signal !== 'in_gebruik'
  ) {
    const conf = parcel.vacancy_confidence != null ? Math.round(parcel.vacancy_confidence * 100) : null
    signals.push({
      dot: 'bg-amber-400',
      text: `Mogelijk leegstaand (${conf != null ? `${conf}% zekerheid` : 'zekerheid onbekend'})`,
    })
  }

  // Transformation candidate — only when criteria met
  if (score != null && score >= 60 && parcel.bouwjaar != null && parcel.bouwjaar < 1980) {
    signals.push({
      dot: 'bg-green-500',
      text: 'Geschikte transformatiekandidaat (Typologie match)',
    })
  }

  return signals
}

/* ── Main component ───────────────────────────────────────── */

interface PotentieLayerProps {
  parcel: ScanResultItem
}

export function PotentieLayer({ parcel }: PotentieLayerProps) {
  const score = parcel.score != null ? Math.round(parcel.score) : null
  const isV3 = isScoreV3(parcel.score_breakdown)
  const verdict = deriveVerdict(score, parcel.potentie_score, parcel.risico_score)

  // Vrije grond
  const rawPandOpp = parcel.building_metrics?.pand_oppervlakte_m2 ?? null
  const pandOpp = rawPandOpp === 0 && parcel.has_pand ? null : rawPandOpp
  const vrijePct =
    pandOpp != null && parcel.area_m2 != null && parcel.area_m2 > 0
      ? Math.max(0, Math.min(100, (1 - pandOpp / parcel.area_m2) * 100))
      : null
  const vrijeM2 =
    pandOpp != null && parcel.area_m2 != null ? Math.round(parcel.area_m2 - pandOpp) : null

  // Optoppotentie
  const opto = deriveOptoppotentie(parcel.building_metrics)

  // Bestemming
  const bestemming = getBestemmingDisplay(parcel.bestemmingen)

  // Score factors for contribution badges
  const factors = extractFactors(parcel.score_breakdown)
  const factorsV3 = extractFactorsV3(parcel.score_breakdown)
  const landPts = factors ? Math.round(factors.underutilization + factors.footprint_size) : null
  const verticalPts = factors ? Math.round(factors.building_age + factors.zoning_value) : null
  const zoningPts = factors ? Math.round(factors.zoning_value) : null

  // One-liner: v3.0 uses top factor toelichting_kort, v2.1 uses generated one-liner
  const oneLiner = (() => {
    if (factorsV3) {
      // Pick the factor with highest bijdrage for the one-liner
      const allFactors = [...factorsV3.potentie, ...factorsV3.risico]
      const top = allFactors.sort((a, b) => Math.abs(b.bijdrage) - Math.abs(a.bijdrage))[0]
      if (top) return top.toelichting_kort
    }
    return generateOneLiner(
      vrijePct,
      opto.lagenHeadroom,
      opto.hoogteHeadroom,
      bestemming.compatible,
      parcel.vacancy_signal,
      parcel.bouwjaar,
    )
  })()

  // Animated score bar
  const springVal = useSpring(0, { stiffness: 60, damping: 20 })
  useEffect(() => {
    const timer = setTimeout(() => springVal.set(score ?? 0), 300)
    return () => clearTimeout(timer)
  }, [score, springVal])
  const barWidth = useTransform(springVal, (v) => `${v}%`)

  // Signals — conditional (strip collapses when empty)
  const signals = deriveSignals(parcel, score)

  // Optoppotentie display value
  let optoValue: string
  let optoSub: string
  if (opto.lagenHeadroom != null && opto.lagenHeadroom > 0) {
    optoValue = `+${opto.lagenHeadroom} LAGEN`
    optoSub = `Max. ${opto.maxLagen} vs. huidig ${opto.actualLagen}`
  } else if (opto.hoogteHeadroom != null && opto.hoogteHeadroom > 0) {
    optoValue = `+${opto.hoogteHeadroom}M`
    optoSub = `Max. ${opto.maxHoogte}m vs. huidig ${opto.actualHoogte}m`
  } else if (
    (opto.maxLagen != null && opto.actualLagen != null && opto.maxLagen <= opto.actualLagen) ||
    (opto.maxHoogte != null && opto.actualHoogte != null && opto.maxHoogte <= opto.actualHoogte)
  ) {
    optoValue = '\u2014'
    optoSub = 'Max hoogte bereikt'
  } else {
    optoValue = '\u2014'
    optoSub = 'Geen DSO data'
  }

  return (
    <div className="flex flex-col pt-4">
      {/* ── Verdict Hero ──────────────────────────────────── */}
      <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-5">
        <div className="flex items-center justify-between">
          {/* Score */}
          <span className="text-7xl font-black tracking-tighter text-slate-900 tabular-nums leading-none">
            {score ?? '\u2014'}
          </span>

          {/* Verdict + one-liner */}
          <div className="flex-1 px-6 min-w-0">
            <p className={`text-xl font-bold uppercase tracking-wide ${verdict.color}`}>
              {verdict.label}
            </p>
            <p className="text-[13px] text-slate-500 mt-0.5 truncate">{oneLiner}</p>
          </div>

          {/* Go/No-Go badge */}
          <div
            className={`size-12 rounded-full flex items-center justify-center shrink-0 ${verdict.badgeColor}`}
          >
            <verdict.Icon className="size-6 text-white" strokeWidth={2.5} />
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${verdict.barColor}`}
            style={{ width: barWidth }}
          />
        </div>
      </div>

      {/* ── 3-Column Deal-Maker Grid ────────────────────── */}
      <div className="grid grid-cols-3 gap-3 px-6 mt-4">
        {/* Card 1 — VRIJE GROND */}
        <div className="bg-white border border-slate-100 rounded-[20px] p-5 h-[130px] flex flex-col justify-between relative">
          {landPts != null && (
            <span className="absolute top-2 right-3 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-100">
              +{landPts} pts
            </span>
          )}
          <p className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase">
            VRIJE GROND
          </p>
          <div>
            <p className="text-3xl font-black text-slate-900 tabular-nums leading-tight">
              {vrijePct != null ? `${Math.round(vrijePct)}%` : '\u2014'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {vrijeM2 != null ? `+/- ${vrijeM2.toLocaleString('nl-NL')} m\u00b2 onbebouwd` : 'Geen data'}
            </p>
          </div>
        </div>

        {/* Card 2 — OPTOPPOTENTIE */}
        <div className="bg-white border border-slate-100 rounded-[20px] p-5 h-[130px] flex flex-col justify-between relative">
          {verticalPts != null && (
            <span className="absolute top-2 right-3 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-100">
              +{verticalPts} pts
            </span>
          )}
          <p className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase">
            OPTOPPOTENTIE
          </p>
          <div>
            <p className="text-3xl font-black text-slate-900 tabular-nums leading-tight">
              {optoValue}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{optoSub}</p>
          </div>
        </div>

        {/* Card 3 — BESTEMMING */}
        <div className="bg-white border border-slate-100 rounded-[20px] p-5 h-[130px] flex flex-col justify-between relative">
          {zoningPts != null && (
            <span className="absolute top-2 right-3 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-100">
              +{zoningPts} pts
            </span>
          )}
          <p className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase">
            BESTEMMING
          </p>
          <div>
            <p
              className={`text-xl font-black leading-tight break-all ${
                bestemming.compatible ? 'text-green-600' : 'text-slate-900'
              }`}
            >
              {bestemming.naam.toUpperCase()}{' '}
              {bestemming.compatible ? '\u2713' : '\u2717'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {bestemming.type ? `${bestemming.type} (${bestemming.transformLabel})` : bestemming.transformLabel}
            </p>
          </div>
        </div>
      </div>

      {/* ── Intelligence Strip ────────────────────────────── */}
      {signals.length > 0 && (
        <div className="px-6 mt-4 space-y-2">
          {signals.map((sig, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 px-4 bg-slate-50/50 rounded-lg"
            >
              <span className={`size-2 rounded-full shrink-0 ${sig.dot}`} />
              <span className="text-[11px] font-bold text-slate-700">{sig.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── v3.0 Factor Breakdown ──────────────────────────── */}
      {isV3 && factorsV3 && (
        <div className="px-6 mt-4 space-y-4">
          {/* Potentie factors */}
          {factorsV3.potentie.length > 0 && (
            <div>
              <p className="text-[10px] font-black tracking-[0.15em] text-green-600 uppercase mb-2">
                POTENTIE
              </p>
              <div className="space-y-1.5">
                {factorsV3.potentie.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between py-1.5 px-3 bg-green-50/50 rounded-lg"
                  >
                    <span className="text-[11px] font-bold text-slate-700 truncate flex-1">
                      {f.toelichting_kort}
                    </span>
                    <span className="text-[11px] font-black text-green-600 tabular-nums ml-2 shrink-0">
                      +{f.bijdrage.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Risico factors */}
          {factorsV3.risico.length > 0 && (
            <div>
              <p className="text-[10px] font-black tracking-[0.15em] text-red-500 uppercase mb-2">
                RISICO
              </p>
              <div className="space-y-1.5">
                {factorsV3.risico.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between py-1.5 px-3 bg-red-50/50 rounded-lg"
                  >
                    <span className="text-[11px] font-bold text-slate-700 truncate flex-1">
                      {f.toelichting_kort}
                    </span>
                    <span className="text-[11px] font-black text-red-500 tabular-nums ml-2 shrink-0">
                      +{f.bijdrage.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
