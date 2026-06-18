/**
 * REGRESSION-CRITICAL: pins frontend factor-label coverage for risico factors.
 * Source: backend/app/services/score_v3.py FACTOR_REGISTRY (2026-06-18, post-M054/S01+S02).
 * Parallel backend test: backend/tests/regression/test_score_v3_registry_29_factors.py
 * (drift-detector — fails FIRST on backend rename, before this test silently rots).
 * grondwaarde_fit (M054/S01) is a potentie factor — its render path is covered by
 * the sibling PotentieLayer.factor-coverage.test.tsx; here it only shifts the
 * potentie slice boundary from 10 to 11.
 * Project convention: pure-logic tests here; React rendering tests via Storybook.
 */
import { describe, expect, it } from 'vitest'
import { FACTOR_LABELS, formatFactorValue } from '../RisicoLayer'
import type { ScoreFactorV3 } from '@/lib/types/scan'

// 29 backend factors:
//   potentie (11): 8 pre-M047 + woonvisie_match (M047) + beleidsalignement (M053/S01)
//                  + grondwaarde_fit (M054/S01)
//   risico (18): 9 pre-M050 risico + 4 env + 3 M050/S03 BRK + splitsingsrisico (M053/S12)
//                + parkeerdruk (M054/S02)
const KNOWN_29_FACTOR_KEYS = [
  'vrije_grond', 'optoppotentie', 'bestemming', 'leegstand', 'funda_frictie',
  'perceelgrootte', 'demografie', 'vergunning_succeskans', 'woonvisie_match',
  'beleidsalignement', 'grondwaarde_fit',
  'funderingsrisico', 'asbest', 'bodemverontreiniging', 'monument',
  'bestemmingswijziging', 'constructieve_staat', 'juridisch_klimaat',
  'criminaliteit', 'max_hoogte_bereikt', 'natura2000', 'overstromingsrisico',
  'geluid', 'luchtkwaliteit',
  'hypotheek_risico', 'eigendoms_complexiteit', 'koopwaarde_trend',
  'splitsingsrisico', 'parkeerdruk',
] as const

// Risico keys flow through TWO render paths (see RisicoLayer.tsx):
//   1. FACTOR_LABELS score-card path (14 keys: 9 pre-M050 + 3 BRK + splitsingsrisico
//      + parkeerdruk)
//   2. deriveEnvCards inline-strings path (4 env keys)
const FACTOR_LABELS_RISICO_KEYS = [
  'funderingsrisico', 'asbest', 'bodemverontreiniging', 'monument',
  'bestemmingswijziging', 'constructieve_staat', 'juridisch_klimaat',
  'criminaliteit', 'max_hoogte_bereikt',
  'hypotheek_risico', 'eigendoms_complexiteit', 'koopwaarde_trend',
  'splitsingsrisico', 'parkeerdruk',
] as const
const ENV_PATH_RISICO_KEYS = ['natura2000', 'overstromingsrisico', 'geluid', 'luchtkwaliteit'] as const
// Potentie is now 11 keys (grondwaarde_fit added), so risico slice starts at index 11.
const ALL_RISICO_KEYS = KNOWN_29_FACTOR_KEYS.slice(11)

const fac = (waarde: unknown, missing = false): ScoreFactorV3 => ({
  waarde, genormaliseerde_score: 0.5, gewicht: 5, bijdrage: 2.5,
  categorie: 'risico', toelichting_kort: '', toelichting_lang: '', data_bronnen: [], missing,
})

