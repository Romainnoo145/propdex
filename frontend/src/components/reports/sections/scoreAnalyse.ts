/**
 * Pure score-analyse helpers shared by the report's S5 section and the
 * off-market "Bekijk scores" panel. No JSX here so it stays unit-testable
 * in the node-env vitest project.
 */
import type { ScanResultItem } from '@/lib/types/scan'

export interface FactorResult {
  naam?: string
  waarde?: unknown
  genormaliseerde_score?: number
  gewicht?: number
  bijdrage?: number
  categorie?: 'potentie' | 'risico'
  toelichting_kort?: string
  toelichting_lang?: string
  data_bronnen?: string[]
  missing?: boolean
}

export interface ScoresV3 {
  overall?: number
  potentie?: number
  risico?: number
}

export function parseScores(raw: Record<string, unknown> | null | undefined): ScoresV3 | null {
  if (!raw) return null
  return {
    overall: typeof raw.overall === 'number' ? raw.overall : undefined,
    potentie: typeof raw.potentie === 'number' ? raw.potentie : undefined,
    risico: typeof raw.risico === 'number' ? raw.risico : undefined,
  }
}

export function parseFactors(
  breakdown: Record<string, unknown> | null | undefined,
): FactorResult[] {
  if (!breakdown) return []
  return Object.entries(breakdown).map(([key, val]) => {
    const f = (val ?? {}) as Record<string, unknown>
    return {
      naam: key,
      waarde: f.waarde,
      genormaliseerde_score: typeof f.genormaliseerde_score === 'number' ? f.genormaliseerde_score : undefined,
      gewicht: typeof f.gewicht === 'number' ? f.gewicht : undefined,
      bijdrage: typeof f.bijdrage === 'number' ? f.bijdrage : undefined,
      categorie: (f.categorie as 'potentie' | 'risico' | undefined) ?? 'potentie',
      toelichting_kort: typeof f.toelichting_kort === 'string' ? f.toelichting_kort : undefined,
      toelichting_lang: typeof f.toelichting_lang === 'string' ? f.toelichting_lang : undefined,
      data_bronnen: Array.isArray(f.data_bronnen) ? (f.data_bronnen as string[]) : undefined,
      missing: typeof f.missing === 'boolean' ? f.missing : false,
    }
  })
}

const byBijdrageDesc = (a: FactorResult, b: FactorResult) => (b.bijdrage ?? 0) - (a.bijdrage ?? 0)

export interface AnalyseData {
  scores: ScoresV3 | null
  potentieFactors: FactorResult[]
  risicoFactors: FactorResult[]
}

/**
 * Adapt a per-parcel ScanResultItem (from /api/scans/parcels/{id}/scan-data)
 * into the score + factor shape the analyse overview renders. Mirrors how the
 * report's S5 derives its data, but sourced from the scan item's dedicated
 * potentie_score / risico_score / score fields + score_breakdown.
 */
export function analyseFromScanItem(item: ScanResultItem | null | undefined): AnalyseData {
  if (!item) return { scores: null, potentieFactors: [], risicoFactors: [] }
  const scores: ScoresV3 = {
    overall: item.score ?? undefined,
    potentie: item.potentie_score ?? undefined,
    risico: item.risico_score ?? undefined,
  }
  const all = parseFactors(item.score_breakdown as Record<string, unknown> | null | undefined)
  return {
    scores,
    potentieFactors: all.filter((f) => f.categorie === 'potentie').sort(byBijdrageDesc),
    risicoFactors: all.filter((f) => f.categorie === 'risico').sort(byBijdrageDesc),
  }
}
