import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { ChevronDown, ChevronRight, Search, X, Heart } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { PotentieModal, RisicoModal } from '@/components/projects/ScoreDetailModal'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'
import { STAGES } from '@/components/projects/PipelineStagePill'
import { SavedParcelCard } from '@/components/projects/SavedParcelCard'
import type { FavoriteResponse, PipelineStage } from '@/lib/types/portfolio'

export const Route = createFileRoute('/_authenticated/opgeslagen')({
  validateSearch: (search: Record<string, unknown>) => ({
    stage: STAGES.includes(search.stage as PipelineStage)
      ? (search.stage as PipelineStage)
      : undefined,
  }),
  component: OpgeslagenPage,
})

/* ── Helpers ───────────────────────────────────────────────── */

interface GemeenteGroup {
  gemeente_naam: string
  gemeente_code: string | null
  parcels: FavoriteResponse[]
  stageCounts: Record<PipelineStage, number>
}

function buildGroups(favorites: FavoriteResponse[]): GemeenteGroup[] {
  const map = new Map<string, GemeenteGroup>()

  for (const fav of favorites) {
    const key = fav.gemeente_naam ?? 'Onbekend'
    if (!map.has(key)) {
      map.set(key, {
        gemeente_naam: key,
        gemeente_code: fav.gemeente_code,
        parcels: [],
        stageCounts: { Gesignaleerd: 0, Onderzoek: 0, Contact: 0, Besluit: 0, Afgerond: 0 },
      })
    }
    const group = map.get(key)!
    group.parcels.push(fav)
    group.stageCounts[fav.pipeline_stage]++
  }

  const sorted = [...map.values()].sort((a, b) =>
    a.gemeente_naam.localeCompare(b.gemeente_naam, 'nl'),
  )
  for (const group of sorted) {
    group.parcels.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }
  return sorted
}

/* ── Count badge ─────────────────────────────────────────────── */

function CountBadge({ total }: { total: number }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-amber-400">
      <span className="text-[14px] font-bold text-aura-ink tabular-nums">{total}</span>
    </div>
  )
}

/* ── Score modal state ──────────────────────────────────────── */

type ScoreModalState = { parcelCacheId: string | null; type: 'potentie' | 'risico' } | null

/* ── Main Page ─────────────────────────────────────────────── */

