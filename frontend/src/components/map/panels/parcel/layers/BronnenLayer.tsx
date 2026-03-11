import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
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
  type LucideIcon,
} from 'lucide-react'
import { useParcelEnrichment } from '@/hooks/useScans'
import { useParcelChanges } from '@/hooks/useNotifications'
import { useParcelDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useDocuments'
import { getDocumentDownloadUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type { ScanResultItem } from '@/lib/types/scan'
import type { ParcelDocumentMeta } from '@/lib/types/document'

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
): DossierPage[] {
  const hasBestemming = Array.isArray(parcel.bestemmingen) && parcel.bestemmingen.length > 0

  return [
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
          value: 'LEEG',
          sub: 'WOZ-waardebeschikking',
          filled: false,
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
          value: 'LEEG',
          sub: 'Natura 2000, beschermd gebied',
          filled: false,
          documents: [],
        },
        {
          key: 'geluid',
          label: 'GELUID',
          Icon: Volume2,
          value: 'LEEG',
          sub: 'Geluidsbelasting Lden',
          filled: false,
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
  ]
}

/* ── Merge user documents into card pages ────────────────── */

function mergeDocuments(pages: DossierPage[], documents: ParcelDocumentMeta[]): DossierPage[] {
  // Group documents by type
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

function TruncatedText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth)
  }, [text])

  return (
    <div className="relative group/tip min-w-0">
      <p
        ref={ref}
        className="text-[11px] font-bold text-slate-400 leading-tight truncate"
      >
        {text}
      </p>
      {isTruncated && (
        <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tip:block z-20 pointer-events-none">
          <div className="bg-slate-800 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-lg max-w-[200px] leading-snug">
            {text}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Document actions per card ──────────────────────────────── */

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx'
const MAX_VISIBLE_DOCS = 2

interface CardDocumentSectionProps {
  card: DossierCard
  parcelId: string
  uploadingKey: string | null
  onUploadClick: (cardKey: string) => void
  onDelete: (documentId: string) => void
  onDownload: (documentId: string, filename: string) => void
}

function CardDocumentSection({
  card,
  uploadingKey,
  onUploadClick,
  onDelete,
  onDownload,
}: CardDocumentSectionProps) {
  const isUploading = uploadingKey === card.key

  if (isUploading) {
    return (
      <div className="mt-1.5 flex items-center gap-1">
        <Loader2 className="size-3 text-amber-400 animate-spin" />
        <span className="text-[9px] font-medium text-slate-400">Uploaden...</span>
      </div>
    )
  }

  if (card.documents.length > 0) {
    const visible = card.documents.slice(0, MAX_VISIBLE_DOCS)
    const remaining = card.documents.length - MAX_VISIBLE_DOCS

    return (
      <div className="mt-1.5 space-y-0.5">
        {visible.map((doc) => (
          <div key={doc.id} className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => onDownload(doc.id, doc.filename)}
              className="text-[9px] font-medium text-slate-500 truncate hover:underline cursor-pointer flex-1 text-left"
              title={doc.filename}
            >
              {doc.filename}
            </button>
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
              title="Verwijderen"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <span className="text-[9px] text-slate-400 font-medium">+{remaining} meer</span>
        )}
        <button
          type="button"
          onClick={() => onUploadClick(card.key)}
          className="flex items-center gap-1 text-[9px] font-medium text-slate-400 hover:text-amber-500 transition-colors mt-0.5"
        >
          <FileUp className="size-2.5" />
          <span>Toevoegen</span>
        </button>
      </div>
    )
  }

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => onUploadClick(card.key)}
        className="flex items-center gap-1 rounded-full bg-slate-50 hover:bg-amber-50 px-2 py-0.5 transition-colors"
      >
        <FileUp className="size-2.5 text-slate-300" />
        <span className="text-[10px] font-bold text-slate-400">Upload</span>
      </button>
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
  const documentsQuery = useParcelDocuments(parcel.parcel_id)
  const uploadDocument = useUploadDocument()
  const deleteDocument = useDeleteDocument()

  const vergunningen = enrichment.data?.enrichment_data?.vergunningen ?? []
  const meldingen = parcelChanges.data ?? []
  const energielabel = enrichment.data?.energielabel?.energieklasse ?? null

  const rawPages = buildPages(parcel, vergunningen.length, meldingen.length, hasReport, energielabel)
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

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const cardKey = activeCardKeyRef.current
      if (!file || !cardKey) return

      setUploadingKey(cardKey)
      try {
        await uploadDocument.mutateAsync({
          parcelId: parcel.parcel_id,
          documentType: cardKey,
          file,
        })
      } catch {
        // Error handled by mutation state
      } finally {
        setUploadingKey(null)
        activeCardKeyRef.current = null
        // Reset the input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [uploadDocument, parcel.parcel_id]
  )

  const handleDelete = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocument.mutateAsync({
          parcelId: parcel.parcel_id,
          documentId,
        })
      } catch {
        // Error handled by mutation state
      }
    },
    [deleteDocument, parcel.parcel_id]
  )

  const handleDownload = useCallback(
    async (documentId: string, filename: string) => {
      const url = getDocumentDownloadUrl(parcel.parcel_id, documentId)
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
      } catch {
        // Silently fail download
      }
    },
    [parcel.parcel_id, accessToken]
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
                    ? 'Nog geen documenten'
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
              <div
                key={card.key}
                className={`bg-white border rounded-[24px] p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
                  card.filled ? 'border-emerald-200' : 'border-slate-100'
                }`}
              >
                {/* Top: icon + label + status */}
                <div className="flex justify-between items-start gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <card.Icon
                      className={`h-3 w-3 shrink-0 ${card.filled ? 'text-emerald-400' : 'text-slate-300'}`}
                      strokeWidth={2}
                    />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-tight truncate">
                      {card.label}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                      card.filled ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 bg-slate-50'
                    }`}
                  >
                    {card.filled ? '\u25CF' : '\u25CB'}
                  </span>
                </div>

                {/* Middle: value */}
                <div className="flex-1 flex items-center min-w-0">
                  <p
                    className={`text-2xl font-black tracking-tighter leading-none truncate ${
                      card.filled ? 'text-slate-900' : 'text-slate-300'
                    }`}
                  >
                    {card.value}
                  </p>
                </div>

                {/* Bottom: description + document actions */}
                <div className="border-t border-slate-50 pt-3 min-w-0">
                  <TruncatedText text={card.sub} />
                  <CardDocumentSection
                    card={card}
                    parcelId={parcel.parcel_id}
                    uploadingKey={uploadingKey}
                    onUploadClick={handleUploadClick}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 transition-colors"
          aria-label="Vorige pagina"
        >
          <ChevronLeft className="size-4 text-slate-400" />
        </button>
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-20 transition-colors"
          aria-label="Volgende pagina"
        >
          <ChevronRight className="size-4 text-slate-400" />
        </button>
      </div>
    </div>
  )
}
