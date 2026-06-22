import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  FileText,
  ClipboardCheck,
  MapPin,
  ScrollText,
  Banknote,
  Sparkles,
  FlaskConical,
  Shovel,
  ShieldAlert,
  Hammer,
  Landmark,
  Volume2,
  Leaf,
  Map,
  Users,
  Scale,
  FileUp,
  Mail,
  Lightbulb,
  FolderOpen,
} from 'lucide-react'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useParcelChanges } from '@/hooks/useNotifications'
import { useParcelDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useDocuments'
import { getDocumentDownloadUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type { ScanResultItem } from '@/lib/types/scan'
import { formatRelativeNL } from '@/lib/utils/datetime'
import { mergeDocuments, type DossierCard, type DossierPage } from '@/lib/cockpit/dossier-pages'
import { DossierSlotCard } from '@/components/map/panels/parcel/DossierSlotCard'
import { PdfViewerDrawer } from '@/components/ui/PdfViewerDrawer'

/* ── Build dossier pages ──────────────────────────────────── */

function buildPages(
  parcel: ScanResultItem,
  vergunningenCount: number,
  meldingenCount: number,
  hasReport: boolean,
  energielabel: string | null,
  wozWaarde: number | null,
  geluidDb: number | null,
  natura2000Naam: string | null,
): DossierPage[] {
  const hasBestemming = Array.isArray(parcel.bestemmingen) && parcel.bestemmingen.length > 0

  return [
    {
      title: 'PROJECTNOTITIES',
      tabLabel: 'Notities',
      Icon: Lightbulb,
      cards: [
        {
          key: 'documenten',
          label: 'DOCUMENTEN',
          Icon: FileUp,
          value: 'LEEG',
          sub: 'Eigen uploads & bijlagen',
          filled: false,
          documents: [],
        },
        {
          key: 'correspondentie',
          label: 'CORRESPONDENTIE',
          Icon: Mail,
          value: 'LEEG',
          sub: 'E-mail & communicatie',
          filled: false,
          documents: [],
        },
        {
          key: 'ideeen',
          label: 'IDEEËEN',
          Icon: Lightbulb,
          value: 'LEEG',
          sub: 'Concepten & aantekeningen',
          filled: false,
          documents: [],
        },
      ],
    },
    {
      title: 'ACQUISITIE',
      tabLabel: 'Acquisitie',
      Icon: FolderOpen,
      cards: [
        {
          key: 'bestemmingscheck',
          label: 'BESTEMMINGSCHECK',
          Icon: ClipboardCheck,
          value: hasBestemming
            ? `${parcel.bestemmingen!.length} ZONE${parcel.bestemmingen!.length > 1 ? 'S' : ''}`
            : 'LEEG',
          sub: 'Haalbaarheid bestemming',
          filled: hasBestemming,
          documents: [],
        },
        {
          key: 'perceeldata',
          label: 'PERCEELDATA',
          Icon: MapPin,
          value: parcel.area_m2 ? `${Math.round(parcel.area_m2).toLocaleString('nl-NL')} M²` : 'LEEG',
          sub: 'Kadaster & BAG gegevens',
          filled: !!parcel.area_m2,
          documents: [],
        },
        {
          key: 'vergunninghistorie',
          label: 'VERGUNNINGEN',
          Icon: ScrollText,
          value: vergunningenCount > 0 ? `${vergunningenCount} STUKS` : 'GEEN',
          sub: 'Bekendmakingen & aanvragen',
          filled: vergunningenCount > 0,
          documents: [],
        },
        {
          key: 'woz',
          label: 'WOZ',
          Icon: Banknote,
          value: wozWaarde != null ? `€${Math.round(wozWaarde).toLocaleString('nl-NL')}` : 'LEEG',
          sub: wozWaarde != null ? 'WOZ-waarde beschikbaar' : 'WOZ-waardebeschikking',
          filled: wozWaarde != null,
          documents: [],
        },
        {
          key: 'quickscan',
          label: 'QUICKSCAN',
          Icon: Sparkles,
          value: hasReport ? 'BESCHIKBAAR' : 'LEEG',
          sub: hasReport ? 'Rapport gegenereerd' : 'AI-gegenereerd rapport',
          filled: hasReport,
          documents: [],
        },
      ],
    },
    {
      title: 'TECHNISCH',
      tabLabel: 'Technisch',
      Icon: Hammer,
      cards: [
        {
          key: 'bodem',
          label: 'BODEMONDERZOEK',
          Icon: FlaskConical,
          value: 'LEEG',
          sub: 'Verkennend / nader onderzoek',
          filled: false,
          documents: [],
        },
        {
          key: 'fundering',
          label: 'FUNDERING',
          Icon: Shovel,
          value: 'LEEG',
          sub: 'Constructieve staat funderingen',
          filled: false,
          documents: [],
        },
        {
          key: 'asbest',
          label: 'ASBEST',
          Icon: ShieldAlert,
          value: 'LEEG',
          sub: 'Inventarisatie Type A / B',
          filled: false,
          documents: [],
        },
        {
          key: 'bouwkundig',
          label: 'BOUWKUNDIG',
          Icon: FileText,
          value: 'LEEG',
          sub: 'Staat van het gebouw',
          filled: false,
          documents: [],
        },
        {
          key: 'energielabel',
          label: 'ENERGIELABEL',
          Icon: Leaf,
          value: energielabel ?? 'LEEG',
          sub: energielabel ? 'EP-Online geregistreerd' : 'Duurzaamheidsstatus',
          filled: !!energielabel,
          documents: [],
        },
      ],
    },
    {
      title: 'JURIDISCH',
      tabLabel: 'Juridisch',
      Icon: Scale,
      cards: [
        {
          key: 'kadaster',
          label: 'KADASTER',
          Icon: MapPin,
          value: parcel.parcel_code ?? 'LEEG',
          sub: 'Kadastraal uittreksel',
          filled: !!parcel.parcel_code,
          documents: [],
        },
        {
          key: 'eigendom',
          label: 'EIGENDOM',
          Icon: Users,
          value: 'LEEG',
          sub: 'BRK eigendomsinformatie',
          filled: false,
          documents: [],
        },
        {
          key: 'erfpacht',
          label: 'ERFPACHT',
          Icon: Scale,
          value: 'LEEG',
          sub: 'Erfpachtvoorwaarden',
          filled: false,
          documents: [],
        },
      ],
    },
    {
      title: 'PLANOLOGISCH',
      tabLabel: 'Planologisch',
      Icon: Landmark,
      cards: [
        {
          key: 'bestemmingsplan',
          label: 'BESTEMMINGSPLAN',
          Icon: Map,
          value: hasBestemming
            ? ((parcel.bestemmingen![0] as { naam?: string }).naam ?? 'GEVONDEN').toUpperCase().slice(0, 14)
            : 'LEEG',
          sub: 'Officieel bestemmingsplan',
          filled: hasBestemming,
          documents: [],
        },
        {
          key: 'milieuzones',
          label: 'MILIEUZONES',
          Icon: Landmark,
          value: natura2000Naam ? 'NABIJ' : 'LEEG',
          sub: natura2000Naam ? natura2000Naam.slice(0, 28) : 'Natura 2000, beschermd gebied',
          filled: !!natura2000Naam,
          documents: [],
        },
        {
          key: 'geluid',
          label: 'GELUID',
          Icon: Volume2,
          value: geluidDb != null ? `${Math.round(geluidDb)} DB` : 'LEEG',
          sub: geluidDb != null ? 'Geluidsbelasting Lden' : 'Geluidsbelasting Lden',
          filled: geluidDb != null,
          documents: [],
        },
        {
          key: 'stikstof',
          label: 'STIKSTOF',
          Icon: Leaf,
          value: 'LEEG',
          sub: 'AERIUS berekening',
          filled: false,
          documents: [],
        },
      ],
    },
  ]
}

/* ── Accepted upload types ────────────────────────────────── */

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx'

/* ── Component ─────────────────────────────────────────────── */

interface BronnenLayerProps {
  parcel: ScanResultItem
  hasReport: boolean
}

export function BronnenLayer({ parcel, hasReport }: BronnenLayerProps) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<string | null>(null)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeCardKeyRef = useRef<string | null>(null)

  const { accessToken } = useAuth()
  const enrichment = useParcelEnrichment(parcel.parcel_id)
  const parcelChanges = useParcelChanges(parcel.parcel_id)
  const documentParcelId = parcel.parcel_code || parcel.parcel_id
  const documentsQuery = useParcelDocuments(documentParcelId)
  const uploadDocument = useUploadDocument()
  const deleteDocument = useDeleteDocument()

  const vergunningen = enrichment.data?.enrichment_data?.vergunningen ?? []
  const meldingen = parcelChanges.data ?? []
  const energielabel = enrichment.data?.energielabel?.energieklasse ?? null
  const wozWaarde = enrichment.data?.woz_data?.meest_recente_waarde ?? null
  const geluidDb = enrichment.data?.geluid_data?.lden_db ?? null
  const natura2000Naam = enrichment.data?.natura2000_data?.naam ?? null

  const rawPages = buildPages(parcel, vergunningen.length, meldingen.length, hasReport, energielabel, wozWaarde, geluidDb, natura2000Naam)
  const userDocs = documentsQuery.data?.documents ?? []
  const pages = mergeDocuments(rawPages, userDocs)

  const allCards = pages.flatMap((p) => p.cards)
  const totalSlots = allCards.length
  const filledTotal = allCards.filter((c) => c.filled).length
  const openCard = activeSlot ? allCards.find((c) => c.key === activeSlot) ?? null : null
  const openDocs = openCard?.documents ?? []
  const activeDoc = openDocs.find((d) => d.id === activeDocId) ?? openDocs[0] ?? null

  const handleUploadClick = useCallback((cardKey: string) => {
    activeCardKeyRef.current = cardKey
    fileInputRef.current?.click()
  }, [])

  const doUpload = useCallback(
    async (file: File, cardKey: string) => {
      setUploadingKey(cardKey)
      try {
        await uploadDocument.mutateAsync({
          parcelId: documentParcelId,
          documentType: cardKey,
          file,
        })
        toast.success('Document toegevoegd aan dossier')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload mislukt')
      } finally {
        setUploadingKey(null)
        activeCardKeyRef.current = null
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [documentParcelId, uploadDocument]
  )

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const cardKey = activeCardKeyRef.current
      if (!file || !cardKey) return
      await doUpload(file, cardKey)
    },
    [doUpload]
  )

  const handleFileDrop = useCallback(
    async (cardKey: string, file: File) => {
      activeCardKeyRef.current = cardKey
      await doUpload(file, cardKey)
    },
    [doUpload]
  )

  const handleDelete = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocument.mutateAsync({
          parcelId: documentParcelId,
          documentId,
        })
        toast.success('Document verwijderd')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Verwijderen mislukt')
      }
    },
    [deleteDocument, documentParcelId]
  )

  const handleDownload = useCallback(
    async (documentId: string, filename: string) => {
      const url = getDocumentDownloadUrl(documentParcelId, documentId)
      try {
        const headers: HeadersInit = {}
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }
        const response = await fetch(url, {
          method: 'GET',
          headers,
          credentials: 'include',
        })
        if (!response.ok) return
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Download mislukt')
      }
    },
    [documentParcelId, accessToken]
  )

  function onSlotClick(card: DossierCard) {
    if (card.documents.length > 0) {
      setActiveSlot(card.key)
      setActiveDocId(card.documents[0]?.id ?? null)
    } else {
      handleUploadClick(card.key)
    }
  }

  // uploadingKey is kept in state for future use by DossierSlotCard loading states
  void uploadingKey

  return (
    <div className="flex flex-1 flex-col pt-4 pb-4">
      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleFileChange} />

      {/* Hero — total completeness */}
      <div className="mx-6 rounded-[20px] border border-slate-100 bg-slate-50/50 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-6xl font-black leading-none tracking-tighter text-slate-900 tabular-nums">
            {filledTotal}<span className="text-2xl font-bold text-slate-300">/{totalSlots}</span>
          </span>
          <div className="min-w-0 flex-1 px-5">
            <p className="text-lg font-bold uppercase tracking-wide text-slate-700">Dossier</p>
            <p className="mt-0.5 truncate text-[13px] text-slate-500">{filledTotal} van {totalSlots} bronnen gevuld</p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-400">
            <FolderOpen className="size-5 text-white" strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${totalSlots ? Math.round((filledTotal / totalSlots) * 100) : 0}%` }} />
        </div>
      </div>

      {/* One continuous scroll, grouped by category */}
      <div className="mt-3 flex-1 overflow-y-auto px-6">
        {pages.map((page) => (
          <div key={page.title}>
            <div className="mb-2 mt-4 flex items-center gap-2 first:mt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{page.tabLabel}</span>
              <span className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {page.cards.map((card) => (
                <DossierSlotCard
                  key={card.key}
                  card={card}
                  onClick={() => onSlotClick(card)}
                  onDragFile={(file) => handleFileDrop(card.key, file)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Viewer drawer for a slot with documents */}
      {openCard && activeDoc && (
        <PdfViewerDrawer
          url={getDocumentDownloadUrl(documentParcelId, activeDoc.id)}
          title={activeDoc.filename}
          eyebrow={`${openCard.label} · Dossier`}
          files={openDocs.map((d) => ({ id: d.id, filename: d.filename, meta: formatRelativeNL(d.uploaded_at) }))}
          activeId={activeDoc.id}
          onSelectFile={(id) => setActiveDocId(id)}
          onClose={() => { setActiveSlot(null); setActiveDocId(null) }}
          onDownload={() => handleDownload(activeDoc.id, activeDoc.filename)}
          onDelete={() => { handleDelete(activeDoc.id); setActiveSlot(null); setActiveDocId(null) }}
          onUpload={() => handleUploadClick(openCard.key)}
        />
      )}
    </div>
  )
}
