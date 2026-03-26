/**
 * Verkenner — Conversational AI interface to all Propdex data.
 *
 * Chat-first: user asks questions, system classifies intent and responds
 * with summaries. PARCEL_SEARCH results never shown inline — the chat shows
 * count + filter pills + "Bekijk resultaten" button that navigates to /resultaten.
 */

import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Sparkles } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { ChatLoading } from '@/components/chat/ChatLoading'
import { ChatSearchResults } from '@/components/chat/ChatSearchResults'
import { ChatCountPreview } from '@/components/chat/ChatCountPreview'
import { ChatParcelDetail } from '@/components/chat/ChatParcelDetail'
import { ChatFavoritesList } from '@/components/chat/ChatFavoritesList'
import { ChatReportsList } from '@/components/chat/ChatReportsList'
import { ChatUnsupported } from '@/components/chat/ChatUnsupported'

/* ─── Route ─────────────────────────────────────────────────── */

export const Route = createFileRoute('/_authenticated/verkenner')({
  component: VerkennerPage,
})

/* ─── Animations ────────────────────────────────────────────── */

const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
}

/* ─── Example queries ───────────────────────────────────────── */

const EXAMPLES = [
  'Alle woningen in Venlo met bouwjaar voor 1970',
  'Bedrijfspanden groter dan 500m² in Amsterdam',
  'Welke percelen heb ik opgeslagen?',
  'Laat mijn rapporten zien',
]

/* ─── Message Bubble ────────────────────────────────────────── */

function MessageBubble({ message, chat }: {
  message: ChatMessage
  chat: ReturnType<typeof useChat>
}) {
  if (message.role === 'user') {
    return (
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="show"
        className="flex justify-end"
      >
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-amber-500 px-4 py-2.5 text-[13px] text-white font-medium">
          {message.text}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      className="flex justify-start"
    >
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-white border border-[#EAEFEF] px-4 py-3 shadow-sm">
        <SystemContent message={message} chat={chat} />
      </div>
    </motion.div>
  )
}

function SystemContent({ message, chat }: {
  message: Extract<ChatMessage, { role: 'system' }>
  chat: ReturnType<typeof useChat>
}) {
  switch (message.intent) {
    case 'LOADING':
      return <ChatLoading />

    case 'PARCEL_SEARCH':
      return (
        <ChatSearchResults
          total={message.total}
          parsed={message.parsed}
          queryId={message.queryId}
        />
      )

    case 'COUNT_PREVIEW':
      return (
        <ChatCountPreview
          count={message.count}
          message={message.message}
          suggestions={message.suggestions}
          onSuggestion={chat.sendSuggestion}
          onForceResults={chat.forceResults}
        />
      )

    case 'PARCEL_DETAIL':
      return <ChatParcelDetail data={message.data} />

    case 'MY_FAVORITES':
      return (
        <ChatFavoritesList
          favorites={message.data}
          count={message.count}
          message={message.message}
        />
      )

    case 'MY_REPORTS':
      return (
        <ChatReportsList
          reports={message.data}
          count={message.count}
          message={message.message}
        />
      )

    case 'UNSUPPORTED':
      return <ChatUnsupported reason={message.reason} />

    default:
      return <p className="text-[13px] text-slate-600">{'message' in message ? String((message as Record<string, unknown>).message) : 'Bericht ontvangen.'}</p>
  }
}

/* ─── Page ──────────────────────────────────────────────────── */

function VerkennerPage() {
  const [input, setInput] = useState('')
  const chat = useChat()
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [chat.messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || chat.isPending) return
    chat.send(trimmed)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, chat])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleExample = useCallback((text: string) => {
    chat.send(text)
  }, [chat])

  const isEmpty = chat.messages.length === 0

  return (
    <ResultsShell className="flex flex-col !py-0 !px-0" contentClassName="!p-0 !max-w-none">
      <div className="flex flex-col h-full">

        {/* ── Thread ─────────────────────────────────────── */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-4 sm:px-6 pt-6 pb-20 sm:pb-4"
          aria-live="polite"
        >
          <div className="mx-auto max-w-3xl">
            <AnimatePresence>
              {isEmpty && (
                <motion.div
                  variants={fadeIn}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="flex flex-col items-center text-center pt-12 sm:pt-20"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                    <Sparkles size={24} className="text-amber-500" />
                  </div>
                  <h1 className="mt-4 text-[24px] sm:text-[32px] font-black tracking-tight text-[#0E1111]">
                    Verkenner
                  </h1>
                  <p className="mt-2 text-[13px] text-slate-500 max-w-md">
                    Stel een vraag over percelen, rapporten, opgeslagen objecten, of welke data dan ook in Propdex.
                  </p>

                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => handleExample(ex)}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] text-amber-800 hover:bg-amber-100 hover:border-amber-300 transition-colors"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {chat.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} chat={chat} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Composer ─────────────────────────────────────── */}
        <div className="shrink-0 border-t border-[#EAEFEF] bg-[#FAFCFA] px-4 sm:px-6 py-3">
          <div className="mx-auto max-w-3xl flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Stel een vraag..."
                rows={1}
                className="w-full resize-none rounded-2xl border border-[#EAEFEF] bg-white px-4 py-2.5 pr-12 text-[13px] text-[#0E1111] placeholder:text-slate-400 focus:outline-none focus:border-amber-400 transition-colors"
                disabled={chat.isPending}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || chat.isPending}
                className="absolute right-1.5 bottom-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white disabled:opacity-30 hover:bg-amber-600 transition-colors"
              >
                <ArrowUp size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ResultsShell>
  )
}
