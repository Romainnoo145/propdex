import type { ScoreFactorV3, ScoreBreakdownV3, ScoresV3 } from '@/lib/types/scan'

type ScoreBreakdown = Record<string, unknown> | null | undefined

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Detect whether a score_breakdown uses the v3.0 format.
 * v3.0 factors have a 'categorie' field ('potentie' | 'risico').
 */
export function isScoreV3(scoreBreakdown: Record<string, unknown> | null): boolean {
  if (!scoreBreakdown) return false
  const firstFactor = Object.values(scoreBreakdown)[0]
  return typeof firstFactor === 'object' && firstFactor !== null && 'categorie' in firstFactor
}

/**
 * Extract v3.0 scores (potentie/risico/overall) from scan flags.
 * Returns null if not a v3.0 scan.
 */
export function getScoresV3(flags: Record<string, unknown> | null): ScoresV3 | null {
  if (!flags || !flags.scores) return null
  const scores = flags.scores as ScoresV3
  if (typeof scores.potentie !== 'number') return null
  return scores
}

/**
 * Filter v3.0 breakdown to potentie factors only.
 */
export function getPotentieFactors(breakdown: ScoreBreakdownV3): ScoreFactorV3[] {
  return Object.values(breakdown).filter((f) => f.categorie === 'potentie')
}

/**
 * Filter v3.0 breakdown to risico factors only.
 */
export function getRisicoFactors(breakdown: ScoreBreakdownV3): ScoreFactorV3[] {
  return Object.values(breakdown).filter((f) => f.categorie === 'risico')
}

/**
 * Extract numeric factor contributions from score_breakdown.
 * Handles both v2.1 (flat numeric) and v3.0 (full factor objects) formats.
 */
export function extractScoreFactors(scoreBreakdown: ScoreBreakdown): Record<string, number> {
  const breakdown = asRecord(scoreBreakdown)
  if (!breakdown) return {}

  // v3.0: extract bijdrage from each factor
  if (isScoreV3(breakdown)) {
    const entries = Object.entries(breakdown).map(([name, factor]) => {
      const f = factor as ScoreFactorV3
      return [name, f.bijdrage] as const
    })
    return Object.fromEntries(entries) as Record<string, number>
  }

  // v2.1: look for factors sub-object or flat numeric entries
  const factors = asRecord(breakdown.factors)
  const source = factors ?? breakdown
  const numericEntries = Object.entries(source).filter(([, value]) => typeof value === 'number')
  return Object.fromEntries(numericEntries) as Record<string, number>
}

/**
 * Extract v2.1 subscores (vacancy/buildability) or v3.0 equivalents.
 */
export function extractScoreSubscores(scoreBreakdown: ScoreBreakdown): {
  vacancy: number | null
  buildability: number | null
} {
  const breakdown = asRecord(scoreBreakdown)
  if (!breakdown) {
    return { vacancy: null, buildability: null }
  }

  // v3.0 does not use vacancy/buildability subscores — return null
  if (isScoreV3(breakdown)) {
    return { vacancy: null, buildability: null }
  }

  // v2.1 path
  const subscores = asRecord(breakdown.subscores)
  const factors = asRecord(breakdown.factors)

  const vacancy =
    toNumber(subscores?.vacancy) ??
    toNumber(factors?.vacancy_subscore) ??
    toNumber(breakdown.vacancy_subscore)
  const buildability =
    toNumber(subscores?.buildability) ??
    toNumber(factors?.buildability_subscore) ??
    toNumber(breakdown.buildability_subscore)

  return { vacancy, buildability }
}
