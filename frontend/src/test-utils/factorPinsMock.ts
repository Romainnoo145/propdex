/**
 * Phase 7 — Storybook helper to pre-seed TanStack Query cache with factor pins.
 *
 * No MSW. Inline cache pre-seed only — precedent: PotentieLayer.stories.tsx
 * (Phase 3) which uses `queryClient.setQueryData(['parcel-project-type', ...])`.
 */
import { QueryClient } from '@tanstack/react-query'

export type FactorPin = {
  id: string
  category: 'potentie' | 'risico'
  factor_key: string
  position: number
  created_at: string
}

export function makeFactorPin(
  factor_key: string,
  position: number,
  category: 'potentie' | 'risico' = 'potentie',
): FactorPin {
  return {
    id: `pin-${factor_key}-${position}`,
    category,
    factor_key,
    position,
    created_at: '2026-04-26T00:00:00Z',
  }
}

export function makeQueryClientWithPins(
  parcelId: string,
  pins: FactorPin[],
  category: 'potentie' | 'risico' = 'potentie',
): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  qc.setQueryData(['parcel-project-type', parcelId], {
    parcel_id: parcelId,
    project_type: 'nieuwbouw_wonen',
    set_at: '2026-04-25T00:00:00Z',
    set_by_user_id: null,
  })
  qc.setQueryData(['factor-pins', category], pins)
  return qc
}
