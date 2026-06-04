import { describe, expect, it } from 'vitest'
import { deriveBriefMode } from '../deriveBriefMode'

describe('deriveBriefMode', () => {
  it('auto wanneer rechtspersoon/overheid-record bestaat', () => {
    expect(deriveBriefMode({ hasBrkRecord: true })).toBe('auto')
  })
  it('manual wanneer geen record', () => {
    expect(deriveBriefMode({ hasBrkRecord: false })).toBe('manual')
  })
})
