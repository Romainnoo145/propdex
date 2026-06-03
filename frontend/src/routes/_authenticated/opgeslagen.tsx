import { createFileRoute, useNavigate, useMatchRoute, Outlet } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { Search, X, Heart } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { PotentieModal, RisicoModal } from '@/components/projects/ScoreDetailModal'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'
import { STAGES } from '@/components/projects/PipelineStagePill'
import {
  GemeenteGroupAccordion,
  type GemeenteGroup,
} from '@/components/projects/GemeenteGroupAccordion'
import type { FavoriteResponse, PipelineStage } from '@/lib/types/portfolio'

export const Route = createFileRoute('/_authenticated/opgeslagen')({
  validateSearch: (search: Record<string, unknown>): { stage?: PipelineStage } => ({
    stage: STAGES.includes(search.stage as PipelineStage)
      ? (search.stage as PipelineStage)
      : undefined,
  }),
  component: OpgeslagenPage,
})

/* ── Helpers ───────────────────────────────────────────────── */

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

/* ── Score modal state ──────────────────────────────────────── */

type ScoreModalState = { parcelCacheId: string | null; type: 'potentie' | 'risico' } | null

/* ── Main Page ─────────────────────────────────────────────── */

function OpgeslagenPage() {
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const isWorkspaceActive = !!matchRoute({ to: '/opgeslagen/perceel/$parcelId', fuzzy: true })
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

  // Workspace portal: child route (/opgeslagen/perceel/$parcelId/*) renders here via Outlet.
  // Slide-in transition gives the "entering the parcel workspace" feel.
  if (isWorkspaceActive) {
    return (
      <motion.div
        key="workspace"
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        className="h-full"
      >
        <Outlet />
      </motion.div>
    )
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
              {filteredGroups.map((group) => (
                <GemeenteGroupAccordion
                  key={group.gemeente_naam}
                  group={group}
                  isExpanded={expandedGemeenten.has(group.gemeente_naam)}
                  onToggle={() => toggleGemeente(group.gemeente_naam)}
                  onOpenMap={(parcel) =>
                    navigate({
                      to: '/map',
                      search: toMapParcelSearch({
                        parcelId: parcel.parcel_id,
                        fallbackAddress: parcel.address,
                      }),
                    })
                  }
                  onPotentieClick={(parcel) =>
                    setScoreModal({ parcelCacheId: parcel.parcel_cache_id, type: 'potentie' })
                  }
                  onRisicoClick={(parcel) =>
                    setScoreModal({ parcelCacheId: parcel.parcel_cache_id, type: 'risico' })
                  }
                />
              ))}
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
