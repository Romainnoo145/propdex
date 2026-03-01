import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { ArrowLeft, Map, Search } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import ResultsShell from '@/components/layout/ResultsShell'
import ResultsTable from '@/components/results/ResultsTable'
import { ParcelDetailModal } from '@/components/results/ParcelDetailModal'
import { BulkActionBar } from '@/components/results/BulkActionBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import { SearchInput } from '@/components/primitives'
import { useScanHistory } from '@/hooks/useScans'
import type { ScanResultsFilters, ScanResultItem } from '@/lib/types/scan'

interface ResultatenSearchParams {
  scan_id?: string
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

  const { scan_id } = search
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
    void navigate({ to: '/projecten' })
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
        <div className="shrink-0 rounded-2xl border border-overlay/[0.08] bg-grey-900 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-md border border-overlay/5 px-3 py-1.5 text-xs font-medium text-grey-400 transition-colors hover:border-overlay/10 hover:text-grey-200 min-h-[44px]"
            >
              <ArrowLeft size={14} />
              Terug
            </button>
            <h1 className="text-lg font-semibold text-grey-100">Scanresultaten</h1>
            {activeScan && (
              <p className="text-xs text-grey-500">
                {dateFmt.format(new Date(activeScan.scan_date))} · {activeScan.status} · {activeScan.parcel_count} percelen
              </p>
            )}
          </div>
          <div className="mt-3 rounded-md border border-overlay/5 bg-grey-850 p-2.5">
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
              className="h-9 rounded-md border-grey-700 bg-grey-900 py-2 text-xs focus:border-amber-accent/50"
            />
            {recentScans.length > 0 && (
              <div className="scrollbar-hidden mt-2 max-h-36 space-y-1 overflow-auto">
                <p className="px-1 text-[11px] uppercase tracking-wide text-grey-600">Recente scans</p>
                {recentScans.map((scan) => {
                  const isActive = scan.scan_id === scan_id
                  return (
                    <button
                      key={scan.scan_id}
                      onClick={() => handleOpenScan(scan.scan_id)}
                      className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? 'border-amber-accent/40 bg-amber-accent/10 text-amber-accent'
                          : 'border-overlay/5 bg-grey-900 text-grey-300 hover:bg-grey-800'
                      }`}
                    >
                      <span className="truncate">
                        {dateFmt.format(new Date(scan.scan_date))} · {scan.status} · {(scan.wijk_naam ?? scan.gemeente_naam)}
                      </span>
                      <span className="ml-2 shrink-0 tabular-nums text-[11px] text-grey-500">
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
          <div className="mt-3 rounded-md border border-amber-accent/30 bg-amber-accent/10 px-3 py-2 text-xs text-amber-accent shrink-0">
            Gebruik desktop voor scannen en exporteren
          </div>
        )}

        {scan_id ? (
          <>
            {/* Results table — fills remaining height */}
            <div className="mt-4 flex-1 overflow-hidden rounded-2xl border border-overlay/[0.08] bg-grey-900">
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

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
