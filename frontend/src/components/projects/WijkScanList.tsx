import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useProjectScans, useTriggerScan } from '@/hooks/useScans'
import { useWijkGeoJSON } from '@/hooks/useWijkGeoJSON'
import { toast } from 'sonner'
import type { ScanListItem } from '@/lib/types/scan'
import { Skeleton } from '@/components/feedback/Skeleton'
import { resolveWijkBbox } from '@/lib/geo-utils'
import { ScanIcon } from './ProjectIcons'

const dateFmt = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })

/**
 * Scan list for a project — renders inside expanded wijk/project rows.
 * Hook only fires when this component mounts (when row is expanded).
 */
export function WijkScanList({
  projectId,
  projectName,
  gemeenteCode,
  wijkNaam,
  navigate,
}: {
  projectId: string
  projectName: string
  gemeenteCode: string | null
  wijkNaam: string | null
  navigate: ReturnType<typeof useNavigate>
}) {
  const { data, isLoading } = useProjectScans(projectId)
  const { data: wijkGeojson } = useWijkGeoJSON(gemeenteCode)
  const triggerScan = useTriggerScan()
  const scans = data?.scans ?? []
  const wijkBboxWgs84 = useMemo(
    () => resolveWijkBbox(wijkGeojson, wijkNaam),
    [wijkGeojson, wijkNaam]
  )

  const handleScanResultsClick = (scan: ScanListItem) => {
    navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
  }

  if (isLoading) {
    return (
      <div className="border-t border-neutral-200 px-10 py-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="border-t border-neutral-200 px-10 py-5 text-center">
        <p className="text-sm text-neutral-600">Nog geen scans voor dit project</p>
        {!gemeenteCode && (
          <p className="mt-1 text-xs text-neutral-500">
            Gemeentecode niet gevonden voor dit project. Hernoem naar een gemeentenaam of koppel gemeente_code.
          </p>
        )}
        <button
          onClick={() => {
            if (!gemeenteCode) return
            triggerScan.mutate(
              {
                gemeente_code: gemeenteCode,
                gemeente_naam: projectName,
                project_id: projectId,
                ...(wijkNaam ? { wijk_naam: wijkNaam } : {}),
                ...(wijkBboxWgs84 ? { bbox_wgs84: wijkBboxWgs84 } : {}),
              },
              {
                onSuccess: (scan) => {
                  if (scan.status === 'existing' && !scan.needs_rescan) {
                    toast.info('Bestaande scan gevonden, resultaten worden geopend')
                    navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
                    return
                  }
                  toast.success('Scan gestart voor dit project')
                },
                onError: (error) => {
                  toast.error(error.message || 'Scan starten mislukt')
                },
              }
            )
          }}
          disabled={!gemeenteCode || triggerScan.isPending}
          className="mt-3 min-h-[36px] rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-aura-ink transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {triggerScan.isPending ? 'Scan starten...' : 'Start scan'}
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-neutral-200 bg-neutral-50">
      {scans.map((scan) => {
        const isCompleted = scan.status === 'completed'
        return (
          <div
            key={scan.scan_id}
            className="flex w-full items-center gap-3 border-b border-neutral-200 px-10 py-3 last:border-b-0"
          >
            <ScanIcon />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-neutral-700">
                  Scan {dateFmt.format(new Date(scan.scan_date))}
                </p>
                {!isCompleted && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    scan.status === 'running' ? 'bg-info/20 text-info' :
                    scan.status === 'failed' ? 'bg-error/20 text-error' :
                    'border border-neutral-200 bg-neutral-50 text-neutral-600'
                  }`}>
                    {scan.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-600">
                {dateFmt.format(new Date(scan.scan_date))} &middot; {scan.parcel_count} percelen
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleScanResultsClick(scan)}
                disabled={!isCompleted}
                className="min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Toon resultaten
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
