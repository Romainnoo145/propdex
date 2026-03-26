import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Scan,
  Eye,
  TrendingUp,
  TrendingDown,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { LeftPanelShell } from './LeftPanelShell'
import { VerdictHero } from './gemeente/VerdictHero'
import { IntelligenceGrid, type IntelCard } from './gemeente/IntelligenceGrid'
import { WijkDetailModal } from './gemeente/WijkDetailModal'
import { scanControlsEnabled } from '@/lib/features'
import { AMBER } from '@/lib/tokens'
import type { ScanListItem, CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface WijkMapPanelProps {
  naam: string
  gemeenteNaam: string
  latestScan: ScanListItem | null
  onClose: () => void
  onBack: () => void
  onStartScan: () => void
  onViewResults: (scanId: string) => void
}

/* ── Markt-score derivation ────────────────────────────────── */

interface MarktVerdict {
  score: number | null
  label: string
  color: string
  Icon: LucideIcon
  subtitle: string
}

/**
 * Derive "markt-score" from CBS data.
 * Based on data coverage (how many fields are present) + key signals.
 *
 * - Data present: each non-null metric adds points (max ~60 from coverage)
 * - Koopwoning%: high = more market opportunity (+up to 15)
 * - Inkomen: higher = more buying power (+up to 15)
 * - Low criminaliteit: safer = better market (+up to 10)
 */
function deriveMarktScore(metrics: CbsNeighborhoodMetrics | null): number | null {
  if (!metrics) return null

  const d = metrics.data
  let score = 0
  let fields = 0

  // Coverage points — each present field earns base points
  const checkField = (v: unknown) => {
    if (v != null && v !== 0) { score += 6; fields++ }
  }

  checkField(d.demografie?.percentage_koopwoningen)
  checkField(d.demografie?.aantal_inwoners)
  checkField(d.gemiddelde_woz_waarde)
  checkField(d.inkomen?.gem_gestandaardiseerd)
  checkField(d.huishoudens?.totaal)
  checkField(d.leeftijdsverdeling?.perc_25_44)
  checkField(metrics.criminaliteit?.per_1000_inwoners)
  checkField(metrics.nabijheid?.afstanden?.supermarkt_km)
  checkField(d.stedelijkheid?.omgevingsadressendichtheid)
  // Max 54 from 9 fields

  // Koopwoning bonus (high = buy market)
  const koop = d.demografie?.percentage_koopwoningen
  if (koop != null) score += Math.round((koop / 100) * 15)

  // Inkomen bonus (higher = more purchasing power)
  const ink = d.inkomen?.gem_gestandaardiseerd
  if (ink != null) score += Math.min(15, Math.round((ink / 40000) * 15))

  // Safety bonus (low crime = better)
  const crim = metrics.criminaliteit?.per_1000_inwoners
  if (crim != null) score += Math.max(0, Math.round((1 - Math.min(crim, 100) / 100) * 10))

  if (fields === 0) return null
  return Math.min(100, score)
}

function deriveVerdict(score: number | null, hasData: boolean): MarktVerdict {
  if (score == null || !hasData) {
    return {
      score: null,
      label: 'GEEN DATA',
      color: SLATE_MUTED,
      Icon: BarChart3,
      subtitle: 'Nog geen wijkdata beschikbaar',
    }
  }
  if (score >= 65) {
    return {
      score,
      label: 'STERK MARKTPROFIEL',
      color: AMBER.base,
      Icon: TrendingUp,
      subtitle: 'Hoog inkomen · veel koopwoningen · goede voorzieningen',
    }
  }
  if (score >= 40) {
    return {
      score,
      label: 'GEMIDDELD PROFIEL',
      color: AMBER.base,
      Icon: BarChart3,
      subtitle: 'Gemengd marktbeeld · kansen afhankelijk van strategie',
    }
  }
  return {
    score,
    label: 'ONTWIKKELGEBIED',
    color: OBSIDIAN,
    Icon: TrendingDown,
    subtitle: 'Lagere marktdruk · mogelijk transformatie-kansen',
  }
}

/* ── Per-card score decomposition ──────────────────────────── */

interface CardScore {
  pts: number
  positive: boolean // true = potentie, false = risico
}

/**
 * Break down the overall markt-score into per-card contributions.
 * Each card earns 0–11 points. Total max = 100.
 */
function deriveCardScores(metrics: CbsNeighborhoodMetrics | null): Record<string, CardScore> {
  const empty: Record<string, CardScore> = {}
  if (!metrics) return empty

  const d = metrics.data
  const scores: Record<string, CardScore> = {}

  // Koopwoning: 0–17 pts (6 base + up to 11 bonus)
  const koop = d.demografie?.percentage_koopwoningen
  if (koop != null) {
    const pts = 6 + Math.round((koop / 100) * 11)
    scores.koopwoning = { pts, positive: koop >= 40 }
  }

  // Dichtheid: 6 pts flat
  const sted = d.stedelijkheid
  if (sted?.omgevingsadressendichtheid != null) {
    scores.dichtheid = { pts: 6, positive: (sted.klasse ?? 5) <= 3 }
  }

  // Eenpersoons: 6 pts flat
  const hh = d.huishoudens
  if (hh?.totaal && hh.eenpersoons) {
    const pct = (hh.eenpersoons / hh.totaal) * 100
    scores.eenpersoons = { pts: 6, positive: pct >= 30 }
  }

  // Inkomen: 0–17 pts (6 base + up to 11 bonus)
  const ink = d.inkomen?.gem_gestandaardiseerd
  if (ink != null) {
    const pts = 6 + Math.min(11, Math.round((ink / 40000) * 11))
    scores.inkomen = { pts, positive: ink >= 22000 }
  }

  // WOZ: 6 pts flat
  if (d.gemiddelde_woz_waarde != null) {
    scores.woz = { pts: 6, positive: true }
  }

  // Inwoners: 6 pts flat
  if (d.demografie?.aantal_inwoners != null) {
    scores.inwoners = { pts: 6, positive: true }
  }

  // Veiligheid: 0–14 pts (6 base + up to 8 safety bonus)
  const crim = metrics.criminaliteit?.per_1000_inwoners
  if (crim != null) {
    const safetyBonus = Math.max(0, Math.round((1 - Math.min(crim, 100) / 100) * 8))
    scores.criminaliteit = { pts: 6 + safetyBonus, positive: crim <= 60 }
  }

  // Voorzieningen: 6 pts flat
  const sm = metrics.nabijheid?.afstanden?.supermarkt_km
  if (sm != null) {
    scores.supermarkt = { pts: 6, positive: sm <= 1.5 }
  }

  // Leeftijd: 6 pts flat
  if (d.leeftijdsverdeling?.perc_25_44 != null) {
    const young = (d.leeftijdsverdeling.perc_25_44 ?? 0) + (d.leeftijdsverdeling.perc_15_24 ?? 0)
    scores.leeftijd = { pts: 6, positive: young >= 30 }
  }

  return scores
}

/* ── CBS → intelligence cards ──────────────────────────────── */

function buildCards(
  metrics: CbsNeighborhoodMetrics | null,
  parcelCount: number | null,
  cardScores: Record<string, CardScore>,
  onCardClick?: (key: string) => void,
): IntelCard[] {
  if (!metrics) {
    // Empty state — show 9 placeholder cards
    return [
      { key: 'koopwoning', label: 'KOOPWONING', value: '—', sub: 'Koop-potentieel' },
      { key: 'dichtheid', label: 'DICHTHEID', value: '—', sub: 'Stedelijkheidsklasse' },
      { key: 'eenpersoons', label: 'EENPERSOONS', value: '—', sub: 'Huishoudtype' },
      { key: 'inkomen', label: 'INKOMEN', value: '—', sub: 'Koopkracht' },
      { key: 'woz', label: 'WOZ-WAARDE', value: '—', sub: 'Woningwaarde' },
      { key: 'inwoners', label: 'INWONERS', value: '—', sub: 'Marktomvang' },
      { key: 'criminaliteit', label: 'VEILIGHEID', value: '—', sub: 'Veiligheid & leefbaarheid' },
      { key: 'supermarkt', label: 'VOORZIENINGEN', value: '—', sub: 'Nabijheid voorzieningen' },
      { key: 'leeftijd', label: 'DEMOGRAFIE', value: '—', sub: 'Bevolkingsopbouw' },
    ]
  }

  const d = metrics.data
  const crim = metrics.criminaliteit
  const nab = metrics.nabijheid

  // Eenpersoons %
  const hh = d.huishoudens
  const eenpersoonsPct = hh?.totaal && hh.eenpersoons
    ? Math.round((hh.eenpersoons / hh.totaal) * 100)
    : null

  // Dominant age group → keurmerk
  const leeftijd = d.leeftijdsverdeling
  let leeftijdKeurmerk = '—'
  let leeftijdSub = 'Geen leeftijdsdata'
  if (leeftijd) {
    const buckets: [string, number | null][] = [
      ['0–14', leeftijd.perc_0_14],
      ['15–24', leeftijd.perc_15_24],
      ['25–44', leeftijd.perc_25_44],
      ['45–64', leeftijd.perc_45_64],
      ['65+', leeftijd.perc_65_plus],
    ]
    const top = buckets.filter(b => b[1] != null).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]
    if (top && top[1] != null) {
      const label = top[0]
      if (label === '65+') {
        leeftijdKeurmerk = 'VERGRIJZEND'
        leeftijdSub = `${Math.round(top[1])}% is 65+ — doorstroomkans`
      } else if (label === '25–44') {
        leeftijdKeurmerk = 'JONG'
        leeftijdSub = `${Math.round(top[1])}% is 25–44 — huurmarkt`
      } else if (label === '0–14') {
        leeftijdKeurmerk = 'GEZINNEN'
        leeftijdSub = `${Math.round(top[1])}% is 0–14 — koopmarkt`
      } else if (label === '15–24') {
        leeftijdKeurmerk = 'STUDENTEN'
        leeftijdSub = `${Math.round(top[1])}% is 15–24 — kamerverhuur`
      } else {
        leeftijdKeurmerk = 'GEVESTIGD'
        leeftijdSub = `${Math.round(top[1])}% is 45–64 — stabiele markt`
      }
    }
  }

  const koop = d.demografie?.percentage_koopwoningen
  const inkomen = d.inkomen?.gem_gestandaardiseerd
  const woz = d.gemiddelde_woz_waarde
  const inwoners = d.demografie?.aantal_inwoners
  const crimPer1k = crim?.per_1000_inwoners
  const supermarkt = nab?.afstanden?.supermarkt_km

  // Voorzieningen keurmerk (average across all available distances)
  let voorzieningenKeurmerk = '—'
  let voorzieningenSub = 'Geen data'
  if (supermarkt != null) {
    const afst = nab?.afstanden
    const dailyDistances = [afst?.supermarkt_km, afst?.huisarts_km, afst?.basisschool_km].filter((v): v is number => v != null)
    const avgDaily = dailyDistances.length > 0 ? dailyDistances.reduce((a, b) => a + b, 0) / dailyDistances.length : null
    if (avgDaily != null && avgDaily <= 0.5) {
      voorzieningenKeurmerk = 'UITSTEKEND'
      voorzieningenSub = `Gem. ${avgDaily.toFixed(1)} km tot dagelijkse voorz.`
    } else if (avgDaily != null && avgDaily <= 1.5) {
      voorzieningenKeurmerk = 'GOED'
      voorzieningenSub = `Gem. ${avgDaily.toFixed(1)} km tot dagelijkse voorz.`
    } else {
      voorzieningenKeurmerk = 'BEPERKT'
      voorzieningenSub = avgDaily != null ? `Gem. ${avgDaily.toFixed(1)} km — aandachtspunt` : 'Beperkte voorzieningen'
    }
  }

  // Veiligheid keurmerk
  let veiligheidKeurmerk = '—'
  let veiligheidSub = 'Geen data'
  if (crimPer1k != null) {
    if (crimPer1k <= 25) {
      veiligheidKeurmerk = 'ZEER VEILIG'
      veiligheidSub = `${Math.round(crimPer1k)}/1k inw. — rustige wijk`
    } else if (crimPer1k <= 50) {
      veiligheidKeurmerk = 'VEILIG'
      veiligheidSub = `${Math.round(crimPer1k)}/1k inw. — onder gemiddeld`
    } else if (crimPer1k <= 80) {
      veiligheidKeurmerk = 'GEMIDDELD'
      veiligheidSub = `${Math.round(crimPer1k)}/1k inw. — stedelijk normaal`
    } else if (crimPer1k <= 150) {
      veiligheidKeurmerk = 'VERHOOGD'
      veiligheidSub = `${Math.round(crimPer1k)}/1k inw. — bovengemiddeld`
    } else if (crimPer1k <= 250) {
      veiligheidKeurmerk = 'ONVEILIG'
      veiligheidSub = `${Math.round(crimPer1k)}/1k inw. — hoge criminaliteit`
    } else {
      veiligheidKeurmerk = 'RISICOGEBIED'
      veiligheidSub = `${Math.round(crimPer1k)}/1k inw. — zeer hoge criminaliteit`
    }
  }

  // Helper to attach score data
  const s = (key: string) => {
    const cs = cardScores[key]
    return cs ? { scorePts: cs.pts, scorePositive: cs.positive } : {}
  }

  return [
    {
      key: 'koopwoning',
      label: 'KOOPWONING',
      value: koop != null
        ? koop >= 60 ? 'STERK' : koop >= 40 ? 'GEMENGD' : 'HUURMARKT'
        : '—',
      sub: koop != null ? `${Math.round(koop)}% koopwoningen` : 'Geen data',
      accentColor: AMBER.base,
      ...s('koopwoning'),
    },
    {
      key: 'dichtheid',
      label: 'DICHTHEID',
      value: d.stedelijkheid?.klasse != null
        ? d.stedelijkheid.klasse <= 1 ? 'ZEER STERK' : d.stedelijkheid.klasse <= 2 ? 'STERK' : d.stedelijkheid.klasse <= 3 ? 'MATIG' : 'LANDELIJK'
        : d.stedelijkheid?.omgevingsadressendichtheid != null
          ? `${Math.round(d.stedelijkheid.omgevingsadressendichtheid)}/km²`
          : '—',
      sub: d.stedelijkheid?.omgevingsadressendichtheid != null
        ? `${Math.round(d.stedelijkheid.omgevingsadressendichtheid)} adr/km²`
        : 'Stedelijkheidsklasse',
      accentColor: AMBER.base,
      ...s('dichtheid'),
    },
    {
      key: 'eenpersoons',
      label: 'EENPERSOONS',
      value: eenpersoonsPct != null
        ? eenpersoonsPct >= 50 ? 'SPLITSKANS' : eenpersoonsPct >= 30 ? 'GEMENGD' : 'GEZINNEN'
        : '—',
      sub: eenpersoonsPct != null ? `${eenpersoonsPct}% eenpersoonshuishoudens` : 'Geen data',
      accentColor: AMBER.base,
      ...s('eenpersoons'),
    },
    {
      key: 'inkomen',
      label: 'INKOMEN',
      value: inkomen != null
        ? inkomen >= 30000 ? 'HOOG' : inkomen >= 22000 ? 'GEMIDDELD' : 'LAGER'
        : '—',
      sub: inkomen != null ? `€${Math.round(inkomen).toLocaleString('nl-NL')} gestandaardiseerd` : 'Geen data',
      accentColor: AMBER.base,
      ...s('inkomen'),
    },
    {
      key: 'woz',
      label: 'WOZ-WAARDE',
      value: woz != null ? `€${Math.round(woz * 1000).toLocaleString('nl-NL')}` : '—',
      sub: woz != null ? 'Gemiddelde woningwaarde' : 'Geen WOZ data',
      accentColor: AMBER.base,
      ...s('woz'),
    },
    {
      key: 'inwoners',
      label: 'INWONERS',
      value: inwoners != null ? inwoners.toLocaleString('nl-NL') : '—',
      sub: parcelCount != null ? `${parcelCount.toLocaleString('nl-NL')} percelen geanalyseerd` : 'Marktomvang',
      accentColor: AMBER.base,
      ...s('inwoners'),
    },
    {
      key: 'criminaliteit',
      label: 'VEILIGHEID',
      value: veiligheidKeurmerk,
      sub: veiligheidSub,
      accentColor: AMBER.base,
      ...s('criminaliteit'),
    },
    {
      key: 'supermarkt',
      label: 'VOORZIENINGEN',
      value: voorzieningenKeurmerk,
      sub: voorzieningenSub,
      accentColor: AMBER.base,
      ...s('supermarkt'),
    },
    {
      key: 'leeftijd',
      label: 'DEMOGRAFIE',
      value: leeftijdKeurmerk,
      sub: leeftijdSub,
      accentColor: AMBER.base,
      ...s('leeftijd'),
    },
  ].map(card => ({
    ...card,
    onClick: onCardClick ? () => onCardClick(card.key) : undefined,
  }))
}