function OpgeslagenPage() {
  const navigate = useNavigate()
  const { stage: stageFilter } = Route.useSearch()
  const { data: favorites, isLoading } = useParcelFavorites()
  const [expandedGemeenten, setExpandedGemeenten] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [scoreModal, setScoreModal] = useState<ScoreModalState>(null)

  const groups = useMemo(() => buildGroups(favorites ?? []), [favorites])

  const filteredGroups = useMemo(() => {
    let result = groups

    if (stageFilter) {
      result = result
        .map((g) => ({
          ...g,
          parcels: g.parcels.filter((p) => p.pipeline_stage === stageFilter),
        }))
        .filter((g) => g.parcels.length > 0)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result
        .map((g) => ({
          ...g,
          parcels: g.parcels.filter(
            (p) =>
              p.address?.toLowerCase().includes(q) ||
              p.parcel_id.toLowerCase().includes(q) ||
              g.gemeente_naam.toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.parcels.length > 0)
    }

    return result
  }, [groups, searchQuery, stageFilter])

  const totalCount = favorites?.length ?? 0
  const gemeenteCount = groups.length

  const toggleGemeente = (naam: string) => {
    setExpandedGemeenten((prev) => {
      const next = new Set(prev)
      if (next.has(naam)) next.delete(naam)
      else next.add(naam)
      return next
    })
  }

  if (isLoading) {
    return (
      <ResultsShell>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </ResultsShell>
    )
  }

  return (
    <ResultsShell>
      <motion.div variants={staggerContainer} initial="hidden" animate="show">

        {/* ── Hero Section ─────────────────────────────── */}
        <motion.div variants={fadeUp} className="mb-8">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-2">
            Portfolio
          </p>
          <h1 className="text-[32px] font-black tracking-tight text-aura-ink leading-none">
            {totalCount} opgeslagen
          </h1>
          <p className="text-[13px] text-slate-500 mt-2">
            in {gemeenteCount} {gemeenteCount === 1 ? 'gemeente' : 'gemeenten'}
          </p>
        </motion.div>

        {totalCount === 0 ? (
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={<Heart size={40} strokeWidth={1.5} className="text-amber-400" />}
              title="Geen opgeslagen percelen"
              description="Gebruik het hartje op de kaart om percelen op te slaan in je portfolio."
            />
          </motion.div>
        ) : (
          <>
            {/* ── Search ───────────────────────────────── */}
            <motion.div variants={fadeUp} className="relative mb-6">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op adres, perceel of gemeente..."
                className="w-full h-[44px] pl-11 pr-4 bg-aura-canvas rounded-full text-[13px] text-aura-ink placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-400/30 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </motion.div>

            {/* ── Gemeente Groups ──────────────────────── */}
            <div className="space-y-2">
              {filteredGroups.map((group) => {
                const isExpanded = expandedGemeenten.has(group.gemeente_naam)

                return (
                  <motion.div
                    key={group.gemeente_naam}
                    variants={fadeUp}
                    className="bg-white/60 backdrop-blur-[24px] rounded-[24px] border border-white/40 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Gemeente header */}
                    <button
                      onClick={() => toggleGemeente(group.gemeente_naam)}
                      aria-expanded={isExpanded}
                      className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <CountBadge total={group.parcels.length} />
                        <div className="text-left">
                          <p className="text-[15px] font-bold text-aura-ink tracking-tight">
                            {group.gemeente_naam}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {group.parcels.length} {group.parcels.length === 1 ? 'perceel' : 'percelen'}
                            {group.gemeente_code && (
                              <span className="ml-1.5 text-slate-300">· {group.gemeente_code}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          {STAGES.filter((s) => group.stageCounts[s] > 0).map((stage) => (
                            <span key={stage} className="text-[10px] font-bold text-slate-400 tabular-nums">
                              {group.stageCounts[stage]}
                            </span>
                          ))}
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Parcel list */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-white/40 p-4">
                            <motion.div
                              className="flex flex-col gap-3"
                              variants={staggerContainer}
                              initial="hidden"
                              animate="show"
                            >
                              {group.parcels.map((parcel) => (
                                <SavedParcelCard
                                  key={parcel.parcel_id}
                                  parcel={parcel}
                                  onOpenMap={() =>
                                    navigate({
                                      to: '/map',
                                      search: toMapParcelSearch({
                                        parcelId: parcel.parcel_id,
                                        fallbackAddress: parcel.address,
                                      }),
                                    })
                                  }
                                  onPotentieClick={() =>
                                    setScoreModal({ parcelCacheId: parcel.parcel_cache_id, type: 'potentie' })
                                  }
                                  onRisicoClick={() =>
                                    setScoreModal({ parcelCacheId: parcel.parcel_cache_id, type: 'risico' })
                                  }
                                />
                              ))}
                            </motion.div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>

            {filteredGroups.length === 0 && (searchQuery || stageFilter) && (
              <motion.div variants={fadeUp} className="text-center py-16">
                <p className="text-[13px] text-slate-400">
                  Geen resultaten
                  {stageFilter && ` in "${stageFilter}"`}
                  {searchQuery && ` voor "${searchQuery}"`}
                </p>
              </motion.div>
            )}

            {/* ── Trust metadata ───────────────────────── */}
            <motion.div variants={fadeUp} className="mt-6 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-slate-500">
                Portfolio · {totalCount} percelen
              </span>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ── Score modals (portal-rendered) ───────────────────── */}
      <PotentieModal
        open={scoreModal?.type === 'potentie'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={scoreModal?.parcelCacheId ?? null}
      />
      <RisicoModal
        open={scoreModal?.type === 'risico'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={scoreModal?.parcelCacheId ?? null}
      />
    </ResultsShell>
  )
}
