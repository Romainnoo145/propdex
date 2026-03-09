import type { ProjectResponse } from '@/lib/types/project'
import { MetricChip } from '@/components/primitives'

interface WijkCardProps {
  /** Wijk-level monitored project */
  wijk: ProjectResponse
  /** Pre-computed SVG path data — supports dual-path (with background + siblings) or single-path */
  svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null
  /** Unread change count for this wijk project */
  unreadCount: number
  /** True when this wijk has at least one completed scan */
  hasCompletedScan?: boolean
  /** Total reports linked to this wijk */
  reportCount?: number
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
  hasCompletedScan = false,
  reportCount = 0,
  onClick,
  isActive = false,
}: WijkCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group overflow-hidden rounded-xl border bg-aura-glass-white/60 transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isActive
          ? 'border-aura-amber/35 bg-neutral-50 shadow-[0_0_0_1px_rgba(217,170,56,0.14)]'
          : 'border-neutral-200 hover:border-aura-amber/35 hover:bg-neutral-50 hover:shadow-[0_0_0_1px_rgba(217,170,56,0.12)]'
      }`}
    >
      {/* SVG silhouette area */}
      <div className="relative aspect-[16/8] border-b border-neutral-200 bg-aura-glass-white/40/65">
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
                className="fill-neutral-400/18 stroke-neutral-400/20"
                strokeWidth="0.5"
              />
            )}
            {svgData.siblingsD && (
              <path
                d={svgData.siblingsD}
                className="fill-transparent stroke-neutral-500/25"
                strokeWidth="0.3"
              />
            )}
            <path
              d={svgData.primaryD}
              className="fill-aura-amber/24 stroke-aura-amber transition-all duration-200 group-hover:fill-aura-amber/30 group-hover:stroke-aura-amber"
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
        <div className="flex items-center gap-2">
          <h4
            className="min-w-0 flex-1 truncate text-sm font-semibold text-aura-ink"
            title={wijk.wijk_naam ?? wijk.name}
          >
            {wijk.wijk_naam ?? wijk.name}
          </h4>
          <div className="flex shrink-0 items-center gap-1.5">
            <MetricChip
              value={hasCompletedScan ? 1 : 0}
              ariaLabel="Gescand"
              icon={<ScanStatusIcon />}
              tone="amber"
              compact
            />
            <MetricChip
              value={reportCount}
              ariaLabel="Rapporten"
              icon={<ReportIcon />}
              tone="amber"
              compact
            />
            {/* Unread badge */}
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-aura-amber px-1 text-xs font-semibold text-aura-obsidian shrink-0">
                {unreadCount}
              </span>
            )}
          </div>
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
      className="text-neutral-400"
    >
      {/* Grid representing an area/neighbourhood */}
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function ScanStatusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function ReportIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
