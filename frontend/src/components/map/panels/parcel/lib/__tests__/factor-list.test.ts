/**
 * Unit tests for the per-tab factor scroll helpers (ParcelDetailPanel redesign).
 * Pins the weight-sort contract + the planned-placeholder split per category.
 */
import { describe, expect, it } from 'vitest'
import {
  sortByWeight,
  PLANNED_POTENTIE,
  PLANNED_RISICO,
  type PlannedFactor,
} from '../factor-list'

const card = (factor_key: string, pts: number) => ({ factor_key, pts })

describe('sortByWeight', () => {
  it('orders by descending |pts| (weighted contribution), heaviest first', () => {
    const sorted = sortByWeight([card('a', 2), card('b', -9), card('c', 5), card('d', 0)])
    expect(sorted.map((c) => c.factor_key)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('uses absolute value so negative risico contributions rank by magnitude', () => {
    const sorted = sortByWeight([card('low', 1), card('bigrisk', -8)])
    expect(sorted[0]?.factor_key).toBe('bigrisk')
  })

  it('is stable for ties — keeps insertion order', () => {
    const sorted = sortByWeight([card('first', 4), card('second', 4)])
    expect(sorted.map((c) => c.factor_key)).toEqual(['first', 'second'])
  })

  it('does not mutate its input', () => {
    const input = [card('a', 1), card('b', 9)]
    sortByWeight(input)
    expect(input.map((c) => c.factor_key)).toEqual(['a', 'b'])
  })

  it('is generic over any pts-bearing shape', () => {
    const sorted = sortByWeight([
      { factor_key: 'x', pts: 1, extra: 'keep' },
      { factor_key: 'y', pts: 9, extra: 'keep' },
    ])
    expect(sorted[0]?.extra).toBe('keep')
  })
})

describe('PLANNED placeholders', () => {
  const all: PlannedFactor[] = [...PLANNED_POTENTIE, ...PLANNED_RISICO]

  it('potentie placeholders are all tone positive, risico all negative', () => {
    expect(PLANNED_POTENTIE.every((p) => p.tone === 'positive')).toBe(true)
    expect(PLANNED_RISICO.every((p) => p.tone === 'negative')).toBe(true)
  })

  it('lists only roadmap cascades not yet in the live registry', () => {
    const liveKeys = new Set([
      'vrije_grond', 'optoppotentie', 'bestemming', 'leegstand', 'funda_frictie',
      'perceelgrootte', 'demografie', 'vergunning_succeskans', 'capaciteit',
      'woonvisie_match', 'beleidsalignement', 'grondwaarde_fit',
      'funderingsrisico', 'asbest', 'bodemverontreiniging', 'monument',
      'bestemmingswijziging', 'constructieve_staat', 'juridisch_klimaat',
      'criminaliteit', 'max_hoogte_bereikt', 'splitsingsrisico', 'parkeerdruk',
      'natura2000', 'overstromingsrisico', 'geluid', 'luchtkwaliteit',
      'hypotheek_risico', 'eigendoms_complexiteit', 'koopwaarde_trend',
    ])
    for (const planned of all) {
      expect(liveKeys.has(planned.key), `${planned.key} is already live`).toBe(false)
    }
  })

  it('every planned factor has a label, source and valid wave', () => {
    for (const p of all) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.source.length).toBeGreaterThan(0)
      expect(['Wave 1', 'Wave 2', 'Wave 3']).toContain(p.wave)
    }
  })

  it('keys are unique across both sets', () => {
    const keys = all.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
