/**
 * SectionStatusBadge — data completeness badge for Due Diligence Dashboard sections
 *
 * Exports both a full badge (for section headers) and a dot variant (for nav items).
 */

export type SectionStatus = 'complete' | 'partial' | 'empty'

const BADGE_STYLES: Record<SectionStatus, string> = {
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  partial: 'border-amber-200 bg-amber-50 text-amber-700',
  empty: 'border-red-200 bg-red-50 text-red-700',
}

const BADGE_LABELS: Record<SectionStatus, string> = {
  complete: 'Compleet',
  partial: 'Deels',
  empty: 'Leeg',
}

const DOT_STYLES: Record<SectionStatus, string> = {
  complete: 'bg-emerald-500',
  partial: 'bg-amber-400',
  empty: 'bg-red-400',
}

export function SectionStatusBadge({ status }: { status: SectionStatus }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${BADGE_STYLES[status]}`}
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {BADGE_LABELS[status]}
    </span>
  )
}

export function SectionStatusDot({ status }: { status: SectionStatus }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full flex-shrink-0 ${DOT_STYLES[status]}`}
    />
  )
}
