/**
 * factor-detail.ts — Shared types and utilities for factor extraction and classification
 *
 * Extracted from ScoreBreakdownModal.tsx to enable reuse in the detail drawer.
 */

/* ── Types ───────────────────────────────────────────────────── */

export interface ScoreFactor {
  categorie: 'potentie' | 'risico'
  waarde: unknown
  genormaliseerde_score: number | null
  gewicht: number | null
  bijdrage: number | null
  toelichting_kort: string | null
  toelichting_lang: string | null
  missing: boolean
  data_bronnen: string[] | null
  succeskans_missing: boolean | null
  succeskans_reason: string | null
  dev_type_ruling_count: number | null
  total_ruling_count: number | null
  percentage_of_category: number | null   // backend float 0.0-1.0, null for pre-M047 scans
}

/* ── Parser ──────────────────────────────────────────────────── */

export function parseFactors(breakdown: Record<string, unknown> | null): {
  potentie: { name: string; factor: ScoreFactor }[]
  risico: { name: string; factor: ScoreFactor }[]
} {
  const potentie: { name: string; factor: ScoreFactor }[] = []
  const risico: { name: string; factor: ScoreFactor }[] = []

  if (!breakdown) return { potentie, risico }

  for (const [name, value] of Object.entries(breakdown)) {
    if (!value || typeof value !== 'object') continue
    const f = value as Record<string, unknown>
    if (!('categorie' in f)) continue

    const factor: ScoreFactor = {
      categorie: f.categorie === 'risico' ? 'risico' : 'potentie',
      waarde: f.waarde ?? null,
      genormaliseerde_score: typeof f.genormaliseerde_score === 'number' ? f.genormaliseerde_score : null,
      gewicht: typeof f.gewicht === 'number' ? f.gewicht : null,
      bijdrage: typeof f.bijdrage === 'number' ? f.bijdrage : null,
      toelichting_kort: typeof f.toelichting_kort === 'string' ? f.toelichting_kort : null,
      toelichting_lang: typeof f.toelichting_lang === 'string' ? f.toelichting_lang : null,
      missing: f.missing === true,
      data_bronnen: Array.isArray(f.data_bronnen)
        ? (f.data_bronnen.filter((x) => typeof x === 'string') as string[])
        : null,
      succeskans_missing: typeof f.succeskans_missing === 'boolean' ? f.succeskans_missing : null,
      succeskans_reason: typeof f.succeskans_reason === 'string' ? f.succeskans_reason : null,
      dev_type_ruling_count: typeof f.dev_type_ruling_count === 'number' ? f.dev_type_ruling_count : null,
      total_ruling_count: typeof f.total_ruling_count === 'number' ? f.total_ruling_count : null,
      percentage_of_category: typeof f.percentage_of_category === 'number'
        ? f.percentage_of_category
        : null,
    }

    if (factor.categorie === 'risico') {
      risico.push({ name, factor })
    } else {
      potentie.push({ name, factor })
    }
  }

  // Sort by bijdrage descending
  potentie.sort((a, b) => (b.factor.bijdrage ?? 0) - (a.factor.bijdrage ?? 0))
  risico.sort((a, b) => (b.factor.bijdrage ?? 0) - (a.factor.bijdrage ?? 0))

  return { potentie, risico }
}

/* ── Formatters ──────────────────────────────────────────────── */

export function formatFactorName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isWijkBreed(dataBronnen: string[] | null): boolean {
  if (!dataBronnen) return false
  return dataBronnen.some((src) => /CBS/i.test(src))
}

/* ── Cascade classifier ──────────────────────────────────────── */

/** The five factors that carry rich editorial detail content. */
export const CASCADE_FACTOR_KEYS: ReadonlySet<string> = new Set([
  'woonvisie_match',
  'beleidsalignement',
  'grondwaarde_fit',
  'splitsingsrisico',
  'parkeerdruk',
])

/** True when a factor has an editorial *DetailContent body (vs. generic explain). */
export function isCascadeFactor(key: string): boolean {
  return CASCADE_FACTOR_KEYS.has(key)
}

/* ── Bijdrage-bar geometry (Variant C) ───────────────────────── */

export function barGeometry(
  pts: number,
  maxAbs: number,
): { side: 'pos' | 'neg' | 'zero'; widthPct: number } {
  if (pts === 0 || maxAbs <= 0) return { side: 'zero', widthPct: 0 }
  const widthPct = Math.round((Math.abs(pts) / maxAbs) * 100)
  return { side: pts > 0 ? 'pos' : 'neg', widthPct }
}
