/**
 * Relative Dutch datetime formatting ("2 uur geleden", "gisteren", etc).
 *
 * Extracted from S03 duplicates in BronnenLayer.tsx and
 * BeleidsdocumentenSection.tsx when S04 added a 3rd consumer
 * (TeamAttributionBadge.tsx).
 */

export function formatRelativeNL(iso: string): string {
  const date = new Date(iso)
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
