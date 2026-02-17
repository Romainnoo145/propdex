import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Map } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import ResultsTable from '@/components/results/ResultsTable'
import ResultsFilterPanel from '@/components/results/ResultsFilterPanel'
import { ParcelDetailModal } from '@/components/results/ParcelDetailModal'
import type { ScanResultsFilters, ScanResultItem } from '@/lib/types/scan'

interface ResultatenSearchParams {
  scan_id?: string
}

export const Route = createFileRoute('/_authenticated/resultaten')({
  component: ResultatenPage,
  validateSearch: (search: Record<string, unknown>): ResultatenSearchParams => ({
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
  }),
})

function ResultatenPage() {
  const { scan_id } = Route.useSearch()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<ScanResultsFilters>({})
  const [total, setTotal] = useState(0)
  const [modalParcel, setModalParcel] = useState<ScanResultItem | null>(null)

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
                onChange={setFilters}
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
              />
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <p className="text-grey-400 text-sm">
              Selecteer een scan op de kaart om resultaten te bekijken
            </p>
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
