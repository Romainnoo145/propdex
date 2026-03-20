import { useMemo } from 'react'
import {
  FileText,
  Landmark,
  ScrollText,
  Banknote,
  BookOpen,
  ShieldCheck,
  ShieldQuestion,
  type LucideIcon,
} from 'lucide-react'
import { VerdictHero } from './VerdictHero'
import { IntelligenceGrid, type IntelCard } from './IntelligenceGrid'
import { useRaadsinformatie } from '@/hooks/useRaadsinformatie'
import { useSubsidies } from '@/hooks/useSubsidies'
import { useHuisvestingsverordening } from '@/hooks/useHuisvestingsverordening'
import { useErfgoed } from '@/hooks/useErfgoed'

interface BestuurlijkLayerProps {
  gemeenteNaam: string
}

/* ── Verdict derivation ────────────────────────────────────── */

interface BestuurlijkVerdict {
  score: number | null
  label: string
  color: string
  Icon: LucideIcon
  subtitle: string
}

function deriveVerdict(
  raadsDekking: boolean | null,
  raadsCount: number,
  subsidieCount: number,
  heeftHvv: boolean | null,
  erfgoedCount: number,
): BestuurlijkVerdict {
  // Score based on information availability — how well can we assess this gemeente
  let score = 0
  let dataPoints = 0

  if (raadsDekking === true) { score += 30; dataPoints++ }
  if (raadsCount > 0) score += Math.min(20, raadsCount * 2)
  if (subsidieCount > 0) { score += 15; dataPoints++ }
  if (heeftHvv != null) { score += 10; dataPoints++ }
  if (erfgoedCount > 0) { score += 10; dataPoints++ }

  // More data points = more coverage = higher base
  score += dataPoints * 5

  score = Math.min(100, score)

  if (dataPoints === 0) {
    return {
      score: null,
      label: 'GEEN DATA',
      color: '#94a3b8',
      Icon: ShieldQuestion,
      subtitle: 'Bestuurlijke informatie niet beschikbaar',
    }
  }
  if (score >= 60) {
    return {
      score,
      label: 'GOED INZICHT',
      color: '#22c55e',
      Icon: ShieldCheck,
      subtitle: 'Uitgebreide bestuurlijke informatie beschikbaar',
    }
  }
  if (score >= 30) {
    return {
      score,
      label: 'BEPERKT INZICHT',
      color: '#f59e0b',
      Icon: BookOpen,
      subtitle: 'Gedeeltelijke bestuurlijke informatie',
    }
  }
  return {
    score,
    label: 'MINIMAAL INZICHT',
    color: '#94a3b8',
    Icon: ShieldQuestion,
    subtitle: 'Weinig bestuurlijke data gevonden',
  }
}

/* ── Raadsstuk type grouping ───────────────────────────────── */

function groupRaadsByType(stukken: { type: string | null }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const s of stukken) {
    const t = s.type ?? 'Overig'
    counts[t] = (counts[t] ?? 0) + 1
  }
  return counts
}

/* ── Component ─────────────────────────────────────────────── */

