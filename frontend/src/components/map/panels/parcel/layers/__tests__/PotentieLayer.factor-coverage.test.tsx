/**
 * REGRESSION-CRITICAL: pins frontend factor-label coverage for potentie factors.
 * Source: backend/app/services/score_v3.py FACTOR_REGISTRY (2026-06-17, post-M054/S01).
 * Parallel backend test: backend/tests/regression/test_score_v3_registry_29_factors.py
 * (drift-detector — fails FIRST on backend rename, before this test silently rots).
 * Project convention: pure-logic tests here; React rendering tests via Storybook.
 */
import { describe, expect, it } from 'vitest'
import { FACTOR_LABELS, formatFactorValue } from '../PotentieLayer'
import type { ScanResultItem, ScoreFactorV3 } from '@/lib/types/scan'

// 11 backend potentie factors (M054/S01):
//   8 pre-M047 + woonvisie_match (M047) + beleidsalignement (M053/S01)
//   + grondwaarde_fit (M054/S01). 'capaciteit' is a UI-only derived card.
const KNOWN_11_POTENTIE_KEYS = [
  'vrije_grond', 'optoppotentie', 'bestemming', 'leegstand', 'funda_frictie',
  'perceelgrootte', 'demografie', 'vergunning_succeskans', 'woonvisie_match',
  'beleidsalignement', 'grondwaarde_fit',
] as const

const parcel = {} as ScanResultItem
const fac = (waarde: unknown, missing = false): ScoreFactorV3 => ({
  waarde, genormaliseerde_score: 0.5, gewicht: 8, bijdrage: 4,
  categorie: 'potentie', toelichting_kort: '', toelichting_lang: '', data_bronnen: [], missing,
})

describe('PotentieLayer factor-coverage (REGRESSION-CRITICAL)', () => {
  it('known potentie factor count is 11', () => {
    expect(KNOWN_11_POTENTIE_KEYS.length).toBe(11)
  })

  it('FACTOR_LABELS covers every potentie key + the UI-only capaciteit card', () => {
    for (const k of KNOWN_11_POTENTIE_KEYS) {
      expect(FACTOR_LABELS[k], `missing FACTOR_LABELS['${k}']`).toBeDefined()
    }
    expect(FACTOR_LABELS['capaciteit']).toBeDefined()
  })

  it('M054/S01 grondwaarde_fit key is in FACTOR_LABELS (drift canary)', () => {
    expect(FACTOR_LABELS['grondwaarde_fit']).toBe('GRONDWAARDE')
  })

  it('grondwaarde_fit passend renders verdict + price band', () => {
    const r = formatFactorValue(
      'grondwaarde_fit',
      fac({ verdict: 'passend', prijs_per_m2_min: 450, prijs_per_m2_max: 650, functiecategorie: 'vrij' }),
      parcel,
    )
    expect(r.value).toBe('PASSEND')
    expect(r.sub).toMatch(/€450/)
  })

  it('grondwaarde_fit context renders CONTEXT', () => {
    const r = formatFactorValue(
      'grondwaarde_fit',
      fac({ verdict: 'context', prijs_per_m2_min: 250, functiecategorie: 'sociaal' }),
      parcel,
    )
    expect(r.value).toBe('CONTEXT')
  })

  it('grondwaarde_fit missing falls back to GRONDWAARDE / geen brief', () => {
    const r = formatFactorValue('grondwaarde_fit', fac(null, true), parcel)
    expect(r.value).toBe('GRONDWAARDE')
    expect(r.sub).toMatch(/Geen grondprijzenbrief/)
  })
})
