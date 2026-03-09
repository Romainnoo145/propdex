import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { Scale, Filter } from 'lucide-react'
import { useExplorerResults, type ExplorerFilters } from '@/hooks/useExplorer'
import ExplorerFilterSidebar from '@/components/jurisprudentie/ExplorerFilterSidebar'
import RulingCard from '@/components/jurisprudentie/RulingCard'
import BroadenSuggestion from '@/components/jurisprudentie/BroadenSuggestion'
import { Skeleton } from '@/components/feedback/Skeleton'

export const Route = createFileRoute('/_authenticated/jurisprudentie')({
  validateSearch: (search: Record<string, unknown>) => ({
    gemeente: typeof search.gemeente === 'string' && search.gemeente.trim()
      ? search.gemeente
      : undefined,
    vergunningstype: typeof search.vergunningstype === 'string' && search.vergunningstype.trim()
      ? search.vergunningstype
      : undefined,
    uitkomst: typeof search.uitkomst === 'string' && search.uitkomst.trim()
      ? search.uitkomst
      : undefined,
    rechtsgrond: typeof search.rechtsgrond === 'string' && search.rechtsgrond.trim()
      ? search.rechtsgrond
      : undefined,
    rechtbank_niveau: typeof search.rechtbank_niveau === 'string' && search.rechtbank_niveau.trim()
      ? search.rechtbank_niveau
      : undefined,
    periode: typeof search.periode === 'string' && search.periode.trim()
      ? search.periode
      : undefined,
  }),
  component: JurisprudentiePage,
})

function JurisprudentiePage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const filters: ExplorerFilters = useMemo(() => ({
    gemeente: search.gemeente,
    vergunningstype: search.vergunningstype,
    uitkomst: search.uitkomst,
    rechtsgrond: search.rechtsgrond,
    rechtbank_niveau: search.rechtbank_niveau,
    periode: search.periode,
  }), [search.gemeente, search.vergunningstype, search.uitkomst, search.rechtsgrond, search.rechtbank_niveau, search.periode])

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useExplorerResults(filters)

  // Flatten all pages into a single list
  const allResults = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data?.pages]
  )

  // Facets from the latest page
  const facets = data?.pages[data.pages.length - 1]?.facets ?? null
  const totalCount = data?.pages[0]?.total_count ?? 0

  const hasActiveFilters = Object.values(filters).some(Boolean)

  // Handle filter changes via URL search params
  const handleFilterChange = useCallback(
    (dimension: keyof ExplorerFilters, value: string | undefined) => {
      navigate({
        to: '/jurisprudentie',
        search: {
          gemeente: filters.gemeente,
          vergunningstype: filters.vergunningstype,
          uitkomst: filters.uitkomst,
          rechtsgrond: filters.rechtsgrond,
          rechtbank_niveau: filters.rechtbank_niveau,
          periode: filters.periode,
          [dimension]: value,
        },
        replace: true,
      })
    },
    [navigate, filters]
  )

  const handleRemoveFilter = useCallback(
    (dimension: keyof ExplorerFilters) => {
      handleFilterChange(dimension, undefined)
    },
    [handleFilterChange]
  )

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="flex h-full w-full overflow-hidden bg-grey-950">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <ExplorerFilterSidebar
          facets={facets}
          activeFilters={filters}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full">
            <ExplorerFilterSidebar
              facets={facets}
              activeFilters={filters}
              onFilterChange={(dim, val) => {
                handleFilterChange(dim, val)
                setSidebarOpen(false)
              }}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* Results panel */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale size={22} className="text-grey-400" />
            <div>
              <h1 className="text-xl font-semibold text-grey-100">
                Jurisprudentie Explorer
              </h1>
              {!isLoading && (
                <p className="text-sm text-grey-400">
                  {totalCount} {totalCount === 1 ? 'uitspraak' : 'uitspraken'} gevonden
                </p>
              )}
            </div>
          </div>
          {/* Mobile filter toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-grey-700 px-3 py-1.5 text-sm text-grey-300 transition-colors hover:bg-grey-800 md:hidden"
          >
            <Filter size={14} />
            Filters
          </button>
        </div>

        {/* Broaden suggestion */}
        {!isLoading && totalCount < 3 && hasActiveFilters && (
          <div className="mb-4">
            <BroadenSuggestion
              activeFilters={filters}
              facets={facets}
              resultCount={totalCount}
              onRemoveFilter={handleRemoveFilter}
            />
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-grey-800 bg-grey-900 p-4 space-y-2"
              >
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Results list */}
        {!isLoading && allResults.length > 0 && (
          <div className="space-y-3">
            {allResults.map((ruling) => (
              <RulingCard key={ruling.ecli} ruling={ruling} />
            ))}
          </div>
        )}

        {/* Empty state (no filters active) */}
        {!isLoading && allResults.length === 0 && !hasActiveFilters && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Scale size={40} className="mb-3 text-grey-600" />
            <h2 className="text-lg font-semibold text-grey-300">
              Geen uitspraken beschikbaar
            </h2>
            <p className="mt-1 max-w-sm text-sm text-grey-500">
              Er zijn nog geen uitspraken in de database. Voer eerst een gemeente-analyse uit via de kaart.
            </p>
          </div>
        )}

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="mt-4 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-grey-600 border-t-amber-accent" />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  )
}
