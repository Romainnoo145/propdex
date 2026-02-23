/**
 * Date formatting utilities (Dutch locale)
 *
 * Used by meldingen.tsx and ChangeTimeline.tsx for display.
 */

/** Format YYYY-MM-DD to human-readable Dutch date */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Vandaag'
  if (date.toDateString() === yesterday.toDateString()) return 'Gisteren'

  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/** Format relative time (e.g., "2 uur geleden", "3 dagen geleden") */
export function formatRelativeTime(isoDateStr: string): string {
  const date = new Date(isoDateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Net gedetecteerd'
  if (diffMinutes < 60)
    return `${diffMinutes} ${diffMinutes === 1 ? 'minuut' : 'minuten'} geleden`
  if (diffHours < 24)
    return `${diffHours} ${diffHours === 1 ? 'uur' : 'uur'} geleden`
  if (diffDays < 7)
    return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagen'} geleden`

  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}
