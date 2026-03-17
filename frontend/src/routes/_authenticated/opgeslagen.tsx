import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState, useRef, useEffect } from 'react'
import { Bookmark, MapPin, ChevronDown, ChevronRight, Search, X, Check } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useParcelFavorites, useUpdatePipelineStage } from '@/hooks/useFavorites'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'
import type { FavoriteResponse, PipelineStage } from '@/lib/types/portfolio'

const STAGES: PipelineStage[] = ['Gesignaleerd', 'Onderzoek', 'Contact', 'Besluit', 'Afgerond']

const STAGE_COLORS: Record<PipelineStage, string> = {
  Gesignaleerd: 'bg-neutral-200 text-neutral-700',
  Onderzoek: 'bg-blue-100 text-blue-700',
  Contact: 'bg-amber-100 text-amber-700',
  Besluit: 'bg-purple-100 text-purple-700',
  Afgerond: 'bg-emerald-100 text-emerald-700',
}

const STAGE_COLORS_ACTIVE: Record<PipelineStage, string> = {
  Gesignaleerd: 'bg-neutral-800 text-white',
  Onderzoek: 'bg-blue-600 text-white',
  Contact: 'bg-amber-500 text-white',
  Besluit: 'bg-purple-600 text-white',
  Afgerond: 'bg-emerald-600 text-white',
}

export const Route = createFileRoute('/_authenticated/opgeslagen')({
  validateSearch: (search: Record<string, unknown>) => ({
    stage: STAGES.includes(search.stage as PipelineStage)
      ? (search.stage as PipelineStage)
      : undefined,
  }),
  component: OpgeslagenPage,
})

interface GemeenteGroup {
  gemeente_naam: string
  gemeente_code: string | null
  parcels: FavoriteResponse[]
}

