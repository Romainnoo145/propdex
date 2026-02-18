import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Map } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import ResultsTable from '@/components/results/ResultsTable'
import ResultsFilterPanel from '@/components/results/ResultsFilterPanel'
import { ParcelDetailModal } from '@/components/results/ParcelDetailModal'
import { EmptyState } from '@/components/feedback/EmptyState'
import type { ScanResultsFilters, ScanResultItem } from '@/lib/types/scan'

interface ResultatenSearchParams {
  scan_id?: string
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

  const { scan_id } = search

  // Derive filters from URL search params
  const filters: ScanResultsFilters = {
    bestemming_type: search.bestemming_type,
    pand_status: search.pand_status,
    min_area_m2: search.min_area_m2,
    max_area_m2: search.max_area_m2,
    score_category: search.score_category,
    sort_by: search.sort_by ?? 'score',
    sort_order: search.sort_order ?? 'desc',
    offset: (search.page ?? 0) * 50,
    limit: 50,
  }

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-800 shrink-0">
          <h1 className="text-lg font-semibold text-grey-100">Scanresultaten</h1>
          <button
            onClick={() => navigate({ to: '/map', search: scan_id ? { scan_id } : {} })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-grey-300 hover:text-white transition-colors"
          >
            <Map size={16} />
            Toon Kaart
          </button>
        </div>

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
                onRowDoubleClick={(parcel) => setModalParcel(parcel)}
                onTotalChange={setTotal}
                onSortChange={handleSortChange}
                onPageChange={handlePageChange}
                currentPage={search.page ?? 0}
              />
            </div>
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
      />
    </ResultsShell>
  )
}
