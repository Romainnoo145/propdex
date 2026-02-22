import type { ProjectResponse } from '@/lib/types/project'

interface GemeenteCardProps {
  /** Gemeente-level monitored project */
  gemeente: ProjectResponse
  /** Pre-computed SVG path data from geoJsonToSvgPath, or null while loading */
  svgData: { d: string; viewBox: string } | null
  /** Sum of unread change counts across all wijk children */
  totalUnread: number
  /** Card click handler — parent decides navigation behavior */
  onClick?: () => void
}

/**
 * Visual card for a monitored gemeente.
 * Renders an inline SVG silhouette (or placeholder icon), the gemeente name,
 * and a conditional unread-changes badge.
 *
 * Intentionally stateless: receives pre-computed svgData and totalUnread as props.
 * GeoJSON fetching and unread aggregation are done by the parent (GemeenteCardGrid
 * or ProjectList) to avoid redundant network requests.
 */
export function GemeenteCard({ gemeente, svgData, totalUnread, onClick }: GemeenteCardProps) {
  return (
    <div
      onClick={onClick}
      className="overflow-hidden rounded-lg border border-grey-800 bg-grey-900 cursor-pointer transition-colors hover:bg-grey-850"
    >
      {/* SVG silhouette area */}
      <div className="relative aspect-[4/3] bg-grey-950/50">
        {svgData ? (
          <svg
            viewBox={svgData.viewBox}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              d={svgData.d}
              className="fill-amber-accent/20 stroke-amber-accent"
              strokeWidth="1"
            />
          </svg>
        ) : (
          /* Placeholder when GeoJSON hasn't loaded yet or feature not found */
          <div className="flex h-full w-full items-center justify-center">
            <MapPinIcon />
          </div>
        )}
      </div>

      {/* Text area */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h4
            className="truncate text-base font-semibold text-grey-100"
            title={gemeente.name}
          >
            {gemeente.name}
          </h4>
          {/* Unread badge — text-white on bg-error is the established pattern (see ProjectList.tsx:177) */}
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-medium text-white shrink-0">
              {totalUnread}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-grey-400">{gemeente.gemeente_code}</p>
      </div>
    </div>
  )
}

function MapPinIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-grey-700"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
