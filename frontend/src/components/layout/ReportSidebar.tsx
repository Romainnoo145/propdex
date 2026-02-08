import { useState } from 'react'
import { useReports } from '@/hooks/useReports'
import { useRecentViewed, type RecentItem } from '@/hooks/useRecentViewed'
import ReportCard from '@/components/reports/ReportCard'
import ReportSearch from '@/components/reports/ReportSearch'
import RecentViewed from '@/components/reports/RecentViewed'

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
 * Design: Glassmorphism with slide-in animation
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
  const { data, isLoading } = useReports()
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

  // Group reports by project
  const groupedReports =
    data?.reports.reduce(
      (acc, report) => {
        const key = report.project_id || 'Geen project'
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(report)
        return acc
      },
      {} as Record<string, typeof data.reports>
    ) || {}

  const hasReports = data && data.reports.length > 0
  const hasRecent = recent.length > 0

  if (!isOpen) return null

  return (
    <aside className="h-full w-80 shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl">

        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <h2 className="text-lg font-medium text-white">Rapporten</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Sluit sidebar"
            >
              <XIcon />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
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
              <div className="border-b border-white/10 pb-4">
                <RecentViewed items={recent} onItemClick={onSelectRecent} />
              </div>
            )}

            {/* Saved Reports */}
            {hasReports && (
              <div className="p-4">
                <h3 className="mb-3 px-1 text-xs uppercase tracking-wide text-white/40">
                  Opgeslagen rapporten
                </h3>
                <div className="space-y-2">
                  {Object.entries(groupedReports).map(
                    ([projectName, projectReports]) => {
                      const isExpanded = expandedProjects.has(projectName)
                      return (
                        <div key={projectName}>
                          {/* Accordion header */}
                          <button
                            onClick={() => toggleProject(projectName)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5"
                          >
                            <span className="text-sm font-medium text-white/80">
                              {projectName}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/40">
                                {projectReports.length}
                              </span>
                              <ChevronIcon
                                className={`h-4 w-4 text-white/40 transition-transform ${
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
                                ? `${projectReports.length * 100}px`
                                : '0',
                            }}
                          >
                            <div className="space-y-2 pt-2">
                              {projectReports.map((report) => (
                                <ReportCard
                                  key={report.id}
                                  report={report}
                                  onClick={() => onSelectReport(report.id)}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              </div>
            )}

            {/* Empty state — minimal */}
            {!hasReports && !hasRecent && !isLoading && (
              <div className="px-4 py-8 text-center text-sm text-white/30">
                Geen opgeslagen rapporten
              </div>
            )}

            {/* Loading state */}
            {isLoading && (
              <div className="py-8 text-center text-sm text-white/40">
                Laden...
              </div>
            )}
          </div>
        </div>
    </aside>
  )
}

// Icons
function XIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
