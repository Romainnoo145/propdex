/**
 * ParcelSourcesPanel — right-hand "Bronnen voor dit perceel" panel in Verkenner.
 *
 * Lists the documents that exist for the selected parcel, grouped by dossier
 * slot (bestemmingsplan, bodem, vergunningen, WOZ, …). These are the sources
 * the Verkenner chat reasons over. Each source group is clickable: it opens the
 * first underlying document (blob fetch with auth, same as BronnenLayer).
 *
 * When the selected address is NOT a saved parcel (parcelId === null), the panel
 * shows a primary action — "Opslaan in portfolio" — instead of an empty state,
 * so the user can turn the address into a real parcel; opening it on the map
 * stays available as a secondary action.
 *
 * Design tokens per DESIGN.md (glass surface, Morning Mist canvas, amber accent).
 */

import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  FileText,
  FolderOpen,
  Loader2,
  MapPin,
  ScrollText,
  ChevronRight,
  Compass,
  Home,
  ParkingSquare,
  KeyRound,
  Palette,
  Leaf,
  Landmark,
  Bookmark,
} from 'lucide-react'
import { toast } from 'sonner'
import { useParcelDocuments } from '@/hooks/useDocuments'
import { usePolicySummaries } from '@/hooks/usePolicySummaries'
import { usePolicyDocuments, type PolicyDocument } from '@/hooks/usePolicyDocuments'
import { useAuth } from '@/lib/auth/useAuth'
import { getDocumentDownloadUrl, fetchPolicyDocumentBlob } from '@/lib/api'
import { DOC_TYPE_TO_SLOT } from '@/lib/documents/typeRegistry'
import { GHOST_ICONS } from '@/lib/cockpit/dossier-pages'
import type { ParcelDocumentMeta } from '@/lib/types/document'

/** Lucide icons per gemeente beleidsbron — monochrome, no color chip. */
const BELEID_ICON: Record<string, typeof FileText> = {
  omgevingsvisie: Compass,
  woonvisie: Home,
  parkeerbeleid: ParkingSquare,
  huisvestingsverordening: KeyRound,
  welstandsnota: Palette,
  duurzaamheidsbeleid: Leaf,
  erfgoedverordening: Landmark,
}

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

/**
 * SourceRow — one quiet, editorial reference row (no card chrome / color chips).
 * A small monochrome icon, the label, a count, and a chevron that surfaces on
 * hover. Amber appears only as a faint hover accent.
 */
