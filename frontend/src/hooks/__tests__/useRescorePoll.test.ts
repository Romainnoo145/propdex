/**
 * Unit tests for useRescorePoll — node-env.
 *
 * Tests the pure predicate (shouldStopOnSuccess) + the fetch function +
 * the polling state-machine semantics. React rendering of the hook is
 * out of scope per project convention (node env, no jsdom — see
 * vite.config.ts `unit` project comment).
 *
 * For state-machine coverage we exercise a faithful in-test reimplementation
 * of the interval callback against vi.useFakeTimers. This guards the AD3
 * contract (2s × 30, success-stop, timeout, cleanup) without requiring
 * @testing-library/react.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '@/lib/api'
import {
  shouldStopOnSuccess,
  fetchScanFlags,
  POLL_INTERVAL_MS,
  MAX_TICKS,
  type ScanFlagsResponse,
} from '../useRescorePoll'

// ============================================================================
// Cadence constants — pin the eng-plan AD3 values
// ============================================================================

describe('useRescorePoll cadence constants (eng-plan AD3)', () => {
  it('POLL_INTERVAL_MS is 2000', () => {
    expect(POLL_INTERVAL_MS).toBe(2000)
  })
  it('MAX_TICKS is 30 (60s window at 2s interval)', () => {
    expect(MAX_TICKS).toBe(30)
    expect(MAX_TICKS * POLL_INTERVAL_MS).toBe(60_000)
  })
})

// ============================================================================
// shouldStopOnSuccess — pure predicate
// ============================================================================

describe('shouldStopOnSuccess', () => {
  const PERSIST_AT = Date.parse('2026-05-19T10:00:00Z')

  it('false when response is null/undefined', () => {
    expect(shouldStopOnSuccess(null, PERSIST_AT)).toBe(false)
    expect(shouldStopOnSuccess(undefined, PERSIST_AT)).toBe(false)
  })

  it('false when flags is null/missing', () => {
    expect(shouldStopOnSuccess({}, PERSIST_AT)).toBe(false)
    expect(shouldStopOnSuccess({ flags: null }, PERSIST_AT)).toBe(false)
  })

  it('false when cascade_rescored_at is null/undefined/empty', () => {
    expect(shouldStopOnSuccess({ flags: {} }, PERSIST_AT)).toBe(false)
    expect(shouldStopOnSuccess({ flags: { cascade_rescored_at: null } }, PERSIST_AT)).toBe(false)
    expect(shouldStopOnSuccess({ flags: { cascade_rescored_at: '' } }, PERSIST_AT)).toBe(false)
  })

  it('false when cascade_rescored_at <= pollStartAt (stale rescore)', () => {
    const before: ScanFlagsResponse = {
      flags: { cascade_rescored_at: '2026-05-19T09:00:00Z' },
    }
    expect(shouldStopOnSuccess(before, PERSIST_AT)).toBe(false)

    const equal: ScanFlagsResponse = {
      flags: { cascade_rescored_at: '2026-05-19T10:00:00Z' },
    }
    expect(shouldStopOnSuccess(equal, PERSIST_AT)).toBe(false)
  })

  it('true when cascade_rescored_at > pollStartAt', () => {
    const fresh: ScanFlagsResponse = {
      flags: { cascade_rescored_at: '2026-05-19T10:00:05Z' },
    }
    expect(shouldStopOnSuccess(fresh, PERSIST_AT)).toBe(true)
  })

  it('false when cascade_rescored_at is unparseable', () => {
    const bogus: ScanFlagsResponse = {
      flags: { cascade_rescored_at: 'not-a-date' },
    }
    expect(shouldStopOnSuccess(bogus, PERSIST_AT)).toBe(false)
  })
})

// ============================================================================
// fetchScanFlags — verify endpoint URL contract
// ============================================================================

describe('fetchScanFlags', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('GETs /api/parcels/{parcelId}/scan', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ flags: { cascade_rescored_at: null } })

    await fetchScanFlags('parcel-1', 'token')

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/parcels/parcel-1/scan',
      { method: 'GET', accessToken: 'token' },
    )
  })

  it('URL-encodes parcel identifiers', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ flags: null })

    await fetchScanFlags('A/B', 'token')

    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toContain('A%2FB')
  })
})

// ============================================================================
// Polling state-machine semantics
//
// We mirror the hook's interval body in test to verify cadence + cleanup
// without renderHook (not available in this node-env unit project).
// ============================================================================

interface PollMachine {
  phase: 'idle' | 'polling' | 'success' | 'timeout'
  tickCount: number
  fetchCount: number
  intervalId: ReturnType<typeof setInterval> | null
}

function createPollMachine(opts: {
  enabled: boolean
  pollStartAt: number
  fetcher: () => Promise<ScanFlagsResponse>
}): PollMachine {
  const m: PollMachine = { phase: 'idle', tickCount: 0, fetchCount: 0, intervalId: null }
  if (!opts.enabled) return m
  m.phase = 'polling'
  m.intervalId = setInterval(async () => {
    m.tickCount += 1
    if (m.tickCount >= MAX_TICKS) {
      if (m.intervalId) clearInterval(m.intervalId)
      m.phase = 'timeout'
      return
    }
    try {
      m.fetchCount += 1
      const response = await opts.fetcher()
      if (shouldStopOnSuccess(response, opts.pollStartAt)) {
        if (m.intervalId) clearInterval(m.intervalId)
        m.phase = 'success'
      }
    } catch {
      // silent
    }
  }, POLL_INTERVAL_MS)
  return m
}

function stopMachine(m: PollMachine) {
  if (m.intervalId) clearInterval(m.intervalId)
}

describe('useRescorePoll state-machine semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('test_no_poll_when_enabled_false: returns idle, no setInterval scheduled', () => {
    const fetcher = vi.fn().mockResolvedValue({ flags: null })
    const m = createPollMachine({ enabled: false, pollStartAt: 0, fetcher })

    expect(m.phase).toBe('idle')
    expect(m.intervalId).toBeNull()
    // Advancing time should not trigger fetches
    vi.advanceTimersByTime(60_000)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('test_starts_polling_when_enabled: phase=polling after activation', () => {
    const fetcher = vi.fn().mockResolvedValue({ flags: null })
    const m = createPollMachine({ enabled: true, pollStartAt: 0, fetcher })

    expect(m.phase).toBe('polling')
    expect(m.intervalId).not.toBeNull()
    stopMachine(m)
  })

  it('test_returns_phase_polling_while_active: 3 ticks without success → still polling', async () => {
    const fetcher = vi.fn().mockResolvedValue({ flags: { cascade_rescored_at: null } })
    const m = createPollMachine({ enabled: true, pollStartAt: 1000, fetcher })

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    }

    expect(m.tickCount).toBe(3)
    expect(m.phase).toBe('polling')
    stopMachine(m)
  })

  it('test_detects_success_when_cascade_rescored_at_exceeds_pollStartAt', async () => {
    const PERSIST_AT = 1000
    const fetcher = vi.fn().mockResolvedValue({
      flags: { cascade_rescored_at: new Date(PERSIST_AT + 5000).toISOString() },
    })
    const m = createPollMachine({ enabled: true, pollStartAt: PERSIST_AT, fetcher })

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)

    expect(m.phase).toBe('success')
    expect(m.tickCount).toBe(1)
    stopMachine(m)
  })

  it('test_returns_timeout_after_30_ticks (60s)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ flags: { cascade_rescored_at: null } })
    const m = createPollMachine({ enabled: true, pollStartAt: 0, fetcher })

    // Advance 30 ticks worth of time
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * MAX_TICKS)

    expect(m.tickCount).toBe(MAX_TICKS)
    expect(m.phase).toBe('timeout')
    // Verify no further fetches after timeout
    const fetchCountAtTimeout = m.fetchCount
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5)
    expect(m.fetchCount).toBe(fetchCountAtTimeout)
  })

  it('test_cleanup_clears_interval_on_unmount: clearInterval called, no further ticks', async () => {
    const fetcher = vi.fn().mockResolvedValue({ flags: null })
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')

    const m = createPollMachine({ enabled: true, pollStartAt: 0, fetcher })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    const ticksAtUnmount = m.tickCount

    stopMachine(m)

    expect(clearSpy).toHaveBeenCalledWith(m.intervalId)

    // After clearInterval, advancing time should not produce more ticks
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)
    expect(m.tickCount).toBe(ticksAtUnmount)

    clearSpy.mockRestore()
  })

  it('test_silent_on_transient_fetch_error: keeps polling, does not crash', async () => {
    let calls = 0
    const fetcher = vi.fn().mockImplementation(() => {
      calls += 1
      if (calls === 1) return Promise.reject(new Error('network blip'))
      return Promise.resolve({ flags: { cascade_rescored_at: null } })
    })

    const m = createPollMachine({ enabled: true, pollStartAt: 0, fetcher })

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)

    expect(m.phase).toBe('polling')
    expect(calls).toBe(2)
    stopMachine(m)
  })
})
