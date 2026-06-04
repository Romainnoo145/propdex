import { describe, expect, it } from 'vitest'
import { phaseLinkTarget } from '../phaseLinkTarget'

describe('phaseLinkTarget', () => {
  it('fase-1 (onderzoek) → base perceel-route zonder phase-param', () => {
    expect(phaseLinkTarget('1-onderzoek', 'X')).toEqual({
      to: '/opgeslagen/perceel/$parcelId',
      params: { parcelId: 'X' },
    })
  })
  it('fase-2 (contact) → $phase-route met phase-param', () => {
    expect(phaseLinkTarget('2-contact', 'X')).toEqual({
      to: '/opgeslagen/perceel/$parcelId/$phase',
      params: { parcelId: 'X', phase: '2-contact' },
    })
  })
})
