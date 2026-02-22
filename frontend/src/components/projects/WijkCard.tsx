import type { ProjectResponse } from '@/lib/types/project'

interface WijkCardProps {
  /** Wijk-level monitored project */
  wijk: ProjectResponse
  /** Pre-computed SVG path data from geoJsonToSvgPath, or null while loading */
  svgData: { d: string; viewBox: string } | null
  /** Unread change count for this wijk project */
  unreadCount: number
  /** Card click handler — parent decides navigation behavior */
  onClick?: () => void
}

/**
 * Visual card for a monitored wijk.
 * Renders an inline SVG silhouette (or placeholder icon), the wijk name,
 * and a conditional unread-changes badge.
 *
 * Intentionally stateless: receives pre-computed svgData and unreadCount as
 * props. GeoJSON fetching and unread aggregation are done by the parent
 * (WijkCardGrid) to avoid redundant network requests.
 *
 * Mirrors the GemeenteCard pattern exactly, minus the gemeente_code subtitle.
 */
export function WijkCard({ wijk, svgData, unreadCount, onClick }: WijkCardProps) {
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
            <AreaGridIcon />
          </div>
        )}
      </div>

      {/* Text area — no gemeente_code subtitle (wijk cards don't have a meaningful code to display) */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h4
            className="truncate text-base font-semibold text-grey-100"
            title={wijk.wijk_naam ?? wijk.name}
          >
            {wijk.wijk_naam ?? wijk.name}
          </h4>
          {/* Unread badge — text-white on bg-error is the established pattern */}
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-medium text-white shrink-0">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Grid/area placeholder icon shown when wijk boundary shape is not available */
function AreaGridIcon() {
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
      {/* Grid representing an area/neighbourhood */}
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}
