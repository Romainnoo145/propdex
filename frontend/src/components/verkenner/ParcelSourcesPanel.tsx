/**
 * ParcelSourcesPanel — right-hand "Bronnen voor dit perceel" panel in Verkenner.
 *
 * Lists the documents that exist for the selected parcel, grouped by dossier
 * slot (bestemmingsplan, bodem, vergunningen, WOZ, …). These are the sources
 * the Verkenner chat reasons over — picking a parcel first, then asking
 * anything, with the relevant docs visible alongside the conversation.
 *
 * Pure presentation: data comes from useParcelDocuments(parcelCacheId).
 * Design tokens per DESIGN.md (glass surface, Morning Mist canvas, amber accent).
 */

import { FileText, FolderOpen, Loader2 } from 'lucide-react'
import { useParcelDocuments } from '@/hooks/useDocuments'
import { DOC_TYPE_TO_SLOT } from '@/lib/documents/typeRegistry'
import { GHOST_ICONS } from '@/lib/cockpit/dossier-pages'
import type { ParcelDocumentMeta } from '@/lib/types/document'

/** Friendly Dutch labels per dossier slot. */
const SLOT_LABEL: Record<string, string> = {
  bestemmingscheck: 'Bestemmingscheck',
  perceeldata: 'Perceeldata',
  vergunninghistorie: 'Vergunningen',
  woz: 'WOZ-waarde',
  quickscan: 'Risicoscan',
  bodem: 'Bodem',
  fundering: 'Fundering',
  asbest: 'Asbest',
  bouwkundig: 'Bouwkundig',
  energielabel: 'Energielabel',
  bestemmingsplan: 'Bestemmingsplan',
  milieuzones: 'Milieuzones',
  geluid: 'Geluid',
  stikstof: 'Stikstof',
  kadaster: 'Kadaster',
  eigendom: 'Eigendom',
  erfpacht: 'Erfpacht',
  documenten: 'Documenten',
  correspondentie: 'Correspondentie',
  ideeen: 'Ideeën',
}

interface SourceGroup {
  slot: string
  label: string
  docs: ParcelDocumentMeta[]
}

function groupBySlot(docs: ParcelDocumentMeta[]): SourceGroup[] {
  const bySlot = new Map<string, ParcelDocumentMeta[]>()
  for (const doc of docs) {
    const slot = DOC_TYPE_TO_SLOT[doc.document_type] ?? 'documenten'
    const arr = bySlot.get(slot) ?? []
    arr.push(doc)
    bySlot.set(slot, arr)
  }
  return [...bySlot.entries()]
    .map(([slot, slotDocs]) => ({
      slot,
      label: SLOT_LABEL[slot] ?? slot,
      docs: slotDocs,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'nl'))
}

function SourceCard({ group }: { group: SourceGroup }) {
  const Icon = GHOST_ICONS[group.slot] ?? FileText
  const summary = group.docs.find((d) => d.ai_summary)?.ai_summary ?? null

  return (
    <div className="rounded-[16px] border border-slate-200/80 bg-white/70 p-3.5 shadow-[0_1px_2px_rgba(14,17,17,0.03),0_4px_12px_rgba(14,17,17,0.03)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-aura-amber/12 text-aura-amber-hover">
          <Icon size={16} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-aura-ink">{group.label}</p>
          <p className="text-[11px] text-slate-400">
            {group.docs.length} {group.docs.length === 1 ? 'bron' : 'bronnen'}
          </p>
        </div>
      </div>
      {summary && (
        <p className="mt-2.5 line-clamp-3 border-t border-slate-100 pt-2.5 text-[12px] leading-snug text-slate-500">
          {summary}
        </p>
      )}
    </div>
  )
}

export function ParcelSourcesPanel({ parcelId }: { parcelId: string | null }) {
  const { data, isLoading } = useParcelDocuments(parcelId ?? undefined)
  const groups = data ? groupBySlot(data.documents) : []
  const total = data?.total ?? 0

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-[40px] border border-white/60 bg-white/60 backdrop-blur-[24px]">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200/70 px-5 pb-4 pt-6">
        <h3 className="text-[14px] font-bold text-aura-ink">Bronnen voor dit perceel</h3>
        <p className="mt-0.5 text-[12px] text-slate-400">
          {total > 0
            ? `${total} ${total === 1 ? 'document' : 'documenten'} · context voor de Verkenner`
            : 'Documenten die bij dit perceel horen'}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {!parcelId && (
          <Empty
            icon={<FolderOpen size={22} className="text-slate-300" />}
            title="Geen perceelkoppeling"
            sub="Dit adres is nog niet als perceel opgeslagen."
          />
        )}
        {parcelId && isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        )}
        {parcelId && !isLoading && groups.length === 0 && (
          <Empty
            icon={<FolderOpen size={22} className="text-slate-300" />}
            title="Nog geen documenten"
            sub="Vraag de Verkenner — die haalt de publieke bronnen erbij."
          />
        )}
        {groups.map((group) => (
          <SourceCard key={group.slot} group={group} />
        ))}
      </div>
    </div>
  )
}

function Empty({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode
  title: string
  sub: string
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
        {icon}
      </div>
      <p className="text-[13px] font-semibold text-aura-ink">{title}</p>
      <p className="mt-1 max-w-[220px] text-[12px] leading-snug text-slate-400">{sub}</p>
    </div>
  )
}
