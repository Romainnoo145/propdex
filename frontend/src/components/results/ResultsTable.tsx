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
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, MapPin, Heart } from 'lucide-react'
import { useScanResults } from '@/hooks/useScans'
import type { ScanResultItem, ScanResultsFilters } from '@/lib/types/scan'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ParcelCard } from './ParcelCard'

interface ResultsTableProps {
  scanId: string
  filters?: ScanResultsFilters
  selectedParcelId?: string | null
  onRowClick?: (parcel: ScanResultItem) => void
  onViewOnMap?: (parcel: ScanResultItem) => void
  onFavorite?: (parcel: ScanResultItem) => void
  onTotalChange?: (total: number) => void
  onTotalUnfilteredChange?: (total: number) => void
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  onPageChange?: (page: number) => void
  currentPage?: number
  onRowHover?: (parcelId: string | null) => void
  onSelectionChange?: (selectedParcelIds: string[]) => void
  selectionKey?: number
}

// Reusable score ring — configurable color, used for potentie/risico/score
function ScoreRing({ score, color = '#F9A826' }: { score: number | null; color?: string }) {
  if (score === null) return <span className="text-neutral-400 text-xs">--</span>
  const r = 14
  const circumference = 2 * Math.PI * r
  const fill = (score / 100) * circumference
  const gap = circumference - fill
  return (
    <div className="relative flex items-center justify-center" style={{ width: 36, height: 36 }}>
      <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="#EAEFEF" strokeWidth="2.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={`${fill} ${gap}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums text-[#0E1111]">{score}</span>
    </div>
  )
}

