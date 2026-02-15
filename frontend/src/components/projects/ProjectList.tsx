import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useProjects, useDeleteProject } from '@/hooks/useProjects'
import { useUnreadCounts } from '@/hooks/useNotifications'
import { toast } from 'sonner'
import type { ProjectResponse } from '@/lib/types/project'
import type { ReportListItem } from '@/lib/types/report'
import ProjectCreateModal from './ProjectCreateModal'
import ProjectEditModal from './ProjectEditModal'
import ChangeTimeline from '@/components/notifications/ChangeTimeline'

// Demo reports per project
const DEMO_REPORTS: Record<string, ReportListItem[]> = {
  'demo-1': [
    { id: 'r1', report_name: 'Markt 1, Venlo', postcode: '5911HD', city: 'Venlo', notes: 'Stadhuis — Rijksmonument', project_id: 'demo-1', completeness_score: 0.95, created_at: '2026-02-08T14:00:00Z', updated_at: '2026-02-08T14:00:00Z' },
    { id: 'r2', report_name: 'Parade 1, Venlo', postcode: '5911CA', city: 'Venlo', notes: null, project_id: 'demo-1', completeness_score: 0.92, created_at: '2026-02-07T10:00:00Z', updated_at: '2026-02-07T10:00:00Z' },
    { id: 'r3', report_name: 'Parade 2, Venlo', postcode: '5911CC', city: 'Venlo', notes: 'Café de Locomotief', project_id: 'demo-1', completeness_score: 0.93, created_at: '2026-02-06T16:00:00Z', updated_at: '2026-02-06T16:00:00Z' },
    { id: 'r4', report_name: 'Lomstraat 10, Venlo', postcode: '5911EG', city: 'Venlo', notes: null, project_id: 'demo-1', completeness_score: 0.88, created_at: '2026-02-05T09:00:00Z', updated_at: '2026-02-05T09:00:00Z' },
    { id: 'r5', report_name: 'Vleesstraat 25, Venlo', postcode: '5911JE', city: 'Venlo', notes: 'Winkelruimte begane grond', project_id: 'demo-1', completeness_score: 0.90, created_at: '2026-02-04T11:00:00Z', updated_at: '2026-02-04T11:00:00Z' },
    { id: 'r6', report_name: 'Klaasstraat 8, Venlo', postcode: '5911HT', city: 'Venlo', notes: null, project_id: 'demo-1', completeness_score: 0.85, created_at: '2026-02-03T14:00:00Z', updated_at: '2026-02-03T14:00:00Z' },
    { id: 'r7', report_name: 'Nieuwstraat 3, Venlo', postcode: '5911JR', city: 'Venlo', notes: null, project_id: 'demo-1', completeness_score: 0.91, created_at: '2026-02-02T10:00:00Z', updated_at: '2026-02-02T10:00:00Z' },
    { id: 'r8', report_name: 'Gasthuisstraat 12, Venlo', postcode: '5911JB', city: 'Venlo', notes: 'Potentiële verbouwing', project_id: 'demo-1', completeness_score: 0.87, created_at: '2026-02-01T15:00:00Z', updated_at: '2026-02-01T15:00:00Z' },
  ],
  'demo-2': [
    { id: 'r9', report_name: 'Randwycksingel 20, Maastricht', postcode: '6229EE', city: 'Maastricht', notes: 'Nabij station Randwyck', project_id: 'demo-2', completeness_score: 0.78, created_at: '2026-01-28T10:00:00Z', updated_at: '2026-01-28T10:00:00Z' },
    { id: 'r10', report_name: 'Endepolsdomein 5, Maastricht', postcode: '6229EP', city: 'Maastricht', notes: null, project_id: 'demo-2', completeness_score: 0.82, created_at: '2026-01-25T14:00:00Z', updated_at: '2026-01-25T14:00:00Z' },
    { id: 'r11', report_name: 'Oxfordlaan 55, Maastricht', postcode: '6229ER', city: 'Maastricht', notes: 'Groot perceel', project_id: 'demo-2', completeness_score: 0.75, created_at: '2026-01-22T09:00:00Z', updated_at: '2026-01-22T09:00:00Z' },
    { id: 'r12', report_name: 'Debyelaan 15, Maastricht', postcode: '6229HX', city: 'Maastricht', notes: null, project_id: 'demo-2', completeness_score: 0.80, created_at: '2026-01-20T11:00:00Z', updated_at: '2026-01-20T11:00:00Z' },
    { id: 'r13', report_name: 'P. Debyeplein 1, Maastricht', postcode: '6229HA', city: 'Maastricht', notes: 'Nabij universiteit', project_id: 'demo-2', completeness_score: 0.83, created_at: '2026-01-18T16:00:00Z', updated_at: '2026-01-18T16:00:00Z' },
  ],
  'demo-3': [
    { id: 'r14', report_name: 'Oudegracht 100, Utrecht', postcode: '3511AX', city: 'Utrecht', notes: 'Werfkelder — Rijksmonument', project_id: 'demo-3', completeness_score: 0.96, created_at: '2026-02-06T11:00:00Z', updated_at: '2026-02-06T11:00:00Z' },
    { id: 'r15', report_name: 'Domplein 5, Utrecht', postcode: '3512JC', city: 'Utrecht', notes: 'Nabij Domtoren', project_id: 'demo-3', completeness_score: 0.94, created_at: '2026-02-06T11:30:00Z', updated_at: '2026-02-06T11:30:00Z' },
    { id: 'r16', report_name: 'Janskerkhof 15, Utrecht', postcode: '3512BL', city: 'Utrecht', notes: null, project_id: 'demo-3', completeness_score: 0.91, created_at: '2026-02-06T12:00:00Z', updated_at: '2026-02-06T12:00:00Z' },
  ],
}

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

  const handleReportClick = (report: ReportListItem) => {
    // Extract huisnummer from "Straat 10, Stad" format
    const streetPart = report.report_name.split(',')[0] ?? ''
    const hn = streetPart.match(/\d+/)?.[0] ?? '1'
    navigate({
      to: '/rapport/$id',
      params: { id: report.id },
      search: { postcode: report.postcode, huisnummer: parseInt(hn, 10) },
    })
  }

  if (isLoading) {
    return <div className="py-8 text-center text-gray-400">Laden...</div>
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
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
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
                      const reports = isDemo
                        ? DEMO_REPORTS[wijk.id] ?? []
                        : [] // TODO: fetch from useReports({ project_id }) when live

                      const wijkUnread = unreadData?.per_project.find(
                        (p) => p.project_id === wijk.id
                      )?.unread_count ?? 0

                      return (
                        <div key={wijk.id} className="border-b border-gray-100 last:border-b-0">
                          {/* Wijk project header */}
                          <button
                            onClick={() => handleToggle(wijk.id)}
                            className="flex w-full items-center gap-3 px-8 py-3 text-left transition-colors hover:bg-gray-100/50"
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
                              {/* Reports section */}
                              {reports.length > 0 && (
                                <div className="border-t border-gray-100 bg-gray-50/50">
                                  {reports.map((report) => (
                                    <button
                                      key={report.id}
                                      onClick={() => handleReportClick(report)}
                                      className="flex w-full items-center gap-3 border-b border-gray-100 px-10 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-100/70"
                                    >
                                      <DocumentIcon />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800">
                                          {report.report_name}
                                        </p>
                                        {report.notes && (
                                          <p className="truncate text-xs text-gray-400">{report.notes}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <span>{Math.round(report.completeness_score * 100)}%</span>
                                        <span>{dateFmt.format(new Date(report.created_at))}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {reports.length === 0 && (
                                <div className="border-t border-gray-100 px-10 py-4 text-center text-sm text-gray-400">
                                  Geen rapporten in dit project
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
            const reports = isDemo
              ? DEMO_REPORTS[project.id] ?? []
              : [] // TODO: fetch from useReports({ project_id }) when live

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
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
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
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        title="Bewerk project"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, project)}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        title="Verwijder project"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </button>

                {/* Expanded content: reports + change timeline */}
                {isExpanded && (
                  <>
                    {/* Reports section */}
                    {reports.length > 0 && (
                      <div className="border-t border-gray-100 bg-gray-50/50">
                        {reports.map((report) => (
                          <button
                            key={report.id}
                            onClick={() => handleReportClick(report)}
                            className="flex w-full items-center gap-3 border-b border-gray-100 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-100/70"
                          >
                            <DocumentIcon />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800">
                                {report.report_name}
                              </p>
                              {report.notes && (
                                <p className="truncate text-xs text-gray-400">{report.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>{Math.round(report.completeness_score * 100)}%</span>
                              <span>{dateFmt.format(new Date(report.created_at))}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {reports.length === 0 && (
                      <div className="border-t border-gray-100 px-5 py-4 text-center text-sm text-gray-400">
                        Geen rapporten in dit project
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
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
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
