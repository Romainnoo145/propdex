/**
 * Pure-logic tests for projectTypeChip helpers (vitest, node env).
 *
 * Project convention: chip-show logic tested as pure helper, not via React render.
 * Precedent: RisicoLayer.factor-coverage.test.tsx, OnderzoekPhaseView.parity.test.tsx.
 */
import { describe, expect, it } from 'vitest'
import {
  projectTypeChipLabel,
  projectTypeToUseCase,
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

  it('returns "Nieuwbouw" for "nieuwbouw_wonen"', () => {
    expect(projectTypeChipLabel('nieuwbouw_wonen')).toBe('Nieuwbouw')
  })

  it('falls back to raw string for unknown type (defensive)', () => {
    expect(projectTypeChipLabel('unknown_future_type')).toBe('unknown_future_type')
  })
})

describe('projectTypeToUseCase (M052/S02 — projecttype → checklist use_case)', () => {
  it('maps optoppen → optoppen', () => {
    expect(projectTypeToUseCase('optoppen')).toBe('optoppen')
  })

  it('maps splitsen → splitsen', () => {
    expect(projectTypeToUseCase('splitsen')).toBe('splitsen')
  })

  it('maps transformatie_wonen → transformatie', () => {
    expect(projectTypeToUseCase('transformatie_wonen')).toBe('transformatie')
  })

  it('maps commercieel_naar_wonen → transformatie (UAT-confirmed)', () => {
    expect(projectTypeToUseCase('commercieel_naar_wonen')).toBe('transformatie')
  })

  it('maps nieuwbouw_wonen → nieuwbouw', () => {
    expect(projectTypeToUseCase('nieuwbouw_wonen')).toBe('nieuwbouw')
  })

  it('returns null for onbepaald (empty state → prompt picker)', () => {
    expect(projectTypeToUseCase('onbepaald')).toBeNull()
  })

  it('returns null for null', () => {
    expect(projectTypeToUseCase(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(projectTypeToUseCase(undefined)).toBeNull()
  })

  it('returns null for unknown future type (defensive)', () => {
    expect(projectTypeToUseCase('unknown_future_type')).toBeNull()
  })
})
