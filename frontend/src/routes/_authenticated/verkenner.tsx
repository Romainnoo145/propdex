/**
 * Verkenner — AI-powered bulk parcel search.
 *
 * Two modes:
 * 1. Chat — conversation journal. User queries, assistant replies with
 *    parsed filters + count. Under threshold → clickable "Bekijk resultaten".
 *    Over threshold → refinement hint suggesting unused filter dimensions.
 * 2. Results — full-screen table view that slides in from the right.
 */

import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download, Clock, ArrowUp, ArrowLeft, Loader2,
  AlertTriangle, MessageSquare, X, Send, CheckCircle2,
  ChevronUp, ChevronDown, ChevronRight, Compass,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/useAuth'
import {
  useBulkQuery,
  useBulkQueryHistory,
  useBulkQueryDetail,
  useBulkRequest,
  getBulkQueryCsvUrl,
  type BulkResult,
  type BulkQueryResponse,
  type ParsedQuery,
} from '@/hooks/useBulkQuery'

/* ─── Route ─────────────────────────────────────────────────── */

export const Route = createFileRoute('/_authenticated/verkenner')({
  component: VerkennerPage,
})

/* ─── Constants ─────────────────────────────────────────────── */

const RESULT_THRESHOLD = 5000

/* ─── Animations ────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const messageIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
}

const slideIn = {
  hidden: { x: '100%', opacity: 0 },
  show: { x: 0, opacity: 1, transition: { type: 'spring', damping: 30, stiffness: 300 } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
}

/* ─── Types ─────────────────────────────────────────────────── */

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  response?: BulkQueryResponse
  requestSubmitted?: boolean
}

interface ActiveResultSet {
  queryId: string
  queryText: string
  results: BulkResult[]
  total: number
  parsed?: ParsedQuery | null
}

/* ─── Filter pills ──────────────────────────────────────────── */

const FILTER_LABELS: Record<string, string> = {
  municipality: 'Gemeente',
  build_year_min: 'Bouwjaar vanaf',
  build_year_max: 'Bouwjaar t/m',
  area_min: 'Opp. vanaf',
  area_max: 'Opp. t/m',
  bestemming: 'Bestemming',
  bestemming_exclude: 'Niet',
  pand_status: 'Pandstatus',
}

function ParsedFilterPills({ parsed, compact }: { parsed: ParsedQuery; compact?: boolean }) {
  const active = Object.entries(parsed).filter(([, v]) => v != null)
  if (active.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-2'}`}>
      {active.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full bg-[#0E1111]/5 px-2.5 py-0.5 text-[11px] font-medium text-[#0E1111]"
        >
          <span className="text-slate-400">{FILTER_LABELS[key] || key}:</span>
          {key.includes('area') ? `${value} m²` : String(value)}
        </span>
      ))}
    </div>
  )
}

/* ─── Refinement hints ──────────────────────────────────────── */

function getRefinementHints(parsed?: ParsedQuery | null): string[] {
  if (!parsed) return []
  const hints: string[] = []
  if (!parsed.municipality) hints.push('gemeente')
  if (parsed.build_year_min == null && parsed.build_year_max == null) hints.push('bouwjaar')
  if (parsed.area_min == null && parsed.area_max == null) hints.push('oppervlakte')
  if (!parsed.bestemming && !parsed.bestemming_exclude) hints.push('bestemming')
  if (!parsed.pand_status) hints.push('pandstatus')
  return hints
}

/* ─── Result Table ──────────────────────────────────────────── */

type SortableColumn = 'address' | 'build_year' | 'area_m2' | 'bestemming' | 'pand_status'
type SortDirection = 'asc' | 'desc'

const COLUMNS: { key: SortableColumn; label: string; numeric: boolean; className?: string }[] = [
  { key: 'address', label: 'Adres', numeric: false, className: 'min-w-[200px]' },
  { key: 'build_year', label: 'Bouwjaar', numeric: true, className: 'whitespace-nowrap' },
  { key: 'area_m2', label: 'Oppervlakte', numeric: true, className: 'whitespace-nowrap' },
  { key: 'bestemming', label: 'Bestemming', numeric: false, className: 'whitespace-nowrap' },
  { key: 'pand_status', label: 'Status', numeric: false, className: 'whitespace-nowrap' },
]

