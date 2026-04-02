/**
 * Verkenner — Conversational AI interface to all Propdex data.
 *
 * Chat-first: user asks questions, agent responds with rich markdown.
 * History panel slides in as a sibling rounded shell (same pattern as
 * parcel detail panel pushing the map).
 */

import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Compass, Clock, X, Loader2 } from 'lucide-react'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { useBulkQueryHistory } from '@/hooks/useBulkQuery'
import { ChatLoading } from '@/components/chat/ChatLoading'
import { ChatAgentMessage } from '@/components/chat/ChatAgentMessage'

export const Route = createFileRoute('/_authenticated/verkenner')({
  component: VerkennerPage,
})

/* ─── Animations ────────────────────────────────────────────── */

const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

/* ─── Examples ──────────────────────────────────────────────── */

const EXAMPLES = [
  'Vergelijk mijn opgeslagen percelen op risicoscore',
  'Welke documenten ontbreken voor mijn rapport in Venlo?',
  'Wat zijn de risico\'s van mijn favoriete percelen?',
  'Waar kan ik een bodemonderzoek laten doen?',
]

/* ─── History Shell ─────────────────────────────────────────── */

function HistoryShell({
  onSelect,
  onClose,
}: {
  onSelect: (query: string) => void
  onClose: () => void
}) {
  const { data, isLoading } = useBulkQueryHistory(0, 50)

  return (
    <div className="h-full w-[340px] shrink-0 overflow-hidden rounded-[40px] bg-white border border-white/20 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-5 pt-6 pb-3 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-aura-obsidian">Geschiedenis</h3>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-full border border-neutral-200 text-slate-400 hover:text-aura-obsidian hover:border-aura-obsidian transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        )}
        {data?.queries.map((q) => (
          <button
            key={q.id}
            onClick={() => onSelect(q.query_text)}
            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-aura-canvas transition-colors"
          >
            <p className="text-[13px] text-aura-obsidian font-medium line-clamp-1">
              {q.query_text}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="tabular-nums">{q.result_count} resultaten</span>
              <span>·</span>
              <span>{new Date(q.created_at).toLocaleDateString('nl-NL')}</span>
            </div>
          </button>
        ))}
        {data && data.queries.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <Clock size={24} className="text-slate-300 mb-2" />
            <p className="text-[13px] text-slate-400">Nog geen queries</p>
            <p className="text-[11px] text-slate-300 mt-0.5">Je zoekgeschiedenis verschijnt hier</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Message Bubble ────────────────────────────────────────── */

function MessageBubble({ message }: {
  message: ChatMessage
}) {
  if (message.role === 'user') {
    return (
      <motion.div variants={fadeIn} className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-amber-500 px-4 py-2.5 text-[13px] text-white font-medium">
          {message.text}
        </div>
      </motion.div>
    )
  }

  // Determine inner content based on message role
  let content: React.ReactNode
  if (message.role === 'tool_progress') {
    content = <ChatLoading tools={message.tools} />
  } else if (message.role === 'loading') {
    content = <ChatLoading />
  } else {
    content = <ChatAgentMessage text={message.text} sources={message.sources} />
  }

  return (
    <motion.div variants={fadeIn} className="flex justify-start gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 mt-0.5">
        <Compass size={14} className="text-amber-500" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white border border-amber-100 px-4 py-3 shadow-sm">
        {content}
      </div>
    </motion.div>
  )
}


/* ─── Page ──────────────────────────────────────────────────── */

function VerkennerPage() {
  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const chat = useChat()
  const threadRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages])

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || chat.isPending) return
    chat.send(trimmed)
    setInput('')
    setShowHistory(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [input, chat])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }, [handleSubmit])

  const handleExample = useCallback((text: string) => { chat.send(text) }, [chat])

  const handleHistorySelect = useCallback((query: string) => {
    chat.send(query)
    setShowHistory(false)
  }, [chat])

  const isEmpty = chat.messages.length === 0

  return (
    <div className="flex h-full gap-4">
      {/* ── History shell (sibling, pushes chat shell) ──── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 h-full overflow-hidden"
          >
            <HistoryShell onSelect={handleHistorySelect} onClose={() => setShowHistory(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat shell ─────────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full overflow-hidden rounded-[40px] bg-aura-canvas flex flex-col">

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl h-full flex flex-col">
            <AnimatePresence>
              {isEmpty && (
                <motion.div
                  variants={fadeIn}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="flex-1 flex flex-col items-center text-center justify-center -mt-12"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                    <Compass size={24} className="text-amber-500" />
                  </div>
                  <h1 className="mt-4 text-[32px] sm:text-[42px] font-black tracking-tight text-aura-obsidian">
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

                  {/* Composer — inline in empty state */}
                  <div className="mt-8 w-full max-w-2xl relative">
                    <button
                      onClick={() => setShowHistory((v) => !v)}
                      className={`absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full transition-colors z-10 ${
                        showHistory
                          ? 'bg-aura-amber text-aura-obsidian'
                          : 'text-slate-400 hover:text-aura-obsidian'
                      }`}
                      title="Geschiedenis"
                    >
                      <Clock size={16} />
                    </button>
                    <input
                      type="text"
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Stel een vraag..."
                      className="w-full rounded-full border border-neutral-200 bg-white h-12 pl-14 pr-14 text-[14px] text-aura-obsidian placeholder:text-slate-400 focus:outline-none focus:border-aura-amber transition-colors"
                      disabled={chat.isPending}
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={!input.trim() || chat.isPending}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-aura-amber text-aura-obsidian disabled:opacity-30 hover:bg-aura-amber-hover transition-colors"
                    >
                      <ArrowUp size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isEmpty && (
              <motion.div initial="hidden" animate="show" variants={staggerContainer} className="space-y-4 py-6">
                {chat.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </div>
        </div>

        {/* Composer — only when chat has messages */}
        {!isEmpty && (
        <div className="shrink-0 px-4 sm:px-6 pb-4 pt-2">
          <div className="mx-auto max-w-3xl relative">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full transition-colors z-10 ${
                showHistory
                  ? 'bg-aura-amber text-aura-obsidian'
                  : 'text-slate-400 hover:text-aura-obsidian'
              }`}
              title="Geschiedenis"
            >
              <Clock size={16} />
            </button>
            <input
              type="text"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stel een vraag..."
              className="w-full rounded-full border border-neutral-200 bg-white h-12 pl-14 pr-14 text-[14px] text-aura-obsidian placeholder:text-slate-400 focus:outline-none focus:border-aura-amber transition-colors"
              disabled={chat.isPending}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || chat.isPending}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-aura-amber text-aura-obsidian disabled:opacity-30 hover:bg-aura-amber-hover transition-colors"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
      </div>
    </div>
  )
}
{16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
