/**
 * useChat — React hook for the Verkenner conversational interface.
 *
 * Sends messages to POST /api/agents/chat/stream and consumes SSE events
 * for real-time tool-progress indicators and word-by-word response streaming.
 */

import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth/useAuth'

const STREAM_URL = '/api/agents/chat/stream'

/* ─── Types ─────────────────────────────────────────────────── */

/** Citation source returned by the agent. */
export interface Source {
  url: string
  title: string
  cited_text: string
}

/** Discriminated union for chat messages — 4 variants. */
export type ChatMessage =
  | { role: 'user'; text: string; id: string }
  | { role: 'assistant'; text: string; sources: Source[]; toolCalls: string[]; id: string }
  | { role: 'loading'; id: string }
  | { role: 'tool_progress'; tools: string[]; id: string }

let _msgId = 0
function nextId() {
  return `msg-${++_msgId}`
}

/* ─── Deprecated type re-exports ────────────────────────────── */
// These types are still imported by the old intent-based chat components
// (ChatFavoritesList, ChatParcelDetail, ChatReportsList, ChatSearchResults,
// ChatCountPreview). They will be removed when verkenner.tsx is
// updated to use ChatAgentMessage exclusively.

/** @deprecated — will be removed in a future cleanup */
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

/** @deprecated — will be removed in a future cleanup */
export interface FavoriteSummary {
  parcel_id: string
  address?: string | null
  gemeente_naam?: string | null
  wijk_naam?: string | null
  pipeline_stage: string
  potentie_score?: number | null
  risico_score?: number | null
}

/** @deprecated — will be removed in a future cleanup */
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

/* ─── SSE Parser ────────────────────────────────────────────── */

interface SSEEvent {
  event: string
  data: string
}

/**
 * Parse SSE text chunk into individual events.
 * Handles partial lines across chunks via a buffer.
 */
function parseSSE(raw: string, buffer: string): { events: SSEEvent[]; remaining: string } {
  // Normalize CRLF → LF before parsing (sse-starlette sends \r\n)
  const text = (buffer + raw).replace(/\r\n/g, '\n')
  const events: SSEEvent[] = []
  // Split on double newlines (SSE event boundary)
  const blocks = text.split('\n\n')
  // Last block may be incomplete
  const remaining = blocks.pop() ?? ''

  for (const block of blocks) {
    if (!block.trim()) continue
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        data = line.slice(5).trim()
      }
    }
    if (data) {
      events.push({ event, data })
    }
  }

  return { events, remaining }
}

/* ─── Hook ──────────────────────────────────────────────────── */

