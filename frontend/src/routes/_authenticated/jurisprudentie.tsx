import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Scale, SlidersHorizontal, X } from 'lucide-react'
import { useExplorerResults, type ExplorerFilters } from '@/hooks/useExplorer'
import WizardFlow from '@/components/jurisprudentie/WizardFlow'
import BenchmarkBar from '@/components/jurisprudentie/BenchmarkBar'
import RulingCard from '@/components/jurisprudentie/RulingCard'
import BroadenSuggestion from '@/components/jurisprudentie/BroadenSuggestion'
import OpponentProfiles from '@/components/jurisprudentie/OpponentProfiles'
import DoorlooptijdChart from '@/components/jurisprudentie/DoorlooptijdChart'
import { Skeleton } from '@/components/feedback/Skeleton'

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

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
    <div className="w-full h-full overflow-y-auto bg-[#FAFCFA] rounded-[40px] pb-14 md:pb-0">
      <motion.div
        className="mx-auto max-w-5xl px-6 py-8"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >

        {/* ── Hero Section ─────────────────────────────── */}
        <motion.div variants={fadeUp} className="mb-8">
          <div className="flex items-end justify-between">
            <div>
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Jurisprudentie
              </p>
              <h1 className="text-[56px] font-black tracking-tighter text-[#0E1111] leading-none tabular-nums">
                {totalCount}
              </h1>
              <p className="text-[13px] text-slate-500 mt-1">
                {totalCount === 1 ? 'uitspraak' : 'uitspraken'}
              </p>
            </div>

            {/* Right side: outcome stats */}
            {!isLoading && facets?.uitkomst && totalCount > 0 && (
              <BenchmarkBar
                uitkomstFacets={facets.uitkomst}
                totalCount={totalCount}
                results={allResults}
              />
            )}
          </div>
        </motion.div>

        {/* ── Filter Bar ───────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex w-full items-center gap-2 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            {filters.gemeente && (
              <Chip label={filters.gemeente} onRemove={() => handleRemoveFilter('gemeente')} />
            )}
            {filters.rechtbank_niveau && (
              <Chip label={filters.rechtbank_niveau} onRemove={() => handleRemoveFilter('rechtbank_niveau')} />
            )}
            {filters.vergunningstype && (
              <Chip label={VERGUNNINGSTYPE_LABELS[filters.vergunningstype] ?? filters.vergunningstype} onRemove={() => handleRemoveFilter('vergunningstype')} />
            )}
            {filters.rechtsgrond && (
              <Chip label={THEMA_LABELS[filters.rechtsgrond] ?? filters.rechtsgrond} onRemove={() => handleRemoveFilter('rechtsgrond')} />
            )}
            {filters.periode && (
              <Chip label={PERIODE_LABELS[filters.periode] ?? filters.periode} onRemove={() => handleRemoveFilter('periode')} />
            )}

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-600 shrink-0 ml-1"
              >
                Wis alles
              </button>
            )}
          </div>
          <button
            onClick={goToWizard}
            className="flex items-center gap-1.5 rounded-full bg-[#0E1111] h-[36px] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 shrink-0"
          >
            <SlidersHorizontal size={13} />
            Filters aanpassen
          </button>
        </motion.div>

        {/* ── Analytics Cards ──────────────────────────── */}
        {!isLoading && (doorlooptijdPerType.length > 0 || opponentProfiles.length > 0) && (
          <motion.div variants={fadeUp} className={`mb-5 ${
            doorlooptijdPerType.length > 0 && opponentProfiles.length > 0
              ? 'grid gap-4 lg:grid-cols-2'
              : ''
          }`}>
            {opponentProfiles.length > 0 && (
              <OpponentProfiles profiles={opponentProfiles} />
            )}
            {doorlooptijdPerType.length > 0 && (
              <DoorlooptijdChart data={doorlooptijdPerType} />
            )}
          </motion.div>
        )}

        {/* ── Uitkomst filter pills ──────────────────── */}
        {!isLoading && totalCount > 0 && (
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-5 flex-wrap">
            {[
              { value: 'afgewezen', label: 'Afgewezen', activeBg: 'bg-red-500/15 border-red-500/30 text-red-600' },
              { value: 'toegewezen', label: 'Toegewezen', activeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600' },
              { value: 'gedeeltelijk', label: 'Gedeeltelijk', activeBg: 'bg-[#F9A826]/15 border-[#F9A826]/30 text-[#D48B1A]' },
            ].map(({ value, label, activeBg }) => {
              const isActive = filters.uitkomst === value
              return (
                <button
                  key={value}
                  onClick={() => handleFilterChange('uitkomst', isActive ? undefined : value)}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors ${
                    isActive
                      ? activeBg
                      : 'bg-white border-[#EAEFEF] text-[#0E1111] hover:border-slate-300'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </motion.div>
        )}

        {/* Broaden suggestion */}
        {!isLoading && totalCount < 3 && hasActiveFilters && (
          <div className="mb-5">
            <BroadenSuggestion
              activeFilters={filters}
              facets={facets}
              resultCount={totalCount}
              onRemoveFilter={handleRemoveFilter}
            />
          </div>
        )}

        {/* ── Loading ──────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-[24px] border border-[#EAEFEF] bg-white p-5">
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

        {/* ── Ruling Cards ─────────────────────────────── */}
        {!isLoading && allResults.length > 0 && (
          <motion.div variants={fadeUp} className="space-y-2">
            {allResults.map((ruling) => (
              <RulingCard key={ruling.ecli} ruling={ruling} onFilterChange={handleFilterChange} />
            ))}
          </motion.div>
        )}

        {/* ── Empty State ──────────────────────────────── */}
        {!isLoading && allResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Scale size={40} strokeWidth={1.5} className="mb-3 text-slate-300" />
            <h2 className="text-[15px] font-bold text-[#0E1111]">Geen uitspraken gevonden</h2>
            <p className="mt-1 max-w-sm text-[13px] text-slate-400">
              Pas je filters aan om meer resultaten te vinden.
            </p>
            <button
              onClick={goToWizard}
              className="mt-5 rounded-full bg-[#0E1111] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Filters aanpassen
            </button>
          </div>
        )}

        {/* Loading more */}
        {isFetchingNextPage && (
          <div className="mt-4 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#F9A826]" />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />

        {/* ── Trust metadata ───────────────────────────── */}
        <div className="mt-6 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider text-slate-300">
            Jurisprudentie · {totalCount} uitspraken
          </span>
        </div>
      </motion.div>
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0E1111] shadow-sm border border-[#EAEFEF]">
      {label}
      <button
        onClick={onRemove}
        className="text-slate-300 transition-colors hover:text-slate-500"
      >
        <X size={10} />
      </button>
    </span>
  )
}
