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
import { staggerContainer } from './gemeente/animations'
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
      color: '#94a3b8',
      Icon: BarChart3,
      subtitle: 'Nog geen wijkdata beschikbaar',
    }
  }
  if (score >= 65) {
    return {
      score,
      label: 'STERK MARKTPROFIEL',
      color: '#22c55e',
      Icon: TrendingUp,
      subtitle: 'Hoog inkomen · veel koopwoningen · goede voorzieningen',
    }
  }
  if (score >= 40) {
    return {
      score,
      label: 'GEMIDDELD PROFIEL',
      color: '#F9A826',
      Icon: BarChart3,
      subtitle: 'Gemengd marktbeeld · kansen afhankelijk van strategie',
    }
  }
  return {
    score,
    label: 'ONTWIKKELGEBIED',
    color: '#0E1111',
    Icon: TrendingDown,
    subtitle: 'Lagere marktdruk · mogelijk transformatie-kansen',
  }
}

/* ── CBS → intelligence cards ──────────────────────────────── */

function buildCards(
  metrics: CbsNeighborhoodMetrics | null,
  parcelCount: number | null,
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
      { key: 'criminaliteit', label: 'CRIMINALITEIT', value: '—', sub: 'Veiligheid' },
      { key: 'supermarkt', label: 'SUPERMARKT', value: '—', sub: 'Voorzieningen' },
      { key: 'leeftijd', label: 'LEEFTIJD', value: '—', sub: 'Demografie' },
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

  // Dominant age group
  const leeftijd = d.leeftijdsverdeling
  let dominantAge = '—'
  let dominantAgeSub = 'Geen leeftijdsdata'
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
      dominantAge = `${Math.round(top[1])}%`
      const label = top[0]
      dominantAgeSub = label === '65+' ? 'Vergrijzing — doorstroomkans'
        : label === '25–44' ? 'Jong werkend — huurmarkt'
        : label === '0–14' ? 'Gezinswijk — koopmarkt'
        : label === '15–24' ? 'Studentenwijk — kamerverhuur'
        : 'Gevestigd — stabiele markt'
      dominantAge = `${Math.round(top[1])}% ${label}`
    }
  }

  const koop = d.demografie?.percentage_koopwoningen
  const inkomen = d.inkomen?.gem_gestandaardiseerd
  const woz = d.gemiddelde_woz_waarde
  const inwoners = d.demografie?.aantal_inwoners
  const crimPer1k = crim?.per_1000_inwoners
  const supermarkt = nab?.afstanden?.supermarkt_km

  return [
    {
      key: 'koopwoning',
      label: 'KOOPWONING',
      value: koop != null ? `${Math.round(koop)}%` : '—',
      sub: koop != null
        ? koop >= 60 ? 'Sterke koopmarkt' : koop >= 40 ? 'Gemengd koop/huur' : 'Huurmarkt dominant'
        : 'Geen data',
      accentColor: koop != null ? (koop >= 60 ? '#22c55e' : koop >= 40 ? '#F9A826' : '#0E1111') : undefined,
      badge: koop != null ? 'KOOP' : undefined,
    },
    {
      key: 'dichtheid',
      label: 'DICHTHEID',
      value: d.stedelijkheid?.omgevingsadressendichtheid != null
        ? `${Math.round(d.stedelijkheid.omgevingsadressendichtheid)}/km²`
        : d.stedelijkheid?.omschrijving ?? '—',
      sub: d.stedelijkheid?.omschrijving ?? 'Stedelijkheidsklasse',
      accentColor: d.stedelijkheid?.klasse != null
        ? d.stedelijkheid.klasse <= 2 ? '#7c3aed' : d.stedelijkheid.klasse <= 3 ? '#3b82f6' : '#94a3b8'
        : undefined,
    },
    {
      key: 'eenpersoons',
      label: 'EENPERSOONS',
      value: eenpersoonsPct != null ? `${eenpersoonsPct}%` : '—',
      sub: eenpersoonsPct != null
        ? eenpersoonsPct >= 50 ? 'Splitsen interessant' : eenpersoonsPct >= 30 ? 'Gemengde huishoudens' : 'Gezinswijk'
        : 'Geen data',
      accentColor: eenpersoonsPct != null && eenpersoonsPct >= 50 ? '#F9A826' : undefined,
    },
    {
      key: 'inkomen',
      label: 'INKOMEN',
      value: inkomen != null ? `€${Math.round(inkomen).toLocaleString('nl-NL')}` : '—',
      sub: inkomen != null
        ? inkomen >= 30000 ? 'Hoge koopkracht' : inkomen >= 22000 ? 'Gemiddelde koopkracht' : 'Lagere koopkracht'
        : 'Mediaan gestandaardiseerd',
      accentColor: inkomen != null ? (inkomen >= 30000 ? '#22c55e' : inkomen >= 22000 ? '#F9A826' : '#94a3b8') : undefined,
    },
    {
      key: 'woz',
      label: 'WOZ-WAARDE',
      value: woz != null ? `€${Math.round(woz * 1000).toLocaleString('nl-NL')}` : '—',
      sub: woz != null ? 'Gemiddelde woningwaarde' : 'Geen WOZ data',
      accentColor: '#0E1111',
    },
    {
      key: 'inwoners',
      label: 'INWONERS',
      value: inwoners != null ? inwoners.toLocaleString('nl-NL') : '—',
      sub: parcelCount != null ? `${parcelCount.toLocaleString('nl-NL')} percelen geanalyseerd` : 'Marktomvang',
      badge: parcelCount != null ? String(parcelCount) : undefined,
      accentColor: '#F9A826',
    },
    {
      key: 'criminaliteit',
      label: 'CRIMINALITEIT',
      value: crimPer1k != null ? `${Math.round(crimPer1k * 10) / 10}/1k` : '—',
      sub: crimPer1k != null
        ? crimPer1k <= 30 ? 'Veilige wijk' : crimPer1k <= 60 ? 'Gemiddeld' : 'Aandachtspunt'
        : 'Geen data',
      accentColor: crimPer1k != null
        ? crimPer1k <= 30 ? '#22c55e' : crimPer1k <= 60 ? '#F9A826' : '#ef4444'
        : undefined,
    },
    {
      key: 'supermarkt',
      label: 'SUPERMARKT',
      value: supermarkt != null ? `${Math.round(supermarkt * 10) / 10} km` : '—',
      sub: supermarkt != null
        ? supermarkt <= 0.5 ? 'Uitstekend voorzieningenniveau' : supermarkt <= 1.5 ? 'Goed bereikbaar' : 'Beperkte voorzieningen'
        : 'Geen data',
      accentColor: supermarkt != null
        ? supermarkt <= 0.5 ? '#22c55e' : supermarkt <= 1.5 ? '#F9A826' : '#ef4444'
        : undefined,
    },
    {
      key: 'leeftijd',
      label: 'LEEFTIJD',
      value: dominantAge,
      sub: dominantAgeSub,
      accentColor: '#F9A826',
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

  const [openMetric, setOpenMetric] = useState<string | null>(null)
  const [gridPage, setGridPage] = useState(0)
  const handleCardClick = metrics ? (key: string) => setOpenMetric(key) : undefined

  const dataCards = useMemo(
    () => buildCards(metrics, parcelCount, handleCardClick),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics, parcelCount, !!handleCardClick],
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
  ) : (
    <button
      type="button"
      onClick={onStartScan}
      className="w-full h-[60px] rounded-full bg-[#F9A826] text-white text-[15px] font-bold tracking-tight transition-all hover:bg-[#e09520] active:scale-[0.98] flex items-center justify-center gap-2"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Scan size={16} strokeWidth={2} />
      Start scan
    </button>
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
            metricKey={openMetric as 'koopwoning' | 'bouwjaar' | 'eenpersoons' | 'inkomen' | 'woz' | 'inwoners' | 'criminaliteit' | 'supermarkt' | 'leeftijd'}
            metrics={metrics}
            wijkNaam={naam}
            onClose={() => setOpenMetric(null)}
          />
        )}
      </AnimatePresence>
    </LeftPanelShell>
  )
}
