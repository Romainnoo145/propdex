/**
 * M048 Phase 7 — useFactorPins hook (PIN-01, PIN-03, UI-01).
 *
 * TanStack Query hook for per-user factor pins with optimistic updates.
 * Mirror shape of useScoreWeights.ts (project canonical pattern).
 *
 * Backend contract (Plan 02):
 *   GET    /api/users/me/factor-pins?category={potentie|risico} → 200 FactorPin[]
 *   POST   /api/users/me/factor-pins {category, factor_key}     → 201 FactorPin | 409 | 400 MAX_PINS_REACHED
 *   DELETE /api/users/me/factor-pins/{id}                       → 204
 *
 * Max-6 guard fires `toast("⭐ Max 6 bereikt")` BEFORE POST when adding
 * would exceed 6 pins; server 400 is silent backup-net.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

export type PinCategory = 'potentie' | 'risico'

export interface FactorPin {
  id: string
  category: PinCategory
  factor_key: string
  position: number
  created_at: string
}

export const MAX_PINS_PER_CATEGORY = 6

const BASE = '/api/users/me/factor-pins'

interface UseFactorPinsResult {
  pins: FactorPin[]
  isLoading: boolean
  toggle: (factorKey: string) => void
  isPinned: (factorKey: string) => boolean
}

export function useFactorPins(category: PinCategory): UseFactorPinsResult {
  const { accessToken } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['factor-pins', category] as const

  const query = useQuery<FactorPin[], Error>({
    queryKey: [...queryKey],
    queryFn: () =>
      apiFetch<FactorPin[]>(`${BASE}?category=${category}`, {
        accessToken,
        method: 'GET',
      }),
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const addMutation = useMutation<
    FactorPin,
    Error,
    string,
    { previous: FactorPin[] }
  >({
    mutationFn: (factor_key) =>
      apiFetch<FactorPin>(BASE, {
        accessToken,
        method: 'POST',
        body: JSON.stringify({ category, factor_key }),
      }),
    onMutate: async (factor_key) => {
      await qc.cancelQueries({ queryKey: [...queryKey] })
      const previous = qc.getQueryData<FactorPin[]>([...queryKey]) ?? []
      const nextPosition =
        previous.length > 0
          ? (previous[previous.length - 1]?.position ?? -1) + 1
          : 0
      const optimistic: FactorPin = {
        id: `tmp-${factor_key}`,
        category,
        factor_key,
        position: nextPosition,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<FactorPin[]>([...queryKey], [...previous, optimistic])
      return { previous }
    },
    onError: (_err, _key, ctx) => {
      if (ctx) qc.setQueryData([...queryKey], ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...queryKey] })
    },
  })

  const removeMutation = useMutation<
    void,
    Error,
    string,
    { previous: FactorPin[] }
  >({
    mutationFn: (pinId) =>
      apiFetch<void>(`${BASE}/${pinId}`, {
        accessToken,
        method: 'DELETE',
      }),
    onMutate: async (pinId) => {
      await qc.cancelQueries({ queryKey: [...queryKey] })
      const previous = qc.getQueryData<FactorPin[]>([...queryKey]) ?? []
      qc.setQueryData<FactorPin[]>(
        [...queryKey],
        previous.filter((p) => p.id !== pinId),
      )
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx) qc.setQueryData([...queryKey], ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...queryKey] })
    },
  })

  const pins = query.data ?? []

  const isPinned = (factorKey: string): boolean =>
    pins.some((p) => p.factor_key === factorKey)

  const toggle = (factorKey: string): void => {
    const existing = pins.find((p) => p.factor_key === factorKey)
    if (existing) {
      removeMutation.mutate(existing.id)
      return
    }
    if (pins.length >= MAX_PINS_PER_CATEGORY) {
      toast('⭐ Max 6 bereikt')
      return
    }
    addMutation.mutate(factorKey)
  }

  return {
    pins,
    isLoading: query.isLoading,
    toggle,
    isPinned,
  }
}
