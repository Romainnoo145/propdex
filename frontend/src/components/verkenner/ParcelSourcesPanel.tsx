/**
 * ParcelSourcesPanel — right-hand "Bronnen voor dit perceel" panel in Verkenner.
 *
 * Lists the documents that exist for the selected parcel, grouped by dossier
 * slot (bestemmingsplan, bodem, vergunningen, WOZ, …). These are the sources
 * the Verkenner chat reasons over. Each source group is clickable: it opens the
 * first underlying document (blob fetch with auth, same as BronnenLayer).
 *
 * When the selected address is NOT a saved parcel (parcelId === null), the panel
 * shows a single primary action — "Maak rapport" — instead of an empty state,
 * so the user can turn the address into a real parcel/report.
 *
 * Design tokens per DESIGN.md (glass surface, Morning Mist canvas, amber accent).
 */

import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FileText, FolderOpen, Loader2, FilePlus2, ScrollText, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useParcelDocuments } from '@/hooks/useDocuments'
import { usePolicySummaries } from '@/hooks/usePolicySummaries'
import { useAuth } from '@/lib/auth/useAuth'
import { getDocumentDownloadUrl } from '@/lib/api'
import { DOC_TYPE_TO_SLOT } from '@/lib/documents/typeRegistry'
import { GHOST_ICONS } from '@/lib/cockpit/dossier-pages'
import type { ParcelDocumentMeta } from '@/lib/types/document'

/** Gemeente-level beleidsbronnen (policy docs) shown above the parcel documents. */
const BELEID_LABEL: Record<string, string> = {
  omgevingsvisie: 'Omgevingsvisie',
  woonvisie: 'Woonvisie',
  parkeerbeleid: 'Parkeerbeleid',
  huisvestingsverordening: 'Huisvestingsverordening',
  welstandsnota: 'Welstandsnota',
  duurzaamheidsbeleid: 'Duurzaamheidsbeleid',
  erfgoedverordening: 'Erfgoedverordening',
}
const BELEID_ORDER = Object.keys(BELEID_LABEL)

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

function SourceCard({
  group,
  onOpen,
}: {
  group: SourceGroup
  onOpen: (doc: ParcelDocumentMeta) => void
}) {
  const Icon = GHOST_ICONS[group.slot] ?? FileText
  const summary = group.docs.find((d) => d.ai_summary)?.ai_summary ?? null

  return (
    <button
      type="button"
      onClick={() => onOpen(group.docs[0]!)}
      className="group w-full rounded-[16px] border border-slate-200/80 bg-white/70 p-3.5 text-left shadow-[0_1px_2px_rgba(14,17,17,0.03),0_4px_12px_rgba(14,17,17,0.03)] transition-colors hover:border-aura-amber/40 hover:bg-white"
    >
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
    </button>
  )
}

