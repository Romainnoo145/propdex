import { useState, useCallback } from 'react'
import type { useNavigate as UseNavigateType } from '@tanstack/react-router'
import type { ProjectResponse } from '@/lib/types/project'
import type { UnreadDetailResponse } from '@/lib/types/monitoring'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useProjectChanges, useRefreshMonitoring } from '@/hooks/useNotifications'
import ChangeTimeline from '@/components/notifications/ChangeTimeline'
import { WijkCard } from './WijkCard'
import { WijkCardGrid } from './WijkCardGrid'

interface GemeenteDetailViewProps {
  gemeente: ProjectResponse
  wijkProjects: ProjectResponse[]
  unreadData: UnreadDetailResponse | undefined
  gemeenteGeojson: GeoJSON.FeatureCollection | null
  navigate: ReturnType<typeof UseNavigateType>
}

/**
 * Detail view for a selected gemeente.
 *
 * Shows:
 * 1. Summary stat bar (wijken, rapporten, meldingen)
 * 2. Wijk card grid for drill-down (reports live per-wijk in WijkDetailView)
 * 3. Meldingen timeline at bottom (gemeente-level, not per-wijk)
 */
export function GemeenteDetailView({
  gemeente,
  wijkProjects,
  unreadData,
  gemeenteGeojson,
  navigate,
}: GemeenteDetailViewProps) {
  const queryClient = useQueryClient()
  const wijkenCount = wijkProjects.length
  // Include reports from both gemeente project and all wijk children
  const rapportenCount =
    gemeente.report_count +
    wijkProjects.reduce((sum, wijk) => sum + wijk.report_count, 0)
  // Total meldingen and unread count
  const { data: changesData } = useProjectChanges(gemeente.id)
  const refreshMonitoring = useRefreshMonitoring()

  const [isSpinning, setIsSpinning] = useState(false)
  const handleRefresh = useCallback(async () => {
    setIsSpinning(true)
    const minDuration = new Promise((r) => setTimeout(r, 500))
    try {
      const [result] = await Promise.all([
        refreshMonitoring.mutateAsync(gemeente.id),
        minDuration,
      ])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['changes'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
      ])
      if ((result?.new_changes ?? 0) > 0) {
        toast.success(
          `Refresh voltooid: ${result.new_changes} ${result.new_changes === 1 ? 'nieuwe melding' : 'nieuwe meldingen'} gevonden`
        )
      } else {
        toast.info('Refresh voltooid: geen nieuwe meldingen gevonden')
      }
    } finally {
      setIsSpinning(false)
    }
  }, [gemeente.id, queryClient, refreshMonitoring])
  const meldingenCount = changesData?.total ?? 0
  const gemeenteUnread =
    unreadData?.per_project.find((p) => p.project_id === gemeente.id)?.unread_count ?? 0

  return (
    <div className="space-y-6">
      {/* Stat bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard value={wijkenCount} label="Wijken" />
        <StatCard value={rapportenCount} label="Rapporten" />
        <StatCard value={meldingenCount} label="Meldingen" highlight={gemeenteUnread > 0} />
      </div>

      {/* Wijk cards — primary content, reports live per-wijk in WijkDetailView */}
      <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent/70">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">Wijken</span>
          <span className="ml-auto text-xs text-grey-600">{wijkenCount}</span>
        </div>
        <div className="p-4">
          <WijkCardGrid
            gemeente={gemeente}
            wijkProjects={wijkProjects}
            unreadData={unreadData}
            gemeenteGeojson={gemeenteGeojson}
            renderCard={(wijk, svgData, unreadCount) => (
              <WijkCard
                key={wijk.id}
                wijk={wijk}
                svgData={svgData}
                unreadCount={unreadCount}
                onClick={() =>
                  navigate({
                    to: '/projecten',
                    search: { gemeente_id: gemeente.id, wijk_id: wijk.id },
                  })
                }
              />
            )}
          />
        </div>
      </section>

      {/* Meldingen — gemeente-level (not per-wijk), shown at bottom */}
      <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent/70">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">Recente meldingen</span>
          {gemeenteUnread > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-accent px-1.5 text-[11px] font-semibold text-on-accent">
              {gemeenteUnread}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isSpinning}
            className="ml-auto rounded p-1 text-grey-600 transition-colors hover:bg-grey-800 hover:text-grey-300 disabled:opacity-50"
            aria-label="Ververs meldingen"
          >
            <RefreshIcon spinning={isSpinning} />
          </button>
          {meldingenCount > 0 && (
            <span className="text-xs text-grey-600">{meldingenCount}</span>
          )}
        </div>
        <ChangeTimeline projectId={gemeente.id} unreadCount={gemeenteUnread} />
      </section>
    </div>
  )
}

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  if (spinning) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function StatCard({
  value,
  label,
  highlight = false,
}: {
  value: number
  label: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-overlay/5 bg-grey-900 px-6 py-5">
      <p
        className={`text-2xl font-semibold ${highlight ? 'text-amber-accent' : 'text-grey-100'}`}
      >
        {value}
      </p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-grey-600">{label}</p>
    </div>
  )
}