describe('RisicoLayer factor-coverage (REGRESSION-CRITICAL)', () => {
  it('known factor count is 29', () => {
    expect(KNOWN_29_FACTOR_KEYS.length).toBe(29)
  })

  it('FACTOR_LABELS covers 14 score-card risico keys', () => {
    for (const k of FACTOR_LABELS_RISICO_KEYS) {
      expect(FACTOR_LABELS[k], `missing FACTOR_LABELS['${k}']`).toBeDefined()
    }
  })

  it('FACTOR_LABELS + env path together cover all 18 risico keys', () => {
    const covered = new Set<string>([...FACTOR_LABELS_RISICO_KEYS, ...ENV_PATH_RISICO_KEYS])
    for (const k of ALL_RISICO_KEYS) {
      expect(covered.has(k), `risico key '${k}' uncovered`).toBe(true)
    }
    expect(covered.size).toBe(18)
  })

  it('M050/S03 BRK keys are in FACTOR_LABELS (drift canary)', () => {
    expect(FACTOR_LABELS['hypotheek_risico']).toBe('HYPOTHEEK')
    expect(FACTOR_LABELS['eigendoms_complexiteit']).toBe('EIGENDOMSCOMPL.')
    expect(FACTOR_LABELS['koopwaarde_trend']).toBe('KOOPWAARDE')
  })

  it('M053/S12 splitsingsrisico key is in FACTOR_LABELS (drift canary)', () => {
    expect(FACTOR_LABELS['splitsingsrisico']).toBe('OPKOOP')
  })

  it('M054/S02 parkeerdruk key is in FACTOR_LABELS (drift canary)', () => {
    expect(FACTOR_LABELS['parkeerdruk']).toBe('PARKEERDRUK')
  })

  it('hypotheek_risico Ja when n_with_hypotheek > 0', () => {
    const r = formatFactorValue('hypotheek_risico', fac({ n_with_hypotheek: 1, n_total: 2 }))
    expect(r.value).toBe('Ja')
    expect(r.sub).toMatch(/Hypotheek/i)
  })

  it('hypotheek_risico Nee when no hypotheek', () => {
    const r = formatFactorValue('hypotheek_risico', fac({ n_with_hypotheek: 0, n_total: 3 }))
    expect(r.value).toBe('Nee')
    expect(r.sub).toMatch(/Geen hypotheek/i)
  })

  it('eigendoms_complexiteit n_owners=1 → Enkelvoudig', () => {
    expect(formatFactorValue('eigendoms_complexiteit', fac({ n_owners: 1 })).value).toBe('Enkelvoudig')
  })

  it('eigendoms_complexiteit n_owners=3 → Complex', () => {
    const r = formatFactorValue('eigendoms_complexiteit', fac({ n_owners: 3 }))
    expect(r.value).toBe('Complex')
    expect(r.sub).toContain('3')
  })

  it('eigendoms_complexiteit legacy string capitalized', () => {
    expect(formatFactorValue('eigendoms_complexiteit', fac('enkelvoudig')).value).toBe('Enkelvoudig')
  })

  it('koopwaarde_trend dict → koopjaar + EUR-formatted koopsom', () => {
    const r = formatFactorValue('koopwaarde_trend', fac({ koopjaar: 2019, koopsom: 450000 }))
    expect(r.value).toBe('2019')
    expect(r.sub).toMatch(/450/)
    expect(r.sub).toMatch(/€/)
  })

  it('koopwaarde_trend null koopjaar → em-dash', () => {
    expect(formatFactorValue('koopwaarde_trend', fac({ koopjaar: null, koopsom: null })).value).toBe('—')
  })

  it('splitsingsrisico mogelijk_van_toepassing → MOGELIJK + buurt_naam', () => {
    const r = formatFactorValue(
      'splitsingsrisico',
      fac({ verdict: 'mogelijk_van_toepassing', buurt_naam: 'Craneveld' }),
    )
    expect(r.value).toBe('MOGELIJK')
    expect(r.sub).toBe('Craneveld')
  })

  it('splitsingsrisico van_toepassing → JA + buurt_naam', () => {
    const r = formatFactorValue(
      'splitsingsrisico',
      fac({ verdict: 'van_toepassing', buurt_naam: 'Q4' }),
    )
    expect(r.value).toBe('JA')
    expect(r.sub).toBe('Q4')
  })

  it('splitsingsrisico vergunningstelsel_voorraad → VERGUNNING', () => {
    const r = formatFactorValue('splitsingsrisico', fac({ verdict: 'vergunningstelsel_voorraad' }))
    expect(r.value).toBe('VERGUNNING')
    expect(r.sub).toBe('Voorraadstelsel')
  })

  it('splitsingsrisico missing → em-dash, geen regeling', () => {
    const r = formatFactorValue('splitsingsrisico', fac({ verdict: 'geen_regeling' }, true))
    expect(r.value).toBe('—')
    expect(r.sub).toBe('Geen regeling')
  })

  it('parkeerdruk verhoogd → VERHOOGD + gebied label', () => {
    const r = formatFactorValue('parkeerdruk', fac({ verdict: 'verhoogd', gebied: 'centrum' }))
    expect(r.value).toBe('VERHOOGD')
    expect(r.sub).toBe('Centrum')
  })

  it('parkeerdruk laag → LAAG + gebied label', () => {
    const r = formatFactorValue('parkeerdruk', fac({ verdict: 'laag', gebied: 'rest_bebouwde_kom' }))
    expect(r.value).toBe('LAAG')
    expect(r.sub).toBe('Bebouwde kom')
  })

  it('parkeerdruk geen_match → N.V.T.', () => {
    const r = formatFactorValue('parkeerdruk', fac({ verdict: 'geen_match' }))
    expect(r.value).toBe('N.V.T.')
    expect(r.sub).toBe('Geen normband')
  })

  it('parkeerdruk missing → em-dash, geen parkeernorm', () => {
    const r = formatFactorValue('parkeerdruk', fac({ verdict: 'geen_parkeerbeleid' }, true))
    expect(r.value).toBe('—')
    expect(r.sub).toBe('Geen parkeernorm')
  })

  it('unknown factor key → default em-dash fallback (no crash)', () => {
    const r = formatFactorValue('unknown_factor', fac('whatever'))
    expect(r.value).toBe('—')
    expect(r.sub).toBe('')
    expect(FACTOR_LABELS['unknown_factor'] ?? 'unknown_factor'.toUpperCase()).toBe('UNKNOWN_FACTOR')
  })
})
