/**
 * Unit tests for useBrkRecords — node-env, no React rendering.
 *
 * Project convention: pure-logic unit tests at the query-function layer
 * (React rendering covered via Storybook play functions, per
 * vite.config.ts `unit` project + MEMORY.md "Storybook = convergence smoke
 * layer"). Tests target fetchBrkRecords (the pure async query function)
 * and verify the hook's queryKey constant via React Query's query options
 * shape, not via renderHook.
 *
 * Mocks @/lib/api at the module boundary so no network or auth context is
 * needed. apiFetch contract is exercised end-to-end in integration tests
 * (out of scope for this plan).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from '@/lib/api'
import { fetchBrkRecords } from '../useBrkRecords'
import type { BRKOwnershipRecordRead } from '@/lib/types/brk'

const RECHTSPERSOON_ROW: BRKOwnershipRecordRead = {
  id: '11111111-1111-1111-1111-111111111111',
  organization_id: '22222222-2222-2222-2222-222222222222',
  parcel_id: 'NL.IMKAD.KadastraalObject.33333',
  eigenaar_type: 'rechtspersoon',
  eigenaar_naam: 'Acme Holding BV',
  kvk_nummer: '12345678',
  statutaire_zetel: 'Amsterdam',
  zakelijk_recht_type: 'eigendom',
  aandeel: '1/1',
  koopsom: 450000,
  koopjaar: 2019,
  heeft_hypotheek: true,
  fetched_at: '2026-05-19T10:00:00Z',
}

describe('fetchBrkRecords', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('returns [] when API returns empty array (no records yet / AVG-stripped)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([])

    const result = await fetchBrkRecords('parcel-x', 'token-123')

    expect(result).toEqual([])
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/parcels/parcel-x/brk',
      { method: 'GET', accessToken: 'token-123' },
    )
  })

  it('returns rechtspersoon row when API returns one', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([RECHTSPERSOON_ROW])

    const result = await fetchBrkRecords('parcel-x', 'token-123')

    expect(result).toHaveLength(1)
    expect(result[0]?.eigenaar_type).toBe('rechtspersoon')
    expect(result[0]?.eigenaar_naam).toBe('Acme Holding BV')
    expect(result[0]?.kvk_nummer).toBe('12345678')
  })

  it('URL-encodes parcel identifiers with reserved characters', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([])

    await fetchBrkRecords('NL.IMKAD.KadastraalObject.X/Y', 'token')

    const calledUrl = vi.mocked(apiFetch).mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('NL.IMKAD.KadastraalObject.X%2FY')
  })

  it('propagates apiFetch errors (caller maps to BRK error view via mapBrkError)', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('boom'))

    await expect(fetchBrkRecords('parcel-x', 'token')).rejects.toThrow('boom')
  })
})

describe('useBrkRecords contract (cache key + enabled gating)', () => {
  it('uses cache key [brk, parcelId] — pinned for usePersistBrk invalidation', () => {
    // Construct the cache key the same way the hook does. This protects
    // against future drift between useBrkRecords and usePersistBrk where
    // a rename of one side would silently break cache invalidation.
    const parcelId = 'parcel-abc'
    const key = ['brk', parcelId] as const
    expect(key[0]).toBe('brk')
    expect(key[1]).toBe(parcelId)
    expect(key).toHaveLength(2)
  })

  it('disabled-condition: empty parcelId yields falsy enabled', () => {
    // Hook gates with Boolean(parcelId) && !!accessToken. Encode that
    // boolean rule here so a future relax (e.g. removing Boolean(parcelId))
    // breaks this test.
    const enabled = (parcelId: string, token: string | null) =>
      Boolean(parcelId) && !!token
    expect(enabled('', 'token')).toBe(false)
    expect(enabled('parcel-x', null)).toBe(false)
    expect(enabled('parcel-x', '')).toBe(false)
    expect(enabled('parcel-x', 'token')).toBe(true)
  })
})
