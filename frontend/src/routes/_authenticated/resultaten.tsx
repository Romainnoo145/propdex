import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { ArrowLeft, Map, Search, Download, Heart, Loader2, FileText, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/useIsMobile'
import ResultsShell from '@/components/layout/ResultsShell'
import ResultsTable from '@/components/results/ResultsTable'
import { ParcelDetailPanel } from '@/components/map/panels/ParcelDetailPanel'
import { BulkActionBar } from '@/components/results/BulkActionBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import { SearchInput } from '@/components/primitives'
import { useScanHistory } from '@/hooks/useScans'
import { useBulkQueryDetail } from '@/hooks/useBulkQuery'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { ScanResultsFilters, ScanResultItem } from '@/lib/types/scan'

interface ResultatenSearchParams {
  scan_id?: string
  query_id?: string // Verkenner bulk query results
  highlight?: string // parcel_id to highlight (from bekendmaking link)
  parcel_q?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
}

export const Route = createFileRoute('/_authenticated/resultaten')({
  component: ResultatenPage,
  validateSearch: (search: Record<string, unknown>): ResultatenSearchParams => ({
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
    query_id: typeof search.query_id === 'string' ? search.query_id : undefined,
    highlight: typeof search.highlight === 'string' ? search.highlight : undefined,
    parcel_q: typeof search.parcel_q === 'string' ? search.parcel_q : undefined,
    sort_by: typeof search.sort_by === 'string' ? search.sort_by : undefined,
    sort_order:
      search.sort_order === 'asc' || search.sort_order === 'desc'
        ? search.sort_order
        : undefined,
    page: typeof search.page === 'number' ? search.page : undefined,
  }),
})

function ResultatenPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { data: scanHistoryData } = useScanHistory({ limit: 200 })
  const [, setTotal] = useState(0)
  const [modalParcel, setModalParcel] = useState<ScanResultItem | null>(null)
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([])
  const [selectionKey, setSelectionKey] = useState(0)

  const isMobile = useIsMobile()

  const { scan_id, query_id } = search

  const scans = scanHistoryData?.scans ?? []
  const activeScan = useMemo(
    () => scans.find((scan) => scan.scan_id === scan_id) ?? null,
    [scans, scan_id]
  )
  const recentScans = useMemo(() => {
    const sorted = [...scans].sort((a, b) => {
      // Extract wijk number from "Wijk XX ..." for natural sort
      const numA = parseInt(a.wijk_naam?.match(/\d+/)?.[0] ?? '999')
      const numB = parseInt(b.wijk_naam?.match(/\d+/)?.[0] ?? '999')
      return numA - numB
    })
    // Move active scan to front
    if (scan_id) {
      const idx = sorted.findIndex((s) => s.scan_id === scan_id)
      if (idx > 0) {
        const [active] = sorted.splice(idx, 1)
        sorted.unshift(active)
      }
    }
    return sorted.slice(0, 20)
  }, [scans, scan_id])

  // Derive filters from URL search params (memoized to prevent re-render loops)
  const filters: ScanResultsFilters = useMemo(() => ({
    search: search.parcel_q?.trim() || undefined,
    sort_by: search.sort_by ?? 'score',
    sort_order: search.sort_order ?? 'desc',
    offset: (search.page ?? 0) * 50,
    limit: 50,
  }), [search.parcel_q, search.sort_by, search.sort_order, search.page])

  // If query_id is present, render Verkenner results
  if (query_id) {
    return <VerkennerResults queryId={query_id} />
  }

  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    void navigate({
      to: '/resultaten',
      search: (prev) => ({
        ...prev,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: 0, // Reset page on sort change
      }),
    })
  }

  const handlePageChange = (page: number) => {
    void navigate({
      to: '/resultaten',
      search: (prev) => ({ ...prev, page }),
    })
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    void navigate({ to: '/opgeslagen' })
  }

  const handleOpenScan = (nextScanId: string) => {
    void navigate({
      to: '/resultaten',
      search: (prev) => ({
        ...prev,
        scan_id: nextScanId,
        page: 0,
      }),
    })
  }

  const handleParcelSearchChange = (value: string) => {
    void navigate({
      to: '/resultaten',
      search: (prev) => ({
        ...prev,
        parcel_q: value.trim() ? value : undefined,
        page: 0,
      }),
      replace: true,
    })
  }

  return (
    <div className="flex h-full">
      {/* ── Results shell (shrinks when detail opens) ── */}
      <div className="flex-1 min-w-[500px] h-full overflow-hidden rounded-[40px] bg-[#FAFCFA] pb-14 md:pb-0 flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="shrink-0 pt-6 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Scanresultaten
                </p>
                {activeScan ? (
                  <>
                    <h1 className="text-[40px] font-black tracking-tighter text-[#0E1111] leading-none tabular-nums">
                      {activeScan.parcel_count.toLocaleString('nl-NL')}
                    </h1>
                    <p className="text-[13px] text-slate-500 mt-1">
                      percelen in {activeScan.wijk_naam ?? activeScan.gemeente_naam}
                    </p>
                  </>
                ) : (
                  <h1 className="text-[32px] font-black tracking-tight text-[#0E1111] leading-none">Selecteer een scan</h1>
                )}
              </div>
            </div>

            <SearchInput
              id="parcel-search-results"
              value={search.parcel_q ?? ''}
              onChange={(e) => handleParcelSearchChange(e.target.value)}
              placeholder="Zoek percelen (adres, perceelcode, status)"
              name="q_scan_results"
              leftIcon={<Search size={14} />}
              className="h-[44px] rounded-full border-[#EAEFEF] bg-[#F2F6F3] py-2 text-[13px] text-[#0E1111] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#F9A826]/30"
            />

            {recentScans.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hidden">
                {recentScans.map((scan) => {
                  const isActive = scan.scan_id === scan_id
                  return (
                    <button
                      key={scan.scan_id}
                      onClick={() => handleOpenScan(scan.scan_id)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#0E1111] text-white'
                          : 'bg-white border border-[#EAEFEF] text-slate-600 hover:border-[#0E1111] hover:text-[#0E1111]'
                      }`}
                    >
                      {scan.wijk_naam ?? scan.gemeente_naam}
                      <span className="ml-1.5 tabular-nums text-[10px] opacity-60">{scan.parcel_count.toLocaleString('nl-NL')}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {isMobile && (
            <div className="shrink-0 mb-3 rounded-full border border-[#F9A826]/30 bg-[#F9A826]/10 px-4 py-2 text-xs text-[#F9A826]">
              Gebruik desktop voor scannen en exporteren
            </div>
          )}

          {scan_id ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-[#EAEFEF] bg-white">
                <ResultsTable
                  scanId={scan_id}
                  filters={filters}
                  onRowClick={(parcel) => setModalParcel(parcel)}
                  onViewOnMap={(parcel) => {
                    void navigate({
                      to: '/map',
                      search: {
                        scan_id,
                        parcel_id: parcel.parcel_id,
                        ...(parcel.address ? { fallback_address: parcel.address } : {}),
                        _t: Date.now(),
                      },
                    })
                  }}
                  onTotalChange={setTotal}
                  onSortChange={handleSortChange}
                  onPageChange={handlePageChange}
                  currentPage={search.page ?? 0}
                  onSelectionChange={setSelectedParcelIds}
                  selectionKey={selectionKey}
                />
              </div>
              {!isMobile && (
                <BulkActionBar
                  selectedCount={selectedParcelIds.length}
                  onExport={() => {
                    const params = new URLSearchParams({ parcel_ids: selectedParcelIds.join(',') })
                    window.open(`/api/scans/${scan_id}/export/selection?${params.toString()}`, '_blank')
                  }}
                  onClearSelection={() => { setSelectedParcelIds([]); setSelectionKey((k) => k + 1) }}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<Map size={32} />}
                title="Geen scan geselecteerd"
                description="Selecteer een scan hierboven om resultaten te bekijken."
                action={{ label: 'Naar kaart', onClick: () => navigate({ to: '/map' }) }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel (flex sibling, pushes table) ── */}
      {modalParcel && (
        <div className="shrink-0 h-full w-[420px] overflow-y-auto rounded-[40px] bg-white border border-white/20 ml-4">
          <ParcelDetailPanel
            parcel={modalParcel}
            onClose={() => setModalParcel(null)}
            gemeenteNaam={activeScan?.gemeente_naam}
            wijkNaam={activeScan?.wijk_naam}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Verkenner Query Results ─────────────────────────────────── */

const FILTER_LABELS: Record<string, string> = {
  municipality: 'Gemeente',
  build_year_min: 'Bouwjaar vanaf',
  build_year_max: 'Bouwjaar t/m',
  area_min: 'Opp. vanaf',
  area_max: 'Opp. t/m',
  bestemming: 'Bestemming',
  bestemming_exclude: 'Niet',
  pand_status: 'Status',
}

function VerkennerResults({ queryId }: { queryId: string }) {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const { data, isLoading, error } = useBulkQueryDetail(queryId)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ created: number; existing: number; failed: number }>('/api/parcels/favorites/bulk', {
        method: 'POST',
        body: JSON.stringify({ parcel_ids: Array.from(selectedIds) }),
        accessToken,
      }),
    onSuccess: (resp) => {
      if (resp.created > 0) {
        toast.success(`${resp.created} ${resp.created === 1 ? 'perceel' : 'percelen'} opgeslagen`)
      } else {
        toast.info('Alle geselecteerde percelen waren al opgeslagen')
      }
    },
    onError: () => toast.error('Opslaan mislukt'),
  })

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- manual memo deps are correct; compiler can't infer optional chaining
  const filteredResults = useMemo(() => {
    if (!data?.results) return []
    if (!searchFilter.trim()) return data.results
    const q = searchFilter.toLowerCase()
    return data.results.filter(r =>
      (r.address?.toLowerCase().includes(q)) ||
      (r.parcel_id?.toLowerCase().includes(q)) ||
      (r.bestemming?.toLowerCase().includes(q))
    )
  }, [data?.results, searchFilter])

  const allSelected = filteredResults.length > 0 && filteredResults.every(r => selectedIds.has(r.parcel_id))

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredResults.map(r => r.parcel_id)))
    }
  }

  const handleCsvExport = () => {
    const rows = filteredResults.filter(r => selectedIds.size === 0 || selectedIds.has(r.parcel_id))
    const header = 'Perceel ID,Adres,Bouwjaar,Oppervlakte,Bestemming,Status\n'
    const csv = header + rows.map(r =>
      `"${r.parcel_id}","${r.address || ''}","${r.build_year ?? ''}","${r.area_m2 ?? ''}","${r.bestemming || ''}","${r.pand_status || ''}"`
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verkenner-${queryId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV gedownload')
  }

  return (
    <ResultsShell fullWidth className="scrollbar-hidden">
      <motion.div
        className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="shrink-0 rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate({ to: '/verkenner' })}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-aura-obsidian transition-colors min-h-[44px]"
            >
              <ArrowLeft size={14} />
              Verkenner
            </button>
            <h1 className="text-lg font-semibold text-aura-obsidian" style={{ textWrap: 'balance' }}>Zoekresultaten</h1>
            {data && (
              <span className="text-xs text-neutral-500 tabular-nums">
                {data.result_count.toLocaleString('nl-NL')} resultaten
              </span>
            )}
          </div>

          {/* Filter pills */}
          {data?.parsed && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(data.parsed)
                .filter(([, v]) => v != null)
                .map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-800"
                  >
                    {FILTER_LABELS[key] || key}: {key.includes('area') ? `${value} m²` : String(value)}
                  </span>
                ))}
            </div>
          )}

          {/* Search within results */}
          <div className="mt-3">
            <SearchInput
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter op adres, perceelcode..."
              name="q_verkenner_results"
              leftIcon={<Search size={14} />}
              className="h-9 rounded-md border-neutral-300 bg-aura-glass-white/60 py-2 text-xs focus:border-aura-amber/50"
            />
          </div>
        </motion.div>

        {/* Table */}
        <motion.div variants={fadeUp} className="mt-4 flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-aura-glass-white/60">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-amber-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-red-600">Resultaten laden mislukt</p>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-neutral-200 bg-aura-canvas">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600 min-w-[250px]">Adres</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Bouwjaar</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Oppervlakte</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Bestemming</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r) => {
                    const checked = selectedIds.has(r.parcel_id)
                    return (
                      <tr
                        key={r.parcel_id}
                        onClick={() => toggleOne(r.parcel_id)}
                        className={`border-b border-neutral-100 last:border-0 cursor-pointer transition-colors ${
                          checked ? 'bg-amber-50/50' : 'hover:bg-aura-canvas'
                        }`}
                      >
                        <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(r.parcel_id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-aura-obsidian whitespace-nowrap">{r.address || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{r.build_year ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                          {r.area_m2 != null ? `${r.area_m2.toLocaleString('nl-NL')} m²` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {r.bestemming ? (
                            <span className="inline-flex rounded-full bg-aura-canvas px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                              {r.bestemming}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[12px]">{r.pand_status || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredResults.length === 0 && !isLoading && (
                <div className="py-12 text-center text-sm text-slate-400">
                  Geen resultaten{searchFilter ? ' voor deze zoekopdracht' : ''}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="shrink-0 mt-3 flex items-center justify-between rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-aura-obsidian">
                {selectedIds.size} {selectedIds.size === 1 ? 'perceel' : 'percelen'}
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline"
              >
                Deselecteren
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} />}
                Opslaan
              </button>
              <button
                onClick={() => toast.info('Rapport genereren wordt binnenkort beschikbaar')}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-amber-400 hover:text-amber-700 transition-colors"
              >
                <FileText size={14} />
                Rapport
              </button>
              <button
                onClick={() => toast.info('Contact zoeken wordt binnenkort beschikbaar')}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-amber-400 hover:text-amber-700 transition-colors"
              >
                <Users size={14} />
                Contact
              </button>
              <button
                onClick={handleCsvExport}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-amber-400 hover:text-amber-700 transition-colors"
              >
                <Download size={14} />
                CSV
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </ResultsShell>
  )
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
