import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { FileText, Trash2, ExternalLink, Plus, Search } from 'lucide-react'
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
  const [searchQuery, setSearchQuery] = useState('')

  const reports = data?.reports ?? []
  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return reports
    return reports.filter((report) => (
      report.report_name.toLowerCase().includes(q) ||
      report.postcode.toLowerCase().includes(q) ||
      report.city.toLowerCase().includes(q) ||
      (report.notes ?? '').toLowerCase().includes(q)
    ))
  }, [reports, searchQuery])

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
    <ResultsShell contentClassName="max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-grey-100">Rapporten</h1>
          <p className="mt-1 text-sm text-grey-500">
            {filteredReports.length}/{reports.length} {reports.length === 1 ? 'rapport' : 'rapporten'}
          </p>
        </div>
        <button
          onClick={() => navigate({ to: '/map' })}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-accent bg-amber-accent px-3.5 text-sm font-semibold text-on-accent transition-colors hover:bg-amber-accent-hover"
        >
          <Plus size={14} />
          Nieuw rapport +
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-overlay/[0.08] bg-grey-900 p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grey-600"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Zoek rapporten (adres, postcode, plaats)"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="search"
              enterKeyHint="search"
              name="search_reports_global"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              className="h-10 w-full rounded-lg border border-overlay/[0.12] bg-overlay/[0.04] pl-9 pr-3 text-sm text-grey-100 placeholder:text-grey-500 focus:border-amber-accent/40 focus:outline-none"
            />
          </div>
          <Select
            id="project-filter"
            value={projectFilter || ''}
            onChange={(e) => setProjectFilter(e.target.value || undefined)}
            className="h-10 min-h-0 rounded-lg border-overlay/[0.12] bg-overlay/[0.04] text-sm"
          >
            <option value="">Alle projecten</option>
            {(projectsData?.projects ?? [])
              .filter((p) => !p.parent_id)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </Select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 space-y-2"
            >
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredReports.length === 0 && (
        <EmptyState
          icon={<FileText size={32} />}
          title={reports.length === 0 ? 'Nog geen rapporten' : 'Geen rapporten gevonden'}
          description={reports.length === 0
            ? 'Genereer een rapport vanuit scanresultaten of zoek een adres op de kaart.'
            : 'Pas je zoekterm of projectfilter aan.'
          }
          action={{
            label: 'Naar kaart',
            onClick: () => navigate({ to: '/map' }),
          }}
        />
      )}

      {/* Report list */}
      {!isLoading && filteredReports.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredReports.map((report) => (
            <ReportTile
              key={report.id}
              report={report}
              onOpen={() => handleOpenReport(report)}
              onOpenMap={(e) => {
                e.stopPropagation()
                navigate({
                  to: '/map',
                  search: { reportId: report.id },
                })
              }}
              onDelete={(e) => handleDelete(e, report)}
            />
          ))}
        </div>
      )}
    </ResultsShell>
  )
}

interface ReportTileProps {
  report: ReportListItem
  onOpen: () => void
  onOpenMap: (e: React.MouseEvent<HTMLButtonElement>) => void
  onDelete: (e: React.MouseEvent<HTMLButtonElement>) => void
}

function ReportTile({ report, onOpen, onOpenMap, onDelete }: ReportTileProps) {
  const completeness = Math.max(0, Math.min(100, Math.round(report.completeness_score * 100)))

  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      className="group w-full rounded-xl border border-overlay/[0.08] bg-grey-900 p-4 text-left transition-colors hover:bg-grey-850"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-overlay/[0.12] bg-overlay/[0.06] text-grey-300">
          <FileText size={14} />
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onOpenMap}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-overlay/[0.12] bg-overlay/[0.04] text-grey-400 transition-colors hover:bg-overlay/[0.08] hover:text-grey-100"
            title="Bekijk op kaart"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-overlay/[0.12] bg-overlay/[0.04] text-grey-400 transition-colors hover:border-error/30 hover:bg-error/10 hover:text-error"
            title="Verwijder rapport"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-grey-100">
        {report.report_name}
      </h3>
      <p className="mt-1 text-xs text-grey-400">
        {report.postcode}, {report.city}
      </p>

      {report.notes && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-grey-500">
          {report.notes}
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-grey-500">{dateFmt.format(new Date(report.created_at))}</span>
          <span className="font-medium text-amber-accent">{completeness}% compleet</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-overlay/[0.08]">
          <div
            className="h-full rounded-full bg-amber-accent transition-all duration-300"
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>
    </div>
  )
}
