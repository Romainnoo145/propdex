import type { ProjectResponse } from '@/lib/types/project'

interface WijkCardProps {
  /** Wijk-level monitored project */
  wijk: ProjectResponse
  /** Pre-computed SVG path data — supports dual-path (with background + siblings) or single-path */
  svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null
  /** Unread change count for this wijk project */
  unreadCount: number
  /** Card click handler — parent decides navigation behavior */
  onClick?: () => void
  /** Optional active state (e.g. selected in a master-detail list) */
  isActive?: boolean
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
export function WijkCard({
  wijk,
  svgData,
  unreadCount,
  onClick,
  isActive = false,
}: WijkCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group overflow-hidden rounded-xl border bg-grey-900 transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isActive
          ? 'border-amber-accent/35 bg-overlay/[0.05] shadow-[0_0_0_1px_rgba(217,170,56,0.14)]'
          : 'border-overlay/[0.08] hover:border-amber-accent/35 hover:bg-overlay/[0.04] hover:shadow-[0_0_0_1px_rgba(217,170,56,0.12)]'
      }`}
    >
      {/* SVG silhouette area */}
      <div className="relative aspect-[16/8] border-b border-overlay/[0.08] bg-grey-850/65">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,170,56,0.11),transparent_45%),radial-gradient(circle_at_20%_82%,rgba(255,255,255,0.06),transparent_45%)]" />
        {svgData ? (
          <svg
            viewBox={svgData.viewBox}
            className="relative h-full w-full overflow-hidden"
            preserveAspectRatio="xMidYMid meet"
          >
            {svgData.backgroundD && (
              <path
                d={svgData.backgroundD}
                className="fill-grey-700/18 stroke-overlay/[0.2]"
                strokeWidth="0.5"
              />
            )}
            {svgData.siblingsD && (
              <path
                d={svgData.siblingsD}
                className="fill-transparent stroke-grey-600/25"
                strokeWidth="0.3"
              />
            )}
            <path
              d={svgData.primaryD}
              className="fill-amber-accent/24 stroke-amber-accent transition-all duration-200 group-hover:fill-amber-accent/30 group-hover:stroke-amber-accent"
              strokeWidth="1"
            />
          </svg>
        ) : (
          /* Placeholder when GeoJSON hasn't loaded yet or feature not found */
          <div className="relative flex h-full w-full items-center justify-center">
            <AreaGridIcon />
          </div>
        )}
      </div>

      {/* Text area — no gemeente_code subtitle (wijk cards don't have a meaningful code to display) */}
      <div className="px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h4
            className="truncate text-sm font-semibold text-grey-100"
            title={wijk.wijk_naam ?? wijk.name}
          >
            {wijk.wijk_naam ?? wijk.name}
          </h4>
          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-accent px-1 text-xs font-semibold text-on-accent shrink-0">
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
