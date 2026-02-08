import type { RecentItem } from '@/hooks/useRecentViewed'

interface RecentViewedProps {
  items: RecentItem[]
  onItemClick: (item: RecentItem) => void
}

/**
 * List of recently viewed properties.
 *
 * Design: Compact list with clock icon, property name, and postcode.
 * Only renders if items exist.
 */
export default function RecentViewed({ items, onItemClick }: RecentViewedProps) {
  // Don't render section if no items
  if (items.length === 0) {
    return null
  }

  return (
    <div className="mb-4">
      {/* Section header */}
      <h3 className="mb-2 flex items-center gap-2 px-4 text-xs uppercase tracking-wide text-white/40">
        <ClockIcon />
        Recent bekeken
      </h3>

      {/* Items list */}
      <div className="space-y-1 px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5"
          >
            <ClockIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/30" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white/70">{item.report_name}</p>
              <p className="text-xs text-white/40">
                {item.postcode}, {item.woonplaats}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Clock icon
function ClockIcon({ className = 'h-3 w-3' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
