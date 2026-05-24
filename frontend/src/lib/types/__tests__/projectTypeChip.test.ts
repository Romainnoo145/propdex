/**
 * Pure-logic tests for projectTypeChip helpers (vitest, node env).
 *
 * Project convention: chip-show logic tested as pure helper, not via React render.
 * Precedent: RisicoLayer.factor-coverage.test.tsx, OnderzoekPhaseView.parity.test.tsx.
 */
import { describe, expect, it } from 'vitest'
import {
  projectTypeChipLabel,
  shouldShowProjectTypeChip,
} from '../projectTypeChip'

describe('shouldShowProjectTypeChip', () => {
  it('returns false for null', () => {
    expect(shouldShowProjectTypeChip(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(shouldShowProjectTypeChip(undefined)).toBe(false)
  })

  it('returns false for "onbepaald"', () => {
    expect(shouldShowProjectTypeChip('onbepaald')).toBe(false)
  })

  it('returns true for "nieuwbouw_wonen"', () => {
    expect(shouldShowProjectTypeChip('nieuwbouw_wonen')).toBe(true)
  })

  it('returns true for "transformatie_wonen"', () => {
    expect(shouldShowProjectTypeChip('transformatie_wonen')).toBe(true)
  })

  it('returns true for "optoppen"', () => {
    expect(shouldShowProjectTypeChip('optoppen')).toBe(true)
  })

  it('returns true for "splitsen"', () => {
    expect(shouldShowProjectTypeChip('splitsen')).toBe(true)
  })

  it('returns true for "commercieel_naar_wonen"', () => {
    expect(shouldShowProjectTypeChip('commercieel_naar_wonen')).toBe(true)
  })
})

describe('projectTypeChipLabel', () => {
  it('returns "Commercieel → wonen" for "commercieel_naar_wonen"', () => {
    expect(projectTypeChipLabel('commercieel_naar_wonen')).toBe('Commercieel → wonen')
  })

  it('returns "Nieuwbouw wonen" for "nieuwbouw_wonen"', () => {
    expect(projectTypeChipLabel('nieuwbouw_wonen')).toBe('Nieuwbouw wonen')
  })

  it('falls back to raw string for unknown type (defensive)', () => {
    expect(projectTypeChipLabel('unknown_future_type')).toBe('unknown_future_type')
  })
})
