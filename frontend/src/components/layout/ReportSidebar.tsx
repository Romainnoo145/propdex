import { useState } from 'react'
import { useReports } from '@/hooks/useReports'
import { useProjects, useAssignReportToProject } from '@/hooks/useProjects'
import { useRecentViewed, type RecentItem } from '@/hooks/useRecentViewed'
import ReportCard from '@/components/reports/ReportCard'
import ReportSearch from '@/components/reports/ReportSearch'
import RecentViewed from '@/components/reports/RecentViewed'
import { toast } from 'sonner'
import { Button, Select } from '@/components/primitives'
import { X, ChevronRight } from 'lucide-react'

interface ReportSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectReport: (reportId: string) => void
  onSelectRecent: (item: RecentItem) => void
}

/**
 * Report sidebar with saved reports, search, and recent viewed.
 *
 * Position: Fixed left-16 (after 64px side-rail), full height, w-80
 * Z-index: var(--z-sidebar) (200)
 * Design: Industrial Amber solid surface with slide-in animation
 *
 * Structure:
 * - Header with close button
 * - Search (ReportSearch with Cmd+K)
 * - Recent Viewed section
 * - Saved Reports grouped by project (accordion)
 * - Empty State when no reports and no recent items
 */
export default function ReportSidebar({
  isOpen,
  onClose,
  onSelectReport,
  onSelectRecent,
}: ReportSidebarProps) {
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined)
  const { data, isLoading } = useReports({ project_id: projectFilter })
  const { data: projectsData } = useProjects()
  const assignMutation = useAssignReportToProject()
  const { recent } = useRecentViewed()
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(['Geen project'])
  )

  // Toggle accordion section
  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  // Create project lookup map (UUID -> name)
  const projectMap = new Map(
    projectsData?.projects.map((p) => [p.id, p.name]) ?? []
  )

  // Group reports by project name (not UUID)
  const groupedReports =
    data?.reports.reduce(
      (acc, report) => {
        // Convert project_id to project name
        const key = report.project_id
          ? projectMap.get(report.project_id) || report.project_id
          : 'Geen project'
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(report)
        return acc
      },
      {} as Record<string, typeof data.reports>
    ) || {}

  // Sort groups: "Geen project" first, then alphabetical
  const sortedGroups = Object.entries(groupedReports).sort(([a], [b]) => {
    if (a === 'Geen project') return -1
    if (b === 'Geen project') return 1
    return a.localeCompare(b)
  })

  // Handle report-to-project assignment
  const handleAssignReport = (reportId: string, projectId: string) => {
    assignMutation.mutate(
      {
        reportId,
        projectId: projectId || null,
      },
      {
        onSuccess: () => {
          toast.success('Rapport verplaatst')
        },
        onError: (error) => {
          toast.error(error.message || 'Fout bij verplaatsen rapport')
        },
      }
    )
  }

  const hasReports = data && data.reports.length > 0
  const hasRecent = recent.length > 0

  if (!isOpen) return null

  return (
    <aside className="h-full w-80 shrink-0 border-r border-neutral-200 bg-aura-glass-white/60">

        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4">
            <h2 className="text-lg font-medium text-aura-ink">Rapporten</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Sluit sidebar"
            >
              <X size={20} />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Project filter */}
            {hasReports && projectsData && projectsData.projects.length > 0 && (
              <div className="border-b border-neutral-200 px-4 py-3">
                <label
                  htmlFor="project-filter"
                  className="mb-1.5 block text-xs font-medium text-neutral-600"
                >
                  Filter op project
                </label>
                <Select
                  id="project-filter"
                  value={projectFilter || ''}
                  onChange={(e) =>
                    setProjectFilter(e.target.value || undefined)
                  }
                >
                  <option value="">Alle projecten</option>
                  {projectsData.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Search */}
            {hasReports && (
              <div className="p-4">
                <ReportSearch
                  reports={data.reports}
                  onSelectReport={onSelectReport}
                />
              </div>
            )}

            {/* Recent Viewed */}
            {hasRecent && (
              <div className="border-b border-neutral-200 pb-4">
                <RecentViewed items={recent} onItemClick={onSelectRecent} />
              </div>
            )}

            {/* Saved Reports */}
            {hasReports && (
              <div className="p-4">
                <h3 className="mb-3 px-1 text-xs uppercase tracking-wide text-neutral-500">
                  Opgeslagen rapporten
                </h3>
                <div className="space-y-2">
                  {sortedGroups.map(([projectName, projectReports]) => {
                    const isExpanded = expandedProjects.has(projectName)
                    return (
                      <div key={projectName}>
                        {/* Accordion header */}
                        <button
                          onClick={() => toggleProject(projectName)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-aura-glass-white/40"
                        >
                          <span className="text-sm font-medium text-neutral-600">
                            {projectName}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">
                              {projectReports.length}
                            </span>
                            <ChevronRight
                              size={16}
                              className={`text-neutral-500 transition-transform ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </button>

                        {/* Accordion content */}
                        <div
                          className="overflow-hidden transition-all"
                          style={{
                            maxHeight: isExpanded
                              ? `${projectReports.length * 150}px`
                              : '0',
                          }}
                        >
                          <div className="space-y-2 pt-2">
                            {projectReports.map((report) => (
                              <div key={report.id}>
                                <ReportCard
                                  report={report}
                                  onClick={() => onSelectReport(report.id)}
                                />
                                {/* Project assignment dropdown */}
                                {projectsData &&
                                  projectsData.projects.length > 0 && (
                                    <Select
                                      value={report.project_id || ''}
                                      onChange={(e) =>
                                        handleAssignReport(
                                          report.id,
                                          e.target.value
                                        )
                                      }
                                      onClick={(e) => e.stopPropagation()}
                                      disabled={assignMutation.isPending}
                                      className="mt-1"
                                    >
                                      <option value="">Geen project</option>
                                      {projectsData.projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                          {project.name}
                                        </option>
                                      ))}
                                    </Select>
                                  )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty state — minimal */}
            {!hasReports && !hasRecent && !isLoading && (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">
                Geen opgeslagen rapporten
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="py-8 text-center text-sm text-neutral-600">
                Laden...
              </div>
            )}
          </div>
        </div>
    </aside>
  )
}
