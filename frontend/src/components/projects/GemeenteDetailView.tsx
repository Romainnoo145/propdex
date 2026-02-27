import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ProjectResponse } from '@/lib/types/project'
import type { UnreadDetailResponse } from '@/lib/types/monitoring'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useProjectChanges, useRefreshMonitoring } from '@/hooks/useNotifications'
import ChangeTimeline from '@/components/notifications/ChangeTimeline'
import { WijkCard } from './WijkCard'
import { WijkCardGrid } from './WijkCardGrid'
import { WijkDetailView } from './WijkDetailView'
import { normalizeAreaName } from '@/lib/geo/normalizers'

interface GemeenteDetailViewProps {
  gemeente: ProjectResponse
  wijkProjects: ProjectResponse[]
  unreadData: UnreadDetailResponse | undefined
  gemeenteGeojson: GeoJSON.FeatureCollection | null
  scannedWijkNames?: ReadonlySet<string> | null
}

/**
 * Detail view for a selected gemeente.
 *
 * Shows:
 * 1. Wijk workspace (left select list + right wijk detail panel)
 * 2. Meldingen timeline at bottom (gemeente-level, not per-wijk)
 */
export function GemeenteDetailView({
  gemeente,
  wijkProjects,
  unreadData,
  gemeenteGeojson,
  scannedWijkNames = null,
}: GemeenteDetailViewProps) {
  const queryClient = useQueryClient()
  const wijkenCount = wijkProjects.length
  // Total meldingen and unread count
  const { data: changesData } = useProjectChanges(gemeente.id)
  const refreshMonitoring = useRefreshMonitoring()

  const [isSpinning, setIsSpinning] = useState(false)
  const [selectedWijkId, setSelectedWijkId] = useState<string | null>(null)
  const monitoringEnabled = Boolean(gemeente.is_monitored)
  const monitoredWijkenCount = useMemo(
    () => wijkProjects.filter((wijk) => wijk.is_monitored).length,
    [wijkProjects]
  )
  const handleRefresh = useCallback(async () => {
    if (!monitoringEnabled) {
      toast.info('Monitoring staat uit voor deze gemeente')
      return
    }
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
        const checked = result?.total_detected ?? 0
        toast.info(
          checked > 0
            ? `Refresh voltooid: geen nieuwe meldingen (${checked} bestaande gecontroleerd)`
            : 'Refresh voltooid: geen meldingen gevonden voor deze gemeente'
        )
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Verversen van meldingen mislukt'
      )
    } finally {
      setIsSpinning(false)
    }
  }, [gemeente.id, monitoringEnabled, queryClient, refreshMonitoring])
  const meldingenCount = changesData?.total ?? 0
  const gemeenteUnread =
    unreadData?.per_project.find((p) => p.project_id === gemeente.id)?.unread_count ?? 0
  const selectedWijk = useMemo(
    () => wijkProjects.find((wijk) => wijk.id === selectedWijkId) ?? wijkProjects[0] ?? null,
    [wijkProjects, selectedWijkId]
  )

  useEffect(() => {
    if (wijkProjects.length === 0) {
      if (selectedWijkId !== null) setSelectedWijkId(null)
      return
    }
    if (!selectedWijkId || !wijkProjects.some((wijk) => wijk.id === selectedWijkId)) {
      setSelectedWijkId(wijkProjects[0]!.id)
    }
  }, [wijkProjects, selectedWijkId])

  return (
    <div className="space-y-6">
      {/* Wijk cards — primary content, reports live per-wijk in WijkDetailView */}
      <section className="rounded-xl border border-overlay/[0.08] bg-grey-900 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-overlay/[0.08] px-4 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent/70">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">Wijken</span>
          <span className="ml-auto text-xs text-grey-600">{wijkenCount}</span>
        </div>
        <div className="p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.65fr)]">
            <div className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900">
              <div className="max-h-[660px] overflow-y-auto p-3">
                <WijkCardGrid
                  gemeente={gemeente}
                  wijkProjects={wijkProjects}
                  unreadData={unreadData}
                  gemeenteGeojson={gemeenteGeojson}
                  layout="list"
                  renderCard={(wijk, svgData, unreadCount) => (
                    <WijkCard
                      key={wijk.id}
                      wijk={wijk}
                      svgData={svgData}
                      unreadCount={unreadCount}
                      hasCompletedScan={Boolean(
                        scannedWijkNames?.has(normalizeAreaName(wijk.wijk_naam ?? wijk.name))
                      )}
                      reportCount={wijk.report_count}
                      isActive={selectedWijk?.id === wijk.id}
                      onClick={() => setSelectedWijkId(wijk.id)}
                    />
                  )}
                />
              </div>
            </div>

            <div className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 sm:p-5">
              {selectedWijk ? (
                <WijkDetailView gemeente={gemeente} wijk={selectedWijk} />
              ) : (
                <p className="text-sm text-grey-500">
                  Geen wijken gevonden voor deze gemeente.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Meldingen — gemeente-level (not per-wijk), shown at bottom */}
      <section className="rounded-xl border border-overlay/[0.08] bg-grey-900 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-overlay/[0.08] px-4 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent/70">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">Recente meldingen</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              monitoringEnabled
                ? 'border-amber-accent/35 bg-amber-accent/10 text-amber-accent'
                : 'border-overlay/[0.14] bg-overlay/[0.06] text-grey-400'
            }`}
          >
            {monitoringEnabled ? 'Monitoring aan' : 'Monitoring uit'}
          </span>
          <span className="text-xs text-grey-600">
            {monitoredWijkenCount}/{wijkenCount} wijken
          </span>
          {gemeenteUnread > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-accent px-1.5 text-[11px] font-semibold text-on-accent">
              {gemeenteUnread}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isSpinning || !monitoringEnabled}
            className="ml-auto rounded p-1 text-grey-600 transition-colors hover:bg-grey-800 hover:text-grey-300 disabled:opacity-50"
            aria-label="Ververs meldingen"
            title={monitoringEnabled ? 'Ververs meldingen' : 'Schakel monitoring in om te verversen'}
          >
            <RefreshIcon spinning={isSpinning} />
          </button>
          {meldingenCount > 0 && (
            <span className="text-xs text-grey-600">{meldingenCount}</span>
          )}
        </div>
        {!monitoringEnabled && (
          <div className="border-b border-overlay/[0.06] bg-overlay/[0.03] px-4 py-2 text-xs text-grey-500">
            Monitoring staat uit voor deze gemeente. Zet 'Meldingen ontvangen' aan om updates te verzamelen.
          </div>
        )}
        <ChangeTimeline
          projectId={gemeente.id}
          unreadCount={gemeenteUnread}
          variant="inbox"
        />
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
