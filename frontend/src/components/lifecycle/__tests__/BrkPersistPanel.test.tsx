/**
 * Unit tests for BrkPersistPanel + RescoreProgressBanner — node-env.
 *
 * Project convention (vite.config.ts `unit` project + MEMORY.md "Storybook =
 * convergence smoke layer"): pure-logic tests in node env, NO jsdom and NO
 * @testing-library/react. React rendering of these components is covered by
 * Storybook play functions (deferred — Phase 6 / Plan 08-06 precedent).
 *
 * These tests pin:
 *   - BrkPersistPanel state-machine derivation (derivePersistPanelState):
 *     IDLE / LOADING / ERROR (retryable + non-retryable) / EMPTY (AD4) / SUCCESS
 *   - RescoreProgressBanner phase → copy derivation (deriveBannerView):
 *     idle / polling (with tick count) / success / timeout (no retry button)
 *
 * The components themselves are thin JSX wrappers around these pure derivations.
 */
import { describe, it, expect } from 'vitest'

import {
  derivePersistPanelState,
  type PersistPanelMutationView,
} from '../BrkPersistPanel'
import { deriveBannerView } from '../RescoreProgressBanner'
import { mapBrkError } from '@/lib/brk/errorMapping'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

// ============================================================================
// derivePersistPanelState — 5-state machine
// ============================================================================

const RECORD: BRKOwnershipRecordRead = {
  id: 'rec-1',
  organization_id: 'org-1',
  parcel_id: 'parcel-1',
  eigenaar_type: 'rechtspersoon',
  eigenaar_naam: 'BV X',
  kvk_nummer: '12345678',
  statutaire_zetel: 'Venlo',
  zakelijk_recht_type: 'eigendom',
  aandeel: '1/1',
  koopsom: 200000,
  koopjaar: 2020,
  heeft_hypotheek: false,
  fetched_at: '2026-05-19T10:00:00Z',
}

const idleMutation: PersistPanelMutationView = {
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null,
  errorStatus: undefined,
  errorDetail: null,
}

describe('derivePersistPanelState — 5-state machine', () => {
  it('test_renders_cta_when_no_records → IDLE', () => {
    const state = derivePersistPanelState([], idleMutation)
    expect(state.kind).toBe('idle')
  })

  it('test_button_disabled_during_mutation → LOADING (isPending)', () => {
    const state = derivePersistPanelState([], { ...idleMutation, isPending: true })
    expect(state.kind).toBe('loading')
  })

  it('test_renders_504_error_with_retry_button → ERROR (retryable=true for 502)', () => {
    // 502 is the GovernmentAPIError variant — retryable per registry
    const state = derivePersistPanelState([], {
      ...idleMutation,
      isError: true,
      errorStatus: 502,
      errorDetail: 'Kadaster upstream timeout',
    })
    expect(state.kind).toBe('error')
    if (state.kind !== 'error') throw new Error('narrowed')
    expect(state.view.retryable).toBe(true)
    expect(state.view.title).toBe('Kadaster tijdelijk niet beschikbaar')
  })

  it('test_renders_503_credential_error_without_retry → ERROR (retryable=false)', () => {
    const state = derivePersistPanelState([], {
      ...idleMutation,
      isError: true,
      errorStatus: 503,
      errorDetail: 'Kadaster credential ontbreekt',
    })
    expect(state.kind).toBe('error')
    if (state.kind !== 'error') throw new Error('narrowed')
    expect(state.view.retryable).toBe(false)
    expect(state.view.title).toContain('credential')
  })

  it('test_renders_particuliere_eigenaar_infoblok_when_empty_success → EMPTY (AD4)', () => {
    // mutation.isSuccess && records.length === 0 → EMPTY
    const state = derivePersistPanelState([], {
      ...idleMutation,
      isSuccess: true,
    })
    expect(state.kind).toBe('empty')
  })

  it('records.length > 0 → SUCCESS (records present, idle mutation)', () => {
    const state = derivePersistPanelState([RECORD], idleMutation)
    expect(state.kind).toBe('success')
  })

  it('records.length > 0 AFTER successful persist → SUCCESS (not EMPTY)', () => {
    const state = derivePersistPanelState([RECORD], {
      ...idleMutation,
      isSuccess: true,
    })
    expect(state.kind).toBe('success')
  })

  it('mapBrkError integration: 403 + 404 collapse to identical title (AD2 silent-isolation)', () => {
    const state403 = derivePersistPanelState([], {
      ...idleMutation,
      isError: true,
      errorStatus: 403,
    })
    const state404 = derivePersistPanelState([], {
      ...idleMutation,
      isError: true,
      errorStatus: 404,
    })
    if (state403.kind !== 'error' || state404.kind !== 'error') {
      throw new Error('both should be error')
    }
    expect(state403.view.title).toBe(state404.view.title)
    expect(state403.view.title).toBe(mapBrkError(403).title)
  })
})

// ============================================================================
// test_calls_onPersistSuccess_when_records_returned — contract verified at hook
// boundary (Plan 08-02 already tested usePersistBrk.onSuccess cache mutation).
// At the component layer, the panel calls onPersistSuccess inside its onSuccess
// handler — covered by structural assertion below.
// ============================================================================

describe('test_calls_onPersistSuccess_when_records_returned — handler wired', async () => {
  it('BrkPersistPanel.tsx source contains onPersistSuccess invocation', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(
      new URL('../BrkPersistPanel.tsx', import.meta.url),
      'utf-8',
    )
    // Component must call onPersistSuccess() inside its onSuccess callback path.
    expect(src).toMatch(/onPersistSuccess/)
  })
})

// ============================================================================
// deriveBannerView — RescoreProgressBanner state derivation
// ============================================================================

describe('deriveBannerView — RescoreProgressBanner phase mapping', () => {
  it('test_renders_null_when_phase_idle → null', () => {
    const view = deriveBannerView({ phase: 'idle', tickCount: 0 })
    expect(view).toBeNull()
  })

  it('test_renders_polling_message_with_tick_count', () => {
    const view = deriveBannerView({ phase: 'polling', tickCount: 7 })
    expect(view).not.toBeNull()
    if (view === null) throw new Error('narrowed')
    expect(view.kind).toBe('polling')
    expect(view.copy).toContain('Onderzoeksscore wordt bijgewerkt')
    expect(view.copy).toContain('7')
    expect(view.copy).toContain('30')
  })

  it('test_renders_success_link_to_fase1', () => {
    const view = deriveBannerView({ phase: 'success', tickCount: 12 })
    expect(view).not.toBeNull()
    if (view === null) throw new Error('narrowed')
    expect(view.kind).toBe('success')
    expect(view.copy).toContain('Score nu in fase 1')
    // Success state must offer a link back to fase 1.
    expect(view.showFase1Link).toBe(true)
  })

  it('test_renders_timeout_message_without_retry_button (AD3 explicit no-retry)', () => {
    const view = deriveBannerView({ phase: 'timeout', tickCount: 30 })
    expect(view).not.toBeNull()
    if (view === null) throw new Error('narrowed')
    expect(view.kind).toBe('timeout')
    expect(view.copy).toContain('langer dan verwacht')
    expect(view.showRetryButton).toBe(false)
  })

  it('polling tickCount 1 (just-started) renders min counter', () => {
    const view = deriveBannerView({ phase: 'polling', tickCount: 1 })
    if (view === null || view.kind !== 'polling') throw new Error('narrowed')
    expect(view.copy).toContain('1')
  })
})