function ResultTable({ results, total }: { results: BulkResult[]; total: number }) {
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = useCallback((col: SortableColumn) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') setSortDirection('desc')
      else { setSortColumn(null); setSortDirection('asc') }
    } else {
      setSortColumn(col); setSortDirection('asc')
    }
  }, [sortColumn, sortDirection])

  const sortedResults = useMemo(() => {
    if (!sortColumn) return results
    return [...results].sort((a, b) => {
      const aVal = a[sortColumn], bVal = b[sortColumn]
      if ((aVal == null || aVal === '') && (bVal == null || bVal === '')) return 0
      if (aVal == null || aVal === '') return 1
      if (bVal == null || bVal === '') return -1
      const colDef = COLUMNS.find((c) => c.key === sortColumn)
      const cmp = colDef?.numeric ? (aVal as number) - (bVal as number) : String(aVal).localeCompare(String(bVal), 'nl')
      return sortDirection === 'desc' ? -cmp : cmp
    })
  }, [results, sortColumn, sortDirection])

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#EAEFEF] bg-white">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#EAEFEF] bg-[#F8FAF8]">
            {COLUMNS.map((col) => (
              <th key={col.key} onClick={() => handleSort(col.key)}
                className={`px-4 py-3 font-semibold text-slate-600 select-none cursor-pointer hover:text-[#0E1111] transition-colors ${col.className ?? ''}`}>
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortColumn === col.key && (sortDirection === 'asc'
                    ? <ChevronUp size={14} className="text-[#0E1111]" />
                    : <ChevronDown size={14} className="text-[#0E1111]" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <motion.tbody variants={staggerContainer} initial="hidden" animate="show">
          {sortedResults.map((r, i) => (
            <motion.tr key={r.parcel_id + i} variants={fadeUp}
              className="border-b border-[#EAEFEF] last:border-0 hover:bg-[#F8FAF8] transition-colors">
              <td className="px-4 py-3 text-[#0E1111] font-medium whitespace-nowrap">{r.address || '—'}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{r.build_year ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                {r.area_m2 != null ? `${r.area_m2.toLocaleString('nl-NL')} m²` : '—'}
              </td>
              <td className="px-4 py-3">
                {r.bestemming ? (
                  <span className="inline-flex items-center rounded-full bg-[#F2F6F3] px-2.5 py-0.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{r.bestemming}</span>
                ) : '—'}
              </td>
              <td className="px-4 py-3 text-slate-500 text-[12px] whitespace-nowrap">{r.pand_status || '—'}</td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
      {total > results.length && (
        <div className="px-4 py-2.5 text-[12px] text-slate-400 border-t border-[#EAEFEF] bg-[#F8FAF8]">
          {results.length} van {total.toLocaleString('nl-NL')} resultaten getoond (max 500)
        </div>
      )}
    </div>
  )
}

/* ─── Results View (slides in) ──────────────────────────────── */

function ResultsView({ data, onBack, onCsvDownload }: {
  data: ActiveResultSet; onBack: () => void; onCsvDownload: (id: string) => void
}) {
  return (
    <motion.div variants={slideIn} initial="hidden" animate="show" exit="exit"
      className="absolute inset-0 z-20 bg-[#FAFCFA] rounded-[40px] overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <button onClick={onBack}
              className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-[#0E1111] transition-colors mb-3">
              <ArrowLeft size={14} /> Terug naar chat
            </button>
            <h2 className="text-[20px] sm:text-[24px] font-bold text-[#0E1111] leading-tight">
              {data.total.toLocaleString('nl-NL')} resultaten
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">{data.queryText}</p>
            {data.parsed && <ParsedFilterPills parsed={data.parsed} />}
          </div>
          <button onClick={() => onCsvDownload(data.queryId)}
            className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] px-3.5 py-2 text-[12px] font-medium text-slate-600 hover:border-[#0E1111] hover:text-[#0E1111] transition-colors shrink-0 mt-8">
            <Download size={14} strokeWidth={2} /> CSV
          </button>
        </div>
        <ResultTable results={data.results} total={data.total} />
      </div>
    </motion.div>
  )
}

/* ─── User bubble ───────────────────────────────────────────── */

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div variants={messageIn} initial="hidden" animate="show" className="flex justify-end">
      <div className="rounded-2xl rounded-tr-md bg-[#0E1111] px-4 py-2.5 text-[13px] text-white leading-relaxed max-w-[80%] sm:max-w-[65%]">
        {text}
      </div>
    </motion.div>
  )
}

/* ─── Assistant card (compact — no table) ───────────────────── */

function AssistantCard({ message, onViewResults, onSubmitRequest }: {
  message: ChatMessage
  onViewResults: (msg: ChatMessage) => void
  onSubmitRequest: (id: string) => void
}) {
  const response = message.response
  if (!response) return null

  const isError = 'error' in response
  const isUnsupported = response.type === 'unsupported'
  const hasResults = response.results && response.results.length > 0
  const aboveThreshold = response.total > RESULT_THRESHOLD
  const hints = getRefinementHints(response.parsed)

  return (
    <motion.div variants={messageIn} initial="hidden" animate="show" className="max-w-[85%] sm:max-w-[70%] space-y-2">
      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3">
          <p className="text-[13px] text-red-700">{String((response as any).error)}</p>
        </div>
      )}

      {/* Unsupported */}
      {isUnsupported && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 space-y-2">
          <p className="text-[13px] text-amber-800">{response.reason}</p>
          {message.requestSubmitted ? (
            <div className="flex items-center gap-1.5 text-[12px] text-green-700">
              <CheckCircle2 size={14} /> <span>Aanvraag ingediend</span>
            </div>
          ) : (
            <button onClick={() => onSubmitRequest(message.id)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-amber-700 hover:text-amber-900 transition-colors">
              <Send size={12} /> Aanvraag indienen
            </button>
          )}
        </div>
      )}

      {/* Above threshold + hints available → refinement */}
      {hasResults && aboveThreshold && hints.length > 0 && (
        <div className="rounded-2xl border border-[#EAEFEF] border-l-amber-400 border-l-2 bg-white px-4 py-3 space-y-2">
          <span className="text-[14px] font-semibold text-[#0E1111]">
            {response.total.toLocaleString('nl-NL')} resultaten
          </span>
          {response.parsed && <ParsedFilterPills parsed={response.parsed} compact />}
          <p className="text-[12px] text-slate-400">
            Veel resultaten — verfijn op {hints.slice(0, 3).join(', ')}
          </p>
        </div>
      )}

      {/* Above threshold + no hints → all filters used, allow viewing */}
      {hasResults && aboveThreshold && hints.length === 0 && (
        <button onClick={() => onViewResults(message)}
          className="w-full text-left rounded-2xl border border-[#EAEFEF] border-l-amber-400 border-l-2 bg-white hover:border-[#0E1111]/20 hover:border-l-amber-500 px-4 py-3 transition-colors group">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[14px] font-semibold text-[#0E1111]">
                {response.total.toLocaleString('nl-NL')} resultaten
              </span>
              {response.parsed && <div className="mt-1.5"><ParsedFilterPills parsed={response.parsed} compact /></div>}
              <p className="text-[12px] text-slate-400 mt-1">Max 500 getoond</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0E1111] transition-colors shrink-0" />
          </div>
        </button>
      )}

      {/* Under threshold → clickable */}
      {hasResults && !aboveThreshold && (
        <button onClick={() => onViewResults(message)}
          className="w-full text-left rounded-2xl border border-[#EAEFEF] border-l-amber-400 border-l-2 bg-white hover:border-[#0E1111]/20 hover:border-l-amber-500 px-4 py-3 transition-colors group">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[14px] font-semibold text-[#0E1111]">
                {response.total.toLocaleString('nl-NL')} resultaten
              </span>
              {response.parsed && <div className="mt-1.5"><ParsedFilterPills parsed={response.parsed} compact /></div>}
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0E1111] transition-colors shrink-0" />
          </div>
        </button>
      )}
    </motion.div>
  )
}

/* ─── History Panel ─────────────────────────────────────────── */

function HistoryPanel({ onSelect, onClose }: {
  onSelect: (id: string, queryText: string) => void; onClose: () => void
}) {
  const { data, isLoading } = useBulkQueryHistory(0, 50)
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 340, opacity: 1, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } }}
      exit={{ width: 0, opacity: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } }}
      className="shrink-0 overflow-hidden h-full"
    >
      <div className="w-[340px] h-full overflow-y-auto bg-[#FAFCFA] rounded-[40px]">
        <div className="sticky top-0 bg-[#FAFCFA] px-5 pt-6 pb-3 border-b border-[#EAEFEF]">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#0E1111]">Geschiedenis</h3>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="px-3 py-3 space-y-0.5">
          {isLoading && (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
          )}
          {data?.queries.map((q) => (
            <button key={q.id} onClick={() => onSelect(q.id, q.query_text)}
              className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F2F6F3] transition-colors">
              <p className="text-[13px] text-[#0E1111] font-medium line-clamp-1">{q.query_text}</p>
              <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                {q.result_count} resultaten · {new Date(q.created_at).toLocaleDateString('nl-NL')}
              </p>
            </button>
          ))}
          {data && data.queries.length === 0 && (
            <p className="text-center py-8 text-[13px] text-slate-400">Nog geen queries</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Page ──────────────────────────────────────────────────── */

function VerkennerPage() {
  const [query, setQuery] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingQuery, setPendingQuery] = useState<string | null>(null)
  const [activeResultSet, setActiveResultSet] = useState<ActiveResultSet | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const { accessToken } = useAuth()

  const bulkQuery = useBulkQuery()
  const bulkRequest = useBulkRequest()

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [])
  useEffect(() => { scrollToBottom() }, [messages, pendingQuery, scrollToBottom])

  // History detail
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null)
  const historyDetail = useBulkQueryDetail(loadingHistoryId)
  useEffect(() => {
    if (loadingHistoryId && historyDetail.data && !historyDetail.isLoading) {
      const d = historyDetail.data
      setMessages((prev) => prev.map((m) =>
        m.id === `history-${loadingHistoryId}` && m.role === 'assistant'
          ? { ...m, response: { type: 'results' as const, query_id: d.id, results: d.results, total: d.result_count, parsed: d.parsed } }
          : m
      ))
      setLoadingHistoryId(null)
    }
  }, [loadingHistoryId, historyDetail.data, historyDetail.isLoading])

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim()
    if (!trimmed || bulkQuery.isPending) return
    const ts = Date.now()
    setMessages((prev) => [...prev, { id: `user-${ts}`, role: 'user', text: trimmed }])
    setPendingQuery(trimmed)
    setQuery('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    bulkQuery.mutate(trimmed, {
      onSuccess: (data) => {
        setMessages((prev) => [...prev, { id: `assistant-${ts}`, role: 'assistant', text: trimmed, response: data }])
        setPendingQuery(null)
      },
      onError: (error) => {
        setMessages((prev) => [...prev, {
          id: `assistant-${ts}`, role: 'assistant', text: trimmed,
          response: { type: 'results' as const, query_id: '', results: [], total: 0, error: error.message || 'Er ging iets mis.' } as any,
        }])
        setPendingQuery(null)
      },
    })
  }, [query, bulkQuery])

  const handleHistorySelect = useCallback((id: string, queryText: string) => {
    setShowHistory(false)
    setMessages((prev) => [
      ...prev,
      { id: `history-user-${id}`, role: 'user', text: queryText },
      { id: `history-${id}`, role: 'assistant', text: queryText },
    ])
    setLoadingHistoryId(id)
  }, [])

  const handleViewResults = useCallback((msg: ChatMessage) => {
    if (!msg.response?.results?.length) return
    setActiveResultSet({
      queryId: msg.response.query_id, queryText: msg.text,
      results: msg.response.results, total: msg.response.total, parsed: msg.response.parsed,
    })
  }, [])

  const handleSubmitRequest = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg?.response) return
    bulkRequest.mutate(msg.response.reason ?? 'Niet-ondersteunde query', {
      onSuccess: () => {
        setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, requestSubmitted: true } : m))
        toast.success('Aanvraag ingediend', { description: 'We nemen contact op wanneer de resultaten beschikbaar zijn.' })
      },
      onError: () => toast.error('Aanvraag kon niet worden ingediend'),
    })
  }, [messages, bulkRequest])

  const handleCsvDownload = useCallback(async (queryId: string) => {
    if (!queryId || !accessToken) return
    try {
      const res = await fetch(getBulkQueryCsvUrl(queryId), { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) { console.error(`CSV download failed: ${res.status}`); toast.error('CSV download mislukt'); return }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const filename = disposition?.match(/filename="?([^";\n]+)"?/)?.[1] ?? 'verkenner-resultaten.csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error('CSV download error:', err); toast.error('CSV download mislukt') }
  }, [accessToken])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }, [handleSubmit])

  const handleInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [])

  const hasMessages = messages.length > 0

  /* ─── Shared composer ─────────────────────────────── */
  const composer = (
    <div className="relative">
      <button onClick={() => setShowHistory(!showHistory)} title="Geschiedenis"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#0E1111] transition-colors">
        <Clock size={18} strokeWidth={1.5} />
      </button>
      <textarea ref={inputRef} value={query}
        onChange={(e) => { setQuery(e.target.value); handleInput() }}
        onKeyDown={handleKeyDown}
        placeholder="Bijv. woningen in Amsterdam met bouwjaar na 2000"
        rows={1} disabled={bulkQuery.isPending}
        className="w-full min-h-[48px] max-h-[120px] resize-none rounded-2xl border border-[#EAEFEF] bg-white pl-11 pr-12 py-3 text-[14px] text-[#0E1111] placeholder:text-slate-300 focus:outline-none focus:border-slate-300 transition-colors leading-relaxed"
      />
      <button onClick={handleSubmit} disabled={!query.trim() || bulkQuery.isPending}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#0E1111] text-white disabled:opacity-20 hover:bg-[#0E1111]/80 transition-colors">
        {bulkQuery.isPending ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={15} strokeWidth={2} />}
      </button>
    </div>
  )

  return (
    <div className="h-full flex gap-3 pb-14 md:pb-0">
      {/* ── History shell ────────────────────────────── */}
      <AnimatePresence>
        {showHistory && <HistoryPanel onSelect={handleHistorySelect} onClose={() => setShowHistory(false)} />}
      </AnimatePresence>

      {/* ── Main shell ───────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full overflow-hidden bg-[#FAFCFA] rounded-[40px] relative">
        <div className="h-full flex flex-col px-4 sm:px-6 py-6 mx-auto max-w-3xl">

          {/* Thread */}
          <div ref={threadRef} className="flex-1 overflow-y-auto min-h-0 pb-4">
            {!hasMessages && !pendingQuery ? (
              /* ── Empty state ─────────────────────────── */
              <div className="flex flex-col items-center justify-center h-full text-center pb-6">
                <Compass size={40} className="text-amber-500 mb-5" strokeWidth={1.5} />
                <h1 className="text-[36px] sm:text-[48px] md:text-[56px] font-black leading-none tracking-tighter text-[#0E1111]">
                  Verkenner
                </h1>
                <p className="mt-2 text-[13px] text-slate-400 max-w-sm">
                  Zoek in het Nederlands op de kadaster-database
                </p>
                <div className="mt-6 w-full max-w-xl">{composer}</div>
              </div>
            ) : (
              /* ── Message thread ──────────────────────── */
              <div className="space-y-4 pt-2">
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <UserBubble key={msg.id} text={msg.text} />
                  ) : (
                    <AssistantCard key={msg.id} message={msg}
                      onViewResults={handleViewResults} onSubmitRequest={handleSubmitRequest} />
                  ),
                )}

                {/* Loading skeleton */}
                {pendingQuery && (
                  <motion.div variants={messageIn} initial="hidden" animate="show" className="max-w-[85%] sm:max-w-[70%]">
                    <div className="rounded-2xl border border-[#EAEFEF] border-l-amber-400 border-l-2 bg-white px-4 py-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-slate-300" />
                        <div className="h-4 w-28 rounded bg-slate-100 animate-pulse" />
                      </div>
                      <div className="flex gap-1.5">
                        <div className="h-5 w-24 rounded-full bg-slate-100 animate-pulse" />
                        <div className="h-5 w-20 rounded-full bg-slate-100 animate-pulse" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* History loading */}
                {loadingHistoryId && historyDetail.isLoading && (
                  <motion.div variants={messageIn} initial="hidden" animate="show">
                    <div className="flex items-center gap-2 text-slate-400 py-2">
                      <Loader2 size={14} className="animate-spin" />
                      <span className="text-[13px]">Laden…</span>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Bottom composer (only in conversation mode) */}
          {(hasMessages || pendingQuery) && (
            <div className="shrink-0 pt-3 pb-3">{composer}</div>
          )}
        </div>

        {/* ── Results overlay ─────────────────────────── */}
        <AnimatePresence>
          {activeResultSet && (
            <ResultsView data={activeResultSet} onBack={() => setActiveResultSet(null)} onCsvDownload={handleCsvDownload} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