/* ── Component ─────────────────────────────────────────────── */

export function WijkMapPanel({
  naam,
  gemeenteNaam,
  latestScan,
  onClose,
  onBack,
  onStartScan,
  onViewResults,
}: WijkMapPanelProps) {
  const hasCompletedScan = latestScan?.status === 'completed'
  const metrics = (hasCompletedScan ? latestScan.neighborhood_metrics : null) as CbsNeighborhoodMetrics | null
  const parcelCount = hasCompletedScan ? latestScan.parcel_count : null

  const marktScore = useMemo(() => deriveMarktScore(metrics), [metrics])
  const verdict = deriveVerdict(marktScore, hasCompletedScan)
  const cardScores = useMemo(() => deriveCardScores(metrics), [metrics])

  const [openMetric, setOpenMetric] = useState<string | null>(null)
  const [gridPage, setGridPage] = useState(0)
  const handleCardClick = metrics ? (key: string) => setOpenMetric(key) : undefined

  const dataCards = useMemo(
    () => buildCards(metrics, parcelCount, cardScores, handleCardClick),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, parcelCount, cardScores, !!handleCardClick],
  )

  // Append roadmap items as page 2 cards
  const cards = useMemo(() => [
    ...dataCards,
    // Page 2: roadmap items
    { key: 'roadmap-funda', label: 'FUNDA MARKTDATA', value: 'Binnenkort', sub: 'Looptijd en prijsmutaties' },
    { key: 'roadmap-von', label: 'VON-PRIJS', value: 'Binnenkort', sub: 'Verwachte verkoopprijs per type' },
    { key: 'roadmap-leefbaar', label: 'LEEFBAARHEID', value: 'Binnenkort', sub: 'Veiligheid, milieu, voorzieningen' },
    { key: 'roadmap-transacties', label: 'TRANSACTIES', value: 'Binnenkort', sub: 'Verkoopprijzen en aantallen' },
    { key: 'roadmap-leegstand', label: 'LEEGSTAND', value: 'Binnenkort', sub: 'Vacaturecijfers per type vastgoed' },
    { key: 'roadmap-klimaat', label: 'KLIMAATRISICO', value: 'Binnenkort', sub: 'Hitte, wateroverlast, droogte' },
  ], [dataCards])

  /* Footer CTA */
  const footer = hasCompletedScan ? (
    <button
      type="button"
      onClick={() => onViewResults(latestScan.scan_id)}
      className="w-full h-[60px] rounded-full bg-[#0E1111] text-white text-[15px] font-bold tracking-tight transition-all hover:bg-slate-800 active:scale-[0.98] flex items-center justify-center gap-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Eye size={16} strokeWidth={2} />
      Bekijk resultaten
    </button>
  ) : scanControlsEnabled ? (
    <button
      type="button"
      onClick={onStartScan}
      className="w-full h-[60px] rounded-full bg-[#F9A826] text-white text-[15px] font-bold tracking-tight transition-all hover:bg-[#e09520] active:scale-[0.98] flex items-center justify-center gap-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Scan size={16} strokeWidth={2} />
      Start scan
    </button>
  ) : (
    <div
      className="w-full min-h-[60px] rounded-full border border-neutral-200 bg-neutral-50 px-5 py-4 text-center text-sm font-medium text-neutral-600 flex items-center justify-center"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      Nog geen voorbereide resultaten voor deze wijk
    </div>
  )

  return (
    <LeftPanelShell onClose={onClose} footer={footer}>
      <motion.div
        className="flex flex-col h-full overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* ── Header ───────────────────────────────────── */}
        <div className="px-8 pt-8">
          {/* Back breadcrumb */}
          <button
            onClick={onBack}
            className="group flex items-center gap-1.5 mb-2 transition-colors duration-200"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-white/60 backdrop-blur-sm group-hover:bg-white/80 transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4 text-aura-ink" />
            </div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">
              {gemeenteNaam}
            </span>
          </button>

          <div className="min-w-0 max-w-full pr-16">
            <h2 className="text-[28px] font-bold tracking-tighter text-slate-900 leading-tight truncate">
              {naam}
            </h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">
              Marktprofiel
            </p>
          </div>
        </div>

        {/* ── Verdict + Grid ───────────────────────────── */}
        <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
          <VerdictHero
            score={verdict.score}
            label={verdict.label}
            subtitle={verdict.subtitle}
            color={verdict.color}
            icon={<verdict.Icon className="size-6 text-white" strokeWidth={2.5} />}
          />
          <IntelligenceGrid cards={cards} page={gridPage} onPageChange={setGridPage} />
        </div>

        {/* ── Trust metadata ───────────────────────────── */}
        <div className="px-8 pb-6">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wider text-slate-300">
              Bron: CBS · Kadaster · PDOK
              {metrics?.peiljaar ? ` · ${metrics.peiljaar}` : ''}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {openMetric && metrics && (
          <WijkDetailModal
            metricKey={openMetric as 'koopwoning' | 'dichtheid' | 'eenpersoons' | 'inkomen' | 'woz' | 'inwoners' | 'criminaliteit' | 'supermarkt' | 'leeftijd'}
            metrics={metrics}
            wijkNaam={naam}
            onClose={() => setOpenMetric(null)}
          />
        )}
      </AnimatePresence>
    </LeftPanelShell>
  )
}
