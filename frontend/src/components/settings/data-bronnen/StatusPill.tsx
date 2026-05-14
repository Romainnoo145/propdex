/**
 * StatusPill — M049/S03
 *
 * Renders a data-source status as an Aura-conform pill in one of 4 colours:
 *   live          → Vitality Green
 *   broken        → red (+ tooltip with error_message)
 *   missing       → Warm Amber
 *   not_applicable→ neutral slate
 *
 * Tokens locked in 03-CONTEXT.md §3 — do not swap for Tailwind defaults.
 *
 * Tooltip: uses project CSS group/group-hover pattern (no Radix/shadcn —
 * @/components/ui/tooltip does not exist in this project per TeamAttributionBadge.tsx).
 */
import { Tooltip } from '@/components/ui/Tooltip'
import type { SourceStatus } from '@/lib/types/data-sources-admin'

interface Props {
  status: SourceStatus
  errorMessage?: string | null
}

const LABELS: Record<SourceStatus, string> = {
  live: 'Live',
  broken: 'Foutmelding',
  missing: 'Ontbreekt',
  not_applicable: 'N.v.t.',
}

const CLASSES: Record<SourceStatus, string> = {
  live: 'bg-[#22C55E]/15 text-[#22C55E]',
  broken: 'bg-red-100 text-red-700',
  missing: 'bg-[#F9A826]/15 text-[#F9A826]',
  not_applicable: 'bg-slate-100 text-slate-500',
}

export function StatusPill({ status, errorMessage }: Props) {
  const pill = (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${CLASSES[status]}`}
      data-status={status}
    >
      {LABELS[status]}
    </span>
  )

  if (status === 'broken' && errorMessage) {
    return (
      <Tooltip content={errorMessage} side="top">
        {pill}
      </Tooltip>
    )
  }

  return pill
}
