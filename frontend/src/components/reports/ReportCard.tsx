import type { ReportListItem } from '@/lib/types/report'

interface ReportCardProps {
  report: ReportListItem
  onClick: () => void
  onDelete?: () => void
  isStale?: boolean
}

/**
 * Rich card for saved report with address, date, and freshness badge.
 *
 * Design: Industrial Amber card with:
 * - Freshness dot (gray for fresh, amber for stale)
 * - Report name (address)
 * - Postcode + city
 * - Created date + completeness percentage
 */
export default function ReportCard({
  report,
  onClick,
  onDelete,
  isStale = false,
}: ReportCardProps) {
  const formattedDate = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(report.created_at))

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.()
  }

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-grey-800 bg-grey-850 p-3 transition-colors hover:bg-grey-800"
    >
      {/* Top line: Freshness dot + Report name */}
      <div className="flex items-start gap-2">
        <div
          className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
            isStale ? 'bg-amber-accent' : 'bg-grey-800'
          }`}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-grey-100">
            {report.report_name}
          </h3>
        </div>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Verwijder rapport"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Second line: Postcode + City */}
      <p className="mt-1 text-xs text-grey-400">
        {report.postcode}, {report.city}
      </p>

      {/* Bottom row: Date | Completeness */}
      <div className="mt-2 flex items-center justify-between text-xs text-grey-600">
        <span>{formattedDate}</span>
        <span>{Math.round(report.completeness_score * 100)}% compleet</span>
      </div>
    </div>
  )
}

// Trash icon (14x14, minimal)
function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-grey-600 hover:text-error"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}
