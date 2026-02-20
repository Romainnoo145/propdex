import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { Map } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import ResultsShell from '@/components/layout/ResultsShell'
import ResultsTable from '@/components/results/ResultsTable'
import ResultsFilterPanel from '@/components/results/ResultsFilterPanel'
import { ParcelDetailModal } from '@/components/results/ParcelDetailModal'
import { BulkActionBar } from '@/components/results/BulkActionBar'
import { EmptyState } from '@/components/feedback/EmptyState'
import type { ScanResultsFilters, ScanResultItem } from '@/lib/types/scan'

interface ResultatenSearchParams {
  scan_id?: string
  highlight?: string // parcel_id to highlight (from bekendmaking link)
  bestemming_type?: string
  pand_status?: string
  min_area_m2?: number
  max_area_m2?: number
  score_category?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
}

export const Route = createFileRoute('/_authenticated/resultaten')({
  component: ResultatenPage,
  validateSearch: (search: Record<string, unknown>): ResultatenSearchParams => ({
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
    highlight: typeof search.highlight === 'string' ? search.highlight : undefined,
    bestemming_type:
      typeof search.bestemming_type === 'string'
        ? search.bestemming_type
        : undefined,
    pand_status:
      typeof search.pand_status === 'string' ? search.pand_status : undefined,
    min_area_m2:
      typeof search.min_area_m2 === 'number' ? search.min_area_m2 : undefined,
    max_area_m2:
      typeof search.max_area_m2 === 'number' ? search.max_area_m2 : undefined,
    score_category:
      typeof search.score_category === 'string'
        ? search.score_category
        : undefined,
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
  const [total, setTotal] = useState(0)
  const [modalParcel, setModalParcel] = useState<ScanResultItem | null>(null)
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([])
  const [selectionKey, setSelectionKey] = useState(0)

  const isMobile = useIsMobile()

  const { scan_id } = search

  // Derive filters from URL search params (memoized to prevent re-render loops)
  const filters: ScanResultsFilters = useMemo(() => ({
    bestemming_type: search.bestemming_type,
    pand_status: search.pand_status,
    min_area_m2: search.min_area_m2,
    max_area_m2: search.max_area_m2,
    score_category: search.score_category,
    sort_by: search.sort_by ?? 'score',
    sort_order: search.sort_order ?? 'desc',
    offset: (search.page ?? 0) * 50,
    limit: 50,
  }), [search.bestemming_type, search.pand_status, search.min_area_m2, search.max_area_m2, search.score_category, search.sort_by, search.sort_order, search.page])

  const handleFilterChange = (newFilters: Partial<ScanResultsFilters>) => {
    void navigate({
      to: '/resultaten',
      search: (prev) => ({
        ...prev,
        bestemming_type: newFilters.bestemming_type,
        pand_status: newFilters.pand_status,
        min_area_m2: newFilters.min_area_m2,
        max_area_m2: newFilters.max_area_m2,
        score_category: newFilters.score_category,
        page: 0, // Reset page on filter change
      }),
    })
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

  return (
    <ResultsShell fullWidth>
      <div className="flex flex-col h-full">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-grey-900 shrink-0">
          <h1 className="text-lg font-semibold text-grey-100">Scanresultaten</h1>
          <button
            onClick={() => navigate({ to: '/map', search: scan_id ? { scan_id } : {} })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-grey-500 hover:text-grey-300 border border-white/5 rounded-md hover:border-white/10 transition-colors min-h-[44px]"
          >
            <Map size={14} />
            <span className="hidden md:inline">Toon Kaart</span>
          </button>
        </div>

        {/* Mobile read-only banner — explains scan/export are desktop-only (MOB-01) */}
        {isMobile && (
          <div className="mx-4 mt-3 rounded-md bg-amber-accent/10 border border-amber-accent/30 px-3 py-2 text-xs text-amber-accent shrink-0">
            Gebruik desktop voor scannen en exporteren
          </div>
        )}

        {scan_id ? (
          <>
            {/* Filter panel */}
            <div className="shrink-0">
              <ResultsFilterPanel
                filters={filters}
                onChange={handleFilterChange}
                total={total}
              />
            </div>

            {/* Results table — fills remaining height */}
            <div className="flex-1 overflow-hidden">
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
        onViewOnMap={scan_id ? () => navigate({ to: '/map', search: { scan_id } }) : undefined}
      />
    </ResultsShell>
  )
}
