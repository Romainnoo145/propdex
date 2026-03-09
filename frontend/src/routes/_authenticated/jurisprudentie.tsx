import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useCallback, useEffect, useMemo } from 'react'
import { Scale, SlidersHorizontal, X } from 'lucide-react'
import { useExplorerResults, type ExplorerFilters } from '@/hooks/useExplorer'
import WizardFlow from '@/components/jurisprudentie/WizardFlow'
import BenchmarkBar from '@/components/jurisprudentie/BenchmarkBar'
import RulingCard from '@/components/jurisprudentie/RulingCard'
import BroadenSuggestion from '@/components/jurisprudentie/BroadenSuggestion'
import OpponentProfiles from '@/components/jurisprudentie/OpponentProfiles'
import DoorlooptijdChart from '@/components/jurisprudentie/DoorlooptijdChart'
import { Skeleton } from '@/components/feedback/Skeleton'

const THEMA_LABELS: Record<string, string> = {
  etfal_ruimtelijke_ordening: 'Ruimtelijke impact',
  procedurefout: 'Procedure & proces',
  motiveringsgebrek: 'Onderbouwing',
  gelijkheidsbeginsel: 'Gelijke behandeling',
  disproportioneel: 'Evenredigheid',
}

const VERGUNNINGSTYPE_LABELS: Record<string, string> = {
  nieuwbouw: 'Nieuwbouw',
  verbouw: 'Verbouw',
  dakopbouw: 'Dakopbouw',
  uitbreiding: 'Uitbreiding',
  sloop: 'Sloop',
  bestemmingswijziging: 'Bestemmingswijziging',
  milieu: 'Milieu',
  monumenten: 'Monumenten',
  overig: 'Overig',
}

const PERIODE_LABELS: Record<string, string> = {
  '1jaar': '1 jaar',
  '3jaar': '3 jaar',
  '5jaar': '5 jaar',
}

export const Route = createFileRoute('/_authenticated/jurisprudentie')({
  validateSearch: (search: Record<string, unknown>) => ({
    gemeente:
      typeof search.gemeente === 'string' && search.gemeente.trim() ? search.gemeente : undefined,
    vergunningstype:
      typeof search.vergunningstype === 'string' && search.vergunningstype.trim()
        ? search.vergunningstype
        : undefined,
    uitkomst:
      typeof search.uitkomst === 'string' && search.uitkomst.trim() ? search.uitkomst : undefined,
    rechtsgrond:
      typeof search.rechtsgrond === 'string' && search.rechtsgrond.trim()
        ? search.rechtsgrond
        : undefined,
    rechtbank_niveau:
      typeof search.rechtbank_niveau === 'string' && search.rechtbank_niveau.trim()
        ? search.rechtbank_niveau
        : undefined,
    periode:
      typeof search.periode === 'string' && search.periode.trim() ? search.periode : undefined,
    view: search.view === 'results' ? ('results' as const) : undefined,
  }),
  component: JurisprudentiePage,
})

