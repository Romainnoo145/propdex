import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { FileText, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import ResultsShell from '@/components/layout/ResultsShell'
import { useReports, useDeleteReport } from '@/hooks/useReports'
import { useProjects } from '@/hooks/useProjects'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { Select } from '@/components/primitives/Select'
import type { ReportListItem } from '@/lib/types/report'

export const Route = createFileRoute('/_authenticated/rapporten')({
  component: RapportenPage,
})

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function RapportenPage() {
  const navigate = useNavigate()
  const [projectFilter, setProjectFilter] = useState<string | undefined>(
    undefined,
  )
  const { data, isLoading } = useReports({ project_id: projectFilter })
  const { data: projectsData } = useProjects()
  const deleteMutation = useDeleteReport()

  const reports = data?.reports ?? []

  const handleOpenReport = (report: ReportListItem) => {
    navigate({ to: '/rapport/$id', params: { id: report.id } })
  }

  const handleDelete = (e: React.MouseEvent, report: ReportListItem) => {
    e.stopPropagation()
    if (!window.confirm(`Rapport "${report.report_name}" verwijderen?`)) return
    deleteMutation.mutate(report.id, {
      onSuccess: () => toast.success('Rapport verwijderd'),
      onError: (err) => toast.error(err.message || 'Fout bij verwijderen'),
    })
  }

  return (
    <ResultsShell>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-grey-100">Rapporten</h1>
        <p className="mt-1 text-grey-400">
          Opgeslagen vastgoedrapporten met kadaster, bestemmingsplan en
          monumentgegevens
        </p>
      </div>

      {/* Filter bar */}
      {projectsData && projectsData.projects.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <label
            htmlFor="project-filter"
            className="text-sm text-grey-400 shrink-0"
          >
            Project:
          </label>
          <Select
            id="project-filter"
            value={projectFilter || ''}
            onChange={(e) => setProjectFilter(e.target.value || undefined)}
            className="min-h-[44px] min-w-[230px]"
          >
            <option value="">Alle projecten</option>
            {projectsData.projects
              .filter((p) => !p.parent_id)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </Select>
          <span className="text-sm text-grey-400 ml-auto">
            {reports.length} {reports.length === 1 ? 'rapport' : 'rapporten'}
          </span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-grey-800 bg-grey-900 p-4 space-y-2"
            >
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && reports.length === 0 && (
        <EmptyState
          icon={<FileText size={32} />}
          title="Nog geen rapporten"
          description="Genereer een rapport vanuit scanresultaten of zoek een adres op de kaart."
          action={{
            label: 'Naar kaart',
            onClick: () => navigate({ to: '/map' }),
          }}
        />
      )}

      {/* Report list */}
      {!isLoading && reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleOpenReport(report)}
              className="w-full text-left rounded-lg border border-grey-800 bg-grey-900 p-4 transition-colors hover:bg-grey-850 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Report name */}
                  <h3 className="text-sm font-semibold text-grey-100 truncate">
                    {report.report_name}
                  </h3>

                  {/* Location */}
                  <p className="mt-0.5 text-xs text-grey-400">
                    {report.postcode}, {report.city}
                  </p>

                  {/* Meta row */}
                  <div className="mt-2 flex items-center gap-3 text-xs text-grey-600">
                    <span>{dateFmt.format(new Date(report.created_at))}</span>
                    <span className="text-grey-700">&middot;</span>
                    <span>
                      {Math.round(report.completeness_score * 100)}% compleet
                    </span>
                    {report.notes && (
                      <>
                        <span className="text-grey-700">&middot;</span>
                        <span className="truncate max-w-[200px]">
                          {report.notes}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate({
                        to: '/map',
                        search: {
                          reportId: report.id,
                        },
                      })
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-grey-400 hover:bg-grey-800 hover:text-grey-300 cursor-pointer"
                    title="Bekijk op kaart"
                  >
                    <ExternalLink size={14} />
                  </span>
                  <span
                    onClick={(e) => handleDelete(e, report)}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-grey-400 hover:bg-error/10 hover:text-error cursor-pointer"
                    title="Verwijder rapport"
                  >
                    <Trash2 size={14} />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </ResultsShell>
  )
}
