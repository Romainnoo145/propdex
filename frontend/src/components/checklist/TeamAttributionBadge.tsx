/**
 * Shows team attribution for a single checklist item.
 *
 * Renders (a) a small pill with first-name + count when other org
 * members have checked this item, and/or (b) a FileText icon when
 * other org members have linked documents to it. Self-entries
 * (same user_id as current user) are filtered out — Bob doesn't
 * need a badge showing his own vinkje.
 *
 * When currentUserId is undefined (auth still loading), fail-open:
 * render all entries as foreign. Corrects once auth lands.
 *
 * Returns null when there is no foreign attribution — zero DOM.
 *
 * Tooltip pattern: CSS group/group-hover (project convention),
 * NOT shadcn — @/components/ui/tooltip does not exist in this project.
 */

import { Check, FileText } from 'lucide-react'
import { formatRelativeNL } from '@/lib/utils/datetime'
import type { ChecklistItemLinks } from '@/lib/types/checklist'

interface Props {
  itemLinks: ChecklistItemLinks | undefined
  currentUserId: string | undefined
}

export function TeamAttributionBadge({ itemLinks, currentUserId }: Props) {
  if (!itemLinks) return null

  const foreignChecks = itemLinks.checked_by.filter(
    (c) => !currentUserId || c.user_id !== currentUserId
  )
  const foreignDocs = itemLinks.linked_documents.filter(
    (d) => !currentUserId || d.user_id !== currentUserId
  )
  if (foreignChecks.length === 0 && foreignDocs.length === 0) return null

  const firstCheck = foreignChecks[0]
  const extraChecks = foreignChecks.length - 1
  const firstName = firstCheck ? firstCheck.user_name.split(' ')[0] : null

  return (
    <div className="flex items-center gap-1.5 ml-2">
      {foreignChecks.length > 0 && firstCheck && (
        <div className="group relative inline-flex">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 cursor-default">
            <Check className="h-3 w-3" />
            {firstName}
            {extraChecks > 0 ? ` +${extraChecks}` : ''}
          </span>
          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-50">
            <div className="bg-aura-canvas border border-neutral-200 rounded-lg px-2.5 py-2 shadow-xl min-w-[160px]">
              <div className="flex flex-col gap-0.5">
                {foreignChecks.map((c) => (
                  <div key={c.user_id} className="text-xs text-aura-ink whitespace-nowrap">
                    <span className="font-medium">{c.user_name}</span>
                    <span className="text-neutral-400">
                      {' • '}{formatRelativeNL(c.updated_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {foreignDocs.length > 0 && (
        <div className="group relative inline-flex">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-500 cursor-default">
            <FileText className="h-3 w-3" />
          </span>
          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-50">
            <div className="bg-aura-canvas border border-neutral-200 rounded-lg px-2.5 py-2 shadow-xl min-w-[160px]">
              <div className="flex flex-col gap-0.5">
                {foreignDocs.map((d) => (
                  <div key={d.document_id} className="text-xs text-aura-ink whitespace-nowrap">
                    Document van{' '}
                    <span className="font-medium">{d.user_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
