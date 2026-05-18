import { useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { PageTitleToggle } from '@/components/map/panels/parcel/layers/PageTitleToggle'
import {
  FileText,
  ClipboardCheck,
  MapPin,
  MapPinned,
  ScrollText,
  Banknote,
  Sparkles,
  FlaskConical,
  Shovel,
  ShieldAlert,
  Hammer,
  Landmark,
  TreePine,
  Volume2,
  Leaf,
  Map,
  Users,
  Scale,
  FileUp,
  Mail,
  Lightbulb,
  FolderOpen,
  Trash2,
  Loader2,
  Download,
  Upload,
  Layers,
  BoxSelect,
  Columns,
  DraftingCompass,
  Gauge,
  LandPlot,
  Factory,
  Waves,
  Wind,
  Gavel,
  KeySquare,
  Hourglass,
  FolderArchive,
  Send,
  BrainCircuit,
  Zap,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useParcelChanges } from '@/hooks/useNotifications'
import { useParcelDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useDocuments'
import { getDocumentDownloadUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type { ScanResultItem } from '@/lib/types/scan'
import type { ParcelDocumentMeta } from '@/lib/types/document'
import { TruncatedText } from '../TruncatedText'
import { formatRelativeNL } from '@/lib/utils/datetime'

/* ── Ghost icons per document type ────────────────────────── */

const GHOST_ICONS: Record<string, LucideIcon> = {
  // Acquisitie — the search
  bestemmingscheck: MapPinned,
  perceeldata: BoxSelect,
  vergunninghistorie: ScrollText,
  woz: Banknote,
  quickscan: Zap,
  // Technisch — the hardware
  bodem: Layers,
  fundering: Columns,
  asbest: ShieldAlert,
  bouwkundig: DraftingCompass,
  energielabel: Gauge,
  // Planologisch — the environment
  bestemmingsplan: LandPlot,
  milieuzones: Factory,
  geluid: Waves,
  stikstof: Wind,
  // Juridisch — the papers
  kadaster: Gavel,
  eigendom: KeySquare,
  erfpacht: Hourglass,
  // Projectnotities — the context
  documenten: FolderArchive,
  correspondentie: Send,
  ideeen: BrainCircuit,
}

/* ── Card model ───────────────────────────────────────────── */

interface DossierCard {
  key: string
  label: string
  Icon: LucideIcon
  value: string
  sub: string
  filled: boolean
  documents: ParcelDocumentMeta[]
}

interface DossierPage {
  title: string
  Icon: LucideIcon
  cards: DossierCard[]
}

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
          label: 'IDE\u00CBEN',
          Icon: Lightbulb,
          value: 'LEEG',
          sub: 'Concepten & aantekeningen',
          filled: false,
          documents: [],
        },
      ],
    },
    {
      title: 'ACQUISITIE DOSSIER',
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
          value: parcel.area_m2 ? `${Math.round(parcel.area_m2).toLocaleString('nl-NL')} M\u00B2` : 'LEEG',
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
      title: 'TECHNISCH DOSSIER',
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
      title: 'JURIDISCH DOSSIER',
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
      title: 'PLANOLOGISCH DOSSIER',
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
          Icon: TreePine,
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

/* ── Merge user documents into card pages ────────────────── */

function mergeDocuments(pages: DossierPage[], documents: ParcelDocumentMeta[]): DossierPage[] {
  const byType: Record<string, ParcelDocumentMeta[]> = {}
  for (const doc of documents) {
    const existing = byType[doc.document_type] ?? []
    existing.push(doc)
    byType[doc.document_type] = existing
  }

  return pages.map((page) => ({
    ...page,
    cards: page.cards.map((card) => {
      const docs = byType[card.key] ?? []
      if (docs.length === 0) return card
      return {
        ...card,
        filled: true,
        value: card.value === 'LEEG' ? `${docs.length} BESTAND${docs.length > 1 ? 'EN' : ''}` : card.value,
        documents: docs,
      }
    }),
  }))
}

/* ── Truncated text with hover tooltip ─────────────────────── */


/* ── Precision Dropzone Card ─────────────────────────────── */

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx'
const MAX_VISIBLE_DOCS = 2

interface DropzoneCardProps {
  card: DossierCard
  uploadingKey: string | null
  onUploadClick: (cardKey: string) => void
  onFileDrop: (cardKey: string, file: File) => void
  onDelete: (documentId: string) => void
  onDownload: (documentId: string, filename: string) => void
}

function DropzoneCard({
  card,
  uploadingKey,
  onUploadClick,
  onFileDrop,
  onDelete,
  onDownload,
}: DropzoneCardProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const isUploading = uploadingKey === card.key
  const hasDocuments = card.documents.length > 0
  const hasApiData = card.filled && card.value !== 'LEEG'

  const GhostIcon = GHOST_ICONS[card.key] ?? BookOpen

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]
        if (file) {
          onFileDrop(card.key, file)
        }
      }
    },
    [card.key, onFileDrop]
  )

  const dragProps = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  }

  /* ── Shared: document file list ────────────────────────── */
  const docFileList = (variant: 'light' | 'dark') => {
    if (!hasDocuments) return null
    const visible = card.documents.slice(0, MAX_VISIBLE_DOCS)
    const remaining = card.documents.length - MAX_VISIBLE_DOCS
    const isDark = variant === 'dark'

    return (
      <div className="space-y-0.5">
        {visible.map((doc) => (
          <div key={doc.id} className="min-w-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDownload(doc.id, doc.filename) }}
                className={`text-[9px] font-medium truncate hover:text-amber-400 cursor-pointer flex-1 text-left transition-colors ${
                  isDark ? 'text-white/50' : 'text-slate-500'
                }`}
                title={doc.filename}
              >
                {doc.filename}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDownload(doc.id, doc.filename) }}
                className={`shrink-0 transition-colors hover:text-amber-400 ${isDark ? 'text-white/30' : 'text-slate-300'}`}
                title="Download"
              >
                <Download className="size-3" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(doc.id) }}
                className={`shrink-0 transition-colors hover:text-red-400 ${isDark ? 'text-white/30' : 'text-slate-300'}`}
                title="Verwijderen"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            {/* NEW: uploaded_at relative label — M045/S03 T07 */}
            <div className="text-[10px] text-slate-400 mt-1">
              {formatRelativeNL(doc.uploaded_at)}
            </div>
            {/* NEW: ai_summary preview with 2-line clamp — M045/S03 T07 */}
            {doc.ai_summary && (
              <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-snug">
                {doc.ai_summary}
              </p>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <span className={`text-[9px] font-medium ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
            +{remaining} meer
          </span>
        )}
      </div>
    )
  }

  /* ── Uploading indicator ───────────────────────────────── */
  const uploadingIndicator = (
    <div className="flex items-center gap-1 mt-1">
      <Loader2 className="size-3 text-amber-500 animate-spin" />
      <span className="text-[9px] font-black text-amber-500 uppercase">Uploaden...</span>
    </div>
  )

  /* ── Add more button ───────────────────────────────────── */
  const addButton = (variant: 'light' | 'dark') => {
    const isDark = variant === 'dark'
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onUploadClick(card.key) }}
        className={`flex items-center gap-1 text-[9px] font-bold transition-colors mt-1 ${
          isDark ? 'text-white/40 hover:text-amber-400' : 'text-slate-300 hover:text-amber-400'
        }`}
      >
        <Upload className="size-2.5" />
        <span>{hasDocuments ? 'TOEVOEGEN' : 'UPLOAD'}</span>
      </button>
    )
  }

  /* ──────────────────────────────────────────────────────── */
  /* STATE: Has user documents (obsidian) — with or without  */
  /* API data. Data badge shown as subtle pill top-right.    */
  /* ──────────────────────────────────────────────────────── */
  if (hasDocuments) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onUploadClick(card.key)}
        onKeyDown={(e) => e.key === 'Enter' && onUploadClick(card.key)}
        {...dragProps}
        className={`bg-amber-50 border-2 rounded-[20px] p-4 flex flex-col justify-between overflow-hidden transition-all duration-300 cursor-pointer group ${
          isDragOver
            ? 'border-amber-500 scale-[1.02]'
            : 'border-amber-200 hover:border-amber-400'
        }`}
      >
        {/* Top: title + data badge or green dot */}
        <div className="flex justify-between items-start gap-1">
          <p className="text-[10px] font-black text-amber-900/70 uppercase tracking-[0.15em] leading-tight truncate flex-1">
            {card.label}
          </p>
          {hasApiData ? (
            <span className="text-[8px] font-black text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wide leading-none">
              {card.value}
            </span>
          ) : (
            <span className="size-2 rounded-full bg-amber-400 shrink-0 mt-0.5" />
          )}
        </div>

        {/* Center: icon + count */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 gap-1">
          <GhostIcon className="size-8 text-amber-600 opacity-40 group-hover:opacity-60 transition-opacity" strokeWidth={1.5} />
          <p className="text-sm font-black text-amber-900 tracking-tight leading-none">
            {card.documents.length} {card.documents.length === 1 ? 'BESTAND' : 'BESTANDEN'}
          </p>
        </div>

        {/* Bottom: file list + add */}
        <div>
          {docFileList('light')}
          {isUploading ? uploadingIndicator : addButton('light')}
        </div>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────── */
  /* STATE: API data present, no user docs yet.              */
  /* Solid border, data value prominent, dropzone on hover.  */
  /* ──────────────────────────────────────────────────────── */
  if (hasApiData) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onUploadClick(card.key)}
        onKeyDown={(e) => e.key === 'Enter' && onUploadClick(card.key)}
        {...dragProps}
        className={`border-2 rounded-[20px] p-4 flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-200 group ${
          isDragOver
            ? 'border-amber-500 bg-amber-50/50 scale-[1.02]'
            : 'border-emerald-200/60 bg-white hover:border-amber-400'
        }`}
      >
        {/* Top: title + green dot */}
        <div className="flex justify-between items-start gap-1">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em] leading-tight truncate flex-1">
            {card.label}
          </p>
          <span className="size-2 rounded-full bg-emerald-400 shrink-0 mt-0.5" />
        </div>

        {/* Center: data value */}
        <div className="flex-1 flex flex-col items-center justify-center py-2">
          <p className="text-xl font-black tracking-tighter leading-none text-slate-900 text-center">
            {card.value}
          </p>
        </div>

        {/* Bottom: description + upload hint */}
        <div>
          <TruncatedText text={card.sub} className="text-[9px] font-medium text-slate-400 truncate" />
          {isUploading ? (
            uploadingIndicator
          ) : (
            <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="size-2.5 text-slate-300" />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.1em] group-hover:text-amber-400 transition-colors">
                VOEG BIJLAGE TOE
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ──────────────────────────────────────────────────────── */
  /* STATE: Empty — ghost dropzone. Dashed border, ghost     */
  /* icon, "SLEEP HIER OF KLIK" CTA.                         */
  /* ──────────────────────────────────────────────────────── */
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onUploadClick(card.key)}
      onKeyDown={(e) => e.key === 'Enter' && onUploadClick(card.key)}
      {...dragProps}
      className={`border-2 border-dashed rounded-[20px] p-4 flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-200 group ${
        isUploading
          ? 'border-amber-400 bg-amber-50/30'
          : isDragOver
            ? 'border-amber-500 bg-amber-50/50 scale-[1.02]'
            : 'border-slate-200 bg-slate-50/30 hover:border-amber-400 hover:bg-amber-50/20'
      }`}
    >
      {/* Top: title + status dot */}
      <div className="flex justify-between items-start gap-1">
        <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em] leading-tight truncate flex-1">
          {card.label}
        </p>
        <span
          className={`size-2 rounded-full shrink-0 mt-0.5 transition-colors ${
            isUploading ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'
          }`}
        />
      </div>

      {/* Center: ghost icon + upload CTA */}
      <div className="flex-1 flex flex-col items-center justify-center py-2 gap-1.5">
        {isUploading ? (
          <>
            <Loader2 className="size-10 text-amber-400 animate-spin" strokeWidth={1.5} />
            <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.15em]">
              UPLOADEN...
            </p>
          </>
        ) : (
          <>
            <GhostIcon
              className="size-10 text-slate-900 opacity-[0.05] group-hover:opacity-[0.30] group-hover:scale-110 transition-all duration-300"
              strokeWidth={1.5}
            />
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.1em] mt-1 group-hover:text-amber-400 transition-colors">
              SLEEP HIER OF KLIK
            </p>
          </>
        )}
      </div>

      {/* Bottom: description */}
      <div>
        <TruncatedText text={card.sub} className="text-[9px] font-medium text-slate-400 truncate" />
      </div>
    </div>
  )
}

/* ── Component ─────────────────────────────────────────────── */

interface BronnenLayerProps {
  parcel: ScanResultItem
  hasReport: boolean
}

export function BronnenLayer({ parcel, hasReport }: BronnenLayerProps) {
  const [page, setPage] = useState(0)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
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
  const totalPages = pages.length
  // Safe: pages always has 5 entries from buildPages, page is bounded by pagination
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const current = (pages[page] ?? pages[0])!
  const filledCount = current.cards.filter((c) => c.filled).length

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

  return (
    <div className="flex flex-col flex-1 pt-4 px-6 pb-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Dossier Page Toggle ────────────────────────────── */}
      <PageTitleToggle pages={pages} activeIndex={page} onSelect={setPage} className="px-1" />

      {/* ── Dossier Hero ───────────────────────────────────── */}
      <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-5 rounded-[20px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-7xl font-black tracking-tighter text-slate-900 tabular-nums leading-none">
                {filledCount}
                <span className="text-2xl text-slate-300 font-bold">/{current.cards.length}</span>
              </span>

              <div className="flex-1 px-6 min-w-0">
                <p className="text-xl font-bold uppercase tracking-wide text-slate-700">
                  {current.title}
                </p>
                <p className="text-[13px] text-slate-500 mt-0.5 truncate">
                  {filledCount === 0
                    ? 'Sleep documenten naar de slots'
                    : `${filledCount} document${filledCount > 1 ? 'en' : ''} beschikbaar`}
                </p>
              </div>

              <div className="size-12 rounded-full flex items-center justify-center shrink-0 bg-slate-200">
                <current.Icon className="size-6 text-white" strokeWidth={2.5} />
              </div>
            </div>

            <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{
                  width: `${current.cards.length > 0 ? Math.round((filledCount / current.cards.length) * 100) : 0}%`,
                }}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Card Grid ──────────────────────────────────────── */}
      <div className="flex-1 mt-4 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-3 gap-1.5 auto-rows-fr h-full"
          >
                {current.cards.map((card) => (
                  <DropzoneCard
                    key={card.key}
                    card={card}
                    uploadingKey={uploadingKey}
                    onUploadClick={handleUploadClick}
                    onFileDrop={handleFileDrop}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                  />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  )
}
