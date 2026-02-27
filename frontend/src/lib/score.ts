type ScoreBreakdown = Record<string, unknown> | null | undefined

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function extractScoreFactors(
  scoreBreakdown: ScoreBreakdown
): Record<string, number> {
  const breakdown = asRecord(scoreBreakdown)
  if (!breakdown) return {}

  const factors = asRecord(breakdown.factors)
  const source = factors ?? breakdown
  const numericEntries = Object.entries(source).filter(([, value]) => typeof value === 'number')
  return Object.fromEntries(numericEntries) as Record<string, number>
}

export function extractScoreSubscores(
  scoreBreakdown: ScoreBreakdown
): {
  vacancy: number | null
  buildability: number | null
} {
  const breakdown = asRecord(scoreBreakdown)
  if (!breakdown) {
    return { vacancy: null, buildability: null }
  }

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
