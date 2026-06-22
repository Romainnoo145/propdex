import { describe, expect, it } from 'vitest'
import {
  parseFactors,
  formatFactorName,
  isWijkBreed,
  isCascadeFactor,
  CASCADE_FACTOR_KEYS,
} from '../factor-detail'

describe('parseFactors', () => {
  it('splits factors by categorie and sorts each by descending bijdrage', () => {
    const breakdown = {
      vrije_grond: { categorie: 'potentie', bijdrage: 8.5, gewicht: 10 },
      bestemming: { categorie: 'potentie', bijdrage: 5.0, gewicht: 6 },
      parkeerdruk: { categorie: 'risico', bijdrage: -2.8, gewicht: 4 },
    }
    const { potentie, risico } = parseFactors(breakdown)
    expect(potentie.map((f) => f.name)).toEqual(['vrije_grond', 'bestemming'])
    expect(risico.map((f) => f.name)).toEqual(['parkeerdruk'])
  })

  it('returns empty lists for null breakdown', () => {
    expect(parseFactors(null)).toEqual({ potentie: [], risico: [] })
  })

  it('skips entries without a categorie field', () => {
    const { potentie, risico } = parseFactors({ junk: { foo: 1 } })
    expect(potentie).toEqual([])
    expect(risico).toEqual([])
  })
})

describe('formatFactorName', () => {
  it('humanises a snake_case factor key', () => {
    expect(formatFactorName('woonvisie_match')).toMatch(/woonvisie/i)
  })
})

describe('isWijkBreed', () => {
  it('is true when a CBS source is present', () => {
    expect(isWijkBreed(['CBS StatLine'])).toBe(true)
  })
  it('is false for parcel-level sources', () => {
    expect(isWijkBreed(['Kadaster', 'BAG'])).toBe(false)
  })
  it('is false for null', () => {
    expect(isWijkBreed(null)).toBe(false)
  })
})

describe('isCascadeFactor', () => {
  it('is true for the five editorial cascade keys', () => {
    for (const key of ['woonvisie_match', 'beleidsalignement', 'grondwaarde_fit', 'splitsingsrisico', 'parkeerdruk']) {
      expect(isCascadeFactor(key)).toBe(true)
    }
  })
  it('is false for a plain computed factor', () => {
    expect(isCascadeFactor('vrije_grond')).toBe(false)
  })
  it('CASCADE_FACTOR_KEYS has exactly five members', () => {
    expect(CASCADE_FACTOR_KEYS.size).toBe(5)
  })
})
