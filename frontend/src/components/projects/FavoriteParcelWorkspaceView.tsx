import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  BookOpen,
  BoxSelect,
  BrainCircuit,
  ChevronLeft,
  ClipboardCheck,
  Columns,
  Download,
  DraftingCompass,
  Factory,
  FileText,
  FileUp,
  FlaskConical,
  FolderOpen,
  FolderArchive,
  Gauge,
  Gavel,
  Hammer,
  Hourglass,
  KeySquare,
  Landmark,
  LandPlot,
  Leaf,
  Lightbulb,
  Loader2,
  Mail,
  Map as MapIcon,
  MapPin,
  MapPinned,
  Layers,
  Scale,
  ScrollText,
  Send,
  ShieldAlert,
  Shovel,
  Sparkles,
  Trash2,
  TreePine,
  Upload,
  Users,
  Volume2,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
  X,
  Phone,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { TruncatedText } from '@/components/map/panels/parcel/TruncatedText'
import { useDeleteDocument, useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'
import { useFavoriteNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/hooks/useFavorites'
import type { FavoriteNoteResponse } from '@/hooks/useFavorites'
import { useGenerateReportFromParcel } from '@/hooks/useReports'
import { getDocumentDownloadUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type { ParcelDocumentMeta } from '@/lib/types/document'
import type { FavoriteResponse } from '@/lib/types/portfolio'
import { PotentieModal, RisicoModal } from './ScoreDetailModal'

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx'
const MAX_VISIBLE_DOCS = 2

const GHOST_ICONS: Record<string, LucideIcon> = {
  bestemmingscheck: MapPinned,
  perceeldata: BoxSelect,
  vergunninghistorie: ScrollText,
  woz: Banknote,
  quickscan: Zap,
  bodem: Layers,
  fundering: Columns,
  asbest: ShieldAlert,
  bouwkundig: DraftingCompass,
  energielabel: Gauge,
  bestemmingsplan: LandPlot,
  milieuzones: Factory,
  geluid: Waves,
  stikstof: Wind,
  kadaster: Gavel,
  eigendom: KeySquare,
  erfpacht: Hourglass,
  documenten: FolderArchive,
  correspondentie: Send,
  ideeen: BrainCircuit,
}

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
  tabLabel: string
  Icon: LucideIcon
  cards: DossierCard[]
}

interface DossierCardWithContext extends DossierCard {
  pageTitle: string
  tabLabel: string
}

const REQUIRED_CARD_PRIORITY = [
  'quickscan',
  'bestemmingscheck',
  'eigendom',
  'vergunninghistorie',
  'woz',
  'bestemmingsplan',
  'bodem',
  'fundering',
  'bouwkundig',
  'energielabel',
  'erfpacht',
  'milieuzones',
  'geluid',
  'stikstof',
  'correspondentie',
] as const

const WORKSPACE_DATE_TIME = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function stageBadgeClasses(stage: FavoriteResponse['pipeline_stage']): string {
  switch (stage) {
    case 'Afgerond':
      return 'border-[#CFE7D6] bg-[#EDF7F0] text-[#2E6A40]'
    case 'Besluit':
      return 'border-[#E4D7C6] bg-[#F8F1E7] text-[#7B5A2B]'
    case 'Contact':
      return 'border-[#D2D9EA] bg-[#EEF2F9] text-[#3E557E]'
    case 'Onderzoek':
      return 'border-[#DAD8EE] bg-[#F2F0FA] text-[#5D4F91]'
    default:
      return 'border-[#F1DCA6] bg-[#FFF8E8] text-[#7A5A00]'
  }
}

function buildParcelTitle(favorite: FavoriteResponse): string {
  return favorite.address ?? favorite.parcel_id
}

function buildPages(favorite: FavoriteResponse): DossierPage[] {
  const hasAddress = Boolean(favorite.address)
  const hasKadaster = Boolean(favorite.parcel_id)

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
          label: 'IDEEEN',
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
      tabLabel: 'Acquisitie',
      Icon: FolderOpen,
      cards: [
        {
          key: 'bestemmingscheck',
          label: 'BESTEMMINGSCHECK',
          Icon: ClipboardCheck,
          value: 'LEEG',
          sub: 'Haalbaarheid bestemming',
          filled: false,
          documents: [],
        },
        {
          key: 'perceeldata',
          label: 'PERCEELDATA',
          Icon: MapPin,
          value: hasAddress ? 'BESCHIKBAAR' : 'LEEG',
          sub: hasAddress ? 'Adres en perceelbasis bekend' : 'Kadaster & BAG gegevens',
          filled: hasAddress,
          documents: [],
        },
        {
          key: 'vergunninghistorie',
          label: 'VERGUNNINGEN',
          Icon: ScrollText,
          value: 'GEEN',
          sub: 'Bekendmakingen & aanvragen',
          filled: false,
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
          value: 'LEEG',
          sub: 'AI-gegenereerd rapport',
          filled: false,
          documents: [],
        },
      ],
    },
    {
      title: 'TECHNISCH DOSSIER',
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
          value: 'LEEG',
          sub: 'Duurzaamheidsstatus',
          filled: false,
          documents: [],
        },
      ],
    },
    {
      title: 'JURIDISCH DOSSIER',
      tabLabel: 'Juridisch',
      Icon: Scale,
      cards: [
        {
          key: 'kadaster',
          label: 'KADASTER',
          Icon: MapPin,
          value: hasKadaster ? favorite.parcel_id : 'LEEG',
          sub: 'Kadastraal uittreksel',
          filled: hasKadaster,
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
      tabLabel: 'Planologisch',
      Icon: Landmark,
      cards: [
        {
          key: 'bestemmingsplan',
          label: 'BESTEMMINGSPLAN',
          Icon: MapIcon,
          value: 'LEEG',
          sub: 'Officieel bestemmingsplan',
          filled: false,
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
  ]
}

function mergeDocuments(pages: DossierPage[], documents: ParcelDocumentMeta[]): DossierPage[] {
  const byType: Record<string, ParcelDocumentMeta[]> = {}
  for (const document of documents) {
    const existing = byType[document.document_type] ?? []
    existing.push(document)
    byType[document.document_type] = existing
  }

  return pages.map((page) => ({
    ...page,
    cards: page.cards.map((card) => {
      const cardDocuments = byType[card.key] ?? []
      if (cardDocuments.length === 0) return card
      return {
        ...card,
        filled: true,
        value: card.value === 'LEEG' ? `${cardDocuments.length} BESTAND${cardDocuments.length > 1 ? 'EN' : ''}` : card.value,
        documents: cardDocuments,
      }
    }),
  }))
}

function flattenCards(pages: DossierPage[]): DossierCardWithContext[] {
  return pages.flatMap((page) =>
    page.cards.map((card) => ({
      ...card,
      pageTitle: page.title,
      tabLabel: page.tabLabel,
    })),
  )
}

function formatWorkspaceDate(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return WORKSPACE_DATE_TIME.format(parsed)
}

function deriveMissingCards(cards: DossierCardWithContext[]): DossierCardWithContext[] {
  const cardMap = new Map(cards.map((card) => [card.key, card]))
  return REQUIRED_CARD_PRIORITY
    .map((key) => cardMap.get(key))
    .filter((card): card is DossierCardWithContext => Boolean(card && !card.filled))
}

function deriveNextStep(
  favorite: FavoriteResponse,
  allCards: DossierCardWithContext[],
  missingCards: DossierCardWithContext[],
): { title: string; detail: string } {
  const missingKeys = new Set(missingCards.map((card) => card.key))
  const correspondenceCount = allCards.find((card) => card.key === 'correspondentie')?.documents.length ?? 0

  // If report exists, next step shifts to review / dossier completeness
  if (favorite.has_report && favorite.pipeline_stage === 'Gesignaleerd') {
    if (missingKeys.has('eigendom')) {
      return {
        title: 'Vraag eigendomsinfo op',
        detail: 'Het rapport staat klaar. Volgende stap: BRK eigendom ophalen zodat je weet wie de eigenaar is en hoe je kunt benaderen.',
      }
    }
    return {
      title: 'Bekijk je rapport en plan opvolging',
      detail: 'Je rapport is gegenereerd. Loop de risico\'s en potentie door en bepaal of dit perceel naar de onderzoeksfase gaat.',
    }
  }

  if (favorite.pipeline_stage === 'Afgerond') {
    if (favorite.afgerond_reden === 'Gekocht') {
      return {
        title: 'Werk het vervolgdossier uit',
        detail: 'Leg overdracht, uitvoeringsstukken en verdere correspondentie vast zodat het perceel direct projectklaar blijft.',
      }
    }
    return {
      title: 'Bewaar leerpunten compact',
      detail: 'Zet de afwijzingsreden, eventuele heropeningssignalen en relevante stukken overzichtelijk weg voor later.',
    }
  }

  if (favorite.pipeline_stage === 'Besluit') {
    if (missingKeys.has('bouwkundig') || missingKeys.has('bodem') || missingKeys.has('fundering')) {
      return {
        title: 'Maak het besluitdossier compleet',
        detail: 'Er ontbreken nog technische stukken die je nodig hebt om stevig te kunnen kopen, parkeren of afwijzen.',
      }
    }
    return {
      title: 'Bundel het beslisdossier',
      detail: 'Zet quickscan, eigendom, technische checks en correspondentie naast elkaar voor een scherp investeringsbesluit.',
    }
  }

  if (favorite.pipeline_stage === 'Contact') {
    if (correspondenceCount === 0) {
      return {
        title: 'Leg de eerste outreach vast',
        detail: 'Sla mail, brief of gespreksnotities op in Correspondentie zodat opvolging niet buiten het perceeldossier valt.',
      }
    }
    if (missingKeys.has('eigendom')) {
      return {
        title: 'Rond het eigenaarsspoor af',
        detail: 'Vraag eigendomsinformatie op voordat je verder escaleert in contact of onderhandeling.',
      }
    }
    return {
      title: 'Plan de opvolging',
      detail: 'Werk het volgende contactmoment uit en koppel nieuwe reacties of stukken direct terug aan het dossier.',
    }
  }

  if (favorite.pipeline_stage === 'Onderzoek') {
    if (missingKeys.has('eigendom')) {
      return {
        title: 'Controleer eigendom',
        detail: 'BRK eigendom ontbreekt nog. Pak dat eerst op voordat je outreach of biedstrategie aanscherpt.',
      }
    }
    if (missingKeys.has('quickscan')) {
      return {
        title: 'Genereer rapport',
        detail: 'Zorg dat de quickscan of rapportlaag gevuld is zodat je van signalen naar inhoudelijke toetsing gaat.',
      }
    }
    if (missingKeys.has('vergunninghistorie')) {
      return {
        title: 'Controleer vergunninghistorie',
        detail: 'Vergunningen en bekendmakingen geven snel scherpte op haalbaarheid, risico en timing.',
      }
    }
    return {
      title: 'Werk toe naar contact',
      detail: 'De basis ligt er. Vertaal de bevindingen nu naar een eerste benadering of onderbouwde afwijzing.',
    }
  }

  if (missingKeys.has('quickscan')) {
    return {
      title: 'Genereer rapport',
      detail: 'Start met een quickscan zodat dit perceel van een ruwe signalering naar een toetsbaar acquisitiedossier gaat.',
    }
  }

  if (missingKeys.has('bestemmingscheck')) {
    return {
      title: 'Bevestig de bestemmingsruimte',
      detail: 'Leg eerst vast wat planologisch wel en niet kan, zodat de rest van het dossier richting krijgt.',
    }
  }

  return {
    title: 'Zet door naar Onderzoek',
    detail: 'De eerste basisinformatie staat klaar. Verzamel nu eigendom, vergunninghistorie en technische checks.',
  }
}

function deriveContactFollowUp(
  favorite: FavoriteResponse,
  allCards: DossierCardWithContext[],
): { title: string; detail: string } {
  const eigendomCard = allCards.find((card) => card.key === 'eigendom')
  const correspondenceCard = allCards.find((card) => card.key === 'correspondentie')
  const hasEigendom = eigendomCard?.filled ?? false
  const correspondenceCount = correspondenceCard?.documents.length ?? 0

  if (favorite.pipeline_stage === 'Afgerond') {
    return {
      title: 'Geen open opvolging',
      detail: favorite.afgerond_reden === 'Gekocht'
        ? 'Dit perceel is afgerond als aankoop. Gebruik correspondentie en documenten vooral voor overdracht en vervolguitwerking.'
        : 'Dit perceel is afgerond als afwijzing. Bewaar alleen nog relevante leerpunten of heropeningssignalen.',
    }
  }

  if (!hasEigendom && correspondenceCount === 0) {
    return {
      title: 'Start met eigenaar + eerste outreach',
      detail: 'Nog geen eigendomsinformatie of contactspoor vastgelegd. Vraag BRK eigendom op en leg de eerste benadering direct vast.',
    }
  }

  if (hasEigendom && correspondenceCount === 0) {
    return {
      title: 'Eigendom staat klaar, contact nog niet',
      detail: 'De volgende logische stap is een eerste bel-, mail- of briefactie. Sla die daarna op in Correspondentie.',
    }
  }

  return {
    title: 'Houd opvolging compact in dit dossier',
    detail: `${correspondenceCount} contactstuk${correspondenceCount === 1 ? '' : 'ken'} aanwezig. Gebruik Correspondentie als vaste plek voor reacties, afspraken en vervolgacties.`,
  }
}

function deriveActivityRows(
  favorite: FavoriteResponse,
  documents: ParcelDocumentMeta[],
  allCards: DossierCardWithContext[],
): Array<{ label: string; value: string }> {
  const latestDocument = [...documents]
    .sort((a, b) => Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at))[0]

  const rows: Array<{ label: string; value: string }> = []

  if (latestDocument) {
    rows.push({
      label: 'Laatste upload',
      value: `${latestDocument.filename} · ${formatWorkspaceDate(latestDocument.uploaded_at) ?? 'Onbekende datum'}`,
    })
  } else {
    rows.push({
      label: 'Laatste upload',
      value: 'Nog geen documenten toegevoegd in deze workspace',
    })
  }

  rows.push({
    label: 'Portfolio status',
    value: `${favorite.pipeline_stage} · ${formatWorkspaceDate(favorite.updated_at) ?? 'Onbekende datum'}`,
  })

  rows.push({
    label: 'Dossierstand',
    value: `${allCards.filter((card) => card.filled).length}/${allCards.length} kaarten gevuld`,
  })

  return rows
}

function WorkspaceInsightCard({
  title,
  kicker,
  Icon,
  children,
  className = '',
  index = 0,
}: {
  title: string
  kicker: string
  Icon: LucideIcon
  children: ReactNode
  className?: string
  index?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-[24px] border border-[#EAEFEF] bg-white p-5 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            {kicker}
          </p>
          <h3 className="mt-2 text-[18px] font-bold tracking-tight text-[#0E1111]">
            {title}
          </h3>
        </div>
        <motion.div
          whileHover={{ scale: 1.08, rotate: 6 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0E1111]"
        >
          <Icon className="size-5 text-[#F9A826]" strokeWidth={2.2} />
        </motion.div>
      </div>
      <div className="mt-4">{children}</div>
    </motion.section>
  )
}

/* ── Multi-Note Block ──────────────────────────────────────── */

function MultiNoteBlock({
  parcelId,
  notes,
  isLoading,
  createNote,
  updateNote,
  deleteNote,
}: {
  parcelId: string
  notes: FavoriteNoteResponse[]
  isLoading: boolean
  createNote: ReturnType<typeof useCreateNote>
  updateNote: ReturnType<typeof useUpdateNote>
  deleteNote: ReturnType<typeof useDeleteNote>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newText, setNewText] = useState('')

  const handleExpand = (note: FavoriteNoteResponse) => {
    if (expandedId === note.id) {
      setExpandedId(null)
    } else {
      setExpandedId(note.id)
      setEditText(note.content)
    }
    setAddingNew(false)
  }

  const handleSave = (noteId: string) => {
    const trimmed = editText.trim()
    if (!trimmed) return
    updateNote.mutate(
      { parcelId, noteId, content: trimmed },
      { onSuccess: () => { setExpandedId(null); toast.success('Notitie bijgewerkt') } },
    )
  }

  const handleDelete = (noteId: string) => {
    deleteNote.mutate(
      { parcelId, noteId },
      { onSuccess: () => { setExpandedId(null); toast.success('Notitie verwijderd') } },
    )
  }

  const handleCreate = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    createNote.mutate(
      { parcelId, content: trimmed },
      { onSuccess: () => { setAddingNew(false); setNewText(''); toast.success('Notitie toegevoegd') } },
    )
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="rounded-[20px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-6 text-center text-[13px] text-slate-400">
        Notities laden...
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {notes.length === 0 && !addingNew && (
        <div className="rounded-[20px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-6 text-center">
          <p className="text-[13px] text-slate-400 italic">Nog geen notities — voeg je eerste acquisitiethese toe</p>
        </div>
      )}

      {notes.map((note) => {
        const isExpanded = expandedId === note.id
        const preview = note.content.length > 80 ? `${note.content.slice(0, 80)}…` : note.content

        return (
          <motion.div
            key={note.id}
            layout
            className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] overflow-hidden transition-colors hover:border-[#F9A826]/30"
          >
            <button
              type="button"
              onClick={() => handleExpand(note)}
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
            >
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-700">
                {isExpanded ? '' : preview}
              </p>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                {formatDate(note.updated_at)}
              </span>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-[12px] border border-[#EAEFEF] bg-white px-3 py-2.5 text-[14px] leading-6 text-slate-700 placeholder:text-slate-400 focus:border-[#F9A826] focus:outline-none focus:ring-1 focus:ring-[#F9A826]"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <motion.button
                        type="button"
                        onClick={() => handleSave(note.id)}
                        disabled={updateNote.isPending}
                        whileTap={{ scale: 0.96 }}
                        className="inline-flex min-h-[34px] items-center gap-2 rounded-full bg-[#0E1111] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                      >
                        {updateNote.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                        Opslaan
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        disabled={deleteNote.isPending}
                        whileTap={{ scale: 0.96 }}
                        className="inline-flex min-h-[34px] items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 text-[12px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        {deleteNote.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                        <Trash2 size={12} />
                        Verwijderen
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}

      {/* New note form */}
      <AnimatePresence>
        {addingNew && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-[16px] border border-[#F9A826]/40 bg-[#FFFDF8] px-4 py-4 space-y-3">
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Waarom is dit perceel interessant? Welke strategie lijkt kansrijk?"
                rows={4}
                className="w-full resize-none rounded-[12px] border border-[#EAEFEF] bg-white px-3 py-2.5 text-[14px] leading-6 text-slate-700 placeholder:text-slate-400 focus:border-[#F9A826] focus:outline-none focus:ring-1 focus:ring-[#F9A826]"
                autoFocus
              />
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  onClick={handleCreate}
                  disabled={createNote.isPending || !newText.trim()}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex min-h-[34px] items-center gap-2 rounded-full bg-[#0E1111] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                >
                  {createNote.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                  Opslaan
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setAddingNew(false); setNewText('') }}
                  className="inline-flex min-h-[34px] items-center rounded-full border border-[#EAEFEF] px-4 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Annuleren
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add note button */}
      {!addingNew && (
        <motion.button
          type="button"
          onClick={() => { setAddingNew(true); setExpandedId(null) }}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-[12px] font-semibold text-slate-500 transition-colors hover:border-[#F9A826]/40 hover:bg-[#FFFDF8] hover:text-[#0E1111]"
        >
          <Lightbulb size={14} />
          Notitie toevoegen
        </motion.button>
      )}
    </div>
  )
}

function FavoriteDossierTabs({
  pages,
  activePage,
  onSelect,
}: {
  pages: DossierPage[]
  activePage: number
  onSelect: (page: number) => void
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex h-[48px] min-w-max rounded-full bg-[#F2F6F3] p-1">
        {pages.map((page, index) => {
          const isActive = activePage === index
          return (
            <button
              key={page.title}
              type="button"
              onClick={() => onSelect(index)}
              className="relative flex h-full min-w-[124px] flex-1 items-center justify-center rounded-full px-4 transition-colors"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '13px',
                fontWeight: isActive ? 700 : 600,
                letterSpacing: isActive ? '-0.01em' : '0',
                color: isActive ? undefined : '#94a3b8',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="favorite-workspace-tab"
                  className="absolute inset-0 rounded-full"
                  style={{ background: '#0E1111' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>{page.tabLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DropzoneCard({
  card,
  uploadingKey,
  onUploadClick,
  onFileDrop,
  onDelete,
  onDownload,
}: {
  card: DossierCard
  uploadingKey: string | null
  onUploadClick: (cardKey: string) => void
  onFileDrop: (cardKey: string, file: File) => void
  onDelete: (documentId: string) => void
  onDownload: (documentId: string, filename: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const isUploading = uploadingKey === card.key
  const hasDocuments = card.documents.length > 0
  const hasApiData = card.filled && card.value !== 'LEEG'
  const GhostIcon = GHOST_ICONS[card.key] ?? BookOpen

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIsDragOver(false)
      if (event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0]
        if (file) {
          onFileDrop(card.key, file)
        }
      }
    },
    [card.key, onFileDrop],
  )

  const dragProps = {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  }

  const docFileList = (variant: 'light' | 'dark') => {
    if (!hasDocuments) return null
    const visible = card.documents.slice(0, MAX_VISIBLE_DOCS)
    const remaining = card.documents.length - MAX_VISIBLE_DOCS
    const isDark = variant === 'dark'

    return (
      <div className="space-y-0.5">
        {visible.map((document) => (
          <div key={document.id} className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDownload(document.id, document.filename)
              }}
              className={`flex-1 cursor-pointer truncate text-left text-[9px] font-medium transition-colors hover:text-amber-400 ${
                isDark ? 'text-white/50' : 'text-slate-500'
              }`}
              title={document.filename}
            >
              {document.filename}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDownload(document.id, document.filename)
              }}
              className={`shrink-0 transition-colors hover:text-amber-400 ${isDark ? 'text-white/30' : 'text-slate-300'}`}
              title="Download"
            >
              <Download className="size-3" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(document.id)
              }}
              className={`shrink-0 transition-colors hover:text-red-400 ${isDark ? 'text-white/30' : 'text-slate-300'}`}
              title="Verwijderen"
            >
              <Trash2 className="size-3" />
            </button>
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

  const uploadingIndicator = (
    <div className="mt-1 flex items-center gap-1">
      <Loader2 className="size-3 animate-spin text-amber-500" />
      <span className="text-[9px] font-black uppercase text-amber-500">Uploaden...</span>
    </div>
  )

  const addButton = (variant: 'light' | 'dark') => {
    const isDark = variant === 'dark'
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onUploadClick(card.key)
        }}
        className={`mt-1 flex items-center gap-1 text-[9px] font-bold transition-colors ${
          isDark ? 'text-white/40 hover:text-amber-400' : 'text-slate-300 hover:text-amber-400'
        }`}
      >
        <Upload className="size-2.5" />
        <span>{hasDocuments ? 'TOEVOEGEN' : 'UPLOAD'}</span>
      </button>
    )
  }

  if (hasDocuments) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onUploadClick(card.key)}
        onKeyDown={(event) => event.key === 'Enter' && onUploadClick(card.key)}
        {...dragProps}
        className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[20px] border-2 p-4 transition-all duration-300 ${
          isDragOver ? 'scale-[1.02] border-amber-500' : 'border-amber-200 hover:border-amber-400'
        } bg-amber-50`}
      >
        <div className="flex items-start justify-between gap-1">
          <p className="flex-1 truncate text-[10px] font-black uppercase tracking-[0.15em] text-amber-900/70">
            {card.label}
          </p>
          {hasApiData ? (
            <span className="shrink-0 rounded-full bg-amber-200/60 px-1.5 py-0.5 text-[8px] font-black uppercase leading-none tracking-wide text-amber-700">
              {card.value}
            </span>
          ) : (
            <span className="mt-0.5 size-2 shrink-0 rounded-full bg-amber-400" />
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-2">
          <GhostIcon className="size-8 text-amber-600 opacity-40 transition-opacity group-hover:opacity-60" strokeWidth={1.5} />
          <p className="text-sm font-black leading-none tracking-tight text-amber-900">
            {card.documents.length} {card.documents.length === 1 ? 'BESTAND' : 'BESTANDEN'}
          </p>
        </div>

        <div>
          {docFileList('light')}
          {isUploading ? uploadingIndicator : addButton('light')}
        </div>
      </div>
    )
  }

  if (hasApiData) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onUploadClick(card.key)}
        onKeyDown={(event) => event.key === 'Enter' && onUploadClick(card.key)}
        {...dragProps}
        className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[20px] border-2 p-4 transition-all duration-200 ${
          isDragOver ? 'scale-[1.02] border-amber-500 bg-amber-50/50' : 'border-emerald-200/60 bg-white hover:border-amber-400'
        }`}
      >
        <div className="flex items-start justify-between gap-1">
          <p className="flex-1 truncate text-[10px] font-black uppercase tracking-[0.15em] text-slate-900">
            {card.label}
          </p>
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-emerald-400" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-2">
          <p className="text-center text-xl font-black leading-none tracking-tighter text-slate-900">
            {card.value}
          </p>
        </div>

        <div>
          <TruncatedText text={card.sub} className="truncate text-[9px] font-medium text-slate-400" />
          {isUploading ? (
            uploadingIndicator
          ) : (
            <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Upload className="size-2.5 text-slate-300" />
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-300 transition-colors group-hover:text-amber-400">
                VOEG BIJLAGE TOE
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onUploadClick(card.key)}
      onKeyDown={(event) => event.key === 'Enter' && onUploadClick(card.key)}
      {...dragProps}
      className={`group flex cursor-pointer flex-col justify-between overflow-hidden rounded-[20px] border-2 border-dashed p-4 transition-all duration-200 ${
        isUploading
          ? 'border-amber-400 bg-amber-50/30'
          : isDragOver
            ? 'scale-[1.02] border-amber-500 bg-amber-50/50'
            : 'border-slate-200 bg-slate-50/30 hover:border-amber-400 hover:bg-amber-50/20'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="flex-1 truncate text-[10px] font-black uppercase tracking-[0.15em] text-slate-900">
          {card.label}
        </p>
        <span
          className={`mt-0.5 size-2 shrink-0 rounded-full transition-colors ${
            isUploading ? 'animate-pulse bg-amber-400' : 'bg-slate-300'
          }`}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2">
        {isUploading ? (
          <>
            <Loader2 className="size-10 animate-spin text-amber-400" strokeWidth={1.5} />
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-500">
              UPLOADEN...
            </p>
          </>
        ) : (
          <>
            <GhostIcon
              className="size-10 text-slate-900 opacity-[0.05] transition-all duration-300 group-hover:scale-110 group-hover:opacity-[0.30]"
              strokeWidth={1.5}
            />
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-300 transition-colors group-hover:text-amber-400">
              SLEEP HIER OF KLIK
            </p>
          </>
        )}
      </div>

      <div>
        <TruncatedText text={card.sub} className="truncate text-[9px] font-medium text-slate-400" />
      </div>
    </div>
  )
}

/* ── Contact Modal ───────────────────────────────────────────── */

const CONTACT_PREFERSREDUCEDMOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function WorkspaceContactModal({
  favorite,
  contactFollowUp,
  hasEigendom,
  onClose,
  onOpenMap,
}: {
  favorite: FavoriteResponse
  contactFollowUp: { title: string; detail: string }
  hasEigendom: boolean
  onClose: () => void
  onOpenMap: () => void
}) {
  const title = buildParcelTitle(favorite)
  const address = favorite.address ?? favorite.parcel_id

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address)
    toast.success('Adres gekopieerd')
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="contact-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={CONTACT_PREFERSREDUCEDMOTION ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={CONTACT_PREFERSREDUCEDMOTION ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[28px] shadow-2xl w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                Contact opnemen
              </p>
              <h3 className="mt-1 text-[18px] font-bold tracking-tight text-[#0E1111] leading-tight">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB] ml-3"
              aria-label="Sluiten"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pb-2">
            {/* Current advice */}
            <div className="rounded-[16px] border border-[#F1E1B0] bg-[#FFF8E8] px-4 py-3 mt-2">
              <p className="text-[14px] font-bold text-[#0E1111]">{contactFollowUp.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{contactFollowUp.detail}</p>
            </div>

            {/* Eigendom status */}
            <div className="mt-3 rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
                  Eigendomsinfo
                </p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  hasEigendom
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                }`}>
                  {hasEigendom ? 'Beschikbaar' : 'Nog niet opgehaald'}
                </span>
              </div>
              {!hasEigendom && (
                <p className="mt-2 text-[12px] text-slate-500">
                  Open dit perceel op de kaart en vraag BRK eigendom op om naam en contactgegevens van de eigenaar te zien.
                </p>
              )}
            </div>

            {/* Quick actions */}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleCopyAddress}
                className="flex w-full items-center gap-3 rounded-[14px] border border-[#EAEFEF] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F8FAFA]"
              >
                <Copy size={15} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0E1111]">Kopieer adres</p>
                  <p className="truncate text-[11px] text-slate-500">{address}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank')
                }}
                className="flex w-full items-center gap-3 rounded-[14px] border border-[#EAEFEF] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F8FAFA]"
              >
                <ExternalLink size={15} className="shrink-0 text-slate-400" />
                <div>
                  <p className="text-[13px] font-semibold text-[#0E1111]">Bekijk op Google Maps</p>
                  <p className="text-[11px] text-slate-500">Street View & omgeving</p>
                </div>
              </button>

              {!hasEigendom && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenMap()
                  }}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-[#EAEFEF] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F8FAFA]"
                >
                  <Phone size={15} className="shrink-0 text-slate-400" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#0E1111]">Eigendom opvragen op kaart</p>
                    <p className="text-[11px] text-slate-500">BRK eigenaar + hypotheekinfo</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-[44px] rounded-full border border-[#EAEFEF] text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
            >
              Sluiten
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

export function FavoriteParcelWorkspaceView({
  favorite,
  onBack,
  onOpenMap,
}: {
  favorite: FavoriteResponse
  onBack: () => void
  onOpenMap: () => void
}) {
  const [page, setPage] = useState(0)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeCardKeyRef = useRef<string | null>(null)

  const { accessToken } = useAuth()
  const documentsQuery = useParcelDocuments(favorite.parcel_id)
  const uploadDocument = useUploadDocument()
  const deleteDocument = useDeleteDocument()

  const rawPages = useMemo(() => buildPages(favorite), [favorite])
  const userDocs = documentsQuery.data?.documents ?? []
  const pages = useMemo(() => mergeDocuments(rawPages, userDocs), [rawPages, userDocs])
  const allCards = useMemo(() => flattenCards(pages), [pages])
  const missingCards = useMemo(() => deriveMissingCards(allCards), [allCards])
  const nextStep = useMemo(() => deriveNextStep(favorite, allCards, missingCards), [favorite, allCards, missingCards])
  const contactFollowUp = useMemo(() => deriveContactFollowUp(favorite, allCards), [favorite, allCards])
  const activityRows = useMemo(() => deriveActivityRows(favorite, userDocs, allCards), [favorite, userDocs, allCards])
  const current = (pages[page] ?? pages[0])!
  const filledCount = current.cards.filter((card) => card.filled).length

  const navigate = useNavigate()
  const generateReport = useGenerateReportFromParcel()

  const handleGenerateReport = useCallback(() => {
    // If report already exists → navigate to it
    if (favorite.has_report && favorite.report_id) {
      navigate({ to: '/rapport/$id', params: { id: favorite.report_id } })
      return
    }
    if (!favorite.parcel_cache_id) {
      toast.error('Perceel niet gekoppeld aan een scan — open het eerst op de kaart')
      return
    }
    generateReport.mutate(favorite.parcel_cache_id, {
      onSuccess: (data) => {
        toast.success('Rapport gegenereerd — je wordt doorgestuurd')
        navigate({ to: '/rapport/$id', params: { id: data.report.id } })
      },
      onError: (err) => {
        toast.error(err.message || 'Rapport genereren mislukt')
      },
    })
  }, [favorite.has_report, favorite.report_id, favorite.parcel_cache_id, generateReport, navigate])

  const [showContactModal, setShowContactModal] = useState(false)
  const [scoreModal, setScoreModal] = useState<'potentie' | 'risico' | null>(null)

  // Multi-note system
  const notesQuery = useFavoriteNotes(favorite.parcel_id)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  const handleOpenContact = useCallback(() => {
    setShowContactModal(true)
  }, [])

  const doUpload = useCallback(
    async (file: File, cardKey: string) => {
      setUploadingKey(cardKey)
      try {
        await uploadDocument.mutateAsync({
          parcelId: favorite.parcel_id,
          documentType: cardKey,
          file,
        })
        toast.success('Document toegevoegd aan workspace')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload mislukt')
      } finally {
        setUploadingKey(null)
        activeCardKeyRef.current = null
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [favorite.parcel_id, uploadDocument],
  )

  const handleUploadClick = useCallback((cardKey: string) => {
    activeCardKeyRef.current = cardKey
    fileInputRef.current?.click()
  }, [])

  const handleFileDrop = useCallback(
    async (cardKey: string, file: File) => {
      activeCardKeyRef.current = cardKey
      await doUpload(file, cardKey)
    },
    [doUpload]
  )

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      const cardKey = activeCardKeyRef.current
      if (!file || !cardKey) return
      await doUpload(file, cardKey)
    },
    [doUpload],
  )

  const handleDelete = useCallback(
    async (documentId: string) => {
      setDeletingId(documentId)
      try {
        await deleteDocument.mutateAsync({
          parcelId: favorite.parcel_id,
          documentId,
        })
        toast.success('Document verwijderd')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Verwijderen mislukt')
      } finally {
        setDeletingId(null)
      }
    },
    [deleteDocument, favorite.parcel_id],
  )

  const handleDownload = useCallback(
    async (documentId: string, filename: string) => {
      try {
        const headers: HeadersInit = {}
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`

        const response = await fetch(getDocumentDownloadUrl(favorite.parcel_id, documentId), {
          method: 'GET',
          headers,
          credentials: 'include',
        })

        if (!response.ok) throw new Error('Download mislukt')

        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = blobUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(blobUrl)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Download mislukt')
      }
    },
    [accessToken, favorite.parcel_id],
  )

  return (
    <div className="pb-8">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Portfolio workspace
            </p>

            <div className="mt-2 flex items-start gap-2 pr-6 lg:pr-12">
              <button
                type="button"
                onClick={onBack}
                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/60 backdrop-blur-sm transition-colors hover:bg-white/80"
                aria-label="Terug"
              >
                <ChevronLeft className="h-4 w-4 text-aura-ink" />
              </button>

              <div className="min-w-0 max-w-full">
                <h1 className="text-[28px] font-bold leading-tight tracking-tighter text-slate-900">
                  {buildParcelTitle(favorite)}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-[14px] leading-relaxed text-slate-500">
                    {favorite.parcel_id}
                    {favorite.gemeente_naam ? ` · ${favorite.gemeente_naam}` : ''}
                    {favorite.wijk_naam ? ` · ${favorite.wijk_naam}` : ''}
                  </p>
                  <span
                    className={`inline-flex min-h-[34px] items-center rounded-full border px-3 text-[12px] font-semibold ${stageBadgeClasses(favorite.pipeline_stage)}`}
                  >
                    {favorite.pipeline_stage}
                  </span>
                  {(favorite.potentie_score != null || favorite.risico_score != null) && (
                    <>
                      {favorite.potentie_score != null && (
                        <motion.button
                          type="button"
                          onClick={() => setScoreModal('potentie')}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.15 }}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700 cursor-pointer hover:shadow-sm transition-shadow"
                          title="Potentie score — klik voor details"
                        >
                          <svg viewBox="0 0 12 12" className="size-3">
                            <circle cx="6" cy="6" r="5" fill="none" stroke="#d1fae5" strokeWidth="2" />
                            <circle
                              cx="6" cy="6" r="5" fill="none" stroke="#22c55e" strokeWidth="2"
                              strokeDasharray={`${(favorite.potentie_score / 100) * 31.4} 31.4`}
                              strokeLinecap="round"
                              transform="rotate(-90 6 6)"
                            />
                          </svg>
                          {Math.round(favorite.potentie_score)}
                        </motion.button>
                      )}
                      {favorite.risico_score != null && (
                        <motion.button
                          type="button"
                          onClick={() => setScoreModal('risico')}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.25 }}
                          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-red-700 cursor-pointer hover:shadow-sm transition-shadow"
                          title="Risico score — klik voor details"
                        >
                          <svg viewBox="0 0 12 12" className="size-3">
                            <circle cx="6" cy="6" r="5" fill="none" stroke="#fee2e2" strokeWidth="2" />
                            <circle
                              cx="6" cy="6" r="5" fill="none" stroke="#ef4444" strokeWidth="2"
                              strokeDasharray={`${(favorite.risico_score / 100) * 31.4} 31.4`}
                              strokeLinecap="round"
                              transform="rotate(-90 6 6)"
                            />
                          </svg>
                          {Math.round(favorite.risico_score)}
                        </motion.button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start justify-end lg:shrink-0">
            <motion.button
              type="button"
              onClick={onOpenMap}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#F9A826] bg-[#F9A826] px-4 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F4B44A]"
              aria-label="Open op kaart"
              title="Open op kaart"
            >
              <MapPin size={15} />
              Open op kaart
            </motion.button>
          </div>
        </div>
      </div>

      <FavoriteDossierTabs pages={pages} activePage={page} onSelect={setPage} />

      <div className="mt-4 rounded-[32px] border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="rounded-[20px] border border-slate-100 bg-slate-50/50 px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center justify-between">
                <span className="tabular-nums text-7xl font-black leading-none tracking-tighter text-slate-900">
                  {filledCount}
                  <span className="text-2xl font-bold text-slate-300">/{current.cards.length}</span>
                </span>

                <div className="min-w-0 flex-1 px-6">
                  <p className="truncate text-xl font-bold uppercase tracking-wide text-slate-700">
                    {current.title}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">
                    {filledCount === 0
                      ? 'Sleep documenten naar de slots'
                      : `${filledCount} document${filledCount > 1 ? 'en' : ''} beschikbaar`}
                  </p>
                </div>

                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#0E1111]">
                  <current.Icon className="size-6 text-[#F9A826]" strokeWidth={2.5} />
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full rounded-full bg-amber-400"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${current.cards.length > 0 ? Math.round((filledCount / current.cards.length) * 100) : 0}%`,
                  }}
                  transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="relative mt-4">
          {documentsQuery.isLoading ? (
            <div className="rounded-[20px] border border-slate-100 bg-slate-50/50 px-6 py-10 text-[14px] text-slate-500">
              Workspace laden...
            </div>
          ) : documentsQuery.isError ? (
            <div className="rounded-[20px] border border-[#E6D1D1] bg-[#FFF5F5] px-6 py-10 text-[14px] text-[#9E3D3D]">
              {documentsQuery.error.message}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2 }}
                className="grid auto-rows-fr grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3"
              >
                {current.cards.map((card) => (
                  <DropzoneCard
                    key={card.key}
                    card={card}
                    uploadingKey={uploadingKey}
                    onUploadClick={handleUploadClick}
                    onFileDrop={handleFileDrop}
                    onDelete={(documentId) => void handleDelete(documentId)}
                    onDownload={handleDownload}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <WorkspaceInsightCard
          kicker="Werkhypothese"
          title="Notities & acquisitiethese"
          Icon={Lightbulb}
          className="xl:col-span-2"
          index={0}
        >
          <MultiNoteBlock
            parcelId={favorite.parcel_id}
            notes={notesQuery.data ?? []}
            isLoading={notesQuery.isLoading}
            createNote={createNote}
            updateNote={updateNote}
            deleteNote={deleteNote}
          />
        </WorkspaceInsightCard>

        <WorkspaceInsightCard
          kicker="Aanpak"
          title="Volgende stap"
          Icon={ClipboardCheck}
          index={1}
        >
          <div className="rounded-[20px] border border-[#F1E1B0] bg-[#FFF8E8] px-4 py-4">
            <p className="text-[16px] font-bold tracking-tight text-[#0E1111]">
              {nextStep.title}
            </p>
            <p className="mt-2 text-[14px] leading-6 text-slate-600">
              {nextStep.detail}
            </p>
            {!favorite.has_report ? (
              <motion.button
                type="button"
                onClick={handleGenerateReport}
                disabled={generateReport.isPending || !favorite.parcel_cache_id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#0E1111] bg-[#F9A826] px-5 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F4B44A] disabled:opacity-50"
              >
                <AnimatePresence mode="wait">
                  {generateReport.isPending ? (
                    <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 size={14} className="animate-spin" />
                    </motion.span>
                  ) : (
                    <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Sparkles size={14} />
                    </motion.span>
                  )}
                </AnimatePresence>
                {generateReport.isPending ? 'Rapport genereren...' : 'Genereer rapport'}
              </motion.button>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  onClick={handleGenerateReport}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-5 text-[13px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                >
                  <FileText size={14} />
                  Bekijk rapport
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleOpenContact}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#0E1111] bg-white px-5 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-slate-50"
                >
                  <Mail size={14} />
                  Neem contact op
                </motion.button>
              </div>
            )}
          </div>
        </WorkspaceInsightCard>

        <WorkspaceInsightCard
          kicker="Tijdlijn"
          title="Laatste activiteit"
          Icon={ScrollText}
          index={2}
        >
          <div className="space-y-2">
            {activityRows.map((row, i) => (
              <motion.div
                key={row.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="rounded-[18px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
                  {row.label}
                </p>
                <p className="mt-1 text-[14px] leading-6 text-slate-700">
                  {row.value}
                </p>
              </motion.div>
            ))}
          </div>
        </WorkspaceInsightCard>

        <WorkspaceInsightCard
          kicker="Opvolging"
          title="Contact & eigenaar vervolg"
          Icon={Send}
          index={3}
        >
          <div className="rounded-[20px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-4">
            <p className="text-[16px] font-bold tracking-tight text-[#0E1111]">
              {contactFollowUp.title}
            </p>
            <p className="mt-2 text-[14px] leading-6 text-slate-600">
              {contactFollowUp.detail}
            </p>
            <motion.button
              type="button"
              onClick={handleOpenContact}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#0E1111] bg-white px-5 text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-slate-50"
            >
              <Mail size={14} />
              Neem contact op
            </motion.button>
          </div>
        </WorkspaceInsightCard>
      </div>

      {showContactModal && (
        <WorkspaceContactModal
          favorite={favorite}
          contactFollowUp={contactFollowUp}
          hasEigendom={allCards.some((c) => c.key === 'eigendom' && c.filled)}
          onClose={() => setShowContactModal(false)}
          onOpenMap={() => {
            setShowContactModal(false)
            onOpenMap()
          }}
        />
      )}

      <PotentieModal
        open={scoreModal === 'potentie'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={favorite.parcel_cache_id}
      />
      <RisicoModal
        open={scoreModal === 'risico'}
        onClose={() => setScoreModal(null)}
        parcelCacheId={favorite.parcel_cache_id}
      />
    </div>
  )
}
