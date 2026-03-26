import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { ChevronDown, ChevronRight, Search, X, Check, Heart, MapPin, Bookmark, FileText } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useParcelFavorites, useUpdatePipelineStage } from '@/hooks/useFavorites'
import { useReports } from '@/hooks/useReports'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { FavoriteParcelWorkspaceView } from '@/components/projects/FavoriteParcelWorkspaceView'
import { ScoreBadge, PotentieModal, RisicoModal } from '@/components/projects/ScoreDetailModal'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'
import type { FavoriteResponse, PipelineStage } from '@/lib/types/portfolio'

const STAGES: PipelineStage[] = ['Gesignaleerd', 'Onderzoek', 'Contact', 'Besluit', 'Afgerond']

export const Route = createFileRoute('/_authenticated/opgeslagen')({
  validateSearch: (search: Record<string, unknown>) => ({
    stage: STAGES.includes(search.stage as PipelineStage)
      ? (search.stage as PipelineStage)
      : undefined,
  }),
  component: OpgeslagenPage,
})

/* ── Animations ────────────────────────────────────────────── */

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

/* ── Count badge (amber ring with count) ────────────────────── */

function CountBadge({ total }: { total: number }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-[#F9A826]">
      <span className="text-[14px] font-bold text-[#0E1111] tabular-nums">{total}</span>
    </div>
  )
}

/* ── Main Page ─────────────────────────────────────────────── */

