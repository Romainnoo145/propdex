/**
 * REGRESSION-CRITICAL: pins frontend factor-label coverage for potentie factors.
 * Source: backend/app/services/score_v3.py FACTOR_REGISTRY (2026-06-23, post-M054/S07).
 * Parallel backend test: backend/tests/regression/test_score_v3_registry_28_factors.py
 * (drift-detector — fails FIRST on backend rename, before this test silently rots).
 * Project convention: pure-logic tests here; React rendering tests via Storybook.
 */
import { describe, expect, it } from 'vitest'
import { FACTOR_LABELS } from '../PotentieLayer'

// 10 backend potentie factors (M054/S07: one potentie factor removed):
//   8 pre-M047 + woonvisie_match (M047) + beleidsalignement (M053/S01).
//   'capaciteit' is a UI-only derived card.
const KNOWN_10_POTENTIE_KEYS = [
  'vrije_grond', 'optoppotentie', 'bestemming', 'leegstand', 'funda_frictie',
  'perceelgrootte', 'demografie', 'vergunning_succeskans', 'woonvisie_match',
  'beleidsalignement',
] as const

describe('PotentieLayer factor-coverage (REGRESSION-CRITICAL)', () => {
  it('known potentie factor count is 10', () => {
    expect(KNOWN_10_POTENTIE_KEYS.length).toBe(10)
  })

  it('FACTOR_LABELS covers every potentie key + the UI-only capaciteit card', () => {
    for (const k of KNOWN_10_POTENTIE_KEYS) {
      expect(FACTOR_LABELS[k], `missing FACTOR_LABELS['${k}']`).toBeDefined()
    }
    expect(FACTOR_LABELS['capaciteit']).toBeDefined()
  })
})
