import { useState, useEffect, useRef } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type PaginationState,
  type RowSelectionState,
  type Updater,
} from '@tanstack/react-table'
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from 'lucide-react'
import { useScanResults } from '@/hooks/useScans'
import type { ScanResultItem, ScanResultsFilters } from '@/lib/types/scan'
import { extractScoreSubscores } from '@/lib/score'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ParcelCard } from './ParcelCard'

interface ResultsTableProps {
  scanId: string
  filters?: ScanResultsFilters
  selectedParcelId?: string | null
  onRowClick?: (parcel: ScanResultItem) => void
  onTotalChange?: (total: number) => void
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  onPageChange?: (page: number) => void
  currentPage?: number
  onRowHover?: (parcelId: string | null) => void
  onSelectionChange?: (selectedParcelIds: string[]) => void
  selectionKey?: number
}

// Score badge — amber-based glow system (high-end dark mode)
function ScoreBadge({
  score,
  category,
}: {
  score: number | null
  category: string | null
}) {
  if (score === null || category === null) {
    return (
      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full text-xs font-semibold bg-grey-800/60 text-grey-600 border border-overlay/5">
        --
      </span>
    )
  }

  // Amber intensity scales with score category
  const styles = {
    High: 'bg-amber-accent/15 text-amber-accent border-amber-accent/30 shadow-[0_0_8px_rgba(217,170,56,0.15)]',
    Medium: 'bg-amber-accent/8 text-amber-accent/70 border-amber-accent/15',
    Low: 'bg-grey-800/60 text-grey-400 border-overlay/5',
  }

  const style = styles[category as keyof typeof styles] ?? styles.Low

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-full text-xs font-bold tabular-nums border ${style}`}
    >
      {score.toFixed(0)}
    </span>
  )
}

function VacancyBadge({
  value,
  confidence,
}: {
  value: string | null
  confidence: number | null
}) {
  if (!value) {
    return <span className="text-grey-600">--</span>
  }

  const map: Record<string, { label: string; cls: string }> = {
    leeg_perceel: {
      label: 'Leeg perceel',
      cls: 'bg-success/12 text-success border-success/25',
    },
    leegstaand_pand: {
      label: 'Leegstaand',
      cls: 'bg-warning/15 text-warning border-warning/30',
    },
    in_gebruik: {
      label: 'In gebruik',
      cls: 'bg-grey-800/70 text-grey-400 border-overlay/8',
    },
    onbekend: {
      label: 'Onbekend',
      cls: 'bg-info/12 text-info border-info/25',
    },
  }

  const { label, cls } = map[value] ?? {
    label: value,
    cls: 'bg-grey-800/70 text-grey-300 border-overlay/8',
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
        {label}
      </span>
      {confidence !== null && (
        <span className="text-[11px] tabular-nums text-grey-500">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  )
}

function SubscoreBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-grey-600">--</span>
  }

  const cls =
    value >= 70
      ? 'bg-amber-accent/15 text-amber-accent border-amber-accent/30'
      : value >= 45
        ? 'bg-amber-accent/8 text-amber-accent/75 border-amber-accent/20'
        : 'bg-grey-800/70 text-grey-400 border-overlay/8'

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${cls}`}>
      {Math.round(value)}
    </span>
  )
}

const columnHelper = createColumnHelper<ScanResultItem>()

