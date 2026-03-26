import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { ArrowLeft, Map, Search, Download, Heart, Loader2, FileText, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useIsMobile } from '@/hooks/useIsMobile'
import ResultsShell from '@/components/layout/ResultsShell'
import ResultsTable from '@/components/results/ResultsTable'
import { ParcelDetailModal } from '@/components/results/ParcelDetailModal'
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

  // If query_id is present, render Verkenner results
  if (query_id) {
    return <VerkennerResults queryId={query_id} />
  }

  const scans = scanHistoryData?.scans ?? []
  const activeScan = useMemo(
    () => scans.find((scan) => scan.scan_id === scan_id) ?? null,
    [scans, scan_id]
  )
  const recentScans = useMemo(() => scans.slice(0, 8), [scans])

  // Derive filters from URL search params (memoized to prevent re-render loops)
  const filters: ScanResultsFilters = useMemo(() => ({
    search: search.parcel_q?.trim() || undefined,
    sort_by: search.sort_by ?? 'score',
    sort_order: search.sort_order ?? 'desc',
    offset: (search.page ?? 0) * 50,
    limit: 50,
  }), [search.parcel_q, search.sort_by, search.sort_order, search.page])

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
    <ResultsShell fullWidth className="scrollbar-hidden">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Header bar */}
        <div className="shrink-0 rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-200 hover:text-aura-ink min-h-[44px]"
            >
              <ArrowLeft size={14} />
              Terug
            </button>
            <h1 className="text-lg font-semibold text-aura-ink">Scanresultaten</h1>
            {activeScan && (
              <p className="text-xs text-neutral-500">
                {dateFmt.format(new Date(activeScan.scan_date))} · {activeScan.status} · {activeScan.parcel_count} percelen
              </p>
            )}
          </div>
          <div className="mt-3 rounded-md border border-neutral-200 bg-aura-glass-white/40 p-2.5">
            <label htmlFor="parcel-search-results" className="sr-only">
              Zoek percelen
            </label>
            <SearchInput
              id="parcel-search-results"
              value={search.parcel_q ?? ''}
              onChange={(e) => handleParcelSearchChange(e.target.value)}
              placeholder="Zoek percelen (adres, perceelcode, status)"
              name="q_scan_results"
              leftIcon={<Search size={14} />}
              className="h-9 rounded-md border-neutral-300 bg-aura-glass-white/60 py-2 text-xs focus:border-aura-amber/50"
            />
            {recentScans.length > 0 && (
              <div className="scrollbar-hidden mt-2 max-h-36 space-y-1 overflow-auto">
                <p className="px-1 text-[11px] uppercase tracking-wide text-neutral-500">Recente scans</p>
                {recentScans.map((scan) => {
                  const isActive = scan.scan_id === scan_id
                  return (
                    <button
                      key={scan.scan_id}
                      onClick={() => handleOpenScan(scan.scan_id)}
                      className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? 'border-aura-amber/40 bg-aura-amber/10 text-aura-amber'
                          : 'border-neutral-200 bg-aura-glass-white/60 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      <span className="truncate">
                        {dateFmt.format(new Date(scan.scan_date))} · {scan.status} · {(scan.wijk_naam ?? scan.gemeente_naam)}
                      </span>
                      <span className="ml-2 shrink-0 tabular-nums text-[11px] text-neutral-500">
                        {scan.parcel_count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Mobile read-only banner — explains scan/export are desktop-only (MOB-01) */}
        {isMobile && (
          <div className="mt-3 rounded-md border border-aura-amber/30 bg-aura-amber/10 px-3 py-2 text-xs text-aura-amber shrink-0">
            Gebruik desktop voor scannen en exporteren
          </div>
        )}

        {scan_id ? (
          <>
            {/* Results table — fills remaining height */}
            <div className="mt-4 flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-aura-glass-white/60">
              <ResultsTable
                scanId={scan_id}
                filters={filters}
                onRowClick={(parcel) => setModalParcel(parcel)}
                onTotalChange={setTotal}
                onSortChange={handleSortChange}
                onPageChange={handlePageChange}
                currentPage={search.page ?? 0}
                onSelectionChange={setSelectedParcelIds}
                selectionKey={selectionKey}
              />
            </div>

            {/* Bulk action bar — appears when parcels are selected; hidden on mobile (checkboxes are hidden in card view) */}
            {!isMobile && (
              <BulkActionBar
                selectedCount={selectedParcelIds.length}
                onExport={() => {
                  const params = new URLSearchParams({
                    parcel_ids: selectedParcelIds.join(','),
                  })
                  window.open(
                    `/api/scans/${scan_id}/export/selection?${params.toString()}`,
                    '_blank',
                  )
                }}
                onClearSelection={() => {
                  setSelectedParcelIds([])
                  setSelectionKey((k) => k + 1)
                }}
              />
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Map size={32} />}
              title="Geen scan geselecteerd"
              description="Selecteer een scan op de kaart om resultaten te bekijken."
              action={{
                label: 'Naar kaart',
                onClick: () => navigate({ to: '/map' }),
              }}
            />
          </div>
        )}
      </div>

      {/* Parcel detail modal — always rendered for double-click support */}
      <ParcelDetailModal
        parcel={modalParcel}
        isOpen={!!modalParcel}
        onClose={() => setModalParcel(null)}
        onViewOnMap={
          scan_id && modalParcel
            ? () =>
                void navigate({
                  to: '/map',
                  search: {
                    scan_id,
                    parcel_id: modalParcel.parcel_id,
                    ...(modalParcel.address
                      ? { fallback_address: modalParcel.address }
                      : {}),
                    _t: Date.now(),
                  },
                })
            : undefined
        }
      />
    </ResultsShell>
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
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="shrink-0 rounded-2xl border border-neutral-200 bg-white px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate({ to: '/verkenner' })}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-[#0E1111] transition-colors min-h-[44px]"
            >
              <ArrowLeft size={14} />
              Verkenner
            </button>
            <h1 className="text-lg font-semibold text-[#0E1111]">Zoekresultaten</h1>
            {data && (
              <span className="text-xs text-neutral-500">
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
              className="h-9 rounded-md border-neutral-300 bg-white py-2 text-xs focus:border-amber-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
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
                  <tr className="border-b border-neutral-200 bg-[#F8FAF8]">
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
                          checked ? 'bg-amber-50/50' : 'hover:bg-[#F8FAF8]'
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
                        <td className="px-4 py-3 font-medium text-[#0E1111] whitespace-nowrap">{r.address || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums">{r.build_year ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                          {r.area_m2 != null ? `${r.area_m2.toLocaleString('nl-NL')} m²` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {r.bestemming ? (
                            <span className="inline-flex rounded-full bg-[#F2F6F3] px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
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
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="shrink-0 mt-3 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-[#0E1111]">
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
      </div>
    </ResultsShell>
  )
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
