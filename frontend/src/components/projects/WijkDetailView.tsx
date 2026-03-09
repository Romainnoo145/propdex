import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { ProjectResponse } from '@/lib/types/project'
import { useProjectScans, useTriggerScan } from '@/hooks/useScans'
import { useWijkGeoJSON } from '@/hooks/useWijkGeoJSON'
import { useReports } from '@/hooks/useReports'
import { resolveWijkBbox } from '@/lib/geo-utils'
import { Skeleton } from '@/components/feedback/Skeleton'
import { toast } from 'sonner'

import { CbsNeighborhoodCard } from './CbsNeighborhoodCard'
import { AgeDistributionCard } from './AgeDistributionCard'
import { HouseholdCard } from './HouseholdCard'
import { IncomeCard } from './IncomeCard'
import { NabijheidCard } from './NabijheidCard'
import { CriminaliteitCard } from './CriminaliteitCard'
import type { CbsNeighborhoodMetrics } from '@/lib/types/scan'

interface WijkDetailViewProps {
  gemeente: ProjectResponse
  wijk: ProjectResponse
}

/**
 * Detail view for a selected wijk (neighbourhood).
 *
 * Shows:
 * 1. Two action cards: "Bekijk resultaten" + "Bekijk rapporten"
 * 2. CBS neighborhood metrics cards
 *
 * Note: Meldingen and Juridisch Klimaat are gemeente-level (shown in GemeenteDetailView).
 */
export function WijkDetailView({ gemeente, wijk }: WijkDetailViewProps) {
  const isVirtualWijk = wijk.id.startsWith('virtual-wijk:')

  return (
    <div className="space-y-6">
      {/* Action cards row */}
      <ActionCardsRow
        wijkId={isVirtualWijk ? null : wijk.id}
        gemeenteCode={gemeente.gemeente_code}
        gemeenteNaam={gemeente.name}
        wijkNaam={wijk.wijk_naam}
      />

      {/* CBS metrics (only when scan data available) */}
      <CbsMetricsSection
        wijkId={isVirtualWijk ? null : wijk.id}
      />
    </div>
  )
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Two side-by-side action cards: Bekijk resultaten + Bekijk rapporten.
 */
function ActionCardsRow({
  wijkId,
  gemeenteCode,
  gemeenteNaam,
  wijkNaam,
}: {
  wijkId: string | null
  gemeenteCode: string | null
  gemeenteNaam: string
  wijkNaam: string | null
}) {
  const navigate = useNavigate()
  const { data, isLoading } = useProjectScans(wijkId)
  const { data: reportsData } = useReports(wijkId ? { project_id: wijkId } : undefined)
  const { data: wijkGeojson } = useWijkGeoJSON(gemeenteCode)
  const triggerScan = useTriggerScan()
  const scans = data?.scans ?? []
  const latestScan = scans.find((s) => s.status === 'completed')
  const activeScan = scans.find((s) => s.status === 'pending' || s.status === 'running')
  const reportCount = reportsData?.reports?.length ?? 0
  const wijkBboxWgs84 = useMemo(
    () => resolveWijkBbox(wijkGeojson, wijkNaam),
    [wijkGeojson, wijkNaam]
  )

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    )
  }

  const hasScan = !!latestScan
  const isScanning = !!activeScan

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Scan / Results card */}
      <button
        onClick={() => {
          if (latestScan) {
            navigate({
              to: '/resultaten',
              search: { scan_id: latestScan.scan_id },
            })
          } else if (activeScan) {
            navigate({
              to: '/resultaten',
              search: { scan_id: activeScan.scan_id },
            })
          } else if (gemeenteCode) {
            triggerScan.mutate(
              {
                gemeente_code: gemeenteCode,
                gemeente_naam: gemeenteNaam,
                ...(wijkId ? { project_id: wijkId } : {}),
                ...(wijkNaam ? { wijk_naam: wijkNaam } : {}),
                ...(wijkBboxWgs84 ? { bbox_wgs84: wijkBboxWgs84 } : {}),
              },
              {
                onSuccess: (scan) => {
                  if (scan.status === 'existing' && !scan.needs_rescan) {
                    toast.info('Bestaande scan gevonden')
                    navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
                    return
                  }
                  toast.success('Scan gestart')
                },
                onError: (error) => {
                  toast.error(error.message || 'Scan starten mislukt')
                },
              }
            )
          }
        }}
        disabled={!gemeenteCode || triggerScan.isPending}
        className="group rounded-xl border border-overlay/5 bg-grey-900 p-4 text-left transition-colors hover:bg-grey-850 hover:border-amber-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${hasScan ? 'bg-emerald-400/15' : isScanning ? 'bg-amber-accent/15' : 'bg-grey-800'}`}>
            {hasScan ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            ) : isScanning ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent animate-pulse">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-grey-500">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-grey-100 group-hover:text-amber-accent transition-colors">
              {hasScan ? 'Bekijk resultaten' : isScanning ? 'Scan bezig...' : 'Start scan'}
            </p>
            <p className="text-[11px] text-grey-500">
              {hasScan
                ? `${latestScan.parcel_count} percelen \u00b7 ${dateFmt.format(new Date(latestScan.scan_date))}`
                : isScanning
                  ? `Gestart ${dateFmt.format(new Date(activeScan.scan_date))}`
                  : 'Nog niet gescand'}
            </p>
          </div>
        </div>
      </button>

      {/* Reports card */}
      <button
        onClick={() => {
          if (wijkId) {
            navigate({
              to: '/rapporten',
              search: { project_id: wijkId, q: undefined },
            })
          }
        }}
        disabled={!wijkId}
        className="group rounded-xl border border-overlay/5 bg-grey-900 p-4 text-left transition-colors hover:bg-grey-850 hover:border-amber-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${reportCount > 0 ? 'bg-amber-accent/15' : 'bg-grey-800'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={reportCount > 0 ? 'text-amber-accent' : 'text-grey-500'}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-grey-100 group-hover:text-amber-accent transition-colors">
              Bekijk rapporten
            </p>
            <p className="text-[11px] text-grey-500">
              {reportCount > 0
                ? `${reportCount} rapport${reportCount === 1 ? '' : 'en'}`
                : 'Geen rapporten'}
            </p>
          </div>
        </div>
      </button>
    </div>
  )
}

/**
 * CBS demographic cards — rendered only when scan data is available.
 */
function CbsMetricsSection({ wijkId }: { wijkId: string | null }) {
  const { data } = useProjectScans(wijkId)
  const scans = data?.scans ?? []
  const latestScan = scans.find((s) => s.status === 'completed')

  if (!latestScan?.neighborhood_metrics) return null

  const metrics = latestScan.neighborhood_metrics as CbsNeighborhoodMetrics

  return (
    <>
      <CbsNeighborhoodCard metrics={metrics} />
      {metrics.data?.leeftijdsverdeling && (
        <AgeDistributionCard leeftijdsverdeling={metrics.data.leeftijdsverdeling} />
      )}
      {metrics.data?.huishoudens && (
        <HouseholdCard
          huishoudens={metrics.data.huishoudens}
          leeftijdsverdeling={metrics.data.leeftijdsverdeling}
        />
      )}
      {metrics.data?.inkomen && (
        <IncomeCard
          inkomen={metrics.data.inkomen}
          wozWaarde={metrics.data.gemiddelde_woz_waarde ?? null}
        />
      )}
      {metrics.nabijheid && (
        <NabijheidCard nabijheid={metrics.nabijheid} />
      )}
      {metrics.criminaliteit && (
        <CriminaliteitCard criminaliteit={metrics.criminaliteit} />
      )}
    </>
  )
}
