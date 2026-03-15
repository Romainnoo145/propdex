import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTriggerScan } from '@/hooks/useScans'
import { useWijkGeoJSON } from '@/hooks/useWijkGeoJSON'
import { toast } from 'sonner'
import type { ScanListItem } from '@/lib/types/scan'
import { Skeleton } from '@/components/feedback/Skeleton'
import { MetricChip } from '@/components/primitives'
import {
  geoJsonToSvgDualPath,
  calculateBboxFromGeometry,
} from '@/lib/geo-utils'
import { normalizeAreaName, normalizeGemeenteCode } from '@/lib/geo/normalizers'
import { toMapGemeenteWijkSearch } from '@/lib/navigation/mapSearch'
import {
  MapPinLineIcon,
  ScanIcon,
  WijkStatIcon,
  WijkScanStatusIcon,
  ReportStatIcon,
} from './ProjectIcons'

const dateFmt = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })

// ---------------------------------------------------------------------------
// WorkspaceMetricCard
// ---------------------------------------------------------------------------

export function WorkspaceMetricCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string
  value: number
  icon: ReactNode
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
        <span className={highlight ? 'text-aura-amber/90' : 'text-neutral-500'}>{icon}</span>
      </div>
      <p className={`mt-1 text-2xl font-semibold leading-none ${highlight ? 'text-aura-amber' : 'text-aura-ink'}`}>
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UnlinkedGemeenteWorkspace
// ---------------------------------------------------------------------------

