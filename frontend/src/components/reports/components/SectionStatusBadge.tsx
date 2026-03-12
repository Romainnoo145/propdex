/**
 * SectionStatusBadge — data completeness badge for Due Diligence Dashboard sections
 *
 * Exports both a full badge (for section headers) and a dot variant (for nav items).
 */

export type SectionStatus = 'complete' | 'partial' | 'empty'

const BADGE_STYLES: Record<SectionStatus, string> = {
  complete: 'bg-green-500/10 text-green-600 border-green-500/20',
  partial: 'bg-amber-400/10 text-amber-600 border-amber-400/20',
  empty: 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

const BADGE_LABELS: Record<SectionStatus, string> = {
  complete: 'Compleet',
  partial: 'Gedeeltelijk',
  empty: 'Leeg',
}

const DOT_STYLES: Record<SectionStatus, string> = {
  complete: 'bg-green-500',
  partial: 'bg-amber-400',
  empty: 'bg-neutral-300',
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
