import { useState } from 'react'
import type { ProjectResponse } from '@/lib/types/project'
import ProjectEditModal from './ProjectEditModal'
import ChangeTimeline from '@/components/notifications/ChangeTimeline'
import { Skeleton } from '@/components/feedback/Skeleton'
import { toast } from 'sonner'
import { useDeleteProject } from '@/hooks/useProjects'
import { ProvincieView } from './ProvincieView'
import { GemeenteView } from './GemeenteView'
import { ProjectWorkspaceHeader } from './WorkspaceHeader'
import { WijkScanList } from './WijkScanList'
import { useProjectenWorkspace } from './useProjectenWorkspace'
import { normalizeAreaName } from '@/lib/geo/normalizers'
import {
  ChevronIcon,
  PencilIcon,
  TrashIcon,
  ProvinceStatIcon,
  GemeenteStatIcon,
  BellStatIcon,
} from './ProjectIcons'

/**
 * Top-level Projecten workspace orchestrator.
 * All hooks and state are in useProjectenWorkspace.
 * View branches are presentational sub-components.
 */
export default function ProjectenPage() {
  const ws = useProjectenWorkspace()
  const deleteMutation = useDeleteProject()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectResponse | null>(null)

  const handleToggle = (projectId: string) => setExpandedId((prev) => (prev === projectId ? null : projectId))

  const handleEdit = (e: React.MouseEvent, project: ProjectResponse) => {
    e.stopPropagation()
    if (ws.isDemo) return
    setSelectedProject(project)
    setEditModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, project: ProjectResponse) => {
    e.stopPropagation()
    if (ws.isDemo) return
    if (!window.confirm('Project verwijderen? Rapporten worden niet verwijderd.')) return
    deleteMutation.mutate(project.id, {
      onSuccess: () => toast.success('Project verwijderd'),
      onError: (error) => toast.error(error.message || 'Fout bij verwijderen project'),
    })
  }

  if (ws.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {ws.isDemo && (
        <div className="rounded-lg border border-aura-amber/30 bg-aura-amber/10 px-4 py-3 text-sm text-aura-amber">
          Voorbeelddata — start de backend om projecten te beheren
        </div>
      )}

      {!ws.hasGemeenteDetail && (
        <ProjectWorkspaceHeader
          title={ws.workspaceTitle}
          subtitle={ws.workspaceSubtitle}
          metrics={[
            { label: 'Provincies', value: ws.totaalProvincies, icon: <ProvinceStatIcon /> },
            { label: 'Gemeenten', value: ws.gemeentenInSelectedProvince, icon: <GemeenteStatIcon /> },
            { label: 'Meldingen', value: ws.totaalMeldingen, icon: <BellStatIcon />, highlight: ws.totaalMeldingen > 0 },
          ]}
          actionLabel="Bekijk op kaart"
          onAction={() => ws.navigate({ to: '/map' })}
        />
      )}

      {ws.allProjects.length > 0 ? (
        <div className="space-y-2">
          {ws.hasGemeenteDetail ? (
            <GemeenteView
              selectedGemeenteId={ws.selectedGemeenteId}
              selectedGemeenteCard={ws.selectedGemeenteCard ?? null}
              selectedWijkId={ws.selectedWijkId}
              selectedProvinceCode={ws.selectedProvinceCode}
              municipalityProjectsById={ws.municipalityProjectsById}
              childrenByParentId={ws.childrenByParentId}
              standaloneWijkProjectsByCode={ws.standaloneWijkProjectsByCode}
              detailWijkGeojson={ws.detailWijkGeojson}
              scanWijkNamesByGemeenteCode={ws.scanWijkNamesByGemeenteCode}
              selectedGemeenteChanges={ws.selectedGemeenteChanges ?? null}
              scanHistory={ws.scanHistory?.scans ?? []}
              selectedGemeenteWijkReportCounts={ws.selectedGemeenteWijkReportCounts}
              unreadData={ws.unreadData}
              gemeenteGeojson={ws.gemeenteGeojson ?? null}
              setMonitoringIsPending={ws.setMonitoringSubscription.isPending}
              resolveGemeenteCodeForProject={ws.resolveGemeenteCodeForProject}
              handleSetGemeenteMonitoring={ws.handleSetGemeenteMonitoring}
              normalizeAreaName={normalizeAreaName}
            />
          ) : (
            <ProvincieView
              provinceOptions={ws.provinceOptions}
              selectedProvince={ws.selectedProvince}
              selectedProvinceCode={ws.selectedProvinceCode}
              provinceStatsByCode={ws.provinceStatsByCode}
              recentCards={ws.recentCards}
              favoriteSelectedProvinceCards={ws.favoriteSelectedProvinceCards}
              nonFavoriteSelectedProvinceCards={ws.nonFavoriteSelectedProvinceCards}
              selectedProvinceGemeenteCards={ws.selectedProvinceGemeenteCards}
              favoriteCodeSet={ws.favoriteCodeSet}
              standaloneWijkCountInSelectedProvince={ws.standaloneWijkCountInSelectedProvince}
              gemeenteGeojson={ws.gemeenteGeojson}
              provincieGeojson={ws.provincieGeojson}
              onProvinceSelect={ws.setSelectedProvinceCode}
              onToggleFavoriteGemeente={ws.toggleFavoriteGemeente}
              onRegisterRecentGemeente={ws.registerRecentGemeente}
            />
          )}

          {ws.regularProjects.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60">
              <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5">
                <span className="text-xs font-medium uppercase tracking-wide text-aura-amber/70">
                  Overige projecten
                </span>
                <span className="ml-auto text-xs text-neutral-500">{ws.regularProjects.length}</span>
              </div>
              <div className="space-y-2.5 p-3">
                {ws.regularProjects.map((project) => {
                  const isExpanded = expandedId === project.id
                  const unreadCount = ws.unreadData?.per_project.find((p) => p.project_id === project.id)?.unread_count ?? 0
                  return (
                    <div key={project.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60">
                      <button
                        onClick={() => handleToggle(project.id)}
                        className="flex w-full min-h-[44px] items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-neutral-50"
                      >
                        <ChevronIcon className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-aura-ink">{project.name}</h4>
                            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600">
                              {project.report_count}
                            </span>
                            {unreadCount > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-aura-amber px-1 text-xs font-semibold text-aura-obsidian">
                                {unreadCount > 9 ? unreadCount : ''}
                              </span>
                            )}
                          </div>
                          {project.description && (
                            <p className="mt-0.5 truncate text-sm text-neutral-600">{project.description}</p>
                          )}
                        </div>
                        {!ws.isDemo && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => handleEdit(e, project)} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-aura-ink" title="Bewerk project">
                              <PencilIcon />
                            </button>
                            <button onClick={(e) => handleDelete(e, project)} disabled={deleteMutation.isPending} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50" title="Verwijder project">
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </button>
                      {isExpanded && (
                        <>
                          {!ws.isDemo && (
                            <WijkScanList
                              projectId={project.id}
                              projectName={project.name}
                              gemeenteCode={ws.resolveGemeenteCodeWithScanFallback(project)}
                              wijkNaam={project.wijk_naam}
                              navigate={ws.navigate}
                            />
                          )}
                          {ws.isDemo && (
                            <div className="border-t border-neutral-200 px-5 py-4 text-center text-sm text-neutral-600">
                              Geen scans beschikbaar (demo modus)
                            </div>
                          )}
                          {!ws.isDemo && <ChangeTimeline projectId={project.id} />}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 px-6 py-12 text-center">
          <p className="text-neutral-600">
            Nog geen projecten gevonden. Projecten worden automatisch gekoppeld via scan- en rapportflows.
          </p>
        </div>
      )}

      <ProjectEditModal
        key={selectedProject?.id}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={selectedProject}
      />
    </div>
  )
}
