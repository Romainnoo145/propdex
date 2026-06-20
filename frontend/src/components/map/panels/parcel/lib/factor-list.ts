/**
 * Weight-sorting + planned-cascade placeholders for the per-tab factor scroll
 * (ParcelDetailPanel redesign). The Potentie and Risico tabs each replace their
 * 4-per-page PageTitleToggle pagination with ONE continuous, weight-sorted list
 * of FactorCard rows. Sorting + the "binnenkort" roadmap placeholders live here
 * so both layers share one source.
 *
 * PLANNED_* are roadmap cascades not yet in the backend registry — dashed
 * "binnenkort" placeholders, split per category so each lands in its own tab.
 * Source: .planning/CASCADE-BUILD-INVENTARISATIE.md (2026-06-11).
 */

import type { Bron } from '@/lib/factor-groups'

export type FactorTone = 'positive' | 'negative'

/**
 * Sort any pts-bearing cards by descending |weighted contribution| (`pts` =
 * factor.bijdrage). Missing / zero-weight cards (pts 0) sink to the bottom.
 * Stable for ties (V8 Array.prototype.sort is stable). Does not mutate input.
 */
export function sortByWeight<T extends { pts: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))
}

/* ── Planned cascades (roadmap placeholders) ──────────────────── */

export type CascadeWave = 'Wave 1' | 'Wave 2' | 'Wave 3'

export interface PlannedFactor {
  /** Synthetic factor key (matches the planned backend factor name). */
  key: string
  /** Card label, same uppercase style as built factors. */
  label: string
  tone: FactorTone
  bron: Bron
  /** Human-readable cascade source document. */
  source: string
  wave: CascadeWave
}

/**
 * Planned POTENTIE cascades — render at the bottom of the Potentie tab scroll.
 * Verbatim factor keys + documents from the build matrix in
 * .planning/CASCADE-BUILD-INVENTARISATIE.md. Refinement-only cascades are
 * excluded (they sharpen existing factors, they aren't new cards).
 */
export const PLANNED_POTENTIE: PlannedFactor[] = [
  {
    key: 'woondeal_boost',
    label: 'WOONDEAL',
    tone: 'positive',
    bron: 'gemeente_beleid',
    source: 'Woondeal Limburg 2022-2030',
    wave: 'Wave 1',
  },
  {
    key: 'beleidsalignement_provincie',
    label: 'PROV. VISIE',
    tone: 'positive',
    bron: 'gemeente_beleid',
    source: 'POVI Limburg',
    wave: 'Wave 2',
  },
  {
    key: 'subsidie_potentie',
    label: 'SUBSIDIE',
    tone: 'positive',
    bron: 'gemeente_beleid',
    source: 'Subsidies Venlo / Limburg',
    wave: 'Wave 3',
  },
  {
    key: 'politiek_klimaat',
    label: 'POLITIEK',
    tone: 'positive',
    bron: 'gemeente_beleid',
    source: 'Raadsinformatie (ORI)',
    wave: 'Wave 3',
  },
  {
    key: 'segment_fit',
    label: 'SEGMENT',
    tone: 'positive',
    bron: 'juridisch',
    source: 'Woningwet',
    wave: 'Wave 3',
  },
]

/**
 * Planned RISICO cascades — render at the bottom of the Risico tab scroll.
 */
export const PLANNED_RISICO: PlannedFactor[] = [
  {
    key: 'welstand_beperking',
    label: 'WELSTAND',
    tone: 'negative',
    bron: 'planologisch',
    source: 'Welstandsnota Venlo',
    wave: 'Wave 2',
  },
  {
    key: 'duurzaamheid_kosten',
    label: 'DUURZAAMHEID',
    tone: 'negative',
    bron: 'gemeente_beleid',
    source: 'Transitievisie Gebouwde Omgeving 2.0',
    wave: 'Wave 2',
  },
  {
    key: 'omgevingsverordening_limburg',
    label: 'PROV. REGELS',
    tone: 'negative',
    bron: 'planologisch',
    source: 'Omgevingsverordening Limburg',
    wave: 'Wave 2',
  },
  {
    key: 'stikstof_risico',
    label: 'STIKSTOF',
    tone: 'negative',
    bron: 'klimaat',
    source: 'Limburgs Offensief Stikstof / AERIUS',
    wave: 'Wave 3',
  },
  {
    key: 'beng_kosten',
    label: 'BENG',
    tone: 'negative',
    bron: 'juridisch',
    source: 'BENG (RVO / EP-Online)',
    wave: 'Wave 3',
  },
  {
    key: 'ladder_risico',
    label: 'LADDER',
    tone: 'negative',
    bron: 'juridisch',
    source: 'Ladder duurzame verstedelijking',
    wave: 'Wave 3',
  },
]