function OpgeslagenPage() {
  const navigate = useNavigate()
  const { stage: stageFilter } = Route.useSearch()
  const { data: favorites, isLoading } = useParcelFavorites()
  const { data: reportsData, isLoading: reportsLoading } = useReports()
  const [activeTab, setActiveTab] = useState<'percelen' | 'rapporten'>('percelen')
  const [expandedGemeenten, setExpandedGemeenten] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [workspaceParcelId, setWorkspaceParcelId] = useState<string | null>(null)

  // Derive workspaceParcel from fresh query data so mutations are reflected
  const workspaceParcel = useMemo(
    () => (workspaceParcelId ? (favorites ?? []).find((f) => f.parcel_id === workspaceParcelId) ?? null : null),
    [workspaceParcelId, favorites],
  )
  const setWorkspaceParcel = useCallback(
    (p: FavoriteResponse | null) => setWorkspaceParcelId(p?.parcel_id ?? null),
    [],
  )

  const groups = useMemo(() => buildGroups(favorites ?? []), [favorites])

  // Filter
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

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const stage of STAGES) counts[stage] = 0
    for (const fav of favorites ?? []) {
      counts[fav.pipeline_stage] = (counts[fav.pipeline_stage] ?? 0) + 1
    }
    return counts
  }, [favorites])

  const setStageFilter = (stage: PipelineStage | undefined) => {
    navigate({ to: '/opgeslagen', search: { stage }, replace: true })
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
        </div>
      </ResultsShell>
    )
  }

  if (workspaceParcel) {
    return (
      <ResultsShell>
        <FavoriteParcelWorkspaceView
          favorite={workspaceParcel}
          onBack={() => setWorkspaceParcel(null)}
          onOpenMap={() => navigateToParcel(workspaceParcel)}
        />
      </ResultsShell>
    )
  }

  return (
    <ResultsShell>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {/* ── Hero Section ─────────────────────────────── */}
        <motion.div variants={fadeUp} className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {activeTab === 'percelen' ? 'Portfolio' : 'Rapporten'}
              </p>
              <h1 className="text-[56px] font-black tracking-tighter text-[#0E1111] leading-none tabular-nums" style={{ textWrap: 'balance' }}>
                {activeTab === 'percelen' ? totalCount : (reportsData?.total ?? 0)}
              </h1>
              <p className="text-[13px] text-slate-500 mt-1" style={{ textWrap: 'pretty' }}>
                {activeTab === 'percelen'
                  ? `opgeslagen in ${gemeenteCount} ${gemeenteCount === 1 ? 'gemeente' : 'gemeenten'}`
                  : `${(reportsData?.total ?? 0) === 1 ? 'rapport' : 'rapporten'} opgeslagen`
                }
              </p>
            </div>

            {/* Toggle — same position as documentatie */}
            <div className="flex items-center rounded-full border border-[#0E1111] p-0.5 shrink-0 mt-2">
              <button
                onClick={() => setActiveTab('percelen')}
                className={`flex items-center justify-center rounded-full p-2 transition-colors ${
                  activeTab === 'percelen'
                    ? 'bg-[#F9A826] text-[#0E1111]'
                    : 'text-slate-400 hover:text-[#0E1111]'
                }`}
                title="Percelen"
              >
                <Bookmark size={16} strokeWidth={2} />
              </button>
              <button
                onClick={() => setActiveTab('rapporten')}
                className={`flex items-center justify-center rounded-full p-2 transition-colors ${
                  activeTab === 'rapporten'
                    ? 'bg-[#F9A826] text-[#0E1111]'
                    : 'text-slate-400 hover:text-[#0E1111]'
                }`}
                title="Rapporten"
              >
                <FileText size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </motion.div>

        {activeTab === 'rapporten' ? (
          /* ── Rapporten tab ── */
          <RapportenView reports={reportsData?.reports ?? []} isLoading={reportsLoading} navigate={navigate} />
        ) : totalCount === 0 ? (
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={<Heart size={40} strokeWidth={1.5} className="text-[#F9A826]" />}
              title="Geen opgeslagen percelen"
              description="Gebruik het hartje op de kaart om percelen op te slaan in je portfolio."
            />
          </motion.div>
        ) : (
          <>
            {/* ── Pipeline Filter Bar ──────────────────── */}
            <motion.div variants={fadeUp} className="flex w-full h-[44px] rounded-full p-1 bg-[#F2F6F3] mb-5">
              <button
                onClick={() => setStageFilter(undefined)}
                className="relative flex-1 h-full rounded-full flex items-center justify-center transition-colors"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '12px',
                  fontWeight: !stageFilter ? 700 : 600,
                  color: !stageFilter ? undefined : '#94a3b8',
                }}
              >
                {!stageFilter && (
                  <motion.div
                    layoutId="pipeline-tab"
                    className="absolute inset-0 rounded-full bg-[#0E1111]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 ${!stageFilter ? 'text-white' : ''}`}>
                  Alle
                </span>
              </button>
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  onClick={() => setStageFilter(stageFilter === stage ? undefined : stage)}
                  className="relative flex-1 h-full rounded-full flex items-center justify-center transition-colors"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: stageFilter === stage ? 700 : 600,
                    color: stageFilter === stage ? undefined : '#94a3b8',
                  }}
                >
                  {stageFilter === stage && (
                    <motion.div
                      layoutId="pipeline-tab"
                      className="absolute inset-0 rounded-full bg-[#0E1111]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${stageFilter === stage ? 'text-white' : ''}`}>
                    {stage}
                  </span>
                </button>
              ))}
            </motion.div>

            {/* ── Search ───────────────────────────────── */}
            <motion.div variants={fadeUp} className="relative mb-6">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek op adres, perceel of gemeente..."
                className="w-full h-[44px] pl-11 pr-4 bg-[#F2F6F3] rounded-full text-[13px] text-[#0E1111] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#F9A826]/30 transition"
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
                    className="bg-white rounded-[24px] border border-[#EAEFEF] shadow-sm hover:shadow-md transition-shadow"
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
                          <p className="text-[15px] font-bold text-[#0E1111] tracking-tight">
                            {group.gemeente_naam}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {group.parcels.length} {group.parcels.length === 1 ? 'perceel' : 'percelen'}
                            {group.gemeente_code && <span className="ml-1.5 text-slate-300">· {group.gemeente_code}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Stage dots summary */}
                        <div className="flex items-center gap-1">
                          {STAGES.filter(s => group.stageCounts[s] > 0).map((stage) => (
                            <span
                              key={stage}
                              className="text-[10px] font-bold text-slate-400 tabular-nums"
                            >
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
                          <div className="border-t border-[#EAEFEF]">
                            {group.parcels.map((parcel) => (
                              <ParcelRow
                                key={parcel.id}
                                parcel={parcel}
                                onNavigate={() => navigateToParcel(parcel)}
                                onOpenWorkspace={() => setWorkspaceParcel(parcel)}
                              />
                            ))}
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
    </ResultsShell>
  )
}

/* ── ParcelRow ─────────────────────────────────────────────── */

function ParcelRow({
  parcel,
  onNavigate,
  onOpenWorkspace,
}: {
  parcel: FavoriteResponse
  onNavigate: () => void
  onOpenWorkspace: () => void
}) {
  const address = parcel.address || parcel.parcel_id
  const subtitle = parcel.address ? parcel.parcel_id : null
  const [scoreModal, setScoreModal] = useState<'potentie' | 'risico' | null>(null)

  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors">
      <button onClick={onOpenWorkspace} className="min-w-0 flex-1 text-left">
        <p className="text-[13px] font-semibold text-[#0E1111] truncate">
          {address}
        </p>
        {subtitle && (
          <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
            {subtitle}
          </p>
        )}
      </button>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        {parcel.potentie_score != null && (
          <ScoreBadge
            score={parcel.potentie_score}
            type="potentie"
            size="sm"
            onClick={() => setScoreModal('potentie')}
          />
        )}
        {parcel.risico_score != null && (
          <ScoreBadge
            score={parcel.risico_score}
            type="risico"
            size="sm"
            onClick={() => setScoreModal('risico')}
          />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate()
          }}
          aria-label="Open op kaart"
          title="Open op kaart"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0E1111] text-[#F9A826] transition-colors hover:bg-slate-800"
        >
          <MapPin size={14} />
        </button>
        <PipelineStagePill parcel={parcel} />
      </div>

      <PotentieModal
        open={scoreModal === 'potentie'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={parcel.parcel_cache_id}
      />
      <RisicoModal
        open={scoreModal === 'risico'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={parcel.parcel_cache_id}
      />
    </div>
  )
}

/* ── Pipeline Stage Pill (compact dropdown switcher) ──────────────────── */

const PIPELINE_STAGES: PipelineStage[] = ['Gesignaleerd', 'Onderzoek', 'Contact', 'Besluit', 'Afgerond']

function PipelineStagePill({ parcel }: { parcel: FavoriteResponse }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const updateStage = useUpdatePipelineStage()

  useEffect(() => {
    if (!isOpen) return undefined
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- positioning from DOM rect is external system sync
    if (!isOpen) { setMenuPosition(null); return undefined }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition({
        top: rect.bottom + 6,
        left: Math.min(window.innerWidth - 180 - 12, Math.max(12, rect.right - 180)),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen((o) => !o) }}
        className="inline-flex min-h-[28px] items-center rounded-full border border-[#0E1111] bg-[#F9A826] px-3 text-[11px] font-semibold text-[#0E1111] transition-colors hover:bg-[#E8951F]"
      >
        {parcel.pipeline_stage}
      </button>
      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }}
          className="w-[180px] rounded-[16px] border border-[#EAEFEF] bg-white py-1.5 shadow-xl"
        >
          {PIPELINE_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (stage !== parcel.pipeline_stage) {
                  updateStage.mutate({ parcelId: parcel.parcel_id, stage })
                }
                setIsOpen(false)
              }}
              className="flex w-full items-center justify-between px-4 py-2 text-[12px] hover:bg-[#F8FAFA] transition-colors"
            >
              <span className={stage === parcel.pipeline_stage ? 'font-bold text-[#0E1111]' : 'text-slate-600'}>
                {stage}
              </span>
              {stage === parcel.pipeline_stage && <Check size={12} className="text-[#F9A826]" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

/* ─── Rapporten View ──────────────────────────────────────── */

function RapportenView({
  reports,
  isLoading: loading,
  navigate,
}: {
  reports: { id: string; report_name: string; postcode: string; city: string; completeness_score: number; created_at: string; updated_at: string }[]
  isLoading: boolean
  navigate: ReturnType<typeof useNavigate>
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <EmptyState
          icon={<FileText size={40} strokeWidth={1.5} className="text-[#F9A826]" />}
          title="Geen rapporten"
          description="Genereer een rapport vanuit een perceeldetail om het hier terug te vinden."
        />
      </motion.div>
    )
  }

  // Group by city
  const byCity = new Map<string, typeof reports>()
  for (const r of reports) {
    const list = byCity.get(r.city) ?? []
    list.push(r)
    byCity.set(r.city, list)
  }

  const dateFmt = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
      {[...byCity.entries()].map(([city, cityReports]) => (
        <motion.div key={city} variants={fadeUp}>
          <div className="bg-white rounded-[24px] border border-[#EAEFEF] shadow-sm">
            {/* City header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAEFEF]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-[#F9A826]">
                  <span className="text-[14px] font-bold text-[#0E1111] tabular-nums">{cityReports.length}</span>
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#0E1111] tracking-tight">{city}</p>
                  <p className="text-[11px] text-slate-400">{cityReports.length} {cityReports.length === 1 ? 'rapport' : 'rapporten'}</p>
                </div>
              </div>
            </div>

            {/* Report rows */}
            <div className="divide-y divide-[#EAEFEF]">
              {cityReports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => navigate({ to: '/rapport/$id', params: { id: report.id } })}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-[#0E1111] truncate">{report.report_name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {report.postcode} · {dateFmt.format(new Date(report.created_at))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {/* Completeness ring */}
                    <div className="relative flex items-center justify-center" style={{ width: 36, height: 36 }}>
                      <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#EAEFEF" strokeWidth="2.5" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#F9A826" strokeWidth="2.5"
                          strokeDasharray={`${(report.completeness_score / 100) * (2 * Math.PI * 14)} ${(2 * Math.PI * 14) - (report.completeness_score / 100) * (2 * Math.PI * 14)}`}
                          strokeLinecap="round" />
                      </svg>
                      <span className="absolute text-[10px] font-bold tabular-nums text-[#0E1111]">{Math.round(report.completeness_score)}</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
