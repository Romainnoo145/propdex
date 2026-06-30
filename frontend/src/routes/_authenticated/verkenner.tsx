/**
 * Verkenner — address-anchored AI chat over all Propdex data.
 *
 * Flow: pick a parcel first (search an address, or one of your saved parcels),
 * then ask anything. The conversation is anchored to that parcel; a right-hand
 * panel shows the documents/sources that belong to it (the context the agent
 * reasons over). The map tab stays the place for open, exploratory browsing.
 *
 * Design tokens per DESIGN.md: Morning Mist canvas, glass surfaces, Warm Amber
 * accent, Obsidian commitment, Plus Jakarta Sans.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowUp, Compass, MapPin, X, Bookmark } from 'lucide-react'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { AddressSearch } from '@/components/search/AddressSearch'
import { ChatLoading } from '@/components/chat/ChatLoading'
import { ChatAgentMessage } from '@/components/chat/ChatAgentMessage'
import { ParcelSourcesPanel } from '@/components/verkenner/ParcelSourcesPanel'
import { lookupPdokAddress } from '@/lib/api'
import { toMapAddressSearch } from '@/lib/navigation/mapSearch'
import type { SuggestResult } from '@/lib/types/property'
import type { FavoriteResponse } from '@/lib/types/portfolio'

export const Route = createFileRoute('/_authenticated/verkenner')({
  component: VerkennerPage,
})

/* ─── Types ─────────────────────────────────────────────────── */

interface SelectedParcel {
  /** Kadaster parcel id — the documents key (parcel_documents.parcel_id). Null
   *  when the address isn't a saved parcel and has no document dossier. */
  id: string | null
  address: string
  gemeente?: string | null
  /** PDOK suggestion id — kept for non-saved parcels so we can resolve the
   *  address (postcode/huisnummer) and kick off a report on the map. */
  pdokId?: string | null
}

/* ─── Animations ────────────────────────────────────────────── */

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

/* ─── Suggested questions (address-aware) ───────────────────── */

function suggestionsFor(address: string): string[] {
  return [
    `Wat is de bestemming van ${address}?`,
    `Mag ik hier optoppen of een extra woning toevoegen?`,
    `Welke risico's spelen er op dit perceel?`,
    `Zijn er recente uitspraken die dit perceel raken?`,
  ]
}

/* ─── Address → parcel resolution ───────────────────────────── */

/**
 * Resolve a picked address to a SelectedParcel. If the address matches one of
 * the user's saved parcels we adopt its kadaster id (the documents key); else
 * the parcel is chat-only (id=null) and the sources panel stays empty.
 */
function resolveParcel(
  suggestion: SuggestResult,
  favorites: FavoriteResponse[],
): SelectedParcel {
  const address = suggestion.weergavenaam
  const match = favorites.find(
    (f) => f.address && address.toLowerCase().includes(f.address.toLowerCase().split(',')[0]!.trim()),
  )
  return {
    id: match?.parcel_id ?? null,
    address,
    gemeente: match?.gemeente_naam ?? null,
    pdokId: suggestion.id,
  }
}

/* ─── Message bubble ────────────────────────────────────────── */

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <motion.div variants={fadeIn} className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-aura-amber px-4 py-2.5 text-[13px] font-medium text-aura-obsidian">
          {message.text}
        </div>
      </motion.div>
    )
  }

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
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aura-amber/15">
        <Compass size={14} className="text-aura-amber-hover" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-[24px]">
        {content}
      </div>
    </motion.div>
  )
}

/* ─── Composer ──────────────────────────────────────────────── */

function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  inputRef,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled: boolean
  placeholder: string
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  // Auto-grow the textarea up to a max height (Omnigent/Claude-style composer).
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 168)}px`
  }, [value, inputRef])

  return (
    <div className="rounded-[24px] border border-neutral-200 bg-white shadow-[0_2px_14px_rgba(14,17,17,0.05)] transition-colors focus-within:border-aura-amber/60">
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={placeholder}
        className="block max-h-[168px] w-full resize-none bg-transparent px-5 pt-4 pb-1.5 text-[14px] leading-relaxed text-aura-obsidian placeholder:text-slate-400 outline-none"
      />
      <div className="flex items-center justify-end px-3.5 pb-3 pt-1">
        <button
          onClick={onSubmit}
          disabled={!value.trim() || disabled}
          className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-aura-obsidian text-aura-amber transition-colors hover:bg-aura-obsidian/90 disabled:opacity-30"
        >
          <ArrowUp size={17} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

/* ─── Parcel gate (empty state) ─────────────────────────────── */

function ParcelGate({ onSelect }: { onSelect: (p: SelectedParcel) => void }) {
  const favorites = useParcelFavorites()
  const saved = (favorites.data ?? []).filter((f) => f.address)

  const handleAddress = (s: SuggestResult) => {
    onSelect(resolveParcel(s, favorites.data ?? []))
  }

  const hasSaved = saved.length > 0

  return (
    <div className="flex h-full gap-4">
      {/* Left — hero + search */}
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="show"
        className="flex min-w-0 flex-1 flex-col items-center justify-center px-4 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-aura-amber/15">
          <Compass size={24} className="text-aura-amber-hover" />
        </div>
        <h1 className="mt-4 text-[32px] font-black tracking-tight text-aura-ink sm:text-[42px]">
          Verkenner
        </h1>
        <p className="mt-2 max-w-md text-[13px] text-slate-500">
          Kies een perceel om te verkennen. Daarna vraag je alles, met de
          bijbehorende documenten als bron ernaast.
        </p>

        {/* Visible search field (glass container around the shared AddressSearch) */}
        <div className="mt-7 w-full max-w-xl">
          <div className="flex items-center rounded-[20px] border border-neutral-200 bg-white px-5 py-3 shadow-[0_2px_14px_rgba(14,17,17,0.05)] transition-colors focus-within:border-aura-amber/60">
            <AddressSearch onSelect={handleAddress} fullWidth className="flex-1" />
          </div>
        </div>
      </motion.div>

      {/* Right — saved parcels rail (mirrors the workspace sources panel) */}
      {hasSaved && (
        <div className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-[40px] border border-white/60 bg-white/60 backdrop-blur-[24px]">
          <div className="shrink-0 border-b border-slate-200/70 px-5 pb-4 pt-6">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-aura-ink">
              <Bookmark size={15} className="text-aura-amber-hover" /> Opgeslagen percelen
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-400">Snel verder waar je was</p>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
            {saved.map((f) => (
              <button
                key={f.id}
                onClick={() =>
                  onSelect({
                    id: f.parcel_id,
                    address: f.address!,
                    gemeente: f.gemeente_naam,
                  })
                }
                className="group flex w-full items-center gap-3 rounded-[16px] border border-slate-200/80 bg-white/70 px-3.5 py-3 text-left transition-colors hover:border-aura-amber/40 hover:bg-white"
              >
                <MapPin size={18} strokeWidth={1.8} className="shrink-0 text-aura-amber-hover" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-aura-ink">{f.address}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {f.gemeente_naam ?? 'Onbekende gemeente'}
                    {f.wijk_naam ? ` · ${f.wijk_naam}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Workspace (parcel selected) ───────────────────────────── */

