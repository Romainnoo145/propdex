import { useState, useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useProjects, useDeleteProject } from '@/hooks/useProjects'
import { useUnreadCounts } from '@/hooks/useNotifications'
import { useProjectScans } from '@/hooks/useScans'
import { toast } from 'sonner'
import type { ProjectResponse } from '@/lib/types/project'
import type { ScanListItem } from '@/lib/types/scan'
import ProjectCreateModal from './ProjectCreateModal'
import ProjectEditModal from './ProjectEditModal'
import ChangeTimeline from '@/components/notifications/ChangeTimeline'
import { Skeleton } from '@/components/feedback/Skeleton'
import { fetchGemeenteGeoJSON, fetchProvincieGeoJSON } from '@/components/map/GemeenteBoundariesLayer'
import { geoJsonToSvgPath, geoJsonToSvgDualPath, findProvinceForGemeente, pointInPolygon, bboxCenter } from '@/lib/geo-utils'
import { GemeenteCard } from './GemeenteCard'
import { GemeenteCardGrid, GemeenteCardGridSkeleton } from './GemeenteCardGrid'
import { WijkCard } from './WijkCard'
import { WijkCardGrid } from './WijkCardGrid'
import { GemeenteDetailView } from './GemeenteDetailView'
import { WijkDetailView } from './WijkDetailView'
import { DrilldownBreadcrumb } from './DrilldownBreadcrumb'

// Demo projects shown when API is unavailable (no auth)
const DEMO_PROJECTS: ProjectResponse[] = [
  {
    id: 'demo-1',
    name: 'Herontwikkeling Venlo Centrum',
    description: 'Haalbaarheidsonderzoek voor 12 panden in het kernwinkelgebied',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-08T14:30:00Z',
    report_count: 8,
    parent_id: null,
    gemeente_code: null,
    wijk_naam: null,
    is_monitored: false,
    unread_count: 0,
    children: [],
  },
  {
    id: 'demo-2',
    name: 'Woningbouw Maastricht Zuid',
    description: 'Nieuwbouwlocaties rondom Randwyck station',
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-02-05T16:00:00Z',
    report_count: 5,
    parent_id: null,
    gemeente_code: null,
    wijk_naam: null,
    is_monitored: false,
    unread_count: 0,
    children: [],
  },
  {
    id: 'demo-3',
    name: 'Monumenten Inventarisatie Utrecht',
    description: null,
    created_at: '2026-02-06T11:00:00Z',
    updated_at: '2026-02-06T11:00:00Z',
    report_count: 3,
    parent_id: null,
    gemeente_code: null,
    wijk_naam: null,
    is_monitored: false,
    unread_count: 0,
    children: [],
  },
]

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
})

/**
 * Project list with expandable report rows.
 * Dark theme — Industrial Amber design system (grey-* tokens).
 * Falls back to demo data when API is unavailable.
 */
