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
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'

interface ResultsTableProps {
  scanId: string
  filters?: ScanResultsFilters
  selectedParcelId?: string | null
  onRowClick?: (parcelId: string) => void
  onRowDoubleClick?: (parcel: ScanResultItem) => void
  onTotalChange?: (total: number) => void
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  onPageChange?: (page: number) => void
  currentPage?: number
  onRowHover?: (parcelId: string | null) => void
  onSelectionChange?: (selectedParcelIds: string[]) => void
  selectionKey?: number
}

// Score badge component for visual indicators
function ScoreBadge({
  score,
  category,
}: {
  score: number | null
  category: string | null
}) {
  if (score === null || category === null) {
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
        N/A
      </span>
    )
  }

  const colors = {
    High: 'bg-green-500/20 text-green-400 border-green-500/30',
    Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Low: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const colorClass = colors[category as keyof typeof colors] || colors.Low

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}
    >
      {score.toFixed(0)}
    </span>
  )
}

const columnHelper = createColumnHelper<ScanResultItem>()

export default function ResultsTable({
  scanId,
  filters = {},
  selectedParcelId,
  onRowClick,
  onRowDoubleClick,
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
        <span className="font-mono text-xs">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('address', {
      header: 'Adres',
      enableSorting: true,
      cell: (info) => info.getValue() ?? 'Onbekend',
    }),
    columnHelper.accessor('area_m2', {
      header: 'Oppervlak (m²)',
      enableSorting: true,
      cell: (info) => {
        const value = info.getValue()
        return value !== null ? value.toLocaleString('nl-NL') : '-'
      },
    }),
    columnHelper.display({
      id: 'bestemming',
      header: 'Bestemming',
      cell: (info) => {
        const bestemmingen = info.row.original.bestemmingen
        if (!bestemmingen || bestemmingen.length === 0) return '-'

        const first = bestemmingen[0] as { type?: string; naam?: string }
        const text = first.type ?? first.naam ?? '-'

        // Truncate to 25 chars
        return text.length > 25 ? `${text.substring(0, 25)}...` : text
      },
    }),
    columnHelper.accessor('bouwjaar', {
      header: 'Bouwjaar',
      enableSorting: true,
      cell: (info) => {
        const value = info.getValue()
        return value !== null ? String(value) : '-'
      },
    }),
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
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-grey-800 rounded animate-pulse"
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
        description="Pas de filters aan of voer een nieuwe scan uit."
      />
    )
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header with summary */}
      <div className="px-6 py-4 border-b border-grey-800">
        <h3 className="text-grey-100 font-semibold text-lg">
          {data.gemeente_naam}
        </h3>
        <p className="text-grey-400 text-sm mt-1">
          {data.total.toLocaleString('nl-NL')} kansrijk van{' '}
          {data.parcels_total.toLocaleString('nl-NL')} gescand
          <span className="text-grey-600 ml-1">
            ({data.parcels_total > 0
              ? Math.round(((data.parcels_total - data.total) / data.parcels_total) * 100)
              : 0}% afgevallen)
          </span>
        </p>
      </div>

      {/* Table container with scroll */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-grey-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-4 py-3 text-left text-xs font-medium text-grey-400 uppercase tracking-wider ${
                      header.column.getCanSort() ? 'cursor-pointer select-none' : ''
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
                          <span className="text-grey-600">
                            {header.column.getIsSorted() === 'desc' ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : header.column.getIsSorted() === 'asc' ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronsUpDown className="w-4 h-4" />
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
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.original.parcel_id, el)
                }}
                className={`border-b border-grey-800 transition-colors cursor-pointer ${
                  row.original.parcel_id === selectedParcelId
                    ? 'bg-grey-850 ring-1 ring-amber-accent/30'
                    : 'hover:bg-grey-850'
                }`}
                onClick={() => onRowClick?.(row.original.parcel_id)}
                onDoubleClick={() => onRowDoubleClick?.(row.original)}
                onMouseEnter={() => onRowHover?.(row.original.parcel_id)}
                onMouseLeave={() => onRowHover?.(null)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-grey-100">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="px-6 py-4 border-t border-grey-800 flex items-center justify-between">
        <div className="text-sm text-grey-400">
          Toont{' '}
          {Math.min(
            pagination.pageIndex * pagination.pageSize + 1,
            data.total
          ).toLocaleString('nl-NL')}
          -
          {Math.min(
            (pagination.pageIndex + 1) * pagination.pageSize,
            data.total
          ).toLocaleString('nl-NL')}{' '}
          van {data.total.toLocaleString('nl-NL')}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-grey-400">
            Pagina {pagination.pageIndex + 1} van {table.getPageCount()}
          </span>

          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="bg-grey-850 hover:bg-grey-800 disabled:opacity-30 disabled:cursor-not-allowed text-grey-100 px-3 py-1.5 rounded text-sm transition-colors"
          >
            Vorige
          </button>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="bg-grey-850 hover:bg-grey-800 disabled:opacity-30 disabled:cursor-not-allowed text-grey-100 px-3 py-1.5 rounded text-sm transition-colors"
          >
            Volgende
          </button>
        </div>
      </div>
    </div>
  )
}
