/**
 * Single-scroll factor list (ParcelDetailPanel redesign — Optie B).
 *
 * Merges the potentie + risico card pipelines (V3 score_breakdown + v2.1
 * fallback, same source as the legacy paginated grid) into ONE globally
 * weight-sorted list. No category tabs, no pagination: heaviest weighted
 * contribution first. Each card keeps its own potentie/risico tone so colour
 * still encodes meaning.
 *
 * PLANNED_FACTORS are roadmap cascades not yet in the backend registry — they
 * render as dashed "binnenkort" placeholders so the panel previews what is
 * coming. Source: .planning/CASCADE-BUILD-INVENTARISATIE.md (2026-06-11).
 */

import type { ScanResultItem } from '@/lib/types/scan'
import type { PageCard, Bron } from '@/lib/factor-groups'
import type { useParcelEnrichment } from '@/hooks/useScans'
import { buildPotentieCards } from '../layers/PotentieLayer'
import { buildRisicoCards } from '../layers/RisicoLayer'

export type FactorTone = 'positive' | 'negative'

/** A real (weighted) factor card plus its potentie/risico colour identity. */
export interface FactorListItem extends PageCard {
  tone: FactorTone
}

/**
 * Global sort: descending by |weighted contribution| (`pts` = factor.bijdrage).
 * Missing / zero-weight cards (pts 0) naturally sink to the bottom. Stable for
 * ties (V8 Array.prototype.sort is stable), so equal-weight cards keep their
 * potentie-before-risico insertion order.
 */
export function sortByWeight(items: FactorListItem[]): FactorListItem[] {
  return [...items].sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))
}

/**
 * Build the merged, weight-sorted factor list for a parcel. Potentie cards are
 * tagged tone 'positive', risico (incl. environmental enrichment) tone
 * 'negative'.
 */
export function buildFactorList(
  parcel: ScanResultItem,
  enrichmentData: ReturnType<typeof useParcelEnrichment>['data'],
): FactorListItem[] {
  const potentie: FactorListItem[] = buildPotentieCards(parcel).map((c) => ({
    ...c,
    tone: 'positive',
  }))
  const risico: FactorListItem[] = buildRisicoCards(parcel, enrichmentData).map((c) => ({
    ...c,
    tone: 'negative',
  }))
  return sortByWeight([...potentie, ...risico])
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
 * Planned cascade factors NOT yet in the backend FACTOR_REGISTRY / score_breakdown.
 * Purely visual placeholders — no scoring. Sourced verbatim from the build matrix
 * in .planning/CASCADE-BUILD-INVENTARISATIE.md (factor keys + documents named there).
 * Refinement-only cascades (erfgoedverordening → monument, asbest/sloop → asbest)
 * are intentionally excluded: they sharpen existing factors, they aren't new cards.
 */
export const PLANNED_FACTORS: PlannedFactor[] = [
  // Wave 1 — pure S07-herhaling, verse Venlo-docs
  {
    key: 'woondeal_boost',
    label: 'WOONDEAL',
    tone: 'positive',
    bron: 'gemeente_beleid',
    source: 'Woondeal Limburg 2022-2030',
    wave: 'Wave 1',
  },
  // Wave 2 — S07-patroon, gedateerde/complexere bron
  {
    key: 'welstand_beperking',
    label: 'WELSTAND',
    tone: 'negative',
    bron: 'planologisch',
    source: 'Welstandsnota Venlo',
    wave: 'Wave 2',
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
  // Wave 3 — ander bron-type, brainstorm vereist
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
