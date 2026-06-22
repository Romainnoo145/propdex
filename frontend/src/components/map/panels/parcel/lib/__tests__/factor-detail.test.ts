import { describe, expect, it } from 'vitest'
import {
  parseFactors,
  formatFactorName,
  isWijkBreed,
  isCascadeFactor,
  CASCADE_FACTOR_KEYS,
  hasExplainContent,
  factorInBreakdown,
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
  it('is true for the four editorial cascade keys', () => {
    for (const key of ['woonvisie_match', 'beleidsalignement', 'splitsingsrisico', 'parkeerdruk']) {
      expect(isCascadeFactor(key)).toBe(true)
    }
  })
  it('is false for a plain computed factor', () => {
    expect(isCascadeFactor('vrije_grond')).toBe(false)
  })
  it('CASCADE_FACTOR_KEYS has exactly four members', () => {
    expect(CASCADE_FACTOR_KEYS.size).toBe(4)
  })
})

describe('factorInBreakdown', () => {
  const breakdown = {
    vrije_grond: { categorie: 'potentie', bijdrage: 8.5, gewicht: 10 },
    parkeerdruk: { categorie: 'risico', bijdrage: -2.8, gewicht: 4 },
  }

  it('returns true when key is present in potentie breakdown', () => {
    expect(factorInBreakdown(breakdown, 'vrije_grond')).toBe(true)
  })

  it('returns true when key is present in risico breakdown', () => {
    expect(factorInBreakdown(breakdown, 'parkeerdruk')).toBe(true)
  })

  it('returns false when key is absent from breakdown', () => {
    expect(factorInBreakdown(breakdown, 'natura2000')).toBe(false)
  })

  it('returns false when breakdown is null', () => {
    expect(factorInBreakdown(null, 'vrije_grond')).toBe(false)
  })
})

describe('hasExplainContent', () => {
  const factor = (over = {}) => ({
    categorie: 'potentie' as const,
    waarde: null,
    genormaliseerde_score: 70,
    gewicht: 10,
    bijdrage: 7,
    toelichting_kort: 'kort',
    toelichting_lang: null,
    missing: false,
    data_bronnen: null,
    succeskans_missing: null,
    succeskans_reason: null,
    dev_type_ruling_count: null,
    total_ruling_count: null,
    percentage_of_category: null,
    ...over,
  })

  it('is true when toelichting_lang is present', () => {
    expect(hasExplainContent(factor({ toelichting_lang: 'lange uitleg' }))).toBe(
      true,
    )
  })
  it('is true when data_bronnen is non-empty', () => {
    expect(hasExplainContent(factor({ data_bronnen: ['CBS StatLine'] }))).toBe(
      true,
    )
  })
  it('is false when only the short label exists', () => {
    expect(hasExplainContent(factor())).toBe(false)
  })
  it('is true when both ruling counts are present', () => {
    expect(hasExplainContent(factor({ dev_type_ruling_count: 3, total_ruling_count: 10 }))).toBe(true)
  })
})