export default function ResultsTable({
  scanId,
  filters = {},
  selectedParcelId,
  onRowClick,
  onTotalChange,
  onSortChange,
  onPageChange,
  currentPage,
  onRowHover,
  onSelectionChange,
  selectionKey,
}: ResultsTableProps) {
  // Initialize sorting from URL-derived filters
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (filters.sort_by) {
      return [{ id: filters.sort_by, desc: filters.sort_order === 'desc' }]
    }
    return [{ id: 'score', desc: true }]
  })

  // Initialize pagination from URL-derived currentPage
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: currentPage ?? 0,
    pageSize: 50,
  })

  // Row selection state — keyed by parcel UUID (not row index)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())

  // Sync pagination when currentPage prop changes (URL navigation)
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: currentPage ?? 0 }))
  }, [currentPage])

  // Sync sorting when URL-derived sort params change
  useEffect(() => {
    if (filters.sort_by) {
      setSorting([{ id: filters.sort_by, desc: filters.sort_order === 'desc' }])
    }
  }, [filters.sort_by, filters.sort_order])

  // Reset row selection when scan, filters, or selectionKey change
  useEffect(() => {
    setRowSelection({})
  }, [scanId, filters, selectionKey])

  // Notify parent when selection changes
  useEffect(() => {
    const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])
    onSelectionChange?.(selectedIds)
  }, [rowSelection, onSelectionChange])

  // Handle sorting changes — propagate primary sort to URL
  const handleSortingChange = (updater: Updater<SortingState>) => {
    const newSorting =
      typeof updater === 'function' ? updater(sorting) : updater
    setSorting(newSorting)
    const primarySort = newSorting[0]
    if (primarySort && onSortChange) {
      onSortChange(primarySort.id, primarySort.desc ? 'desc' : 'asc')
    }
  }

  // Handle pagination changes — propagate page index to URL
  const handlePaginationChange = (updater: Updater<PaginationState>) => {
    const newPagination =
      typeof updater === 'function' ? updater(pagination) : updater
    setPagination(newPagination)
    onPageChange?.(newPagination.pageIndex)
  }

  // Build API filters with sorting and pagination
  const apiFilters: ScanResultsFilters = {
    ...filters,
    sort_by: sorting[0]?.id,
    sort_order: sorting[0]?.desc ? 'desc' : 'asc',
    offset: pagination.pageIndex * pagination.pageSize,
    limit: pagination.pageSize,
  }

  const { data, isLoading, error, refetch } = useScanResults(scanId, apiFilters)

  // Update total count when data changes
  useEffect(() => {
    if (data?.total !== undefined) {
      onTotalChange?.(data.total)
    }
  }, [data?.total, onTotalChange])

  // Auto-scroll to selected row when selection changes
  useEffect(() => {
    if (!selectedParcelId) return
    const rowEl = rowRefs.current.get(selectedParcelId)
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedParcelId])

  // Columns defined inside component to access table instance for checkbox column
  const columns = [
    // Checkbox column — FIRST, keyed by parcel UUID via getRowId
    columnHelper.display({
      id: 'select',
      size: 40,
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected()
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="w-4 h-4 rounded border-grey-700 bg-grey-900 accent-amber-accent cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-grey-700 bg-grey-900 accent-amber-accent cursor-pointer"
        />
      ),
    }),
    columnHelper.accessor('parcel_code', {
      header: 'Perceelcode',
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs text-grey-600 tracking-wide">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('address', {
      header: 'Adres',
      enableSorting: true,
      cell: (info) => {
        const raw = info.getValue()
        const address = typeof raw === 'string' ? raw.trim() : raw
        return (
          <span className="font-semibold text-grey-100">
            {address ? address : <span className="text-grey-600 font-normal italic">Onbekend</span>}
          </span>
        )
      },
    }),
    columnHelper.accessor('area_m2', {
      header: 'Oppervlak (m²)',
      enableSorting: true,
      cell: (info) => {
        const value = info.getValue()
        return value !== null ? (
          <span className="tabular-nums text-grey-300">
            {Math.round(value).toLocaleString('nl-NL')}
          </span>
        ) : (
          <span className="text-grey-600">--</span>
        )
      },
    }),
    columnHelper.display({
      id: 'bestemming',
      header: 'Bestemming',
      cell: (info) => {
        const bestemmingen = info.row.original.bestemmingen
        if (!bestemmingen || bestemmingen.length === 0)
          return <span className="text-grey-600">--</span>

        const first = bestemmingen[0] as { type?: string; naam?: string }
        const text = first.type ?? first.naam ?? '--'

        return (
          <span className="text-grey-400">
            {text.length > 25 ? `${text.substring(0, 25)}...` : text}
          </span>
        )
      },
    }),
    columnHelper.accessor('bouwjaar', {
      header: 'Bouwjaar',
      enableSorting: true,
      cell: (info) => {
        const value = info.getValue()
        return value !== null ? (
          <span className="tabular-nums text-grey-400">{String(value)}</span>
        ) : (
          <span className="text-grey-600">--</span>
        )
      },
    }),
    columnHelper.accessor('vacancy_signal', {
      header: 'Potentie-signaal',
      enableSorting: false,
      cell: (info) => (
        <VacancyBadge
          value={info.getValue()}
          confidence={info.row.original.vacancy_confidence}
        />
      ),
    }),
    columnHelper.accessor(
      (row) => extractScoreSubscores(row.score_breakdown).vacancy,
      {
        id: 'vacancy_subscore',
        header: 'Leegstandskans',
        enableSorting: true,
        cell: (info) => <SubscoreBadge value={info.getValue()} />,
      }
    ),
    columnHelper.accessor(
      (row) => extractScoreSubscores(row.score_breakdown).buildability,
      {
        id: 'buildability_subscore',
        header: 'Bouwruimte',
        enableSorting: true,
        cell: (info) => <SubscoreBadge value={info.getValue()} />,
      }
    ),
    columnHelper.accessor('score', {
      header: 'Score',
      enableSorting: true,
      cell: (info) => (
        <ScoreBadge
          score={info.getValue()}
          category={info.row.original.score_category}
        />
      ),
    }),
  ]

  const isMobile = useIsMobile()

  const table = useReactTable({
    data: data?.results ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: true,
    enableRowSelection: true,
    getRowId: (row) => row.parcel_id, // Key by parcel UUID, not row index
    isMultiSortEvent: (e) => (e as MouseEvent).shiftKey,
    maxMultiSortColCount: 3,
    pageCount: Math.ceil((data?.total ?? 0) / pagination.pageSize),
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: setRowSelection,
  })

  if (error) {
    return (
      <ErrorState
        message="Fout bij laden van resultaten"
        actions={[
          { label: 'Opnieuw proberen', onClick: () => refetch() },
        ]}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="h-full w-full p-6">
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 bg-overlay/[0.02] border-b border-overlay/[0.03] animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.results.length === 0) {
    return (
      <EmptyState
        icon={<Search size={32} />}
        title="Geen resultaten gevonden"
        description="Pas je zoekterm of sortering aan, of voer een nieuwe scan uit."
      />
    )
  }

  // Mobile branch: card list below 768px (MOB-02)
  // Intentionally omits checkboxes — selection/export is desktop-only per MOB-01 read-only mode
  if (isMobile) {
    const areaTitle = data.wijk_naam
      ? `${data.wijk_naam} (${data.gemeente_naam})`
      : data.gemeente_naam
    return (
      <div className="h-full w-full flex flex-col">
        {/* Header with summary */}
        <div className="px-4 py-3 border-b border-overlay/5">
          <h3 className="text-grey-100 font-semibold text-base">
            {areaTitle}
          </h3>
          <p className="text-grey-600 text-xs mt-0.5">
            <span className="text-grey-300 font-medium">{data.total.toLocaleString('nl-NL')}</span> in ranking van{' '}
            <span className="tabular-nums">{data.parcels_total.toLocaleString('nl-NL')}</span> gescand
          </p>
        </div>

        {/* Card list */}
        <div className="scrollbar-hidden flex-1 overflow-y-auto divide-y divide-overlay/[0.03]">
          {table.getRowModel().rows.map((row) => (
            <ParcelCard
              key={row.id}
              parcel={row.original}
              isSelected={row.original.parcel_id === selectedParcelId}
              onClick={() => onRowClick?.(row.original)}
            />
          ))}
        </div>

        {/* Simplified pagination — compact layout with 44px touch targets (MOB-03) */}
        <div className="px-4 py-3 border-t border-overlay/5 flex items-center justify-between">
          <span className="text-xs text-grey-600 tabular-nums">
            {pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="border border-overlay/5 bg-grey-900 hover:bg-grey-850 disabled:opacity-25 disabled:cursor-not-allowed text-grey-300 px-3 py-2 rounded-md text-xs font-medium transition-colors min-h-[44px]"
            >
              Vorige
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="border border-overlay/5 bg-grey-900 hover:bg-grey-850 disabled:opacity-25 disabled:cursor-not-allowed text-grey-300 px-3 py-2 rounded-md text-xs font-medium transition-colors min-h-[44px]"
            >
              Volgende
            </button>
          </div>
        </div>
      </div>
    )
  }

  const areaTitle = data.wijk_naam
    ? `${data.wijk_naam} (${data.gemeente_naam})`
    : data.gemeente_naam

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header with summary */}
      <div className="px-6 py-4 border-b border-overlay/5">
        <h3 className="text-grey-100 font-semibold text-lg">
          {areaTitle}
        </h3>
        <p className="text-grey-600 text-sm mt-1">
          <span className="text-grey-300 font-medium">{data.total.toLocaleString('nl-NL')}</span> in ranking van{' '}
          <span className="tabular-nums">{data.parcels_total.toLocaleString('nl-NL')}</span> gescand
        </p>
      </div>

      {/* Table container with scroll */}
      <div className="scrollbar-hidden flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-grey-900 border-b border-overlay/5">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-5 py-3 text-left text-xs font-medium text-grey-600 uppercase tracking-wider ${
                      header.column.getCanSort() ? 'cursor-pointer select-none hover:text-grey-300 transition-colors' : ''
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <>
                          <span className="text-grey-700">
                            {header.column.getIsSorted() === 'desc' ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : header.column.getIsSorted() === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                          {/* Multi-sort priority badge */}
                          {header.column.getIsSorted() && sorting.length > 1 && (
                            <span className="text-xs text-amber-accent ml-0.5">
                              {header.column.getSortIndex() + 1}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-overlay/[0.03]">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.original.parcel_id, el)
                }}
                className={`transition-colors cursor-pointer ${
                  row.original.parcel_id === selectedParcelId
                    ? 'bg-amber-accent/[0.06] ring-1 ring-inset ring-amber-accent/20'
                    : 'hover:bg-overlay/[0.02]'
                }`}
                onClick={() => onRowClick?.(row.original)}
                onMouseEnter={() => onRowHover?.(row.original.parcel_id)}
                onMouseLeave={() => onRowHover?.(null)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-4 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="px-6 py-3 border-t border-overlay/5 flex items-center justify-between bg-grey-900">
        <span className="text-xs text-grey-600 tabular-nums">
          {Math.min(
            pagination.pageIndex * pagination.pageSize + 1,
            data.total
          ).toLocaleString('nl-NL')}
          –
          {Math.min(
            (pagination.pageIndex + 1) * pagination.pageSize,
            data.total
          ).toLocaleString('nl-NL')}{' '}
          van {data.total.toLocaleString('nl-NL')}
        </span>

        <div className="flex items-center gap-3">
          <span className="text-xs text-grey-600 tabular-nums">
            {pagination.pageIndex + 1} / {table.getPageCount()}
          </span>

          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border border-overlay/5 bg-grey-900 hover:bg-grey-850 disabled:opacity-25 disabled:cursor-not-allowed text-grey-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            Vorige
          </button>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border border-overlay/5 bg-grey-900 hover:bg-grey-850 disabled:opacity-25 disabled:cursor-not-allowed text-grey-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            Volgende
          </button>
        </div>
      </div>
    </div>
  )
}