// Score badge — amber ring for main score column
function ScoreBadge({
  score,
}: {
  score: number | null
  category: string | null
}) {
  if (score === null) {
    return <span className="text-neutral-400 text-xs">--</span>
  }

  const s = Math.round(score)
  const r = 16
  const circumference = 2 * Math.PI * r
  const fill = (s / 100) * circumference
  const gap = circumference - fill

  return (
    <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
      <svg viewBox="0 0 40 40" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#EAEFEF" strokeWidth="3" />
        <circle
          cx="20" cy="20" r={r} fill="none"
          stroke="#F9A826"
          strokeWidth="3"
          strokeDasharray={`${fill} ${gap}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-bold tabular-nums text-[#0E1111]">{s}</span>
    </div>
  )
}

function LeegstandBadge({ hasPand }: { hasPand: boolean }) {
  const isLeeg = !hasPand
  const cls = isLeeg
    ? 'bg-aura-amber/15 text-aura-amber border-aura-amber/30'
    : 'bg-neutral-200/70 text-neutral-600 border-neutral-200/8'

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {isLeeg ? 'Ja' : 'Nee'}
    </span>
  )
}

const columnHelper = createColumnHelper<ScanResultItem>()

export default function ResultsTable({
  scanId,
  filters = {},
  selectedParcelId,
  onRowClick,
  onViewOnMap,
  onFavorite,
  onTotalChange,
  onTotalUnfilteredChange,
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

  // Propagate unfiltered total for hidden-count display
  useEffect(() => {
    if (data?.total_unfiltered !== undefined) {
      onTotalUnfilteredChange?.(data.total_unfiltered)
    }
  }, [data?.total_unfiltered, onTotalUnfilteredChange])

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
          className="w-4 h-4 rounded border-neutral-300 bg-aura-glass-white/60 accent-aura-amber cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-neutral-300 bg-aura-glass-white/60 accent-aura-amber cursor-pointer"
        />
      ),
    }),
    columnHelper.accessor('parcel_code', {
      header: 'Perceelcode',
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs text-neutral-500 tracking-wide">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('address', {
      header: 'Adres',
      enableSorting: true,
      cell: (info) => {
        const raw = info.getValue()
        const address = typeof raw === 'string' ? raw.trim() : raw
        return (
          <span className="font-semibold text-aura-ink">
            {address ? address : <span className="text-neutral-500 font-normal italic">Onbekend</span>}
          </span>
        )
      },
    }),
    columnHelper.accessor('area_m2', {
      header: 'Onbebouwd',
      enableSorting: true,
      size: 90,
      cell: (info) => {
        const area = info.getValue()
        const bm = info.row.original.building_metrics
        const pandOpp = bm?.pand_oppervlakte_m2
        // Show unbuild area if we have pand footprint, otherwise total area
        const displayArea = (pandOpp != null && area != null) ? Math.max(0, Math.round(area - pandOpp)) : area != null ? Math.round(area) : null
        return displayArea !== null ? (
          <span className="tabular-nums text-neutral-700 text-[12px]">
            {displayArea.toLocaleString('nl-NL')} m²
          </span>
        ) : (
          <span className="text-neutral-400">--</span>
        )
      },
    }),
    columnHelper.display({
      id: 'bestemming',
      header: 'Bestemming',
      cell: (info) => {
        const bestemmingen = info.row.original.bestemmingen
        if (!bestemmingen || bestemmingen.length === 0)
          return <span className="text-neutral-500">--</span>

        const first = bestemmingen[0] as { type?: string; naam?: string }
        const text = first.type ?? first.naam ?? '--'

        return (
          <span className="text-neutral-600">
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
          <span className="tabular-nums text-neutral-600">{String(value)}</span>
        ) : (
          <span className="text-neutral-500">--</span>
        )
      },
    }),
    columnHelper.accessor('has_pand', {
      header: 'Leegstand',
      enableSorting: true,
      cell: (info) => <LeegstandBadge hasPand={info.getValue()} />,
    }),
    columnHelper.accessor('potentie_score', {
      header: 'Potentie',
      enableSorting: true,
      size: 60,
      cell: (info) => {
        const value = info.getValue()
        return <ScoreRing score={value != null ? Math.round(value) : null} color="#22c55e" />
      },
    }),
    columnHelper.accessor('risico_score', {
      header: 'Risico',
      enableSorting: true,
      size: 60,
      cell: (info) => {
        const value = info.getValue()
        return <ScoreRing score={value != null ? Math.round(value) : null} color="#ef4444" />
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
    // Action buttons — map + favorite
    columnHelper.display({
      id: 'actions',
      header: '',
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onViewOnMap && (
            <button
              onClick={() => onViewOnMap(row.original)}
              aria-label="Open op kaart"
              title="Open op kaart"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0E1111] text-[#F9A826] transition-colors hover:bg-slate-800"
            >
              <MapPin size={14} />
            </button>
          )}
          {onFavorite && (
            <button
              onClick={() => onFavorite(row.original)}
              aria-label="Opslaan"
              title="Opslaan"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#EAEFEF] text-slate-400 transition-colors hover:text-red-500 hover:border-red-200"
            >
              <Heart size={14} />
            </button>
          )}
        </div>
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
      columnVisibility: { parcel_code: false, bouwjaar: false },
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
              className="h-14 bg-neutral-100/[0.02] border-b border-neutral-200/[0.03] animate-pulse"
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
        <div className="px-4 py-3 border-b border-neutral-200">
          <h3 className="text-[#0E1111] font-semibold text-base">
            {areaTitle}
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            <span className="text-[#0E1111] font-medium tabular-nums">{data.total.toLocaleString('nl-NL')}</span> percelen
          </p>
        </div>

        {/* Card list */}
        <div className="scrollbar-hidden flex-1 overflow-y-auto divide-y divide-neutral-200">
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
        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between">
          <span className="text-xs text-neutral-500 tabular-nums">
            {pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="border border-neutral-200 bg-aura-glass-white/60 hover:bg-aura-glass-white/40 disabled:opacity-25 disabled:cursor-not-allowed text-neutral-700 px-3 py-2 rounded-md text-xs font-medium transition-colors min-h-[44px]"
            >
              Vorige
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="border border-neutral-200 bg-aura-glass-white/60 hover:bg-aura-glass-white/40 disabled:opacity-25 disabled:cursor-not-allowed text-neutral-700 px-3 py-2 rounded-md text-xs font-medium transition-colors min-h-[44px]"
            >
              Volgende
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col">

      {/* Table container with scroll */}
      <div className="scrollbar-hidden flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-[#EAEFEF]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-5 py-2.5 text-left text-[11px] font-medium text-slate-400 tracking-wide ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-slate-600 transition-colors' : ''
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
                          <span className="text-neutral-400">
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
                            <span className="text-xs text-aura-amber ml-0.5">
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
          <tbody className="divide-y divide-neutral-200">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.original.parcel_id, el)
                }}
                className={`transition-colors cursor-pointer ${row.original.parcel_id === selectedParcelId
                  ? 'bg-aura-amber/[0.06] ring-1 ring-inset ring-aura-amber/20'
                  : 'hover:bg-neutral-100/[0.02]'
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
      <div className="px-6 py-3 border-t border-neutral-200 flex items-center justify-between bg-aura-glass-white/60">
        <span className="text-xs text-neutral-500 tabular-nums">
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
          <span className="text-xs text-neutral-500 tabular-nums">
            {pagination.pageIndex + 1} / {table.getPageCount()}
          </span>

          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border border-neutral-200 bg-aura-glass-white/60 hover:bg-aura-glass-white/40 disabled:opacity-25 disabled:cursor-not-allowed text-neutral-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            Vorige
          </button>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border border-neutral-200 bg-aura-glass-white/60 hover:bg-aura-glass-white/40 disabled:opacity-25 disabled:cursor-not-allowed text-neutral-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            Volgende
          </button>
        </div>
      </div>
    </div>
  )
}
