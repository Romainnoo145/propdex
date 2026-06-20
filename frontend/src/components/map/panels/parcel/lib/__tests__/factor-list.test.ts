/**
 * Unit tests for the single-scroll factor list (ParcelDetailPanel Optie B).
 * Pins the global weight-sort + planned-placeholder contract.
 */
import { describe, expect, it } from 'vitest'
import {
  sortByWeight,
  buildFactorList,
  PLANNED_FACTORS,
  type FactorListItem,
} from '../factor-list'
import type { ScanResultItem } from '@/lib/types/scan'

const item = (factor_key: string, pts: number, tone: 'positive' | 'negative'): FactorListItem => ({
  label: factor_key.toUpperCase(),
  value: '—',
  sub: '',
  pts,
  factor_key,
  bron: 'fysiek',
  tone,
})

describe('sortByWeight', () => {
  it('orders by descending |pts| (weighted contribution), heaviest first', () => {
    const sorted = sortByWeight([
      item('a', 2, 'positive'),
      item('b', -9, 'negative'),
      item('c', 5, 'positive'),
      item('d', 0, 'positive'),
    ])
    expect(sorted.map((c) => c.factor_key)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('uses absolute value so negative risico contributions rank by magnitude', () => {
    const sorted = sortByWeight([item('low', 1, 'positive'), item('bigrisk', -8, 'negative')])
    expect(sorted[0]?.factor_key).toBe('bigrisk')
  })

  it('is stable for ties — keeps insertion order', () => {
    const sorted = sortByWeight([
      item('first', 4, 'positive'),
      item('second', 4, 'negative'),
    ])
    expect(sorted.map((c) => c.factor_key)).toEqual(['first', 'second'])
  })

  it('does not mutate its input', () => {
    const input = [item('a', 1, 'positive'), item('b', 9, 'negative')]
    sortByWeight(input)
    expect(input.map((c) => c.factor_key)).toEqual(['a', 'b'])
  })
})

describe('buildFactorList', () => {
  // Empty parcel → v2.1 fallback path in both builders (no score_breakdown).
  const parcel = {} as ScanResultItem

  it('merges potentie + risico cards into one list', () => {
    const list = buildFactorList(parcel, undefined)
    // v2.1 potentie fallback = 9 cards; risico fallback = 9 + 5 env = 14.
    expect(list.length).toBe(23)
  })

  it('tags every card with a potentie/risico tone', () => {
    const list = buildFactorList(parcel, undefined)
    expect(list.every((c) => c.tone === 'positive' || c.tone === 'negative')).toBe(true)
    expect(list.some((c) => c.tone === 'positive')).toBe(true)
    expect(list.some((c) => c.tone === 'negative')).toBe(true)
  })

  it('returns a globally weight-sorted list', () => {
    const list = buildFactorList(parcel, undefined)
    for (let i = 1; i < list.length; i++) {
      expect(Math.abs(list[i - 1]!.pts)).toBeGreaterThanOrEqual(Math.abs(list[i]!.pts))
    }
  })
})

describe('PLANNED_FACTORS', () => {
  it('lists only roadmap cascades not yet in the live registry', () => {
    const liveKeys = new Set([
      // potentie (built)
      'vrije_grond', 'optoppotentie', 'bestemming', 'leegstand', 'funda_frictie',
      'perceelgrootte', 'demografie', 'vergunning_succeskans', 'capaciteit',
      'woonvisie_match', 'beleidsalignement', 'grondwaarde_fit',
      // risico (built) + env + brk
      'funderingsrisico', 'asbest', 'bodemverontreiniging', 'monument',
      'bestemmingswijziging', 'constructieve_staat', 'juridisch_klimaat',
      'criminaliteit', 'max_hoogte_bereikt', 'splitsingsrisico', 'parkeerdruk',
      'natura2000', 'overstromingsrisico', 'geluid', 'luchtkwaliteit',
      'hypotheek_risico', 'eigendoms_complexiteit', 'koopwaarde_trend',
    ])
    for (const planned of PLANNED_FACTORS) {
      expect(liveKeys.has(planned.key), `${planned.key} is already live`).toBe(false)
    }
  })

  it('every planned factor has a label, tone, source and wave', () => {
    for (const p of PLANNED_FACTORS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.source.length).toBeGreaterThan(0)
      expect(['positive', 'negative']).toContain(p.tone)
      expect(['Wave 1', 'Wave 2', 'Wave 3']).toContain(p.wave)
    }
  })

  it('keys are unique', () => {
    const keys = PLANNED_FACTORS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