function OpgeslagenPage() {
  const navigate = useNavigate()
  const { stage: stageFilter } = Route.useSearch()
  const { data: favorites, isLoading } = useParcelFavorites()
  const [expandedGemeenten, setExpandedGemeenten] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Group favorites by gemeente
  const groups = useMemo(() => {
    if (!favorites?.length) return []

    const map = new Map<string, GemeenteGroup>()

    for (const fav of favorites) {
      const key = fav.gemeente_naam ?? 'Onbekend'
      if (!map.has(key)) {
        map.set(key, { gemeente_naam: key, gemeente_code: fav.gemeente_code, parcels: [] })
      }
      map.get(key)!.parcels.push(fav)
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
  }, [favorites])

  // Filter by search + pipeline stage
  const filteredGroups = useMemo(() => {
    let result = groups

    // Stage filter
    if (stageFilter) {
      result = result
        .map((g) => ({
          ...g,
          parcels: g.parcels.filter((p) => p.pipeline_stage === stageFilter),
        }))
        .filter((g) => g.parcels.length > 0)
    }

    // Search filter
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

  // Stage counts for filter bar
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const stage of STAGES) counts[stage] = 0
    for (const fav of favorites ?? []) {
      counts[fav.pipeline_stage] = (counts[fav.pipeline_stage] ?? 0) + 1
    }
    return counts
  }, [favorites])

  const setStageFilter = (stage: PipelineStage | undefined) => {
    navigate({
      to: '/opgeslagen',
      search: { stage },
      replace: true,
    })
  }

  const toggleGemeente = (naam: string) => {
    setExpandedGemeenten((prev) => {
      const next = new Set(prev)
      if (next.has(naam)) next.delete(naam)
      else next.add(naam)
      return next
    })
  }

  const navigateToParcel = (parcel: FavoriteResponse) => {
    navigate({
      to: '/map',
      search: toMapParcelSearch({
        parcelId: parcel.parcel_id,
        fallbackAddress: parcel.address,
      }),
    })
  }

  if (isLoading) {
    return (
      <ResultsShell>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </ResultsShell>
    )
  }

  return (
    <ResultsShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-aura-ink tracking-tight font-display">
            Opgeslagen
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalCount} {totalCount === 1 ? 'perceel' : 'percelen'} opgeslagen
          </p>
        </div>
      </div>

      {totalCount === 0 ? (
        <EmptyState
          icon={<Bookmark size={40} strokeWidth={1.5} className="text-slate-300" />}
          title="Geen opgeslagen percelen"
          description="Gebruik het hartje op de kaart om percelen op te slaan."
        />
      ) : (
        <>
          {/* Pipeline stage filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setStageFilter(undefined)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !stageFilter
                  ? 'bg-aura-ink text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Alle ({totalCount})
            </button>
            {STAGES.map((stage) => (
              <button
                key={stage}
                onClick={() => setStageFilter(stageFilter === stage ? undefined : stage)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  stageFilter === stage
                    ? STAGE_COLORS_ACTIVE[stage]
                    : `${STAGE_COLORS[stage]} hover:opacity-80`
                }`}
              >
                {stage} ({stageCounts[stage] ?? 0})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek op adres, perceel of gemeente..."
              className="w-full h-10 pl-10 pr-4 bg-[#F2F6F3] rounded-full text-[13px] text-aura-ink placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-aura-amber/30 transition"
            />
          </div>

          {/* Gemeente groups */}
          <div className="space-y-3">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGemeenten.has(group.gemeente_naam)

              return (
                <div
                  key={group.gemeente_naam}
                  className="bg-white/60 backdrop-blur-xl rounded-[24px] border border-white/30 overflow-hidden"
                >
                  {/* Gemeente header */}
                  <button
                    onClick={() => toggleGemeente(group.gemeente_naam)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F2F6F3]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F6F3]">
                        <MapPin size={16} className="text-aura-ink" />
                      </div>
                      <div className="text-left">
                        <p className="text-[14px] font-bold text-aura-ink tracking-tight">
                          {group.gemeente_naam}
                        </p>
                        <p className="text-[12px] text-slate-500">
                          {group.parcels.length} {group.parcels.length === 1 ? 'perceel' : 'percelen'}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-400" />
                    )}
                  </button>

                  {/* Parcel list */}
                  {isExpanded && (
                    <div className="border-t border-[#EAEFEF]">
                      {group.parcels.map((parcel) => (
                        <ParcelRow
                          key={parcel.id}
                          parcel={parcel}
                          onNavigate={() => navigateToParcel(parcel)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filteredGroups.length === 0 && (searchQuery || stageFilter) && (
            <div className="text-center py-12 text-[13px] text-slate-400">
              Geen resultaten
              {stageFilter && ` voor stage "${stageFilter}"`}
              {searchQuery && ` met zoekterm "${searchQuery}"`}
            </div>
          )}
        </>
      )}
    </ResultsShell>
  )
}

// ---------------------------------------------------------------------------
// ParcelRow with pipeline stage pill
// ---------------------------------------------------------------------------

function ParcelRow({
  parcel,
  onNavigate,
}: {
  parcel: FavoriteResponse
  onNavigate: () => void
}) {
  const address = parcel.address || parcel.parcel_id
  const subtitle = parcel.address ? parcel.parcel_id : null

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-[#EAEFEF] last:border-b-0 hover:bg-[#F2F6F3]/50 transition-colors">
      <button onClick={onNavigate} className="min-w-0 flex-1 text-left">
        <p className="text-[13px] font-semibold text-aura-ink truncate">
          {address}
        </p>
        {subtitle && (
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </button>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <PipelineStagePill parcel={parcel} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipeline stage pill with dropdown
// ---------------------------------------------------------------------------

function PipelineStagePill({ parcel }: { parcel: FavoriteResponse }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAfgerondForm, setShowAfgerondForm] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const updateStage = useUpdatePipelineStage()

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const handleStageSelect = (stage: PipelineStage) => {
    if (stage === 'Afgerond') {
      setShowAfgerondForm(true)
      setIsOpen(false)
      return
    }
    updateStage.mutate({ parcelId: parcel.parcel_id, stage })
    setIsOpen(false)
  }

  const handleAfgerondSubmit = (reden: string, notitie: string) => {
    updateStage.mutate({
      parcelId: parcel.parcel_id,
      stage: 'Afgerond',
      afgerondReden: reden,
      notitie: notitie || null,
    })
    setShowAfgerondForm(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${STAGE_COLORS[parcel.pipeline_stage]} hover:opacity-80`}
      >
        {parcel.pipeline_stage}
        {parcel.pipeline_stage === 'Afgerond' && parcel.afgerond_reden && (
          <span className="ml-1 opacity-70">· {parcel.afgerond_reden}</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-neutral-200 bg-white shadow-lg py-1">
          {STAGES.map((stage) => (
            <button
              key={stage}
              onClick={(e) => {
                e.stopPropagation()
                handleStageSelect(stage)
              }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-neutral-50 flex items-center gap-2 ${
                stage === parcel.pipeline_stage ? 'font-semibold' : ''
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage].split(' ')[0]}`} />
              {stage}
              {stage === parcel.pipeline_stage && <Check size={12} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}

      {/* Afgerond reason modal */}
      {showAfgerondForm && (
        <AfgerondForm
          onSubmit={handleAfgerondSubmit}
          onCancel={() => setShowAfgerondForm(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Afgerond reason form (mini modal)
// ---------------------------------------------------------------------------

function AfgerondForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reden: string, notitie: string) => void
  onCancel: () => void
}) {
  const [reden, setReden] = useState<string>('')
  const [notitie, setNotitie] = useState('')

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-aura-ink">Afgerond markeren</h3>
          <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-600">
            <X size={16} />
          </button>
        </div>

        {/* Reason */}
        <p className="text-xs text-neutral-500 mb-2">Reden</p>
        <div className="flex gap-2 mb-4">
          {['Gekocht', 'Afgewezen'].map((option) => (
            <button
              key={option}
              onClick={() => setReden(option)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                reden === option
                  ? 'border-aura-amber bg-aura-amber/10 text-aura-amber'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Note */}
        <p className="text-xs text-neutral-500 mb-1.5">Notitie (optioneel)</p>
        <textarea
          value={notitie}
          onChange={(e) => setNotitie(e.target.value)}
          placeholder="Eventuele toelichting..."
          className="w-full h-20 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-aura-ink placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-aura-amber/30 resize-none"
        />

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-xs font-medium border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
          >
            Annuleren
          </button>
          <button
            onClick={() => onSubmit(reden, notitie)}
            disabled={!reden}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-aura-amber text-aura-ink hover:bg-aura-amber/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bevestigen
          </button>
        </div>
      </div>
    </div>
  )
}
