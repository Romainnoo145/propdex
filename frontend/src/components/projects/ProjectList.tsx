import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
 * Light theme — off-white background with dark typography.
 * Falls back to demo data when API is unavailable.
 */
export default function ProjectList() {
  const { data, isLoading } = useProjects()
  const { data: unreadData } = useUnreadCounts()
  const deleteMutation = useDeleteProject()
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedGemeenteId, setExpandedGemeenteId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectResponse | null>(null)

  const isDemo = !data && !isLoading
  const allProjects = data?.projects ?? (isDemo ? DEMO_PROJECTS : [])

  // Separate top-level projects (no parent) from hierarchical projects
  const topLevelProjects = allProjects.filter((p) => p.parent_id === null)
  const monitoringProjects = topLevelProjects.filter((p) => p.is_monitored)
  const regularProjects = topLevelProjects.filter((p) => !p.is_monitored)

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
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Voorbeelddata — start de backend om projecten te beheren
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">
          {allProjects.length > 0
            ? `${allProjects.length} ${allProjects.length === 1 ? 'project' : 'projecten'}`
            : 'Nog geen projecten'}
        </h3>
        <button
          onClick={() => setCreateModalOpen(true)}
          disabled={isDemo}
          className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nieuw project +
        </button>
      </div>

      {allProjects.length > 0 ? (
        <div className="space-y-2">
          {/* Monitoring projects (hierarchical gemeente -> wijk) */}
          {monitoringProjects.map((gemeente) => {
            const isGemeenteExpanded = expandedGemeenteId === gemeente.id
            const wijkChildren = allProjects.filter((p) => p.parent_id === gemeente.id)
            const totalUnread = wijkChildren.reduce((sum, wijk) => {
              const wijkUnread = unreadData?.per_project.find(
                (p) => p.project_id === wijk.id
              )?.unread_count ?? 0
              return sum + wijkUnread
            }, 0)

            return (
              <div
                key={gemeente.id}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                {/* Gemeente group header */}
                <button
                  onClick={() => setExpandedGemeenteId((prev) => (prev === gemeente.id ? null : gemeente.id))}
                  className="flex w-full min-h-[44px] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                >
                  <ChevronIcon
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isGemeenteExpanded ? 'rotate-90' : ''}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{gemeente.name}</h4>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                        {wijkChildren.length} {wijkChildren.length === 1 ? 'wijk' : 'wijken'}
                      </span>
                      {totalUnread > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
                          {totalUnread}
                        </span>
                      )}
                    </div>
                    {gemeente.description && (
                      <p className="mt-0.5 truncate text-sm text-gray-500">
                        {gemeente.description}
                      </p>
                    )}
                  </div>
                </button>

                {/* Wijk children */}
                {isGemeenteExpanded && wijkChildren.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50/30">
                    {wijkChildren.map((wijk) => {
                      const isWijkExpanded = expandedId === wijk.id

                      const wijkUnread = unreadData?.per_project.find(
                        (p) => p.project_id === wijk.id
                      )?.unread_count ?? 0

                      return (
                        <div key={wijk.id} className="border-b border-gray-100 last:border-b-0">
                          {/* Wijk project header */}
                          <button
                            onClick={() => handleToggle(wijk.id)}
                            className="flex w-full min-h-[44px] items-center gap-3 px-8 py-3 text-left transition-colors hover:bg-gray-100/50"
                          >
                            <ChevronIcon
                              className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isWijkExpanded ? 'rotate-90' : ''}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-medium text-gray-800">{wijk.name}</h5>
                                {wijk.report_count > 0 && (
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                                    {wijk.report_count}
                                  </span>
                                )}
                                {wijkUnread > 0 && (
                                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
                                    {wijkUnread > 9 ? wijkUnread : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>

                          {/* Wijk expanded content */}
                          {isWijkExpanded && (
                            <>
                              {/* Scan history section */}
                              {!isDemo && <WijkScanList projectId={wijk.id} navigate={navigate} />}

                              {isDemo && (
                                <div className="border-t border-gray-100 px-10 py-4 text-center text-sm text-gray-400">
                                  Geen scans beschikbaar (demo modus)
                                </div>
                              )}

                              {/* Change timeline section */}
                              {!isDemo && <ChangeTimeline projectId={wijk.id} />}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

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
                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                {/* Project header — clickable */}
                <button
                  onClick={() => handleToggle(project.id)}
                  className="flex w-full min-h-[44px] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                >
                  <ChevronIcon
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{project.name}</h4>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        {project.report_count}
                      </span>
                      {/* Unread badge */}
                      {unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
                          {unreadCount > 9 ? unreadCount : ''}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="mt-0.5 truncate text-sm text-gray-500">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {!isDemo && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleEdit(e, project)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        title="Bewerk project"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, project)}
                        disabled={deleteMutation.isPending}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
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
                      <div className="border-t border-gray-100 px-5 py-4 text-center text-sm text-gray-400">
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
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="mb-4 text-gray-500">Nog geen projecten aangemaakt</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="min-h-[44px] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Maak je eerste project
          </button>
        </div>
      )}

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
      <div className="border-t border-gray-100 px-10 py-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <div className="border-t border-gray-100 px-10 py-4 text-center text-sm text-gray-400">
        Nog geen scans voor dit project
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/50">
      {scans.map((scan) => {
        const isCompleted = scan.status === 'completed'
        return (
          <div
            key={scan.scan_id}
            className="flex w-full items-center gap-3 border-b border-gray-100 px-10 py-3 last:border-b-0"
          >
            <ScanIcon />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-800">
                  {scan.gemeente_naam}{scan.wijk_naam ? ` \u2014 ${scan.wijk_naam}` : ''}
                </p>
                {!isCompleted && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    scan.status === 'running' ? 'bg-blue-100 text-blue-600' :
                    scan.status === 'failed' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {scan.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {dateFmt.format(new Date(scan.scan_date))} &middot; {scan.parcel_count} percelen
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleScanResultsClick(scan)}
                disabled={!isCompleted}
                className="min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Toon resultaten
              </button>
              <button
                onClick={() => handleScanMapClick(scan)}
                disabled={!isCompleted}
                className="min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300">
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
