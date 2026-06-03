/**
 * useBrief — M052/S04 Contact brief-teaser hooks.
 *
 * - useAfzender / useSaveAfzender: org afzender-velden (briefhoofd).
 * - useGenerateBrief / useSendBrief: brief-genereer + fake-send (hauzer_demo-gate).
 *
 * Project convention: raw fetch via apiFetch + useAuth (mirrors useDashboard/useBrkRecords).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'

export interface Afzender {
  bedrijfsnaam: string
  afzender_adres: string | null
  contactpersoon: string | null
  contact_email: string | null
  contact_telefoon: string | null
}

export function useAfzender() {
  const { accessToken } = useAuth()
  return useQuery<Afzender, Error>({
    queryKey: ['afzender'],
    queryFn: () =>
      apiFetch<Afzender>('/api/users/org/afzender', { method: 'GET', accessToken }),
    enabled: !!accessToken,
  })
}

export function useSaveAfzender() {
  const { accessToken } = useAuth()
  const qc = useQueryClient()
  return useMutation<Afzender, Error, Partial<Omit<Afzender, 'bedrijfsnaam'>>>({
    mutationFn: (patch) =>
      apiFetch<Afzender>('/api/users/org/afzender', {
        method: 'PATCH',
        body: JSON.stringify(patch),
        accessToken,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['afzender'] }),
  })
}

export interface BriefResult {
  markdown: string
  mode: 'auto' | 'manual'
}

export function useGenerateBrief(parcelId: string) {
  const { accessToken } = useAuth()
  return useMutation<
    BriefResult,
    Error,
    { eigenaar_aanhef?: string; eigenaar_adres?: string } | undefined
  >({
    mutationFn: (addressee) =>
      apiFetch<BriefResult>(`/api/parcels/${encodeURIComponent(parcelId)}/brief`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify(addressee ? { addressee } : {}),
      }),
  })
}

export function useSendBrief(parcelId: string) {
  const { accessToken } = useAuth()
  return useMutation<{ status: string; sent_at: string }, Error, string>({
    mutationFn: (markdown) =>
      apiFetch<{ status: string; sent_at: string }>(
        `/api/parcels/${encodeURIComponent(parcelId)}/brief/send`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify({ markdown }),
        },
      ),
  })
}