export function BestuurlijkLayer({ gemeenteNaam }: BestuurlijkLayerProps) {
  const { data: raadsData, isLoading: raadsLoading } = useRaadsinformatie(gemeenteNaam)
  const { data: subsidieData, isLoading: subsidieLoading } = useSubsidies()
  const { data: hvvData, isLoading: hvvLoading } = useHuisvestingsverordening(gemeenteNaam)
  const { data: erfgoedData, isLoading: erfgoedLoading } = useErfgoed(gemeenteNaam)

  const isLoading = raadsLoading || subsidieLoading || hvvLoading || erfgoedLoading

  const raadsTypeCounts = useMemo(
    () => raadsData?.stukken ? groupRaadsByType(raadsData.stukken) : {},
    [raadsData?.stukken],
  )
  const raadsTypes = Object.entries(raadsTypeCounts).sort((a, b) => b[1] - a[1])

  const verdict = deriveVerdict(
    raadsData?.dekking ?? null,
    raadsData?.total_found ?? 0,
    subsidieData?.total ?? 0,
    hvvData?.heeft_verordening ?? null,
    erfgoedData?.total ?? 0,
  )

  // Build cards
  const cards: IntelCard[] = useMemo(() => {
    const result: IntelCard[] = []

    // Raadsinformatie — top card
    result.push({
      key: 'raadsinformatie',
      label: 'RAADSINFORMATIE',
      value: raadsLoading ? '...' : raadsData?.dekking
        ? `${raadsData.total_found} STUK${raadsData.total_found !== 1 ? 'KEN' : ''}`
        : 'NIET BESCHIKBAAR',
      sub: raadsData?.dekking ? 'Open Raadsinformatie' : 'Gemeente niet aangesloten bij ORI',
      accentColor: raadsData?.dekking && raadsData.total_found > 0 ? '#f59e0b' : '#94a3b8',
      badge: raadsData?.dekking ? 'ORI' : undefined,
    })

    // Top 2 raadsstuk types as separate cards
    if (raadsTypes.length > 0) {
      result.push({
        key: `raads-${raadsTypes[0][0]}`,
        label: raadsTypes[0][0].toUpperCase().slice(0, 16),
        value: String(raadsTypes[0][1]),
        sub: 'Meest voorkomend type',
        accentColor: '#f59e0b',
      })
    } else {
      result.push({
        key: 'raads-type1',
        label: 'RAADSTYPE',
        value: '—',
        sub: 'Geen stukken gevonden',
      })
    }

    if (raadsTypes.length > 1) {
      result.push({
        key: `raads-${raadsTypes[1][0]}`,
        label: raadsTypes[1][0].toUpperCase().slice(0, 16),
        value: String(raadsTypes[1][1]),
        sub: 'Op-één-na meest voorkomend',
        accentColor: '#f59e0b',
      })
    } else {
      result.push({
        key: 'raads-type2',
        label: 'RAADSSTUKKEN',
        value: raadsData?.stukken?.[0]?.titel?.slice(0, 20)?.toUpperCase() ?? '—',
        sub: raadsData?.stukken?.[0]?.datum ?? 'Geen data',
      })
    }

    // Huisvestingsverordening
    result.push({
      key: 'huisvesting',
      label: 'HUISVESTINGSVERORD.',
      value: hvvLoading ? '...' : hvvData?.heeft_verordening ? 'JA' : 'NEE',
      sub: hvvData?.heeft_verordening
        ? (hvvData.title?.slice(0, 30) ?? 'Verordening actief')
        : 'Geen huisvestingsverordening',
      accentColor: hvvData?.heeft_verordening ? '#8b5cf6' : '#94a3b8',
      badge: hvvData?.heeft_verordening ? 'ACTIEF' : undefined,
    })

    // Erfgoed
    result.push({
      key: 'erfgoed',
      label: 'BESCHERMD ERFGOED',
      value: erfgoedLoading ? '...' : erfgoedData?.total
        ? `${erfgoedData.total} GEZICHT${erfgoedData.total !== 1 ? 'EN' : ''}`
        : 'GEEN',
      sub: erfgoedData?.beschermde_gezichten?.[0]?.naam ?? 'Geen beschermde gezichten',
      accentColor: erfgoedData?.total ? '#d97706' : '#94a3b8',
    })

    // Erfgoed detail — type breakdown
    const stadsgezichten = erfgoedData?.beschermde_gezichten?.filter(g => g.type === 'stadsgezicht').length ?? 0
    const dorpsgezichten = erfgoedData?.beschermde_gezichten?.filter(g => g.type === 'dorpsgezicht').length ?? 0
    result.push({
      key: 'erfgoed-types',
      label: 'ERFGOED TYPE',
      value: erfgoedData?.total
        ? `${stadsgezichten}S / ${dorpsgezichten}D`
        : '—',
      sub: erfgoedData?.total
        ? `${stadsgezichten} stads- / ${dorpsgezichten} dorpsgezicht`
        : 'Geen beschermde gebieden',
      accentColor: '#d97706',
    })

    // Subsidies
    result.push({
      key: 'subsidies',
      label: 'SUBSIDIES',
      value: subsidieLoading ? '...' : subsidieData?.total
        ? `${subsidieData.total} REGELING${subsidieData.total !== 1 ? 'EN' : ''}`
        : 'GEEN',
      sub: subsidieData?.subsidies?.[0]?.title?.slice(0, 30) ?? 'Geen relevante subsidies',
      accentColor: subsidieData?.total ? '#22c55e' : '#94a3b8',
      badge: subsidieData?.source ?? undefined,
    })

    // Top subsidie detail
    const topSubsidie = subsidieData?.subsidies?.[0]
    result.push({
      key: 'subsidie-top',
      label: 'TOP SUBSIDIE',
      value: topSubsidie?.title?.slice(0, 16)?.toUpperCase() ?? '—',
      sub: topSubsidie?.intro?.slice(0, 30) ?? 'Geen subsidiedata',
      accentColor: '#22c55e',
    })

    // Data coverage summary
    const sources = [
      raadsData?.dekking ? 'ORI' : null,
      hvvData ? 'KOOP' : null,
      erfgoedData ? 'RCE' : null,
      subsidieData ? 'RVO' : null,
    ].filter(Boolean)
    result.push({
      key: 'bronnen',
      label: 'BRONNEN',
      value: `${sources.length}/4`,
      sub: sources.length > 0 ? sources.join(' · ') : 'Geen bronnen beschikbaar',
      accentColor: sources.length >= 3 ? '#22c55e' : sources.length >= 2 ? '#f59e0b' : '#94a3b8',
    })

    return result
  }, [raadsData, raadsTypes, hvvData, erfgoedData, subsidieData, raadsLoading, hvvLoading, erfgoedLoading, subsidieLoading])

  return (
    <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
      <VerdictHero
        score={isLoading ? null : verdict.score}
        label={isLoading ? 'LADEN...' : verdict.label}
        subtitle={isLoading ? 'Bestuurlijke data ophalen...' : verdict.subtitle}
        color={verdict.color}
        icon={<verdict.Icon className="size-6 text-white" strokeWidth={2.5} />}
      />
      <IntelligenceGrid cards={cards} />
    </div>
  )
}
