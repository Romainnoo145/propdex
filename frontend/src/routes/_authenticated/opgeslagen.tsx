import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Search, X, Check, Heart, MapPin } from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { useParcelFavorites, useUpdatePipelineStage } from '@/hooks/useFavorites'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { FavoriteParcelWorkspaceView } from '@/components/projects/FavoriteParcelWorkspaceView'
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

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

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

/* ── Stage progress ring (mini) ────────────────────────────── */

function StageRing({ counts, total }: { counts: Record<PipelineStage, number>; total: number }) {
  const r = 18
  const circumference = 2 * Math.PI * r
  // Show progress as: Afgerond = full, Besluit = 80%, Contact = 60%, Onderzoek = 40%, Gesignaleerd = 20%
  const progress = total > 0
    ? (counts.Afgerond * 1 + counts.Besluit * 0.8 + counts.Contact * 0.6 + counts.Onderzoek * 0.4 + counts.Gesignaleerd * 0.2) / total
    : 0

  return (
    <svg viewBox="0 0 44 44" className="h-10 w-10 shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
      <motion.circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="#F9A826"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - progress * circumference }}
        transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
      />
    </svg>
  )
}

/* ── Main Page ─────────────────────────────────────────────── */

function OpgeslagenPage() {
  const navigate = useNavigate()
  const { stage: stageFilter } = Route.useSearch()
  const { data: favorites, isLoading } = useParcelFavorites()
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
          <div className="flex items-end justify-between">
            <div>
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Portfolio
              </p>
              <h1 className="text-[56px] font-black tracking-tighter text-[#0E1111] leading-none tabular-nums">
                {totalCount}
              </h1>
              <p className="text-[13px] text-slate-500 mt-1">
                {totalCount === 1 ? 'perceel' : 'percelen'} in {gemeenteCount} {gemeenteCount === 1 ? 'gemeente' : 'gemeenten'}
              </p>
            </div>

            {/* Mini stage summary */}
            {totalCount > 0 && (
              <div className="flex items-center gap-4">
                {STAGES.filter(s => stageCounts[s] > 0).map((stage) => (
                  <div key={stage} className="text-right">
                    <span className="text-[20px] font-black text-[#0E1111] tabular-nums leading-none">
                      {stageCounts[stage]}
                    </span>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                      {stage}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {totalCount === 0 ? (
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
                      className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <StageRing counts={group.stageCounts} total={group.parcels.length} />
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
                          <ChevronDown size={16} className="text-slate-300" />
                        ) : (
                          <ChevronRight size={16} className="text-slate-300" />
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
              <span className="text-[9px] uppercase tracking-wider text-slate-300">
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate()
          }}
          aria-label="Open op kaart"
          title="Open op kaart"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB]"
        >
          <MapPin size={14} />
        </button>
        <PipelineStagePill parcel={parcel} />
      </div>
    </div>
  )
}

/* ── Pipeline Stage Pill ───────────────────────────────────── */

function PipelineStagePill({ parcel }: { parcel: FavoriteResponse }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAfgerondForm, setShowAfgerondForm] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const updateStage = useUpdatePipelineStage()

  useEffect(() => {
    if (!isOpen) return undefined
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null)
      return undefined
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return

      const menuWidth = 192
      const left = Math.min(
        window.innerWidth - menuWidth - 12,
        Math.max(12, rect.right - menuWidth),
      )

      setMenuPosition({
        top: rect.bottom + 8,
        left,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
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

  // Stage index for visual indicator
  const stageIndex = STAGES.indexOf(parcel.pipeline_stage)

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F2F6F3] text-[11px] font-semibold text-[#0E1111] hover:bg-[#E8EDEB] transition-colors"
      >
        {/* Stage progress dots */}
        <div className="flex items-center gap-0.5">
          {STAGES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i <= stageIndex ? 'bg-[#F9A826]' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        {parcel.pipeline_stage}
      </button>

      {isOpen && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1400] w-48 rounded-[16px] border border-[#EAEFEF] bg-white py-1.5 shadow-[0_18px_50px_rgba(15,23,42,0.14)]"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {STAGES.map((stage, i) => (
              <button
                key={stage}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStageSelect(stage)
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12px] transition-colors hover:bg-[#F2F6F3]"
              >
                <div className="flex items-center gap-0.5">
                  {STAGES.map((_, j) => (
                    <span
                      key={j}
                      className={`h-1.5 w-1.5 rounded-full ${
                        j <= i ? 'bg-[#F9A826]' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <span className={stage === parcel.pipeline_stage ? 'font-bold' : 'text-slate-600'}>
                  {stage}
                </span>
                {stage === parcel.pipeline_stage && <Check size={12} className="ml-auto text-[#F9A826]" />}
              </button>
            ))}
          </div>,
          document.body,
        )}

      {showAfgerondForm && typeof document !== 'undefined' &&
        createPortal(
          <AfgerondForm
            onSubmit={handleAfgerondSubmit}
            onCancel={() => setShowAfgerondForm(false)}
          />,
          document.body,
        )}
    </div>
  )
}

/* ── Afgerond Form ─────────────────────────────────────────── */

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
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-sm rounded-[24px] bg-white shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-[#0E1111]">Afgerond markeren</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {/* Reason */}
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">Reden</p>
        <div className="flex gap-2 mb-5">
          {['Gekocht', 'Afgewezen'].map((option) => (
            <button
              key={option}
              onClick={() => setReden(option)}
              className={`flex-1 h-[44px] rounded-full text-[13px] font-semibold transition-all ${
                reden === option
                  ? 'bg-[#0E1111] text-white'
                  : 'bg-[#F2F6F3] text-[#0E1111] hover:bg-[#E8EDEB]'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Note */}
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">Notitie</p>
        <textarea
          value={notitie}
          onChange={(e) => setNotitie(e.target.value)}
          placeholder="Eventuele toelichting..."
          className="w-full h-24 rounded-[14px] bg-[#F2F6F3] px-4 py-3 text-[13px] text-[#0E1111] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#F9A826]/30 resize-none"
        />

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 h-[44px] rounded-full bg-[#F2F6F3] text-[13px] font-semibold text-[#0E1111] hover:bg-[#E8EDEB] transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={() => onSubmit(reden, notitie)}
            disabled={!reden}
            className="flex-1 h-[44px] rounded-full bg-[#0E1111] text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-40 transition-all"
          >
            Bevestigen
          </button>
        </div>
      </motion.div>
    </div>
  )
}
