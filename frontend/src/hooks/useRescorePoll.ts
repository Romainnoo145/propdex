/**
 * useRescorePoll — eng-plan AD3: interval 2000ms, max 30 ticks (60s window),
 * stop when flags.cascade_rescored_at > pollStartAt, clearInterval cleanup,
 * no retry-loop on timeout. Pure shouldStopOnSuccess predicate exported for
 * tests + endpoint-shape decoupling.
 */
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export const POLL_INTERVAL_MS = 2000
export const MAX_TICKS = 30
export type RescorePollPhase = 'idle' | 'polling' | 'success' | 'timeout'
export interface RescorePollResult { phase: RescorePollPhase; tickCount: number }

/**
 * Response shape from GET /api/scans/parcels/{parcelId}/scan-data (ScanResultItem).
 *
 * Backend exposes `cascade_rescored_at` at the top level (DEF-01 fix, Phase 8
 * wire-up). The legacy `{ flags: { cascade_rescored_at } }` shape is retained as
 * an optional fallback so future endpoint evolution stays drop-in.
 */
export interface ScanFlagsResponse {
  cascade_rescored_at?: string | null
  flags?: { cascade_rescored_at?: string | null } | null
}

/** Pure predicate — true iff cascade rescore completed AFTER persist. */
export function shouldStopOnSuccess(
  response: ScanFlagsResponse | null | undefined,
  pollStartAt: number,
): boolean {
  const ts = response?.cascade_rescored_at ?? response?.flags?.cascade_rescored_at
  if (!ts) return false
  const parsed = Date.parse(ts)
  if (Number.isNaN(parsed)) return false
  return parsed > pollStartAt
}

export async function fetchScanFlags(
  parcelId: string, accessToken: string | null,
): Promise<ScanFlagsResponse> {
  // DEF-01 fix (Phase 8 wire-up): /api/parcels/{id}/scan does not exist.
  // Real endpoint is /api/scans/parcels/{id}/scan-data → ScanResultItem with
  // top-level cascade_rescored_at field.
  return apiFetch<ScanFlagsResponse>(
    `/api/scans/parcels/${encodeURIComponent(parcelId)}/scan-data`,
    { method: 'GET', accessToken },
  )
}

export interface UseRescorePollOptions {
  parcelId: string
  pollStartAt: number  // unix ms when persist completed
  enabled: boolean
}

export function useRescorePoll(opts: UseRescorePollOptions): RescorePollResult {
  const { parcelId, pollStartAt, enabled } = opts
  const { accessToken } = useAuth()
  const active = enabled && Boolean(parcelId)
  // Phase derives from props (idle when inactive) + terminal state (success/timeout).
  const [terminal, setTerminal] = useState<{ key: string; phase: RescorePollPhase } | null>(null)
  const [tickCount, setTickCount] = useState(0)
  const tickRef = useRef(0)
  const runKey = `${parcelId}:${pollStartAt}:${active ? 1 : 0}`

  useEffect(() => {
    if (!active) return
    tickRef.current = 0
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on new poll run (parcelId/pollStartAt change)
    setTickCount(0)
    setTerminal(null)
    let cancelled = false
    const intervalId = setInterval(async () => {
      if (cancelled) return
      tickRef.current += 1
      setTickCount(tickRef.current)
      if (tickRef.current >= MAX_TICKS) {
        clearInterval(intervalId)
        if (!cancelled) setTerminal({ key: runKey, phase: 'timeout' })
        return
      }
      try {
        const response = await fetchScanFlags(parcelId, accessToken)
        if (cancelled) return
        if (shouldStopOnSuccess(response, pollStartAt)) {
          clearInterval(intervalId)
          setTerminal({ key: runKey, phase: 'success' })
        }
      } catch {
        // Transient errors silent — timeout branch is the safety net.
      }
    }, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(intervalId) }
  }, [active, parcelId, pollStartAt, accessToken, runKey])

  const phase: RescorePollPhase = !active
    ? 'idle'
    : terminal?.key === runKey ? terminal.phase : 'polling'

  return { phase, tickCount: active ? tickCount : 0 }
}
