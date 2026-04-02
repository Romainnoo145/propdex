/**
 * useChat — React hook for the Verkenner conversational interface.
 *
 * Sends AgentRequest to POST /api/agents/chat, receives AgentResponse,
 * and manages a 3-variant ChatMessage union (user | assistant | loading).
 */

import { useState, useCallback, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

const CHAT_URL = '/api/agents/chat'

/* ─── Types ─────────────────────────────────────────────────── */

/** Citation source returned by the agent. */
export interface Source {
  url: string
  title: string
  cited_text: string
}

/** API response from POST /api/agents/chat (matches backend AgentResponse). */
export interface AgentApiResponse {
  message: string
  conversation_id: string | null
  tool_calls_made: string[]
  structured_blocks: Record<string, unknown>[]
  sources: Source[]
}

/** Discriminated union for chat messages — 3 variants. */
export type ChatMessage =
  | { role: 'user'; text: string; id: string }
  | { role: 'assistant'; text: string; sources: Source[]; toolCalls: string[]; id: string }
  | { role: 'loading'; id: string }

let _msgId = 0
function nextId() {
  return `msg-${++_msgId}`
}

/* ─── Deprecated type re-exports ────────────────────────────── */
// These types are still imported by the old intent-based chat components
// (ChatFavoritesList, ChatParcelDetail, ChatReportsList, ChatSearchResults,
// ChatCountPreview). They will be removed in T02 when verkenner.tsx is
// updated to use ChatAgentMessage exclusively.

/** @deprecated — will be removed in T02 */
export interface ParcelDetailSummary {
  parcel_id: string
  parcel_code?: string | null
  address?: string | null
  municipality?: string | null
  gemeente_code?: string | null
  bouwjaar?: number | null
  area_m2?: number | null
  bestemming?: string | null
  pand_status?: string | null
  woz_waarde?: number | null
  energielabel?: string | null
  has_report?: boolean
  report_id?: string | null
}

/** @deprecated — will be removed in T02 */
export interface FavoriteSummary {
  parcel_id: string
  address?: string | null
  gemeente_naam?: string | null
  wijk_naam?: string | null
  pipeline_stage: string
  potentie_score?: number | null
  risico_score?: number | null
}

/** @deprecated — will be removed in T02 */
export interface ReportSummary {
  id: string
  report_name: string
  address?: string | null
  city?: string | null
  created_at: string
  potentie?: number | null
  risico?: number | null
  bouwjaar?: number | null
  oppervlakte?: number | null
  gebruiksdoel?: string | null
  bestemming?: string | null
  energielabel?: string | null
  asbest_risk?: string | null
  fysiek_risk?: string | null
  is_monument?: boolean | null
}

/* ─── Hook ──────────────────────────────────────────────────── */

export function useChat() {
  const { accessToken } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const conversationIdRef = useRef<string | null>(null)

  const mutation = useMutation<AgentApiResponse, Error, { message: string }>({
    mutationFn: ({ message }) =>
      apiFetch<AgentApiResponse>(CHAT_URL, {
        method: 'POST',
        body: JSON.stringify({
          message,
          conversation_id: conversationIdRef.current,
        }),
        accessToken,
      }),
  })

  const send = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || mutation.isPending) return

    const userId = nextId()
    const loadingId = nextId()

    setMessages(prev => [
      ...prev,
      { role: 'user', text: trimmed, id: userId },
      { role: 'loading', id: loadingId },
    ])

    mutation.mutate(
      { message: trimmed },
      {
        onSuccess: (resp) => {
          conversationIdRef.current = resp.conversation_id ?? null

          const assistantMsg: ChatMessage = {
            role: 'assistant',
            text: resp.message,
            sources: resp.sources ?? [],
            toolCalls: resp.tool_calls_made ?? [],
            id: nextId(),
          }

          setMessages(prev =>
            prev.map(m => m.id === loadingId ? assistantMsg : m)
          )
        },
        onError: (error) => {
          const errorMsg: ChatMessage = {
            role: 'assistant',
            text: error.message || 'Er ging iets mis. Probeer het opnieuw.',
            sources: [],
            toolCalls: [],
            id: loadingId,
          }
          setMessages(prev =>
            prev.map(m => m.id === loadingId ? errorMsg : m)
          )
        },
      },
    )
  }, [mutation, accessToken])

  const clearChat = useCallback(() => {
    setMessages([])
    conversationIdRef.current = null
  }, [])

  return {
    messages,
    send,
    clearChat,
    isPending: mutation.isPending,
  }
}
