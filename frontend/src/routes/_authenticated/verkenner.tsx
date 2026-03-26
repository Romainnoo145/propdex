/**
 * Verkenner — AI-powered bulk parcel search with chat composer and result table.
 *
 * Chat-style interface: type a natural language query, get a structured result table.
 * History toggle shows past queries. CSV export per result set.
 * Unsupported queries offer "aanvraag indienen" flow.
 */

import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Download, Clock, ArrowRight, Loader2,
  AlertTriangle, MessageSquare, Table2, X, Send, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import ResultsShell from '@/components/layout/ResultsShell'
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

/* ─── Animations ────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

/* ─── Parsed filter pills ───────────────────────────────────── */

const FILTER_LABELS: Record<string, string> = {
  municipality: 'Gemeente',
  build_year_min: 'Bouwjaar vanaf',
  build_year_max: 'Bouwjaar t/m',
  area_min: 'Opp. vanaf',
  area_max: 'Opp. t/m',
  bestemming: 'Bestemming',
  pand_status: 'Pandstatus',
}

function ParsedFilterPills({ parsed }: { parsed: ParsedQuery }) {
  const active = Object.entries(parsed).filter(([, v]) => v != null)
  if (active.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
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

/* ─── Loading skeleton ──────────────────────────────────────── */

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEFEF] bg-white">
      <div className="border-b border-[#EAEFEF] bg-[#F8FAF8] px-4 py-3 flex gap-6">
        {['w-32', 'w-20', 'w-24', 'w-24', 'w-28'].map((w, i) => (
          <div key={i} className={`h-4 ${w} rounded bg-slate-200 animate-pulse`} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border-b border-[#EAEFEF] last:border-0 px-4 py-3.5 flex gap-6">
          <div className="h-3.5 w-48 rounded bg-slate-100 animate-pulse" />
          <div className="h-3.5 w-14 rounded bg-slate-100 animate-pulse" />
          <div className="h-3.5 w-16 rounded bg-slate-100 animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-3.5 w-24 rounded bg-slate-100 animate-pulse" />
        </div>
      ))}
    </div>
  )
}

/* ─── Result Table ──────────────────────────────────────────── */

