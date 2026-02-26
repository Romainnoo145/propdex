import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { ProjectResponse } from '@/lib/types/project'
import { useProjectScans, useTriggerScan } from '@/hooks/useScans'
import { useWijkGeoJSON } from '@/hooks/useWijkGeoJSON'
import { useReports } from '@/hooks/useReports'
import { calculateBboxFromGeometry } from '@/lib/geo-utils'
import ReportCard from '@/components/reports/ReportCard'
import { Skeleton } from '@/components/feedback/Skeleton'
import { toast } from 'sonner'

interface WijkDetailViewProps {
  gemeente: ProjectResponse
  wijk: ProjectResponse
}

/**
 * Detail view for a selected wijk (neighbourhood).
 *
 * Shows:
 * 1. Scan summary with quick actions
 * 2. Reports assigned to the wijk
 *
 * Note: Meldingen are only available at gemeente level (change monitor
 * stores identical records for all projects in a gemeente).
 */
export function WijkDetailView({ gemeente, wijk }: WijkDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Scan summary */}
      <ScanSummarySection
        wijkId={wijk.id}
        gemeenteCode={gemeente.gemeente_code}
        gemeenteNaam={gemeente.name}
        wijkNaam={wijk.wijk_naam}
      />

      {/* Reports section */}
      <ReportListSection wijkId={wijk.id} />
    </div>
  )
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function normalizeAreaName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’']/g, '')
    .trim()
}

function resolveWijkBbox(
  geojson: GeoJSON.FeatureCollection | undefined,
  wijkNaam: string | null
): [number, number, number, number] | null {
  if (!geojson || !wijkNaam) return null

  const target = normalizeAreaName(wijkNaam)
  const match = geojson.features.find((feature) => {
    const name = String(feature.properties?.statnaam ?? '')
    return normalizeAreaName(name) === target
  })
  if (!match) return null

  const geometry = match.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
    return null
  }

  return calculateBboxFromGeometry(geometry)
}

/**
 * Shows latest scan info with quick action buttons.
 */
function ScanSummarySection({
  wijkId,
  gemeenteCode,
  gemeenteNaam,
  wijkNaam,
}: {
  wijkId: string
  gemeenteCode: string | null
  gemeenteNaam: string
  wijkNaam: string | null
}) {
  const navigate = useNavigate()
  const { data, isLoading } = useProjectScans(wijkId)
  const { data: wijkGeojson } = useWijkGeoJSON(gemeenteCode)
  const triggerScan = useTriggerScan()
  const scans = data?.scans ?? []
  const latestScan = scans.find((s) => s.status === 'completed')
  const activeScan = scans.find((s) => s.status === 'pending' || s.status === 'running')
  const wijkBboxWgs84 = useMemo(
    () => resolveWijkBbox(wijkGeojson, wijkNaam),
    [wijkGeojson, wijkNaam]
  )

  if (isLoading) {
    return (
      <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent/70">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">Laatste scan</span>
        </div>
        <div className="p-4 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent/70">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">Laatste scan</span>
      </div>
      {latestScan ? (
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-grey-100">
                {dateFmt.format(new Date(latestScan.scan_date))}
              </p>
              <p className="text-xs text-grey-400 mt-0.5">
                {latestScan.parcel_count} percelen gescand
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  navigate({
                    to: '/resultaten',
                    search: { scan_id: latestScan.scan_id },
                  })
                }
                className="flex items-center gap-1.5 rounded-md border border-grey-700 bg-grey-850 px-3 py-1.5 text-xs font-medium text-grey-200 transition-colors hover:bg-grey-800"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
                Bekijk resultaten
              </button>
            </div>
          </div>
        </div>
      ) : activeScan ? (
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-grey-100">
                Scan bezig ({activeScan.status})
              </p>
              <p className="text-xs text-grey-400 mt-0.5">
                Gestart op {dateFmt.format(new Date(activeScan.scan_date))}
              </p>
            </div>
            <button
              onClick={() =>
                navigate({
                  to: '/resultaten',
                  search: { scan_id: activeScan.scan_id },
                })
              }
              className="flex items-center gap-1.5 rounded-md border border-grey-700 bg-grey-850 px-3 py-1.5 text-xs font-medium text-grey-200 transition-colors hover:bg-grey-800"
            >
              Bekijk resultaten
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-grey-400">Nog geen scan beschikbaar</p>
          {!gemeenteCode && (
            <p className="mt-1 text-xs text-grey-600">
              Geen gemeentecode gevonden voor deze wijk
            </p>
          )}
          <button
            onClick={() => {
              if (!gemeenteCode) return
              triggerScan.mutate(
                {
                  gemeente_code: gemeenteCode,
                  gemeente_naam: gemeenteNaam,
                  project_id: wijkId,
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
                    toast.success('Scan gestart voor deze wijk')
                  },
                  onError: (error) => {
                    toast.error(error.message || 'Scan starten mislukt')
                  },
                }
              )
            }}
            disabled={!gemeenteCode || triggerScan.isPending}
            className="mt-3 min-h-[36px] rounded-md border border-grey-700 bg-grey-850 px-3 py-1.5 text-xs font-medium text-grey-200 transition-colors hover:bg-grey-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {triggerScan.isPending ? 'Scan starten...' : 'Start scan'}
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * Lists reports assigned to this wijk project.
 */
function ReportListSection({ wijkId }: { wijkId: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useReports({ project_id: wijkId })
  const reports = data?.reports ?? []
  const [reportSearch, setReportSearch] = useState('')
  const filteredReports = useMemo(() => {
    const q = reportSearch.trim().toLowerCase()
    if (!q) return reports
    return reports.filter((report) => (
      report.report_name.toLowerCase().includes(q) ||
      report.postcode.toLowerCase().includes(q) ||
      report.city.toLowerCase().includes(q)
    ))
  }, [reports, reportSearch])

  if (isLoading) {
    return (
      <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent/70">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">Rapporten</span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-grey-800 bg-grey-850 p-3 space-y-2"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-overlay/5 bg-grey-900 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-overlay/5 px-4 py-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-accent/70">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-wide text-amber-accent/70">Rapporten</span>
        {reports.length > 0 && (
          <span className="ml-auto text-xs text-grey-600">
            {filteredReports.length}/{reports.length}
          </span>
        )}
      </div>
      {reports.length > 0 ? (
        <div className="p-4">
          <input
            type="search"
            value={reportSearch}
            onChange={(e) => setReportSearch(e.target.value)}
            placeholder="Zoek rapporten (adres, postcode, plaats)"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="search"
            enterKeyHint="search"
            name="q_wijk_reports"
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
            className="mb-3 w-full rounded-md border border-grey-700 bg-grey-850 px-3 py-2 text-xs text-grey-100 placeholder:text-grey-500 focus:border-amber-accent/50 focus:outline-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onClick={() =>
                  navigate({ to: '/rapport/$id', params: { id: report.id } })
                }
              />
            ))}
          </div>
          {filteredReports.length === 0 && (
            <p className="mt-2 text-xs text-grey-500">Geen rapporten gevonden</p>
          )}
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-sm text-grey-400">
          Geen rapporten
        </div>
      )}
    </section>
  )
}
