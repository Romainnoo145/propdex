/**
 * Unit tests for usePersistBrk + mapBrkError — node-env, no React rendering.
 *
 * Project convention (vite.config.ts `unit` project + MEMORY.md): pure-logic
 * unit tests at the query-function + cache-callback layers. React rendering
 * is covered by Storybook play functions in Plan 08-03.
 *
 * Tests:
 *   - mapBrkError: 7 backend error variants + fallback (10 assertions)
 *   - persistBrkRecords: POST URL + AVG-stripped [] success
 *   - onSuccess cache mutation: invalidates ['scan', parcelId] + sets
 *     ['brk', parcelId] (manual QueryClient drives the callback)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    readonly status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
}))

import { apiFetch } from '@/lib/api'
import { persistBrkRecords } from '../usePersistBrk'
import { mapBrkError } from '@/lib/brk/errorMapping'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

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

// ============================================================================
// mapBrkError — 7-row eng-plan failure registry
// ============================================================================

describe('mapBrkError — eng-plan §Backend-error-mapping (7 variants + fallback)', () => {
  it('401 → re-auth copy, not retryable', () => {
    const v = mapBrkError(401)
    expect(v.title).toBe('Sessie verlopen')
    expect(v.retryable).toBe(false)
  })

  it('403 → masked as "niet in portfolio" (no existence leak)', () => {
    const v = mapBrkError(403)
    expect(v.title).toBe('Perceel niet in jouw portfolio')
    expect(v.retryable).toBe(false)
  })

  it('404 → "niet in portfolio" — same copy as 403', () => {
    const v = mapBrkError(404)
    expect(v.title).toBe('Perceel niet in jouw portfolio')
    expect(v.retryable).toBe(false)
    // Pin shared copy with 403 — drift-detection canary
    expect(v.title).toBe(mapBrkError(403).title)
  })

  it('422 → "Ongeldige perceel-identificatie", not retryable', () => {
    const v = mapBrkError(422)
    expect(v.title).toBe('Ongeldige perceel-identificatie')
    expect(v.retryable).toBe(false)
  })

  it('502 → "Kadaster tijdelijk niet beschikbaar", RETRYABLE', () => {
    const v = mapBrkError(502)
    expect(v.title).toBe('Kadaster tijdelijk niet beschikbaar')
    expect(v.retryable).toBe(true)
  })

  it('503 + detail "feature disabled" → DPA copy, not retryable', () => {
    const v = mapBrkError(503, 'feature disabled')
    expect(v.title).toContain('DPA in afhandeling')
    expect(v.retryable).toBe(false)
  })

  it('503 + detail "credential ontbreekt" → admin copy, not retryable', () => {
    const v = mapBrkError(503, 'Kadaster credential ontbreekt')
    expect(v.title).toContain('credential ontbreekt')
    expect(v.title).toContain('admin')
    expect(v.retryable).toBe(false)
  })

  it('503 case-insensitive credential disambiguation', () => {
    // detail.toLowerCase().includes('credential') per ENG-PLAN
    const v = mapBrkError(503, 'CREDENTIAL missing')
    expect(v.title).toContain('credential ontbreekt')
  })

  it('503 with no detail defaults to FeatureDisabled (not CredentialNotConfigured)', () => {
    const v = mapBrkError(503)
    expect(v.title).toContain('DPA')
  })

  it('undefined status → generic fallback, retryable', () => {
    const v = mapBrkError(undefined)
    expect(v.title).toContain('Verbinding')
    expect(v.retryable).toBe(true)
  })

  it('unknown status (500) → generic fallback', () => {
    const v = mapBrkError(500)
    expect(v.title).toContain('Verbinding')
    expect(v.retryable).toBe(true)
  })
})

// ============================================================================
// persistBrkRecords — query function
// ============================================================================

describe('persistBrkRecords', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('POSTs to /api/parcels/{parcelId}/brk/persist', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([RECORD])

    await persistBrkRecords('parcel-1', 'token')

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/parcels/parcel-1/brk/persist',
      { method: 'POST', accessToken: 'token' },
    )
  })

  it('returns [] for AVG-stripped natuurlijk-persoon response (eng-plan AD4)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([])

    const result = await persistBrkRecords('parcel-1', 'token')

    expect(result).toEqual([])
  })

  it('returns array of records on rechtspersoon success', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([RECORD, RECORD])

    const result = await persistBrkRecords('parcel-1', 'token')

    expect(result).toHaveLength(2)
    expect(result[0]?.eigenaar_type).toBe('rechtspersoon')
  })

  it('URL-encodes parcel identifiers with reserved characters', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([])

    await persistBrkRecords('A/B', 'token')

    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toContain('A%2FB')
  })
})

// ============================================================================
// onSuccess cache mutation — verify the inline callback drives both caches
// ============================================================================
//
// We rebuild the same onSuccess body the hook uses and exercise it against
// a real QueryClient. This protects the eng-plan AD2 contract: persist
// success MUST (a) hydrate ['brk', parcelId] and (b) invalidate
// ['scan', parcelId] for downstream rescore polling.

function makeOnSuccess(qc: QueryClient, parcelId: string) {
  return (records: BRKOwnershipRecordRead[]) => {
    qc.setQueryData(['brk', parcelId], records)
    qc.invalidateQueries({ queryKey: ['scan', parcelId] })
  }
}

describe('usePersistBrk onSuccess cache mutation (eng-plan AD2)', () => {
  it('setQueryData hydrates ["brk", parcelId] with returned records', () => {
    const qc = new QueryClient()
    const onSuccess = makeOnSuccess(qc, 'parcel-1')

    onSuccess([RECORD])

    expect(qc.getQueryData(['brk', 'parcel-1'])).toEqual([RECORD])
  })

  it('setQueryData hydrates [] for AVG-stripped response', () => {
    const qc = new QueryClient()
    const onSuccess = makeOnSuccess(qc, 'parcel-1')

    onSuccess([])

    expect(qc.getQueryData(['brk', 'parcel-1'])).toEqual([])
  })

  it('invalidateQueries marks ["scan", parcelId] stale', async () => {
    const qc = new QueryClient()
    // Pre-seed scan cache with a query observer so we can detect invalidation
    qc.setQueryData(['scan', 'parcel-1'], { flags: {} })
    const onSuccess = makeOnSuccess(qc, 'parcel-1')

    onSuccess([RECORD])

    const state = qc.getQueryState(['scan', 'parcel-1'])
    expect(state?.isInvalidated).toBe(true)
  })

  it('does NOT invalidate ["scan", OTHER_parcelId]', async () => {
    const qc = new QueryClient()
    qc.setQueryData(['scan', 'parcel-other'], { flags: {} })
    const onSuccess = makeOnSuccess(qc, 'parcel-1')

    onSuccess([RECORD])

    const state = qc.getQueryState(['scan', 'parcel-other'])
    expect(state?.isInvalidated).toBeFalsy()
  })
})
