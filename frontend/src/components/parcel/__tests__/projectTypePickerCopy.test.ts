/**
 * Copy-assertion test for ProjectTypePickerModal (vitest, pure-logic).
 *
 * Project convention: copy/source-text assertions via fs.readFileSync (not render).
 * Render tests live in Storybook. Precedent: RisicoLayer.factor-coverage.test.tsx,
 * OnderzoekPhaseView.parity.test.tsx.
 *
 * Two test groups:
 * 1. Intention copy present + scoring copy absent (pins the copy edit).
 * 2. Single-source guard: copy lives ONLY in ProjectTypePickerModal, not duplicated
 *    into HeartButton.tsx or ParcelDetailModal.tsx invocation sites.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'

const MODAL_PATH = path.resolve(__dirname, '../ProjectTypePickerModal.tsx')
const HEART_BUTTON_PATH = path.resolve(
  __dirname,
  '../../map/panels/parcel/HeartButton.tsx',
)
const PARCEL_DETAIL_MODAL_PATH = path.resolve(
  __dirname,
  '../../results/ParcelDetailModal.tsx',
)

describe('ProjectTypePickerModal — intention copy (M052/S01)', () => {
  const source = fs.readFileSync(MODAL_PATH, 'utf-8')

  it('contains the intention title "Wat ga je hier ontwikkelen"', () => {
    expect(source).toContain('Wat ga je hier ontwikkelen')
  })

  it('does NOT contain the old scoring subtitle "scoring beter past"', () => {
    expect(source).not.toContain('scoring beter past')
  })

  it('does NOT contain the old title "Wat wil je hier bouwen"', () => {
    expect(source).not.toContain('Wat wil je hier bouwen')
  })

  it('does NOT contain "Kies het projecttype" (scoring-claim sentence)', () => {
    expect(source).not.toContain('Kies het projecttype')
  })
})

describe('ProjectTypePickerModal — single-source copy guard (M052/S01)', () => {
  it('HeartButton does NOT duplicate the intention copy (copy lives only in modal)', () => {
    const heartButtonSource = fs.readFileSync(HEART_BUTTON_PATH, 'utf-8')
    expect(heartButtonSource).not.toContain('Wat ga je hier ontwikkelen')
  })

  it('ParcelDetailModal does NOT duplicate the intention copy (copy lives only in modal)', () => {
    const parcelDetailSource = fs.readFileSync(PARCEL_DETAIL_MODAL_PATH, 'utf-8')
    expect(parcelDetailSource).not.toContain('Wat ga je hier ontwikkelen')
  })
})
