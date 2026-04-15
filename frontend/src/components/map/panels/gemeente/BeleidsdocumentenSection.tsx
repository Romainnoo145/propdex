/**
 * BeleidsdocumentenSection — M045/S03 T06
 *
 * Renders the cascade policy documents for a gemeente inside the Beleid & Nieuws
 * tab of GemeenteContextPanel. Compact one-line rows grouped by cascade level
 * (LANDELIJK / PROVINCIE / GEMEENTE). Clicking a row expands it to show the full
 * AiSummaryCard (prose + key_facts + extracted_values). Multiple rows can be
 * expanded simultaneously — no mutual exclusivity.
 *
 * Data flow:
 *   useGemeenteCascadeDocuments(gemeenteCode) → CascadePolicyBundleResponse
 *   → render grouped by level → click to expand
 *   → parseAiSummary(doc.ai_summary) → DocumentSummary | null
 *   → render AiSummaryCard OR skeleton ("Samenvatting wordt gegenereerd…")
 */
import { useState } from 'react'
import {
  useGemeenteCascadeDocuments,
  type CascadePolicyDocRead,
  type CascadePolicyBundleResponse,
} from '@/hooks/useGemeenteCascadeDocuments'
import { parseAiSummary } from '@/hooks/usePolicyDocuments'
import { AiSummaryCard } from '@/components/configuratie/AiSummaryCard'
import { formatRelativeNL } from '@/lib/utils/datetime'

interface Props {
  gemeenteCode: string
  gemeenteNaam: string
}

const LEVEL_ORDER: Array<keyof CascadePolicyBundleResponse> = [
  'landelijk',
  'provincie',
  'gemeente',
]

const LEVEL_LABELS: Record<string, string> = {
  landelijk: 'LANDELIJK',
  provincie: 'PROVINCIE',
  gemeente: 'GEMEENTE',
}

function capitalizeSourceKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export function BeleidsdocumentenSection({ gemeenteCode, gemeenteNaam }: Props) {
  const { data, isLoading, isError, refetch } = useGemeenteCascadeDocuments(gemeenteCode)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (!data) return null

  const totalCount = data.landelijk.length + data.provincie.length + data.gemeente.length
  if (totalCount === 0) return <EmptyState gemeenteNaam={gemeenteNaam} />

  return (
    <section className="bg-white rounded-[20px] p-6 shadow-sm">
      <div className="text-[10px] font-extrabold tracking-[0.15em] text-slate-500 mb-1">
        BELEIDSDOCUMENTEN
      </div>
      <div className="text-[20px] font-extrabold text-slate-900 tracking-tight mb-1">
        {totalCount} documenten van toepassing
      </div>
      <div className="text-[12px] text-slate-500 mb-5">
        Cascade · laatste versies · klik om samenvatting te tonen
      </div>

      {LEVEL_ORDER.map((level) => {
        const docs = data[level]
        if (docs.length === 0) return null
        return (
          <div key={level} className="mb-5">
            <div className="text-[10px] font-extrabold tracking-[0.15em] text-slate-500 mb-2.5">
              {LEVEL_LABELS[level]} · {docs.length} {docs.length === 1 ? 'DOCUMENT' : 'DOCUMENTEN'}
            </div>
            <div className="space-y-2.5">
              {docs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  isExpanded={expandedIds.has(doc.id)}
                  onToggle={() => toggleExpand(doc.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

interface DocumentRowProps {
  doc: CascadePolicyDocRead
  isExpanded: boolean
  onToggle: () => void
}

function DocumentRow({ doc, isExpanded, onToggle }: DocumentRowProps) {
  if (!isExpanded) {
    return <CompactRow doc={doc} onClick={onToggle} />
  }
  return <ExpandedRow doc={doc} onCollapse={onToggle} />
}

function CompactRow({ doc, onClick }: { doc: CascadePolicyDocRead; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 px-3.5 rounded-[8px] border-l-2 border-[#F9A826] bg-[#FAFBFA] text-left hover:bg-[#F2F6F3] transition-colors"
    >
      <div>
        <div className="font-bold text-[13px] text-slate-900">
          {capitalizeSourceKey(doc.source_key)}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          v{doc.version_number} · {formatRelativeNL(doc.uploaded_at)}
        </div>
      </div>
      <div className="text-slate-400 text-base">›</div>
    </button>
  )
}

function ExpandedRow({
  doc,
  onCollapse,
}: {
  doc: CascadePolicyDocRead
  onCollapse: () => void
}) {
  const parsed = parseAiSummary(doc.ai_summary)

  if (!parsed) {
    return (
      <button
        type="button"
        onClick={onCollapse}
        className="w-full text-left py-3 px-3.5 rounded-[8px] border-l-2 border-[#F9A826] bg-[#FAFBFA]"
      >
        <div className="font-bold text-[13px] text-slate-900 mb-1">
          {capitalizeSourceKey(doc.source_key)}
        </div>
        <div className="text-[11px] text-slate-400 italic">
          Samenvatting wordt gegenereerd…
        </div>
      </button>
    )
  }

  return (
    <div onClick={onCollapse} className="cursor-pointer">
      <AiSummaryCard summary={parsed} documentName={capitalizeSourceKey(doc.source_key)} />
    </div>
  )
}

function LoadingState() {
  return (
    <section className="bg-white rounded-[20px] p-6 shadow-sm">
      <div className="text-[10px] font-extrabold tracking-[0.15em] text-slate-500 mb-2">
        BELEIDSDOCUMENTEN
      </div>
      <div className="text-[13px] text-slate-400">Laden…</div>
    </section>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="bg-white rounded-[20px] p-6 shadow-sm">
      <div className="text-[10px] font-extrabold tracking-[0.15em] text-slate-500 mb-2">
        BELEIDSDOCUMENTEN
      </div>
      <div className="text-[13px] text-red-600 mb-2">
        Kon beleidsdocumenten niet laden.
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="text-[12px] font-bold text-[#F9A826] hover:underline"
      >
        Opnieuw proberen
      </button>
    </section>
  )
}

function EmptyState({ gemeenteNaam }: { gemeenteNaam: string }) {
  return (
    <section className="bg-white rounded-[20px] p-6 shadow-sm">
      <div className="text-[10px] font-extrabold tracking-[0.15em] text-slate-500 mb-2">
        BELEIDSDOCUMENTEN
      </div>
      <div className="text-[13px] text-slate-500">
        Nog geen beleidsdocumenten voor {gemeenteNaam}. Er draait wekelijks automatische ingest.
      </div>
    </section>
  )
}
