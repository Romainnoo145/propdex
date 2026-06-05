/**
 * M048 Phase 7 — Factor groups (bron-mapping) for UI pagination.
 *
 * MIRROR of backend FACTOR_REGISTRY[key].bron values from
 * backend/app/services/score_v3.py (Phase 7 Plan 03 Task 1).
 * Keep these in sync if backend mapping changes.
 *
 * UI-only: capaciteit (derived UI card, not in backend registry) is
 * mapped to 'fysiek' here. Document this exception below.
 */

export type Bron =
  | 'gemeente_beleid'
  | 'markt'
  | 'fysiek'
  | 'klimaat'
  | 'juridisch'
  | 'planologisch'

/** Display order for group pages (left-to-right in pagination). */
export const BRON_ORDER: readonly Bron[] = [
  'gemeente_beleid',
  'markt',
  'fysiek',
  'klimaat',
  'juridisch',
  'planologisch',
] as const

/** Display labels rendered as page-header titles (uppercase, tracking). */
export const BRON_LABEL: Record<Bron, string> = {
  gemeente_beleid: 'GEMEENTE BELEID',
  markt: 'MARKT',
  fysiek: 'FYSIEK',
  klimaat: 'KLIMAAT',
  juridisch: 'JURIDISCH',
  planologisch: 'PLANOLOGISCH',
}

/**
 * factor_key → Bron mapping. MUST match backend FACTOR_REGISTRY[key].bron.
 *
 * Special case: `capaciteit` is UI-only (derived from building_metrics in
 * PotentieLayer.tsx capacityValue/capacitySub). It is NOT in backend
 * FACTOR_REGISTRY but MUST appear in some group-page. Mapped to 'fysiek'.
 */
export const FACTOR_BRON: Record<string, Bron> = {
  // Potentie (9 backend + 1 UI-derived)
  vrije_grond: 'fysiek',
  optoppotentie: 'fysiek',
  bestemming: 'gemeente_beleid',
  leegstand: 'fysiek',
  funda_frictie: 'markt',
  perceelgrootte: 'fysiek',
  demografie: 'markt',
  vergunning_succeskans: 'gemeente_beleid',
  woonvisie_match: 'gemeente_beleid',
  beleidsalignement: 'gemeente_beleid',
  capaciteit: 'fysiek', // UI-only derived card — NOT in backend FACTOR_REGISTRY

  // Risico (13)
  funderingsrisico: 'fysiek',
  asbest: 'fysiek',
  bodemverontreiniging: 'fysiek',
  monument: 'juridisch',
  bestemmingswijziging: 'planologisch',
  constructieve_staat: 'fysiek',
  juridisch_klimaat: 'juridisch',
  criminaliteit: 'markt', // Open Question 4 resolution — avoids expanding enum to 'sociaal'
  max_hoogte_bereikt: 'fysiek',
  natura2000: 'klimaat',
  overstromingsrisico: 'klimaat',
  geluid: 'klimaat',
  luchtkwaliteit: 'klimaat',
  bodemtype: 'fysiek', // UI-only env card (funderingsrisico enrichment) — NOT in backend FACTOR_REGISTRY
}

/** Card shape consumed by buildPages — minimal contract. */
export interface PageCard {
  label: string
  value: string
  sub: string
  pts: number
  factor_key: string
  bron: Bron
  missing?: boolean
}

/** Pin shape needed by buildPages. Mirrors useFactorPins FactorPin. */
export interface PinLike {
  id: string
  factor_key: string
  position: number
}

/** Synthetic ghost slot rendered when pinned-page is partial. */
export type GhostSlot = { kind: 'ghost' }

export type PageSlot = PageCard | GhostSlot

export interface BuiltPage {
  title: string
  kind: 'pinned' | 'group'
  cards: PageSlot[]
}

export const CARDS_PER_PAGE = 4

/**
 * Build the full page array: page 0 = pinned synth-page; page 1..N = group pages.
 *
 * Page 0 logic:
 *   - 0 pins → title "TOP FACTOREN", show top-4 by |pts| desc across all bronnen
 *   - 1..3 pins → title "GEPIND", show pinned cards in position order + ghost slots filling to 4
 *   - 4 pins → title "GEPIND", show 4 pinned cards (no ghosts)
 *
 * Group pages (one per bron in BRON_ORDER, skipping empty):
 *   - title = BRON_LABEL[bron]
 *   - cards = allCards filtered to that bron, sliced to CARDS_PER_PAGE
 *   - cards keep their `factor_key` so pinned ones can render the star
 */
export function buildPages(
  allCards: PageCard[],
  pins: PinLike[],
): BuiltPage[] {
  // Page 0: pinned or fallback
  let pinnedPage: BuiltPage
  if (pins.length === 0) {
    const topN = [...allCards]
      .sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))
      .slice(0, CARDS_PER_PAGE)
    pinnedPage = {
      title: 'TOP FACTOREN',
      kind: 'pinned',
      cards: topN,
    }
  } else {
    const ordered = [...pins].sort((a, b) => a.position - b.position)
    const pinnedCards: PageSlot[] = ordered.map((p) => {
      const card = allCards.find((c) => c.factor_key === p.factor_key)
      // If pinned card no longer in allCards, render as missing ghost-shaped placeholder
      if (!card) {
        return {
          label: p.factor_key.toUpperCase(),
          value: '—',
          sub: 'Geen data',
          pts: 0,
          factor_key: p.factor_key,
          bron: FACTOR_BRON[p.factor_key] ?? 'fysiek',
          missing: true,
        } as PageCard
      }
      return card
    })
    const ghostsNeeded = Math.max(0, CARDS_PER_PAGE - pinnedCards.length)
    const cards: PageSlot[] = [
      ...pinnedCards,
      ...Array.from({ length: ghostsNeeded }, () => ({ kind: 'ghost' as const })),
    ]
    pinnedPage = { title: 'GEPIND', kind: 'pinned', cards }
  }

  // Group pages
  const groupPages: BuiltPage[] = BRON_ORDER.map((bron) => {
    const cards = allCards
      .filter((c) => c.bron === bron)
      .slice(0, CARDS_PER_PAGE)
    return { title: BRON_LABEL[bron], kind: 'group' as const, cards }
  }).filter((p) => p.cards.length > 0)

  return [pinnedPage, ...groupPages]
}