export function useChat() {
  const { accessToken } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isPending, setIsPending] = useState(false)
  const conversationIdRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (text: string, opts?: { contextPrefix?: string }) => {
    const trimmed = text.trim()
    if (!trimmed || isPending) return

    // The user bubble shows `trimmed`; the wire message may carry an invisible
    // context prefix (e.g. the selected parcel address) so the agent knows what
    // the question is about without cluttering the visible conversation.
    const wireMessage = opts?.contextPrefix
      ? `${opts.contextPrefix}\n\n${trimmed}`
      : trimmed

    // Cancel any in-flight stream
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userId = nextId()
    const placeholderId = nextId()

    setMessages(prev => [
      ...prev,
      { role: 'user', text: trimmed, id: userId },
      { role: 'loading', id: placeholderId },
    ])
    setIsPending(true)

    // Track active tools and accumulated text for this stream
    const activeTools: string[] = []
    let accumulatedText = ''
    let sources: Source[] = []
    let toolCallsMade: string[] = []
    // Whether we've transitioned from tool_progress/loading to assistant text
    let textStarted = false

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(STREAM_URL, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          message: wireMessage,
          conversation_id: conversationIdRef.current,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        let errorMessage = 'Er ging iets mis. Probeer het opnieuw.'
        try {
          const parsed = JSON.parse(errorBody)
          if (parsed.detail) errorMessage = typeof parsed.detail === 'string' ? parsed.detail : errorMessage
        } catch { /* use default */ }

        setMessages(prev =>
          prev.map(m => m.id === placeholderId
            ? { role: 'assistant', text: errorMessage, sources: [], toolCalls: [], id: placeholderId }
            : m
          )
        )
        setIsPending(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('ReadableStream not supported')
      }

      const decoder = new TextDecoder()
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const { events, remaining } = parseSSE(chunk, sseBuffer)
        sseBuffer = remaining

        for (const sse of events) {
          let payload: Record<string, unknown>
          try {
            payload = JSON.parse(sse.data)
          } catch {
            continue
          }

          switch (sse.event) {
            case 'tool_start': {
              const toolName = payload.tool as string
              if (toolName && !activeTools.includes(toolName)) {
                activeTools.push(toolName)
              }
              setMessages(prev =>
                prev.map(m => m.id === placeholderId
                  ? { role: 'tool_progress', tools: [...activeTools], id: placeholderId }
                  : m
                )
              )
              break
            }

            case 'tool_end': {
              const toolName = payload.tool as string
              const idx = activeTools.indexOf(toolName)
              if (idx !== -1) activeTools.splice(idx, 1)
              // Keep showing tool_progress if tools are still active
              if (activeTools.length > 0) {
                setMessages(prev =>
                  prev.map(m => m.id === placeholderId
                    ? { role: 'tool_progress', tools: [...activeTools], id: placeholderId }
                    : m
                  )
                )
              }
              break
            }

            case 'text_delta': {
              const delta = payload.text as string
              if (!delta) break
              accumulatedText += delta
              textStarted = true
              setMessages(prev =>
                prev.map(m => m.id === placeholderId
                  ? { role: 'assistant', text: accumulatedText, sources, toolCalls: toolCallsMade, id: placeholderId }
                  : m
                )
              )
              break
            }

            case 'sources': {
              const srcList = payload.sources as Source[] | undefined
              if (srcList) {
                sources = srcList
                // Update current message with sources if text already showing
                if (textStarted) {
                  setMessages(prev =>
                    prev.map(m => m.id === placeholderId
                      ? { role: 'assistant', text: accumulatedText, sources, toolCalls: toolCallsMade, id: placeholderId }
                      : m
                    )
                  )
                }
              }
              break
            }

            case 'done': {
              const convId = payload.conversation_id as string | null
              if (convId) conversationIdRef.current = convId
              toolCallsMade = (payload.tool_calls_made as string[]) ?? toolCallsMade
              // Finalize the assistant message
              setMessages(prev =>
                prev.map(m => m.id === placeholderId
                  ? { role: 'assistant', text: accumulatedText || '…', sources, toolCalls: toolCallsMade, id: placeholderId }
                  : m
                )
              )
              break
            }

            case 'error': {
              const errMsg = (payload.message as string) || 'Er ging iets mis. Probeer het opnieuw.'
              setMessages(prev =>
                prev.map(m => m.id === placeholderId
                  ? { role: 'assistant', text: errMsg, sources: [], toolCalls: [], id: placeholderId }
                  : m
                )
              )
              break
            }
          }
        }
      }

      // If stream ended without a done event (e.g. just text), finalize
      if (accumulatedText && !textStarted) {
        // This shouldn't happen, but guard against it
        setMessages(prev =>
          prev.map(m => m.id === placeholderId
            ? { role: 'assistant', text: accumulatedText, sources, toolCalls: toolCallsMade, id: placeholderId }
            : m
          )
        )
      }
    } catch (err: unknown) {
      // AbortError is expected on cancel — don't show error
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }

      // Connection drop: show last received text + error indicator
      const errorSuffix = '\n\n⚠️ Verbinding verbroken.'
      const displayText = accumulatedText
        ? accumulatedText + errorSuffix
        : 'Verbinding verbroken. Probeer het opnieuw.'

      setMessages(prev =>
        prev.map(m => m.id === placeholderId
          ? { role: 'assistant', text: displayText, sources, toolCalls: toolCallsMade, id: placeholderId }
          : m
        )
      )
    } finally {
      setIsPending(false)
    }
  }, [isPending, accessToken])

  const clearChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    conversationIdRef.current = null
    setIsPending(false)
  }, [])

  return {
    messages,
    send,
    clearChat,
    isPending,
  }
}
