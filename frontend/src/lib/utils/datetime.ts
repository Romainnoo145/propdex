/**
 * Relative Dutch datetime formatting ("2 uur geleden", "gisteren", etc).
 *
 * Extracted from S03 duplicates in BronnenLayer.tsx and
 * BeleidsdocumentenSection.tsx when S04 added a 3rd consumer
 * (TeamAttributionBadge.tsx).
 */

/**
 * Parse a backend timestamp as UTC.
 *
 * The backend stores naive UTC (`datetime.utcnow()`) and serializes it WITHOUT a
 * timezone suffix (e.g. "2026-06-22T22:00:00"). JS `new Date()` parses a tz-less
 * string as **browser-local** time — in NL (+02:00 CEST) that reads ~2h off. We
 * append "Z" when no tz designator is present so the instant is interpreted as UTC.
 * Strings that already carry a tz (`Z` or `±HH:MM`) are left untouched.
 */
export function parseUtc(iso: string): Date {
  const hasTz = /([zZ])|([+-]\d{2}:?\d{2})$/.test(iso.trim())
  return new Date(hasTz ? iso : `${iso}Z`)
}

export function formatRelativeNL(iso: string): string {
  const date = parseUtc(iso)
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)

  const rtf = new Intl.RelativeTimeFormat('nl', { numeric: 'auto' })
  if (diffMonth >= 1) return rtf.format(-diffMonth, 'month')
  if (diffWeek >= 1) return rtf.format(-diffWeek, 'week')
  if (diffDay >= 1) return rtf.format(-diffDay, 'day')
  if (diffHour >= 1) return rtf.format(-diffHour, 'hour')
  if (diffMin >= 1) return rtf.format(-diffMin, 'minute')
  return 'zojuist'
}