function JurisprudentiePage() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  const filters: ExplorerFilters = useMemo(
    () => ({
      gemeente: search.gemeente,
      vergunningstype: search.vergunningstype,
      uitkomst: search.uitkomst,
      rechtsgrond: search.rechtsgrond,
      rechtbank_niveau: search.rechtbank_niveau,
      periode: search.periode,
    }),
    [
      search.gemeente,
      search.vergunningstype,
      search.uitkomst,
      search.rechtsgrond,
      search.rechtbank_niveau,
      search.periode,
    ]
  )

  const showResults = search.view === 'results'

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useExplorerResults(filters)

  const allResults = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data?.pages]
  )

  const latestPage = data?.pages[data.pages.length - 1]
  const facets = latestPage?.facets ?? null
  const totalCount = data?.pages[0]?.total_count ?? 0
  const doorlooptijdPerType = latestPage?.doorlooptijd_per_type ?? []
  const opponentProfiles = latestPage?.opponent_profiles ?? []
  const hasActiveFilters = Object.values(filters).some(Boolean)

  /** Change a single filter dimension, stay in current view */
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
          view: search.view,
        },
        replace: true,
      })
    },
    [navigate, filters, search.view]
  )

  const handleRemoveFilter = useCallback(
    (dimension: keyof ExplorerFilters) => {
      handleFilterChange(dimension, undefined)
    },
    [handleFilterChange]
  )

  /** Navigate to results view */
  const goToResults = useCallback(() => {
    navigate({
      to: '/jurisprudentie',
      search: { gemeente: filters.gemeente, vergunningstype: filters.vergunningstype, uitkomst: filters.uitkomst, rechtsgrond: filters.rechtsgrond, rechtbank_niveau: filters.rechtbank_niveau, periode: filters.periode, view: 'results' as const },
      replace: true,
    })
  }, [navigate, filters])

  /** Navigate back to wizard (keep filters) */
  const goToWizard = useCallback(() => {
    navigate({
      to: '/jurisprudentie',
      search: { gemeente: filters.gemeente, vergunningstype: filters.vergunningstype, uitkomst: filters.uitkomst, rechtsgrond: filters.rechtsgrond, rechtbank_niveau: filters.rechtbank_niveau, periode: filters.periode, view: undefined },
      replace: true,
    })
  }, [navigate, filters])

  /** Clear everything, back to wizard */
  const clearAllFilters = useCallback(() => {
    navigate({
      to: '/jurisprudentie',
      search: {
        gemeente: undefined,
        vergunningstype: undefined,
        uitkomst: undefined,
        rechtsgrond: undefined,
        rechtbank_niveau: undefined,
        periode: undefined,
        view: undefined,
      },
      replace: true,
    })
  }, [navigate])

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !showResults) return

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
  }, [showResults, hasNextPage, isFetchingNextPage, fetchNextPage])

  /* ── Wizard mode (default landing) ──────────────── */
  if (!showResults) {
    return (
      <WizardFlow
        filters={filters}
        facets={facets}
        onFilterChange={handleFilterChange}
        onComplete={goToResults}
        totalCount={totalCount}
      />
    )
  }

  /* ── Results mode ─────────────────────────────────── */
  return (
    <div className="flex h-full flex-col overflow-hidden bg-aura-canvas">
      {/* Filter chips bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-aura-glass-white/60/50 px-6 py-3">
        <Scale size={18} className="text-amber-500/60" />
        <span className="text-sm font-medium text-aura-ink">Jurisprudentie</span>
        <div className="mx-2 h-4 w-px bg-neutral-300" />

        {filters.gemeente && (
          <Chip label={filters.gemeente} onRemove={() => handleRemoveFilter('gemeente')} />
        )}
        {filters.rechtbank_niveau && (
          <Chip
            label={filters.rechtbank_niveau}
            onRemove={() => handleRemoveFilter('rechtbank_niveau')}
          />
        )}
        {filters.vergunningstype && (
          <Chip
            label={VERGUNNINGSTYPE_LABELS[filters.vergunningstype] ?? filters.vergunningstype}
            onRemove={() => handleRemoveFilter('vergunningstype')}
          />
        )}
        {filters.rechtsgrond && (
          <Chip
            label={THEMA_LABELS[filters.rechtsgrond] ?? filters.rechtsgrond}
            onRemove={() => handleRemoveFilter('rechtsgrond')}
          />
        )}
        {filters.periode && (
          <Chip
            label={PERIODE_LABELS[filters.periode] ?? filters.periode}
            onRemove={() => handleRemoveFilter('periode')}
          />
        )}

        <span className="text-xs tabular-nums text-neutral-500">
          {totalCount} {totalCount === 1 ? 'uitspraak' : 'uitspraken'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={goToWizard}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 px-3 py-1.5 text-xs text-amber-400 transition-colors hover:bg-amber-500/10"
          >
            <SlidersHorizontal size={13} />
            Filters aanpassen
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-neutral-500 transition-colors hover:text-neutral-700"
            >
              Wis alles
            </button>
          )}
        </div>
      </div>

      {/* Results panel */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Benchmark stats */}
        {!isLoading && facets?.uitkomst && totalCount > 0 && (
          <BenchmarkBar
            uitkomstFacets={facets.uitkomst}
            totalCount={totalCount}
            results={allResults}
          />
        )}

        {/* Doorlooptijd per type + Opponent profiles side by side */}
        {!isLoading && (doorlooptijdPerType.length > 0 || opponentProfiles.length > 0) && (
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            {doorlooptijdPerType.length > 0 && (
              <DoorlooptijdChart data={doorlooptijdPerType} />
            )}
            {opponentProfiles.length > 0 && (
              <OpponentProfiles profiles={opponentProfiles} />
            )}
          </div>
        )}

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
                className="space-y-2 rounded-lg border border-neutral-200 bg-aura-glass-white/60 p-4"
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

        {/* Empty state */}
        {!isLoading && allResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Scale size={40} className="mb-3 text-neutral-500" />
            <h2 className="text-lg font-semibold text-neutral-700">Geen uitspraken gevonden</h2>
            <p className="mt-1 max-w-sm text-sm text-neutral-500">
              Pas je filters aan om meer resultaten te vinden.
            </p>
            <button
              onClick={goToWizard}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-aura-canvas transition-colors hover:bg-amber-400"
            >
              Filters aanpassen
            </button>
          </div>
        )}

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="mt-4 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-amber-500" />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 text-amber-400/50 transition-colors hover:text-amber-300"
      >
        <X size={10} />
      </button>
    </span>
  )
}