export function UnlinkedGemeenteWorkspace({
  gemeenteCode,
  gemeenteName,
  gemeenteGeometry,
  scanHistory,
  wijkReportCounts,
}: {
  gemeenteCode: string
  gemeenteName: string
  gemeenteGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  scanHistory: ScanListItem[]
  wijkReportCounts: Map<string, number>
}) {
  const navigate = useNavigate()
  const triggerScan = useTriggerScan()
  const { data: wijkGeojson, isLoading } = useWijkGeoJSON(gemeenteCode)
  const [selectedWijkNaam, setSelectedWijkNaam] = useState<string | null>(null)

  const wijkItems = useMemo(() => {
    const unique = new Map<
      string,
      { geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; bbox: [number, number, number, number] | null }
    >()
    for (const feature of wijkGeojson?.features ?? []) {
      const name = String(feature.properties?.statnaam ?? '').trim()
      const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | undefined
      if (!name || !geometry) continue
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue
      unique.set(name, { geometry, bbox: calculateBboxFromGeometry(geometry) })
    }
    const rows = Array.from(unique.entries())
      .map(([name, value]) => ({ name, geometry: value.geometry, bbox: value.bbox }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl-NL'))
    return rows.map((row, index) => {
      const siblings = rows.filter((_, i) => i !== index).map((e) => e.geometry)
      const svgData = geoJsonToSvgDualPath(row.geometry, gemeenteGeometry, siblings)
      return { name: row.name, bbox: row.bbox, svgData }
    })
  }, [wijkGeojson, gemeenteGeometry])

  const latestScanByWijkName = useMemo(() => {
    const map = new Map<string, ScanListItem>()
    const normalizedCode = normalizeGemeenteCode(gemeenteCode)
    for (const scan of scanHistory) {
      if (scan.status !== 'completed') continue
      if (normalizeGemeenteCode(scan.gemeente_code) !== normalizedCode) continue
      const wijkNaam = normalizeAreaName(scan.wijk_naam ?? '')
      if (!wijkNaam) continue
      const current = map.get(wijkNaam)
      if (!current || Date.parse(scan.scan_date) > Date.parse(current.scan_date)) map.set(wijkNaam, scan)
    }
    return map
  }, [scanHistory, gemeenteCode])

  useEffect(() => {
    if (wijkItems.length === 0) {
      if (selectedWijkNaam !== null) queueMicrotask(() => setSelectedWijkNaam(null))
      return
    }
    if (!selectedWijkNaam || !wijkItems.some((item) => item.name === selectedWijkNaam)) {
      queueMicrotask(() => setSelectedWijkNaam(wijkItems[0]!.name))
    }
  }, [wijkItems, selectedWijkNaam])

  const selectedWijk = useMemo(
    () => wijkItems.find((item) => item.name === selectedWijkNaam) ?? null,
    [wijkItems, selectedWijkNaam]
  )

  const latestWijkScan = useMemo(() => {
    if (!selectedWijkNaam) return null
    return latestScanByWijkName.get(normalizeAreaName(selectedWijkNaam)) ?? null
  }, [latestScanByWijkName, selectedWijkNaam])

  return (
    <section className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
        <WijkStatIcon />
        <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">Wijken in {gemeenteName}</span>
        <span className="ml-auto text-xs text-neutral-500">{wijkItems.length}</span>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : wijkItems.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-6 text-center">
            <p className="text-sm text-neutral-600">Geen wijkgrenzen gevonden voor deze gemeente.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.65fr)]">
            <div className="max-h-[620px] overflow-y-auto rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-3">
              <div className="space-y-2.5">
                {wijkItems.map((wijk) => {
                  const isActive = wijk.name === selectedWijkNaam
                  const wijkScan = latestScanByWijkName.get(normalizeAreaName(wijk.name))
                  const reportCount = wijkReportCounts.get(normalizeAreaName(wijk.name)) ?? 0
                  return (
                    <button
                      key={wijk.name}
                      onClick={() => setSelectedWijkNaam(wijk.name)}
                      className={`group relative w-full overflow-hidden rounded-xl border text-left transition-all ${
                        isActive
                          ? 'border-aura-amber/35 bg-neutral-50 shadow-[0_0_0_1px_rgba(217,170,56,0.14)]'
                          : 'border-neutral-200 bg-neutral-50 hover:border-aura-amber/30 hover:bg-neutral-50'
                      }`}
                    >
                      <span className={`absolute inset-y-1 left-0 z-10 w-1 rounded-r ${isActive ? 'bg-aura-amber' : 'bg-transparent'}`} />
                      <div className="relative aspect-[16/8] border-b border-neutral-200 bg-aura-glass-white/40/65">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,170,56,0.11),transparent_45%),radial-gradient(circle_at_20%_82%,rgba(255,255,255,0.06),transparent_45%)]" />
                        {wijk.svgData ? (
                          <svg viewBox={wijk.svgData.viewBox} className="relative h-full w-full overflow-hidden" preserveAspectRatio="xMidYMid meet">
                            {wijk.svgData.backgroundD && (
                              <path d={wijk.svgData.backgroundD} className="fill-neutral-400/18 stroke-neutral-400/20" strokeWidth="0.5" />
                            )}
                            {wijk.svgData.siblingsD && (
                              <path d={wijk.svgData.siblingsD} className="fill-transparent stroke-neutral-500/25" strokeWidth="0.3" />
                            )}
                            <path d={wijk.svgData.primaryD} className="fill-aura-amber/24 stroke-aura-amber transition-all duration-200 group-hover:fill-aura-amber/30 group-hover:stroke-aura-amber" strokeWidth="1" />
                          </svg>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><WijkStatIcon /></div>
                        )}
                      </div>
                      <div className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-aura-ink">{wijk.name}</p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <MetricChip value={wijkScan ? 1 : 0} ariaLabel="Gescand" icon={<WijkScanStatusIcon />} tone="amber" compact />
                            <MetricChip value={reportCount} ariaLabel="Rapporten" icon={<ReportStatIcon />} tone="amber" compact />
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-neutral-500">
                          {wijkScan ? `Scan: ${dateFmt.format(new Date(wijkScan.scan_date))}` : 'Nog geen scan'}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4 sm:p-5">
              {selectedWijk ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-aura-ink">{selectedWijk.name}</h3>
                    <p className="mt-1 text-sm text-neutral-500">Wijk is direct beschikbaar voor scan en kaartnavigatie.</p>
                  </div>
                  {latestWijkScan ? (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-neutral-500">Laatste scan</p>
                      <p className="mt-1 text-sm font-medium text-aura-ink">{dateFmt.format(new Date(latestWijkScan.scan_date))}</p>
                      <p className="text-xs text-neutral-500">{latestWijkScan.parcel_count} percelen gescand</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                      <p className="text-sm text-neutral-600">Nog geen scan uitgevoerd voor deze wijk.</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate({ to: '/map', search: toMapGemeenteWijkSearch({ gemeenteCode, wijkNaam: selectedWijk.name }) })}
                      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-aura-ink"
                    >
                      <MapPinLineIcon />
                      Open op kaart
                    </button>
                    {latestWijkScan && (
                      <button
                        onClick={() => navigate({ to: '/resultaten', search: { scan_id: latestWijkScan.scan_id } })}
                        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-aura-ink"
                      >
                        <ScanIcon />
                        Bekijk resultaten
                      </button>
                    )}
                    <button
                      onClick={() => {
                        triggerScan.mutate(
                          {
                            gemeente_code: gemeenteCode,
                            gemeente_naam: gemeenteName,
                            wijk_naam: selectedWijk.name,
                            ...(selectedWijk.bbox ? { bbox_wgs84: selectedWijk.bbox } : {}),
                          },
                          {
                            onSuccess: (scan) => {
                              if (scan.status === 'existing' && !scan.needs_rescan) {
                                toast.info('Bestaande scan gevonden, resultaten worden geopend')
                                navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
                                return
                              }
                              toast.success(`Scan gestart voor ${selectedWijk.name}`)
                            },
                            onError: (error) => toast.error(error.message || 'Scan starten mislukt'),
                          }
                        )
                      }}
                      disabled={triggerScan.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md border border-aura-amber bg-aura-amber px-3 py-1.5 text-xs font-semibold text-aura-obsidian transition-colors hover:bg-aura-amber-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ScanIcon />
                      {triggerScan.isPending ? 'Scan starten...' : 'Start wijkscan'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Selecteer links een wijk.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