function Workspace({
  parcel,
  onReset,
}: {
  parcel: SelectedParcel
  onReset: () => void
}) {
  const [input, setInput] = useState('')
  const chat = useChat()
  const navigate = useNavigate()
  const [creatingReport, setCreatingReport] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const contextPrefix = `Context: deze vraag gaat over het perceel ${parcel.address}${
    parcel.gemeente ? ` (gemeente ${parcel.gemeente})` : ''
  }. Beantwoord specifiek voor dit perceel.`

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || chat.isPending) return
      chat.send(trimmed, { contextPrefix })
      setInput('')
      setTimeout(() => inputRef.current?.focus(), 50)
    },
    [chat, contextPrefix],
  )

  // Non-saved parcel → resolve the PDOK address and hand off to the map, where
  // the proven lookup → report-generation flow lives.
  const createReport = useCallback(async () => {
    if (!parcel.pdokId || creatingReport) return
    setCreatingReport(true)
    try {
      const details = await lookupPdokAddress(parcel.pdokId)
      const postcode = details.postcode?.replace(/\s/g, '')
      if (!postcode || !details.huisnummer) {
        toast.error('Adres kon niet worden omgezet naar een perceel.')
        return
      }
      navigate({
        to: '/map',
        search: toMapAddressSearch({ postcode, huisnummer: details.huisnummer }),
      })
    } catch {
      toast.error('Adres opzoeken mislukt. Probeer het opnieuw.')
    } finally {
      setCreatingReport(false)
    }
  }, [parcel.pdokId, creatingReport, navigate])

  const isEmpty = chat.messages.length === 0

  return (
    <div className="flex h-full gap-4">
      {/* Chat shell */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[40px] border border-white/60 bg-[#FAFCFA]/80 backdrop-blur-[24px]">
        {/* Header — selected parcel chip (h-[72px] matches the sources panel header so the divider lines align) */}
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-slate-200/70 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-aura-amber/15 text-aura-amber-hover">
            <MapPin size={15} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-aura-ink">{parcel.address}</p>
            {parcel.gemeente && (
              <p className="truncate text-[11px] text-slate-400">{parcel.gemeente}</p>
            )}
          </div>
          <button
            onClick={onReset}
            aria-label="Ander perceel"
            title="Ander perceel"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-slate-400 transition-colors hover:border-aura-obsidian hover:text-aura-obsidian"
          >
            <X size={15} />
          </button>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          <div className="mx-auto flex h-full max-w-3xl flex-col">
            {isEmpty ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="show"
                className="-mt-6 flex flex-1 flex-col items-center justify-center text-center"
              >
                <h2 className="text-[20px] font-bold text-aura-ink">
                  Vraag alles over dit perceel
                </h2>
                <p className="mt-1 text-[13px] text-slate-500">
                  Antwoorden met bronnen uit Propdex.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {suggestionsFor(parcel.address).map((q) => (
                    <button
                      key={q}
                      onClick={() => submit(q)}
                      className="rounded-full border border-aura-amber/30 bg-aura-amber/[0.08] px-3.5 py-2 text-[12px] text-aura-amber-hover transition-colors hover:bg-aura-amber/15"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={staggerContainer}
                className="space-y-4 py-6"
              >
                {chat.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </motion.div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={() => submit(input)}
              disabled={chat.isPending}
              placeholder={`Vraag iets over ${parcel.address}…`}
              inputRef={inputRef}
            />
          </div>
        </div>
      </div>

      {/* Sources panel */}
      <ParcelSourcesPanel
        parcelId={parcel.id}
        onCreateReport={parcel.id ? undefined : createReport}
        creatingReport={creatingReport}
      />
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────── */

function VerkennerPage() {
  const [parcel, setParcel] = useState<SelectedParcel | null>(null)

  return (
    <div className="h-full">
      <AnimatePresence mode="wait">
        {parcel ? (
          // key forces a fresh chat (useChat state) per parcel selection
          <Workspace
            key={parcel.id ?? parcel.address}
            parcel={parcel}
            onReset={() => setParcel(null)}
          />
        ) : (
          <ParcelGate onSelect={setParcel} />
        )}
      </AnimatePresence>
    </div>
  )
}
