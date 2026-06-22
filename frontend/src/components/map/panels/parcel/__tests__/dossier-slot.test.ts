import { describe, expect, it } from 'vitest'
import { dossierSlotState } from '../DossierSlotCard'

const card = (over = {}) => ({ key: 'woz', label: 'WOZ', Icon: (() => null) as never, value: 'LEEG', sub: '', filled: false, documents: [], ...over })

describe('dossierSlotState', () => {
  it('docs when user documents present', () => {
    expect(dossierSlotState(card({ documents: [{ id: '1' }] as never, filled: true }))).toBe('docs')
  })
  it('data when filled by API value (no user docs)', () => {
    expect(dossierSlotState(card({ filled: true, value: '€420K' }))).toBe('data')
  })
  it('empty otherwise', () => {
    expect(dossierSlotState(card())).toBe('empty')
  })
})
