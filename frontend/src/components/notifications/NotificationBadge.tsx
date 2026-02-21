/**
 * Simple notification badge component
 *
 * Shows count in a red circle positioned absolutely.
 * Caller must provide relative positioning context.
 *
 * Behavior:
 * - count=0: Nothing rendered
 * - count 1-99: Shows number
 * - count > 99: Shows "99+"
 */

interface NotificationBadgeProps {
  count: number
}

export function NotificationBadge({ count }: NotificationBadgeProps) {
  if (count === 0) return null

  const displayText = count > 99 ? '99+' : count.toString()

  return (
    <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-medium text-white">
      {displayText}
    </span>
  )
}
