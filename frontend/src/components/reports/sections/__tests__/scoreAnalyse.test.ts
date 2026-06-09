import { describe, it, expect } from 'vitest'
import { analyseFromScanItem } from '../scoreAnalyse'
import type { ScanResultItem } from '@/lib/types/scan'

const item = {
  score: 71,
  potentie_score: 80,
  risico_score: 22,
  score_breakdown: {
    woonvisie_match: { genormaliseerde_score: 90, gewicht: 12, bijdrage: 8, categorie: 'potentie' },
    capaciteit: { genormaliseerde_score: 50, gewicht: 10, bijdrage: 12, categorie: 'potentie' },
    overstroming: { genormaliseerde_score: 30, gewicht: 5, bijdrage: 4, categorie: 'risico' },
  },
} as unknown as ScanResultItem

describe('analyseFromScanItem', () => {
  it('maps the three subscores from the scan item', () => {
    const r = analyseFromScanItem(item)
    expect(r.scores).toEqual({ overall: 71, potentie: 80, risico: 22 })
  })

  it('splits factors by categorie, sorted by bijdrage desc', () => {
    const r = analyseFromScanItem(item)
    expect(r.potentieFactors.map((f) => f.naam)).toEqual(['capaciteit', 'woonvisie_match']) // 12 > 8
    expect(r.risicoFactors.map((f) => f.naam)).toEqual(['overstroming'])
  })

  it('returns null scores + empty factor lists for an absent item', () => {
    const r = analyseFromScanItem(undefined)
    expect(r.scores).toBeNull()
    expect(r.potentieFactors).toEqual([])
    expect(r.risicoFactors).toEqual([])
  })
})