function SourceRow({
  icon: Icon,
  label,
  meta,
  onOpen,
}: {
  icon: typeof FileText
  label: string
  meta: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition-colors hover:bg-aura-amber/[0.06]"
    >
      <Icon
        size={15}
        strokeWidth={1.7}
        className="shrink-0 text-slate-400 transition-colors group-hover:text-aura-amber-hover"
      />
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-aura-ink">{label}</p>
      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{meta}</span>
      <ChevronRight
        size={14}
        className="shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  )
}

/**
 * BeleidRow — same quiet row as SourceRow, with an amber 'gemeente' pill.
 * Clicking opens the actual policy document in a new window (blob fetch with
 * auth), exactly like a perceeldocument — no inline accordion.
 */
function BeleidRow({
  icon: Icon,
  label,
  onOpen,
}: {
  icon: typeof FileText
  label: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition-colors hover:bg-aura-amber/[0.06]"
    >
      <Icon
        size={15}
        strokeWidth={1.7}
        className="shrink-0 text-slate-400 transition-colors group-hover:text-aura-amber-hover"
      />
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-aura-ink">{label}</p>
      <span className="shrink-0 rounded-full bg-aura-amber/12 px-2 py-0.5 text-[10px] font-semibold text-aura-amber-hover">
        gemeente
      </span>
      <ChevronRight
        size={14}
        className="shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  )
}

export function ParcelSourcesPanel({
  parcelId,
  gemeenteCode,
  onSaveToPortfolio,
  savingToPortfolio = false,
  onOpenMap,
  creatingReport = false,
  analyzing = false,
}: {
  parcelId: string | null
  /** CBS gemeente code (e.g. "GM0983") for gemeente-level beleidsbronnen. */
  gemeenteCode?: string | null
  /** Provided only for non-saved parcels — primary action: save to portfolio. */
  onSaveToPortfolio?: () => void
  savingToPortfolio?: boolean
  /** Secondary action for non-saved parcels — open the parcel on the map. */
  onOpenMap?: () => void
  creatingReport?: boolean
  /** True while the parcel analysis (report + dossier docs) is being generated. */
  analyzing?: boolean
}) {
  const { accessToken } = useAuth()
  const navigate = useNavigate()
  // Poll the documents while the analysis runs so they surface as they're built.
  const { data, isLoading } = useParcelDocuments(parcelId ?? undefined, {
    poll: analyzing,
  })
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
  const { data: policyDocs } = usePolicyDocuments('gemeente', gmCode ?? '', undefined, !!gmCode)

  // Map source_key → latest policy document (for opening the file in a new tab).
  const docBySourceKey = useMemo(() => {
    const m = new Map<string, PolicyDocument>()
    for (const d of policyDocs?.documents ?? []) {
      const existing = m.get(d.source_key)
      if (!existing || d.version_number > existing.version_number) m.set(d.source_key, d)
    }
    return m
  }, [policyDocs])

  const beleid = policy?.summaries
    ? BELEID_ORDER.filter((k) => policy.summaries[k]?.length).map((k) => ({
        key: k,
        label: BELEID_LABEL[k]!,
      }))
    : []
  const total = docTotal + beleid.length

  // Open a parcel document by fetching its blob with auth (mirrors BronnenLayer).
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

  // Open a gemeente beleidsdocument in a new window (same UX as a perceeldocument).
  const openBeleidDoc = useCallback(
    async (sourceKey: string) => {
      if (!gmCode) return
      const doc = docBySourceKey.get(sourceKey)
      if (!doc) {
        // No file behind this slot — fall back to the Beleid page detail.
        navigate({
          to: '/beleid',
          search: {
            gemeente: gmCode,
            provincie: undefined,
            source: sourceKey,
            category: undefined,
            niveau: undefined,
          },
        })
        return
      }
      try {
        const blob = await fetchPolicyDocumentBlob('gemeente', gmCode, doc.id, accessToken)
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      } catch {
        toast.error('Beleidsdocument openen mislukt.')
      }
    },
    [gmCode, docBySourceKey, accessToken, navigate],
  )

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-[40px] border border-white/60 bg-white/60 backdrop-blur-[24px]">
      {/* Header — h-[72px] matches the chat-shell header so the two divider lines align */}
      <div className="flex h-[72px] shrink-0 flex-col justify-center border-b border-slate-200/70 px-5">
        <h3 className="text-[14px] font-semibold text-aura-ink">Bronnen voor dit perceel</h3>
        <p className="mt-0.5 text-[12px] text-slate-400">
          {total > 0
            ? `${total} ${total === 1 ? 'bron' : 'bronnen'} · context voor de Verkenner`
            : 'Documenten die bij dit perceel horen'}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Non-saved parcel → primary action instead of an empty message. */}
        {!parcelId && onSaveToPortfolio && (
          <SaveToPortfolioPrompt
            onSaveToPortfolio={onSaveToPortfolio}
            saving={savingToPortfolio}
            onOpenMap={onOpenMap}
            openingMap={creatingReport}
          />
        )}

        {/* Gemeente beleid — applies to this parcel via its gemeente. */}
        {beleid.length > 0 && (
          <div>
            <SectionLabel>Beleid</SectionLabel>
            <div className="mt-0.5">
              {beleid.map((b) => (
                <BeleidRow
                  key={b.key}
                  icon={BELEID_ICON[b.key] ?? ScrollText}
                  label={b.label}
                  onOpen={() => openBeleidDoc(b.key)}
                />
              ))}
            </div>
          </div>
        )}

        {parcelId && isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        )}
        {/* Analysis in progress — the report + dossier documents are being built. */}
        {parcelId && analyzing && (
          <div
            className={
              beleid.length > 0
                ? 'mt-3 flex items-center gap-2.5 border-t border-slate-200/60 pt-3 px-2.5'
                : 'flex items-center gap-2.5 px-2.5 py-2'
            }
          >
            <Loader2 size={15} className="animate-spin text-aura-amber-hover" />
            <p className="text-[12px] text-slate-500">
              Perceel wordt geanalyseerd — documenten verschijnen zo…
            </p>
          </div>
        )}
        {parcelId && !isLoading && !analyzing && groups.length === 0 && beleid.length === 0 && (
          <Empty
            icon={<FolderOpen size={22} className="text-slate-300" />}
            title="Nog geen documenten"
            sub="Vraag de Verkenner — die haalt de publieke bronnen erbij."
          />
        )}
        {groups.length > 0 && (
          <div className={beleid.length > 0 ? 'mt-3 border-t border-slate-200/60 pt-3' : ''}>
            <SectionLabel>Perceeldocumenten</SectionLabel>
            <div className="mt-0.5">
              {groups.map((group) => (
                <SourceRow
                  key={group.slot}
                  icon={GHOST_ICONS[group.slot] ?? FileText}
                  label={group.label}
                  meta={`${group.docs.length}`}
                  onOpen={() => openDoc(group.docs[0]!)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Small, quiet section divider label. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
      {children}
    </p>
  )
}

function SaveToPortfolioPrompt({
  onSaveToPortfolio,
  saving,
  onOpenMap,
  openingMap,
}: {
  onSaveToPortfolio: () => void
  saving: boolean
  onOpenMap?: () => void
  openingMap: boolean
}) {
  const busy = saving || openingMap
  return (
    <div className="flex h-full flex-col items-center justify-center px-5 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-aura-amber/12">
        <Bookmark size={22} className="text-aura-amber-hover" strokeWidth={1.8} />
      </div>
      <p className="text-[14px] font-bold text-aura-ink">Nog geen bronnen</p>
      <p className="mt-1 max-w-[240px] text-[12px] leading-snug text-slate-400">
        Nog niet in je portfolio. Sla op om de bronnen hier te zien.
      </p>
      <button
        type="button"
        onClick={onSaveToPortfolio}
        disabled={busy}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-aura-obsidian px-5 py-2.5 text-[13px] font-semibold text-aura-amber transition-colors hover:bg-aura-obsidian/90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Bookmark size={15} strokeWidth={2} />
        )}
        {saving ? 'Bezig…' : 'Opslaan in portfolio'}
      </button>
      {onOpenMap && (
        <button
          type="button"
          onClick={onOpenMap}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-400 transition-colors hover:text-aura-obsidian disabled:opacity-50"
        >
          {openingMap ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <MapPin size={13} strokeWidth={2} />
          )}
          Bekijk op de kaart
        </button>
      )}
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