export function ParcelSourcesPanel({
  parcelId,
  gemeenteCode,
  onCreateReport,
  creatingReport = false,
}: {
  parcelId: string | null
  /** CBS gemeente code (e.g. "GM0983") for gemeente-level beleidsbronnen. */
  gemeenteCode?: string | null
  /** Provided only for non-saved parcels — turns the empty state into an action. */
  onCreateReport?: () => void
  creatingReport?: boolean
}) {
  const { accessToken } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading } = useParcelDocuments(parcelId ?? undefined)
  const groups = data ? groupBySlot(data.documents) : []
  const docTotal = data?.total ?? 0

  // Gemeente-level beleid (omgevingsvisie, woonvisie, …) that also applies to
  // this parcel — the same context surfaced in the parcel detail card.
  const gmCode = gemeenteCode
    ? gemeenteCode.startsWith('GM')
      ? gemeenteCode
      : `GM${gemeenteCode}`
    : undefined
  const { data: policy } = usePolicySummaries(gmCode)
  const beleid = policy?.summaries
    ? BELEID_ORDER.filter((k) => policy.summaries[k]?.length).map((k) => ({
        key: k,
        label: BELEID_LABEL[k]!,
        snippet: policy.summaries[k]![0]?.samenvatting ?? null,
      }))
    : []
  const total = docTotal + beleid.length

  // Open a document by fetching its blob with auth (mirrors BronnenLayer).
  const openDoc = useCallback(
    async (doc: ParcelDocumentMeta) => {
      if (!parcelId) return
      try {
        const headers: HeadersInit = {}
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
        const response = await fetch(getDocumentDownloadUrl(parcelId, doc.id), {
          method: 'GET',
          headers,
          credentials: 'include',
        })
        if (!response.ok) {
          toast.error('Document kon niet worden geopend.')
          return
        }
        const blobUrl = URL.createObjectURL(await response.blob())
        window.open(blobUrl, '_blank', 'noopener,noreferrer')
        // Revoke after the new tab has had time to load.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      } catch {
        toast.error('Document openen mislukt.')
      }
    },
    [parcelId, accessToken],
  )

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-[40px] border border-white/60 bg-white/60 backdrop-blur-[24px]">
      {/* Header — h-[72px] matches the chat-shell header so the two divider lines align */}
      <div className="flex h-[72px] shrink-0 flex-col justify-center border-b border-slate-200/70 px-5">
        <h3 className="text-[14px] font-bold text-aura-ink">Bronnen voor dit perceel</h3>
        <p className="mt-0.5 text-[12px] text-slate-400">
          {total > 0
            ? `${total} ${total === 1 ? 'bron' : 'bronnen'} · context voor de Verkenner`
            : 'Documenten die bij dit perceel horen'}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {/* Non-saved parcel → primary action instead of an empty message. */}
        {!parcelId && onCreateReport && (
          <CreateReportPrompt onCreateReport={onCreateReport} loading={creatingReport} />
        )}

        {/* Gemeente beleid — applies to this parcel via its gemeente. */}
        {beleid.length > 0 && (
          <>
            <p className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              Beleid · gemeente
            </p>
            {beleid.map((b) => (
              <BeleidCard
                key={b.key}
                label={b.label}
                snippet={b.snippet}
                onOpen={() =>
                  navigate({
                    to: '/beleid',
                    search: {
                      gemeente: gmCode,
                      provincie: undefined,
                      source: undefined,
                      category: undefined,
                      niveau: undefined,
                    },
                  })
                }
              />
            ))}
          </>
        )}

        {parcelId && isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        )}
        {parcelId && !isLoading && groups.length === 0 && beleid.length === 0 && (
          <Empty
            icon={<FolderOpen size={22} className="text-slate-300" />}
            title="Nog geen documenten"
            sub="Vraag de Verkenner — die haalt de publieke bronnen erbij."
          />
        )}
        {groups.length > 0 && (
          <>
            {beleid.length > 0 && (
              <p className="px-1 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Perceeldocumenten
              </p>
            )}
            {groups.map((group) => (
              <SourceCard key={group.slot} group={group} onOpen={openDoc} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function BeleidCard({
  label,
  snippet,
  onOpen,
}: {
  label: string
  snippet: string | null
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-[16px] border border-violet-200/70 bg-violet-50/40 p-3.5 text-left transition-colors hover:border-violet-300 hover:bg-violet-50"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-violet-100 text-violet-500">
          <ScrollText size={16} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-aura-ink">{label}</p>
          <p className="text-[11px] text-slate-400">Gemeentelijk beleid</p>
        </div>
        <ChevronRight size={15} className="shrink-0 text-slate-300 group-hover:text-violet-400" />
      </div>
      {snippet && (
        <p className="mt-2.5 line-clamp-3 border-t border-violet-100 pt-2.5 text-[12px] leading-snug text-slate-500">
          {snippet}
        </p>
      )}
    </button>
  )
}

function CreateReportPrompt({
  onCreateReport,
  loading,
}: {
  onCreateReport: () => void
  loading: boolean
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-5 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-aura-amber/12">
        <FilePlus2 size={22} className="text-aura-amber-hover" strokeWidth={1.8} />
      </div>
      <p className="text-[14px] font-bold text-aura-ink">Nog geen dossier</p>
      <p className="mt-1 max-w-[230px] text-[12px] leading-snug text-slate-400">
        Dit adres staat nog niet in je portfolio. Maak een rapport om de bronnen
        op te halen.
      </p>
      <button
        type="button"
        onClick={onCreateReport}
        disabled={loading}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-aura-obsidian px-5 py-2.5 text-[13px] font-semibold text-aura-amber transition-colors hover:bg-aura-obsidian/90 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <FilePlus2 size={15} strokeWidth={2} />
        )}
        {loading ? 'Bezig…' : 'Maak rapport'}
      </button>
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
