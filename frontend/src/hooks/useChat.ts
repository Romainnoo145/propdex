/**
 * useChat — React hook for the Verkenner conversational interface.
 *
 * Manages chat messages as React state, sends queries to POST /api/agents/chat,
 * handles refinement context (previous_intent/params), and provides typed
 * ChatMessage discriminated union for rendering.
 */

import { useState, useCallback, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'

const CHAT_URL = '/api/agents/chat'

/* ─── Types ─────────────────────────────────────────────────── */

export interface ParsedQuery {
  municipality?: string | null
  build_year_min?: number | null
  build_year_max?: number | null
  area_min?: number | null
  area_max?: number | null
  bestemming?: string | null
  bestemming_exclude?: string | null
  pand_status?: string | null
}

export interface BulkResult {
  parcel_id: string
  address?: string | null
  municipality?: string | null
  build_year?: number | null
  area_m2?: number | null
  bestemming?: string | null
  pand_status?: string | null
}

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

export interface FavoriteSummary {
  parcel_id: string
  address?: string | null
  gemeente_naam?: string | null
  wijk_naam?: string | null
  pipeline_stage: string
  potentie_score?: number | null
  risico_score?: number | null
}

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

/** API response from POST /api/agents/chat */
export interface ChatApiResponse {
  intent: string
  context_intent?: string | null
  params: Record<string, unknown>
  data: unknown
  count?: number | null
  suggestions?: string[] | null
  message?: string | null
  query_id?: string | null
}

/** Discriminated union for chat messages */
export type ChatMessage =
  | { role: 'user'; text: string; id: string }
  | { role: 'system'; intent: 'PARCEL_SEARCH'; data: BulkResult[]; total: number; parsed: Record<string, unknown>; queryId?: string; id: string }
  | { role: 'system'; intent: 'COUNT_PREVIEW'; count: number; parsed: Record<string, unknown>; suggestions: string[]; message: string; id: string }
  | { role: 'system'; intent: 'PARCEL_DETAIL'; data: ParcelDetailSummary; id: string }
  | { role: 'system'; intent: 'MY_FAVORITES'; data: FavoriteSummary[]; count: number; message?: string; id: string }
  | { role: 'system'; intent: 'MY_REPORTS'; data: ReportSummary[]; count: number; message?: string; id: string }
  | { role: 'system'; intent: 'UNSUPPORTED'; reason: string; id: string }
  | { role: 'system'; intent: 'LOADING'; id: string }

let _msgId = 0
function nextId() {
  return `msg-${++_msgId}`
}

/* ─── Hook ──────────────────────────────────────────────────── */

export function useChat() {
  const { accessToken } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const lastIntentRef = useRef<string | null>(null)
  const lastParamsRef = useRef<Record<string, unknown> | null>(null)
  const lastCountRef = useRef<number | null>(null)

  const mutation = useMutation<ChatApiResponse, Error, { message: string; forceResults?: boolean }>({
    mutationFn: ({ message, forceResults }) =>
      apiFetch<ChatApiResponse>(CHAT_URL, {
        method: 'POST',
        body: JSON.stringify({
          message,
          previous_intent: lastIntentRef.current,
          previous_params: lastParamsRef.current,
          previous_count: lastCountRef.current,
          force_results: forceResults ?? false,
        }),
        accessToken,
      }),
  })

  const send = useCallback((text: string, opts?: { forceResults?: boolean }) => {
    const trimmed = text.trim()
    if (!trimmed || mutation.isPending) return

    // Add user message
    const userId = nextId()
    const loadingId = nextId()

    setMessages(prev => [
      ...prev,
      { role: 'user', text: trimmed, id: userId },
      { role: 'system', intent: 'LOADING', id: loadingId },
    ])

    mutation.mutate(
      { message: trimmed, forceResults: opts?.forceResults },
      {
        onSuccess: (resp) => {
          // Track context for refinement — use context_intent to avoid
          // storing COUNT_PREVIEW as the previous intent
          lastIntentRef.current = resp.context_intent ?? resp.intent
          lastParamsRef.current = resp.params
          lastCountRef.current = resp.count ?? null

          // Replace LOADING with real response
          const sysMsg = apiResponseToMessage(resp)
          setMessages(prev =>
            prev.map(m => m.id === loadingId ? sysMsg : m)
          )
        },
        onError: (error) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === loadingId
                ? { role: 'system', intent: 'UNSUPPORTED', reason: error.message || 'Er ging iets mis.', id: loadingId }
                : m
            )
          )
        },
      },
    )
  }, [mutation, accessToken])

  /** Send "toon resultaten" with force_results=true, using previous params */
  const forceResults = useCallback(() => {
    send('Toon resultaten', { forceResults: true })
  }, [send])

  /** Send a refinement suggestion as if the user typed it */
  const sendSuggestion = useCallback((suggestion: string) => {
    send(suggestion)
  }, [send])

  const clearChat = useCallback(() => {
    setMessages([])
    lastIntentRef.current = null
    lastParamsRef.current = null
    lastCountRef.current = null
  }, [])

  return {
    messages,
    send,
    forceResults,
    sendSuggestion,
    clearChat,
    isPending: mutation.isPending,
  }
}

/* ─── Response → ChatMessage mapping ─────────────────────────── */

function apiResponseToMessage(resp: ChatApiResponse): ChatMessage {
  const id = nextId()

  switch (resp.intent) {
    case 'PARCEL_SEARCH':
      return {
        role: 'system',
        intent: 'PARCEL_SEARCH',
        data: (resp.data as BulkResult[]) ?? [],
        total: resp.count ?? 0,
        parsed: resp.params,
        queryId: resp.query_id ?? undefined,
        id,
      }

    case 'COUNT_PREVIEW':
      return {
        role: 'system',
        intent: 'COUNT_PREVIEW',
        count: resp.count ?? 0,
        parsed: resp.params,
        suggestions: resp.suggestions ?? [],
        message: resp.message ?? '',
        id,
      }

    case 'PARCEL_DETAIL':
      return {
        role: 'system',
        intent: 'PARCEL_DETAIL',
        data: resp.data as ParcelDetailSummary,
        id,
      }

    case 'MY_FAVORITES':
      return {
        role: 'system',
        intent: 'MY_FAVORITES',
        data: (resp.data as FavoriteSummary[]) ?? [],
        count: resp.count ?? 0,
        message: resp.message ?? undefined,
        id,
      }

    case 'MY_REPORTS':
      return {
        role: 'system',
        intent: 'MY_REPORTS',
        data: (resp.data as ReportSummary[]) ?? [],
        count: resp.count ?? 0,
        message: resp.message ?? undefined,
        id,
      }

    case 'UNSUPPORTED':
    default:
      return {
        role: 'system',
        intent: 'UNSUPPORTED',
        reason: resp.message ?? 'Deze vraag kan niet worden beantwoord.',
        id,
      }
  }
}
