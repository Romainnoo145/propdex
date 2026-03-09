import { MetricChip } from '@/components/primitives'

interface GemeenteCardProps {
  /** Display name of the municipality */
  gemeenteName: string
  /** CBS municipality code */
  gemeenteCode: string | null
  /** Pre-computed SVG path data — supports dual-path (with background + siblings) or single-path */
  svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null
  /** Unread notification count for this municipality scope */
  totalUnread: number
  /** Optional municipality-level counters shown inside the card */
  stats?: {
    linkedWijken: number
    completedWijken: number
    rapporten: number
    meldingen: number
  }
  /** Favorite state for quick access */
  isFavorite?: boolean
  /** Toggle favorite status */
  onToggleFavorite?: () => void
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
export function GemeenteCard({
  gemeenteName,
  gemeenteCode,
  svgData,
  totalUnread,
  stats,
  isFavorite = false,
  onToggleFavorite,
  onClick,
}: GemeenteCardProps) {
  return (
    <div
      onClick={onClick}
      className="group overflow-hidden rounded-xl border border-neutral-200 bg-aura-glass-white/60 cursor-pointer transition-all hover:border-aura-amber/35 hover:bg-neutral-50 hover:shadow-[0_0_0_1px_rgba(217,170,56,0.12)]"
    >
      {/* SVG silhouette area */}
      <div className="relative aspect-[4/3] border-b border-neutral-200 bg-aura-glass-white/40/65">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(217,170,56,0.11),transparent_45%),radial-gradient(circle_at_20%_82%,rgba(255,255,255,0.06),transparent_45%)]" />
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-aura-glass-white/60/90 text-aura-amber/80 transition-colors hover:text-aura-amber"
            aria-label={isFavorite ? 'Verwijder favoriet' : 'Markeer als favoriet'}
            title={isFavorite ? 'Verwijder favoriet' : 'Markeer als favoriet'}
          >
            <HeartIcon filled={isFavorite} />
          </button>
        )}
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
          <div className="flex h-full w-full items-center justify-center">
            <MapPinIcon />
          </div>
        )}
      </div>

      {/* Text area */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h4
            className="truncate text-base font-semibold text-aura-ink"
            title={gemeenteName}
          >
            {gemeenteName}
          </h4>
          {/* Unread badge — text-white on bg-error is the established pattern (see ProjectList.tsx:177) */}
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-aura-amber px-1 text-xs font-semibold text-aura-obsidian shrink-0">
              {totalUnread}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="shrink-0 text-xs text-neutral-600">{gemeenteCode}</p>
          {stats && (
            <div className="flex items-center gap-1.5">
              <MetricChip
                value={stats.linkedWijken}
                tone="amber"
                ariaLabel="Gekoppelde wijken"
                icon={<WijkIcon />}
              />
              <MetricChip
                value={stats.rapporten}
                tone="info"
                ariaLabel="Rapporten"
                icon={<ReportIcon />}
              />
              <MetricChip
                value={stats.meldingen}
                tone="error"
                ariaLabel="Nieuwe meldingen"
                icon={<BellIcon />}
              />
            </div>
          )}
        </div>
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
      className="text-neutral-400"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={filled ? 'text-aura-amber' : ''}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function WijkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <rect x="5" y="10" width="5" height="11" rx="1" />
      <rect x="14" y="6" width="5" height="15" rx="1" />
      <path d="M7.5 6 17 3" />
    </svg>
  )
}

function ReportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
