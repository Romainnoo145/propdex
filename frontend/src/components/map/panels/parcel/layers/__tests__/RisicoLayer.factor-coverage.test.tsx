/**
 * REGRESSION-CRITICAL: pins frontend factor-label coverage for risico factors.
 * Source: backend/app/services/score_v3.py FACTOR_REGISTRY (2026-05-19, post-M050/S03).
 * Parallel backend test: backend/tests/regression/test_score_v3_registry_25_factors.py
 * (drift-detector — fails FIRST on backend rename, before this test silently rots).
 * Project convention: pure-logic tests here; React rendering tests via Storybook.
 */
import { describe, expect, it } from 'vitest'
import { FACTOR_LABELS, formatFactorValue } from '../RisicoLayer'
import type { ScoreFactorV3 } from '@/lib/types/scan'

// 25 backend factors: 9 potentie + 13 pre-M050 risico + 3 M050/S03 BRK
const KNOWN_25_FACTOR_KEYS = [
  'vrije_grond', 'optoppotentie', 'bestemming', 'leegstand', 'funda_frictie',
  'perceelgrootte', 'demografie', 'vergunning_succeskans', 'woonvisie_match',
  'funderingsrisico', 'asbest', 'bodemverontreiniging', 'monument',
  'bestemmingswijziging', 'constructieve_staat', 'juridisch_klimaat',
  'criminaliteit', 'max_hoogte_bereikt', 'natura2000', 'overstromingsrisico',
  'geluid', 'luchtkwaliteit',
  'hypotheek_risico', 'eigendoms_complexiteit', 'koopwaarde_trend',
] as const

// Risico keys flow through TWO render paths (see RisicoLayer.tsx):
//   1. FACTOR_LABELS score-card path (12 keys: 9 pre-M050 + 3 BRK)
//   2. deriveEnvCards inline-strings path (4 env keys)
const FACTOR_LABELS_RISICO_KEYS = [
  'funderingsrisico', 'asbest', 'bodemverontreiniging', 'monument',
  'bestemmingswijziging', 'constructieve_staat', 'juridisch_klimaat',
  'criminaliteit', 'max_hoogte_bereikt',
  'hypotheek_risico', 'eigendoms_complexiteit', 'koopwaarde_trend',
] as const
const ENV_PATH_RISICO_KEYS = ['natura2000', 'overstromingsrisico', 'geluid', 'luchtkwaliteit'] as const
const ALL_RISICO_KEYS = KNOWN_25_FACTOR_KEYS.slice(9)

const fac = (waarde: unknown, missing = false): ScoreFactorV3 => ({
  waarde, genormaliseerde_score: 0.5, gewicht: 5, bijdrage: 2.5,
  categorie: 'risico', toelichting_kort: '', toelichting_lang: '', data_bronnen: [], missing,
})

describe('RisicoLayer factor-coverage (REGRESSION-CRITICAL)', () => {
  it('known factor count is 25', () => {
    expect(KNOWN_25_FACTOR_KEYS.length).toBe(25)
  })

  it('FACTOR_LABELS covers 12 score-card risico keys', () => {
    for (const k of FACTOR_LABELS_RISICO_KEYS) {
      expect(FACTOR_LABELS[k], `missing FACTOR_LABELS['${k}']`).toBeDefined()
    }
  })

  it('FACTOR_LABELS + env path together cover all 16 risico keys', () => {
    const covered = new Set<string>([...FACTOR_LABELS_RISICO_KEYS, ...ENV_PATH_RISICO_KEYS])
    for (const k of ALL_RISICO_KEYS) {
      expect(covered.has(k), `risico key '${k}' uncovered`).toBe(true)
    }
    expect(covered.size).toBe(16)
  })

  it('M050/S03 BRK keys are in FACTOR_LABELS (drift canary)', () => {
    expect(FACTOR_LABELS['hypotheek_risico']).toBe('HYPOTHEEK')
    expect(FACTOR_LABELS['eigendoms_complexiteit']).toBe('EIGENDOMSCOMPL.')
    expect(FACTOR_LABELS['koopwaarde_trend']).toBe('KOOPWAARDE')
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

  it('unknown factor key → default em-dash fallback (no crash)', () => {
    const r = formatFactorValue('unknown_factor', fac('whatever'))
    expect(r.value).toBe('—')
    expect(r.sub).toBe('')
    expect(FACTOR_LABELS['unknown_factor'] ?? 'unknown_factor'.toUpperCase()).toBe('UNKNOWN_FACTOR')
  })
})