export default function ProjectList() {
  const { data, isLoading } = useProjects()
  const { data: unreadData } = useUnreadCounts()
  const deleteMutation = useDeleteProject()
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/projecten' })
  const selectedGemeenteId = search.gemeente_id ?? null
  const selectedWijkId = search.wijk_id ?? null
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectResponse | null>(null)

  const isDemo = !data && !isLoading
  const allProjects = data?.projects ?? (isDemo ? DEMO_PROJECTS : [])

  // Separate top-level projects (no parent) from hierarchical projects
  const topLevelProjects = allProjects.filter((p) => p.parent_id === null)
  const monitoringProjects = topLevelProjects.filter((p) => p.is_monitored)
  const regularProjects = topLevelProjects.filter((p) => !p.is_monitored)

  const [gemeenteGeojson, setGemeenteGeojson] = useState<GeoJSON.FeatureCollection | null>(null)
  const [provincieGeojson, setProvincieGeojson] = useState<GeoJSON.FeatureCollection | null>(null)

  // Fetch CBS gemeente + provincie boundaries once when monitoring projects exist
  useEffect(() => {
    if (monitoringProjects.length === 0) return
    fetchGemeenteGeoJSON().then(setGemeenteGeojson).catch(console.error)
    // Province data is non-blocking — cards render without it, re-render when it arrives
    fetchProvincieGeoJSON().then(setProvincieGeojson).catch(console.error)
  }, [monitoringProjects.length])

  const handleToggle = (projectId: string) => {
    setExpandedId((prev) => (prev === projectId ? null : projectId))
  }

  const handleEdit = (e: React.MouseEvent, project: ProjectResponse) => {
    e.stopPropagation()
    if (isDemo) return
    setSelectedProject(project)
    setEditModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, project: ProjectResponse) => {
    e.stopPropagation()
    if (isDemo) return
    if (!window.confirm('Project verwijderen? Rapporten worden niet verwijderd.')) return
    deleteMutation.mutate(project.id, {
      onSuccess: () => toast.success('Project verwijderd'),
      onError: (error) => toast.error(error.message || 'Fout bij verwijderen project'),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-grey-800 bg-grey-900 p-4 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isDemo && (
        <div className="rounded-lg border border-amber-accent/30 bg-amber-accent/10 px-4 py-3 text-sm text-amber-accent">
          Voorbeelddata — start de backend om projecten te beheren
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-grey-400">
          {allProjects.length > 0
            ? `${allProjects.length} ${allProjects.length === 1 ? 'project' : 'projecten'}`
            : 'Nog geen projecten'}
        </h3>
        <button
          onClick={() => setCreateModalOpen(true)}
          disabled={isDemo}
          className="min-h-[44px] rounded-lg border border-grey-800 bg-grey-900 px-4 py-2 text-sm font-medium text-grey-100 transition-colors hover:bg-grey-850 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nieuw project +
        </button>
      </div>

      {allProjects.length > 0 ? (
        <div className="space-y-2">
          {/* Monitoring projects — drill-down: gemeente cards -> gemeente detail -> wijk detail */}
          {monitoringProjects.length > 0 && (
            selectedGemeenteId ? (
              (() => {
                const gemeente = monitoringProjects.find((p) => p.id === selectedGemeenteId)
                if (!gemeente) return null
                const wijkChildren = allProjects.filter((p) => p.parent_id === gemeente.id)

                // Wijk detail view
                if (selectedWijkId) {
                  const wijk = wijkChildren.find((w) => w.id === selectedWijkId)
                  if (!wijk) return null
                  return (
                    <>
                      <DrilldownBreadcrumb gemeenteName={gemeente.name} wijkName={wijk.name} />
                      <WijkDetailView gemeente={gemeente} wijk={wijk} />
                    </>
                  )
                }

                // Gemeente detail view
                return (
                  <>
                    <DrilldownBreadcrumb gemeenteName={gemeente.name} />
                    <GemeenteDetailView
                      gemeente={gemeente}
                      wijkProjects={wijkChildren}
                      unreadData={unreadData}
                      gemeenteGeojson={gemeenteGeojson}
                      navigate={navigate}
                    />
                  </>
                )
              })()
            ) : (
              <>
                {!gemeenteGeojson ? (
                  <GemeenteCardGridSkeleton count={monitoringProjects.length} />
                ) : (
                  <GemeenteCardGrid>
                    {monitoringProjects.map((gemeente) => {
                      const wijkChildren = allProjects.filter((p) => p.parent_id === gemeente.id)
                      const totalUnread = wijkChildren.reduce((sum, wijk) => {
                        const wijkUnread = unreadData?.per_project.find(
                          (p) => p.project_id === wijk.id
                        )?.unread_count ?? 0
                        return sum + wijkUnread
                      }, 0)
                      const feature = gemeenteGeojson.features.find(
                        (f) => f.properties?.statcode === gemeente.gemeente_code
                      )
                      const gemeenteGeom = feature?.geometry as
                        | GeoJSON.Polygon
                        | GeoJSON.MultiPolygon
                        | undefined

                      let svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null = null
                      if (gemeenteGeom && provincieGeojson) {
                        const provinceFeature = findProvinceForGemeente(gemeenteGeom, provincieGeojson)
                        if (provinceFeature) {
                          const provGeom = provinceFeature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon

                          // Collect sibling gemeenten within the same province
                          const siblingGeoms: (GeoJSON.Polygon | GeoJSON.MultiPolygon)[] = []
                          if (gemeenteGeojson) {
                            for (const f of gemeenteGeojson.features) {
                              if (f.properties?.statcode === gemeente.gemeente_code) continue
                              const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
                              if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
                              const center = bboxCenter(g)
                              if (pointInPolygon(center, provGeom)) {
                                siblingGeoms.push(g)
                              }
                            }
                          }

                          svgData = geoJsonToSvgDualPath(gemeenteGeom, provGeom, siblingGeoms)
                        } else {
                          const single = geoJsonToSvgPath(gemeenteGeom)
                          svgData = { primaryD: single.d, viewBox: single.viewBox }
                        }
                      } else if (gemeenteGeom) {
                        const single = geoJsonToSvgPath(gemeenteGeom)
                        svgData = { primaryD: single.d, viewBox: single.viewBox }
                      }
                      return (
                        <GemeenteCard
                          key={gemeente.id}
                          gemeente={gemeente}
                          svgData={svgData}
                          totalUnread={totalUnread}
                          onClick={() => navigate({ to: '/projecten', search: { gemeente_id: gemeente.id } })}
                        />
                      )
                    })}
                  </GemeenteCardGrid>
                )}
              </>
            )
          )}

          {/* Regular projects (non-monitoring) */}
          {regularProjects.map((project) => {
            const isExpanded = expandedId === project.id

            // Get unread count for this project
            const unreadCount = unreadData?.per_project.find(
              (p) => p.project_id === project.id
            )?.unread_count ?? 0

            return (
              <div
                key={project.id}
                className="overflow-hidden rounded-lg border border-grey-800 bg-grey-900"
              >
                {/* Project header — clickable */}
                <button
                  onClick={() => handleToggle(project.id)}
                  className="flex w-full min-h-[44px] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-grey-850"
                >
                  <ChevronIcon
                    className={`h-4 w-4 shrink-0 text-grey-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-grey-100">{project.name}</h4>
                      <span className="rounded-full bg-grey-800 px-2 py-0.5 text-xs font-medium text-grey-400">
                        {project.report_count}
                      </span>
                      {/* Unread badge */}
                      {unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-medium text-white">
                          {unreadCount > 9 ? unreadCount : ''}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="mt-0.5 truncate text-sm text-grey-400">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {!isDemo && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleEdit(e, project)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-grey-400 transition-colors hover:bg-grey-800 hover:text-grey-300"
                        title="Bewerk project"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, project)}
                        disabled={deleteMutation.isPending}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-grey-400 transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                        title="Verwijder project"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </button>

                {/* Expanded content: scan history + change timeline */}
                {isExpanded && (
                  <>
                    {/* Scan history section */}
                    {!isDemo && <WijkScanList projectId={project.id} navigate={navigate} />}

                    {isDemo && (
                      <div className="border-t border-grey-800 px-5 py-4 text-center text-sm text-grey-400">
                        Geen scans beschikbaar (demo modus)
                      </div>
                    )}

                    {/* Change timeline section */}
                    {!isDemo && <ChangeTimeline projectId={project.id} />}
                  </>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-grey-800 bg-grey-900 px-6 py-12 text-center">
          <p className="mb-4 text-grey-400">Nog geen projecten aangemaakt</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="min-h-[44px] rounded-lg border border-grey-800 bg-grey-900 px-4 py-2 text-sm font-medium text-grey-100 transition-colors hover:bg-grey-850"
          >
            Maak je eerste project
          </button>
        </div>
      )}

      {/* Modals use intentional light theme (white card on dark backdrop) — JSDoc documents this decision */}
      <ProjectCreateModal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      <ProjectEditModal
        key={selectedProject?.id}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={selectedProject}
      />
    </div>
  )
}

/**
 * Navigation-aware wijk card sub-component.
 *
 * Calls useProjectScans at component top level (valid hook usage — this is a
 * React component, not a .map() callback). Looks up the latest completed scan
 * on click and navigates to /resultaten?scan_id=<id>. Shows a Dutch toast when
 * no completed scan exists.
 *
 * Passed to WijkCardGrid via the renderCard render prop so each wijk card can
 * independently fetch its own scan data without a hooks-in-loop violation.
 */
function WijkCardWithNav({
  wijk,
  svgData,
  unreadCount,
  navigate,
}: {
  wijk: ProjectResponse
  svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null
  unreadCount: number
  navigate: ReturnType<typeof useNavigate>
}) {
  const { data } = useProjectScans(wijk.id)

  const handleClick = () => {
    const latestScan = data?.scans.find((s) => s.status === 'completed')
    if (!latestScan) {
      toast.info('Nog geen scan beschikbaar voor deze wijk')
      return
    }
    navigate({ to: '/resultaten', search: { scan_id: latestScan.scan_id } })
  }

  return (
    <WijkCard
      wijk={wijk}
      svgData={svgData}
      unreadCount={unreadCount}
      onClick={handleClick}
    />
  )
}

/**
 * Scan list for a project -- renders inside expanded wijk/project rows.
 * Hook only fires when this component mounts (when row is expanded).
 */
function WijkScanList({
  projectId,
  navigate,
}: {
  projectId: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const { data, isLoading } = useProjectScans(projectId)
  const scans = data?.scans ?? []

  const handleScanResultsClick = (scan: ScanListItem) => {
    navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
  }

  const handleScanMapClick = (scan: ScanListItem) => {
    navigate({ to: '/map', search: { scan_id: scan.scan_id } })
  }

  if (isLoading) {
    return (
      <div className="border-t border-grey-800 px-10 py-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="border-t border-grey-800 px-10 py-4 text-center text-sm text-grey-400">
        Nog geen scans voor dit project
      </div>
    )
  }

  return (
    <div className="border-t border-grey-800 bg-grey-850/50">
      {scans.map((scan) => {
        const isCompleted = scan.status === 'completed'
        return (
          <div
            key={scan.scan_id}
            className="flex w-full items-center gap-3 border-b border-grey-800 px-10 py-3 last:border-b-0"
          >
            <ScanIcon />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-grey-300">
                  Scan {dateFmt.format(new Date(scan.scan_date))}
                </p>
                {!isCompleted && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    scan.status === 'running' ? 'bg-info/20 text-info' :
                    scan.status === 'failed' ? 'bg-error/20 text-error' :
                    'bg-grey-800 text-grey-400'
                  }`}>
                    {scan.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-grey-400">
                {dateFmt.format(new Date(scan.scan_date))} &middot; {scan.parcel_count} percelen
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleScanResultsClick(scan)}
                disabled={!isCompleted}
                className="min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium text-grey-300 transition-colors hover:bg-grey-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Toon resultaten
              </button>
              <button
                onClick={() => handleScanMapClick(scan)}
                disabled={!isCompleted}
                className="min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium text-grey-300 transition-colors hover:bg-grey-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Toon kaart
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-grey-600">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}
