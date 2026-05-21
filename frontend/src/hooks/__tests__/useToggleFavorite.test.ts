/**
 * Unit tests for shouldShowProjectTypePicker — node-env, no rendering.
 *
 * FUND-01: HeartButton save success → picker shown → PUT project-type called.
 * NOT shown on un-favorite (delete path).
 *
 * Implementer: Plan 01-03 must export `shouldShowProjectTypePicker` from
 * '@/components/map/panels/parcel/HeartButton'.
 *
 * RED today: HeartButton does not export this helper yet.
 * Import fails with a resolve/missing-export error — the Nyquist signal
 * that Plan 01-03 must ship the helper.
 *
 * Pattern: pure-helper node-env unit test per project convention (see
 * useBrkRecords.test.ts, vitest.config `unit` project in vite.config.ts).
 * No jsdom, no @testing-library/react.
 */
import { describe, it, expect } from 'vitest'

// Plan 01-03 must export this helper from HeartButton.
// Contract: returns true ONLY when the toggle was a NEW favorite —
//   !isFavorited && data != null
// Returns false on un-favorite (data === null) and false when already favorited.
import { shouldShowProjectTypePicker } from '@/components/map/panels/parcel/HeartButton'

describe('shouldShowProjectTypePicker', () => {
  it('returns true when a new favorite was saved (isFavorited=false, data present)', () => {
    // Happy path: user just added a new favorite.
    expect(shouldShowProjectTypePicker(false, { parcel_id: 'x' })).toBe(true)
  })

  it('returns false when the toggle was a delete (data is null)', () => {
    // Delete path: API returns null after un-favoriting.
    expect(shouldShowProjectTypePicker(false, null)).toBe(false)
  })

  it('returns false when parcel was already favorited (un-favorite path, isFavorited=true, data present)', () => {
    // isFavorited=true means the button was in "favorited" state before the click,
    // so this was an un-favorite action.
    expect(shouldShowProjectTypePicker(true, { parcel_id: 'x' })).toBe(false)
  })

  it('returns false when isFavorited=true and data is null', () => {
    // Un-favorite + delete path: both conditions say no picker.
    expect(shouldShowProjectTypePicker(true, null)).toBe(false)
  })
})