function ResultTable({ results, total }: { results: BulkResult[]; total: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#EAEFEF] bg-white">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#EAEFEF] bg-[#F8FAF8]">
            <th className="px-4 py-3 font-semibold text-slate-600 min-w-[200px]">Adres</th>
            <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Bouwjaar</th>
            <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Oppervlakte</th>
            <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Bestemming</th>
            <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <motion.tbody variants={staggerContainer} initial="hidden" animate="show">
          {results.map((r, i) => (
            <motion.tr
              key={r.parcel_id + i}
              variants={fadeUp}
              className="border-b border-[#EAEFEF] last:border-0 hover:bg-[#F8FAF8] transition-colors"
            >
              <td className="px-4 py-3 text-[#0E1111] font-medium whitespace-nowrap">{r.address || '—'}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums">{r.build_year ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                {r.area_m2 != null ? `${r.area_m2.toLocaleString('nl-NL')} m²` : '—'}
              </td>
              <td className="px-4 py-3">
                {r.bestemming ? (
                  <span className="inline-flex items-center rounded-full bg-[#F2F6F3] px-2.5 py-0.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">
                    {r.bestemming}
                  </span>
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

/* ─── History Panel ─────────────────────────────────────────── */

function HistoryPanel({
  onSelect,
  onClose,
}: {
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const { data, isLoading } = useBulkQueryHistory(0, 50)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute left-0 top-0 bottom-0 w-80 max-w-[calc(100vw-4rem)] bg-white border-r border-[#EAEFEF] rounded-l-[40px] z-10 overflow-y-auto"
    >
      <div className="sticky top-0 bg-white px-5 pt-6 pb-3 border-b border-[#EAEFEF]">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#0E1111]">Geschiedenis</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="px-3 py-3 space-y-1">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        )}
        {data?.queries.map((q) => (
          <button
            key={q.id}
            onClick={() => onSelect(q.id)}
            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#F2F6F3] transition-colors group"
          >
            <p className="text-[13px] text-[#0E1111] font-medium line-clamp-1 group-hover:text-[#0E1111]">
              {q.query_text}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="tabular-nums">{q.result_count} resultaten</span>
              <span>·</span>
              <span>{new Date(q.created_at).toLocaleDateString('nl-NL')}</span>
              {q.status === 'unsupported' && (
                <>
                  <span>·</span>
                  <span className="text-amber-500">niet ondersteund</span>
                </>
              )}
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
    </motion.div>
  )
}

/* ─── Page ──────────────────────────────────────────────────── */

function VerkennerPage() {
  const [query, setQuery] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [activeResult, setActiveResult] = useState<BulkQueryResponse | null>(null)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { accessToken } = useAuth()

  const bulkQuery = useBulkQuery()
  const historyDetail = useBulkQueryDetail(selectedHistoryId)
  const bulkRequest = useBulkRequest()

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim()
    if (!trimmed || bulkQuery.isPending) return
    setSelectedHistoryId(null)
    setRequestSubmitted(false)
    bulkQuery.mutate(trimmed, {
      onSuccess: (data) => {
        setActiveResult(data)
        setQuery('')
      },
    })
  }, [query, bulkQuery])

  const handleHistorySelect = useCallback((id: string) => {
    setSelectedHistoryId(id)
    setActiveResult(null)
    setShowHistory(false)
    setRequestSubmitted(false)
  }, [])

  const handleSubmitRequest = useCallback(() => {
    if (!activeResult || requestSubmitted) return
    const queryText = activeResult.reason
      ? `${activeResult.reason}`
      : 'Niet-ondersteunde query'
    bulkRequest.mutate(queryText, {
      onSuccess: () => {
        setRequestSubmitted(true)
        toast.success('Aanvraag ingediend', {
          description: 'We nemen contact op wanneer de resultaten beschikbaar zijn.',
        })
      },
      onError: () => {
        toast.error('Aanvraag kon niet worden ingediend')
      },
    })
  }, [activeResult, requestSubmitted, bulkRequest])

  // Show history detail when loaded
  const displayResults = selectedHistoryId && historyDetail.data
    ? historyDetail.data.results
    : activeResult?.results ?? []

  const displayTotal = selectedHistoryId && historyDetail.data
    ? historyDetail.data.result_count
    : activeResult?.total ?? 0

  const displayQueryText = selectedHistoryId && historyDetail.data
    ? historyDetail.data.query_text
    : activeResult?.type === 'results'
      ? query || 'Query'
      : null

  const displayParsed = selectedHistoryId && historyDetail.data
    ? historyDetail.data.parsed
    : activeResult?.parsed

  const currentQueryId = selectedHistoryId ?? activeResult?.query_id ?? null

  const handleCsvDownload = useCallback(async () => {
    if (!currentQueryId || !accessToken) return
    try {
      const res = await fetch(getBulkQueryCsvUrl(currentQueryId), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error(`CSV download failed: ${res.status}`)
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="?([^";\n]+)"?/)
      const filename = filenameMatch?.[1] ?? 'verkenner-resultaten.csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Verkenner] CSV download error:', err)
    }
  }, [currentQueryId, accessToken])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const isUnsupported = activeResult?.type === 'unsupported'
  const hasResults = displayResults.length > 0
  const isLoading = bulkQuery.isPending || historyDetail.isLoading
  const showEmpty = !hasResults && !isLoading && !isUnsupported && !bulkQuery.isError

  return (
    <ResultsShell>
      <div className="relative mx-auto max-w-5xl min-h-full flex flex-col">

        <AnimatePresence>
          {showHistory && (
            <HistoryPanel onSelect={handleHistorySelect} onClose={() => setShowHistory(false)} />
          )}
        </AnimatePresence>

        {/* ── Hero ─────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p
            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            AI Verkenner
          </p>
          <h1 className="mt-1 text-[32px] sm:text-[40px] font-black leading-none tracking-tight text-[#0E1111]">
            Bulk zoeken
          </h1>
          <p className="mt-2 text-[13px] sm:text-[14px] text-slate-500 max-w-lg">
            Stel een vraag in het Nederlands en krijg direct resultaten uit de kadaster-database.
            Zoek op gemeente, bouwjaar, oppervlakte, bestemming of pandstatus.
          </p>
        </motion.div>

        {/* ── Composer ─────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-5 sm:mt-6"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border border-[#EAEFEF] text-slate-400 hover:text-[#0E1111] hover:border-[#0E1111] transition-colors"
              title="Geschiedenis"
            >
              <Clock size={18} strokeWidth={2} />
            </button>
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Bijv. 'Alle woningen in Venlo met bouwjaar voor 1970'"
                className="w-full h-10 sm:h-11 rounded-full border border-[#EAEFEF] bg-white pl-4 pr-12 text-[13px] sm:text-[14px] text-[#0E1111] placeholder:text-slate-400 focus:outline-none focus:border-[#0E1111] transition-colors"
                disabled={bulkQuery.isPending}
              />
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || bulkQuery.isPending}
                className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#0E1111] text-white disabled:opacity-30 hover:bg-[#0E1111]/80 transition-colors"
              >
                {bulkQuery.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Error state ──────────────────────────────────── */}
        {bulkQuery.isError && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 sm:px-5 py-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-red-700">Query mislukt</p>
                <p className="mt-0.5 text-[12px] text-red-600">{bulkQuery.error?.message || 'Er ging iets mis. Probeer het opnieuw.'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Unsupported state + aanvraag ─────────────────── */}
        {isUnsupported && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 sm:px-5 py-4">
              <div className="flex items-start gap-3">
                <MessageSquare size={18} className="text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-amber-800">Niet ondersteund</p>
                  <p className="mt-0.5 text-[12px] text-amber-700">{activeResult?.reason}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-200">
                {requestSubmitted ? (
                  <div className="flex items-center gap-2 text-[12px] text-green-700">
                    <CheckCircle2 size={16} />
                    <span className="font-medium">Aanvraag ingediend — we nemen contact op</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitRequest}
                    disabled={bulkRequest.isPending}
                    className="flex items-center gap-1.5 rounded-full bg-amber-600 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    {bulkRequest.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    Aanvraag indienen
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Loading skeleton ─────────────────────────────── */}
        {isLoading && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-6">
            <div className="flex items-center gap-3 mb-3 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[13px]">Resultaten ophalen…</span>
            </div>
            <TableSkeleton />
          </motion.div>
        )}

        {/* ── Results ──────────────────────────────────────── */}
        {hasResults && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-6 flex-1">
            {/* Result header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Table2 size={16} className="text-slate-400" />
                  <span className="text-[13px] font-semibold text-[#0E1111]">
                    {displayTotal.toLocaleString('nl-NL')} resultaten
                  </span>
                  {displayQueryText && (
                    <span className="text-[12px] text-slate-400 hidden sm:inline">· {displayQueryText}</span>
                  )}
                </div>
                {displayParsed && <ParsedFilterPills parsed={displayParsed} />}
              </div>
              {currentQueryId && (
                <button
                  onClick={handleCsvDownload}
                  className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-[#0E1111] hover:text-[#0E1111] transition-colors self-start sm:self-auto"
                >
                  <Download size={14} strokeWidth={2} />
                  CSV
                </button>
              )}
            </div>
            <ResultTable results={displayResults} total={displayTotal} />
          </motion.div>
        )}

        {/* ── Empty state ──────────────────────────────────── */}
        {showEmpty && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-12 sm:mt-16 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F2F6F3]">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="mt-4 text-[14px] font-medium text-[#0E1111]">Stel een vraag</p>
            <p className="mt-1 text-[13px] text-slate-400 max-w-sm">
              Typ een zoekopdracht in het Nederlands, bijv. "Bedrijfspanden groter dan 500m² in Amsterdam"
            </p>
          </motion.div>
        )}

        {/* Footer spacer for mobile bottom nav */}
        <div className="h-16 sm:h-8" />
      </div>
    </ResultsShell>
  )
}
