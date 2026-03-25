/**
 * Subsidie Explorer — browse national RVO subsidies with sector/doelgroep filters.
 *
 * Design consistent with jurisprudentie page: staggerContainer/fadeUp animations,
 * ResultsShell wrapper, amber filter pills, responsive card grid.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { HandCoins } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import SubsidieCard from '@/components/subsidies/SubsidieCard'
import {
  useSubsidieExplorer,
  type SubsidieFilters,
  type SubsidieFacetItem,
} from '@/hooks/useSubsidieExplorer'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'

/* ─── Route ─────────────────────────────────────────────────── */

export const Route = createFileRoute('/_authenticated/subsidies')({
  validateSearch: (search: Record<string, unknown>) => ({
    sector:
      typeof search.sector === 'string' && search.sector.trim()
        ? search.sector
        : undefined,
    target:
      typeof search.target === 'string' && search.target.trim()
        ? search.target
        : undefined,
  }),
  component: SubsidiesPage,
})

/* ─── Animations ────────────────────────────────────────────── */

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

/* ─── Filter pill ───────────────────────────────────────────── */

function FilterPill({
  facet,
  active,
  onClick,
}: {
  facet: SubsidieFacetItem
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors ${
        active
          ? 'bg-[#F9A826]/15 border-[#F9A826]/30 text-[#D48B1A]'
          : 'bg-white border-[#EAEFEF] text-[#0E1111] hover:border-slate-300'
      }`}
    >
      {facet.value}
      <span className="ml-1 text-slate-400">{facet.count}</span>
    </button>
  )
}

/* ─── Loading skeletons ─────────────────────────────────────── */

function LoadingSkeletons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[24px] border border-[#EAEFEF] bg-white px-6 py-5">
          <Skeleton className="h-5 w-3/4 mb-3" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3 mb-3" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────── */

function SubsidiesPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()

  const filters: SubsidieFilters = useMemo(
    () => ({ sector: search.sector, target: search.target }),
    [search.sector, search.target],
  )

  const { data, allCount, isLoading, error } = useSubsidieExplorer(filters)

  const results = data?.results ?? []
  const facets = data?.facets ?? null
  const totalCount = data?.total_count ?? 0
  const hasActiveFilters = Object.values(filters).some(Boolean)

  /** Toggle a single filter dimension, stay in current view */
  const handleFilterChange = useCallback(
    (dimension: keyof SubsidieFilters, value: string | undefined) => {
      navigate({
        to: '/subsidies',
        search: {
          sector: filters.sector,
          target: filters.target,
          [dimension]: value,
        },
        replace: true,
      })
    },
    [navigate, filters],
  )

  return (
    <ResultsShell>
      <div className="mx-auto max-w-5xl">
        {/* ── Hero ─────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p
            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Beschikbare subsidies
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <h1 className="text-[56px] font-black leading-none tracking-tight text-[#0E1111] tabular-nums">
              {isLoading ? '–' : totalCount}
            </h1>
            {!isLoading && hasActiveFilters && allCount > 0 && (
              <span className="text-[14px] text-slate-400">
                van {allCount} regelingen
              </span>
            )}
          </div>
          {!isLoading && !hasActiveFilters && (
            <p className="mt-1 text-[14px] text-slate-500">
              bouw- en woningregelingen via RVO
            </p>
          )}
        </motion.div>

        {/* ── Filter pills ─────────────────────────────────── */}
        {!isLoading && facets && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-6 space-y-4"
          >
            {/* Sector */}
            {facets.sectors.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-2">
                  Sector
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {facets.sectors.map((facet) => (
                    <FilterPill
                      key={facet.value}
                      facet={facet}
                      active={filters.sector === facet.value}
                      onClick={() =>
                        handleFilterChange(
                          'sector',
                          filters.sector === facet.value ? undefined : facet.value,
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Doelgroep */}
            {facets.targets.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-semibold mb-2">
                  Doelgroep
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {facets.targets.map((facet) => (
                    <FilterPill
                      key={facet.value}
                      facet={facet}
                      active={filters.target === facet.value}
                      onClick={() =>
                        handleFilterChange(
                          'target',
                          filters.target === facet.value ? undefined : facet.value,
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Results ──────────────────────────────────────── */}
        <div className="mt-8">
          {isLoading ? (
            <LoadingSkeletons />
          ) : error ? (
            <EmptyState
              title="Subsidies konden niet worden geladen"
              description={error.message}
            />
          ) : results.length === 0 ? (
            <EmptyState
              icon={<HandCoins size={32} strokeWidth={1.5} className="text-slate-400" />}
              title={hasActiveFilters ? 'Geen subsidies gevonden' : 'Geen subsidies beschikbaar'}
              description={
                hasActiveFilters
                  ? 'Pas de filters aan om meer resultaten te zien.'
                  : 'Er zijn momenteel geen subsidies beschikbaar.'
              }
            />
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {results.map((item) => (
                <motion.div key={item.id} variants={fadeUp}>
                  <SubsidieCard item={item} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        {!isLoading && results.length > 0 && (
          <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Subsidies · {totalCount} regelingen
          </p>
        )}
      </div>
    </ResultsShell>
  )
}
