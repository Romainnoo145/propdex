/**
 * Cockpit dossier-page builders. Extracted from FavoriteParcelWorkspaceView.tsx
 * 2026-05-19 (Plan 08-06 split, M050/S06 cont.).
 *
 * Pure helpers: page builders, document merging, card flattening. No React imports.
 */
import {
  Banknote,
  BoxSelect,
  BrainCircuit,
  ClipboardCheck,
  Columns,
  DraftingCompass,
  Factory,
  FileText,
  FileUp,
  FlaskConical,
  FolderArchive,
  FolderOpen,
  Gauge,
  Gavel,
  Hammer,
  Hourglass,
  KeySquare,
  Landmark,
  LandPlot,
  Layers,
  Leaf,
  Lightbulb,
  Mail,
  Map as MapIcon,
  MapPin,
  MapPinned,
  Scale,
  ScrollText,
  Send,
  ShieldAlert,
  Shovel,
  Sparkles,
  TreePine,
  Users,
  Volume2,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ParcelDocumentMeta } from '@/lib/types/document'
import type { FavoriteResponse } from '@/lib/types/portfolio'

export interface DossierCard {
  key: string
  label: string
  Icon: LucideIcon
  value: string
  sub: string
  filled: boolean
  documents: ParcelDocumentMeta[]
}

export interface DossierPage {
  title: string
  tabLabel: string
  Icon: LucideIcon
  cards: DossierCard[]
}

export interface DossierCardWithContext extends DossierCard {
  pageTitle: string
  tabLabel: string
}

export const REQUIRED_CARD_PRIORITY = [
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

export const GHOST_ICONS: Record<string, LucideIcon> = {
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

function buildNotitiesPage(): DossierPage {
  return {
    title: 'PROJECTNOTITIES',
    tabLabel: 'Notities',
    Icon: Lightbulb,
    cards: [
      { key: 'documenten', label: 'DOCUMENTEN', Icon: FileUp, value: 'LEEG', sub: 'Eigen uploads & bijlagen', filled: false, documents: [] },
      { key: 'correspondentie', label: 'CORRESPONDENTIE', Icon: Mail, value: 'LEEG', sub: 'E-mail & communicatie', filled: false, documents: [] },
      { key: 'ideeen', label: 'IDEEEN', Icon: Lightbulb, value: 'LEEG', sub: 'Concepten & aantekeningen', filled: false, documents: [] },
      { key: 'checklist', label: 'CHECKLISTS', Icon: ClipboardCheck, value: 'LEEG', sub: 'Vergunning checklists', filled: false, documents: [] },
    ],
  }
}

function buildAcquisitiePage(favorite: FavoriteResponse): DossierPage {
  const hasAddress = Boolean(favorite.address)
  return {
    title: 'ACQUISITIE DOSSIER',
    tabLabel: 'Acquisitie',
    Icon: FolderOpen,
    cards: [
      { key: 'bestemmingscheck', label: 'BESTEMMINGSCHECK', Icon: ClipboardCheck, value: 'LEEG', sub: 'Haalbaarheid bestemming', filled: false, documents: [] },
      {
        key: 'perceeldata',
        label: 'PERCEELDATA',
        Icon: MapPin,
        value: hasAddress ? 'BESCHIKBAAR' : 'LEEG',
        sub: hasAddress ? 'Adres en perceelbasis bekend' : 'Kadaster & BAG gegevens',
        filled: hasAddress,
        documents: [],
      },
      { key: 'vergunninghistorie', label: 'VERGUNNINGEN', Icon: ScrollText, value: 'GEEN', sub: 'Bekendmakingen & aanvragen', filled: false, documents: [] },
      { key: 'woz', label: 'WOZ', Icon: Banknote, value: 'LEEG', sub: 'WOZ-waardebeschikking', filled: false, documents: [] },
      { key: 'quickscan', label: 'QUICKSCAN', Icon: Sparkles, value: 'LEEG', sub: 'AI-gegenereerd rapport', filled: false, documents: [] },
    ],
  }
}

function buildTechnischPage(): DossierPage {
  return {
    title: 'TECHNISCH DOSSIER',
    tabLabel: 'Technisch',
    Icon: Hammer,
    cards: [
      { key: 'bodem', label: 'BODEMONDERZOEK', Icon: FlaskConical, value: 'LEEG', sub: 'Verkennend / nader onderzoek', filled: false, documents: [] },
      { key: 'fundering', label: 'FUNDERING', Icon: Shovel, value: 'LEEG', sub: 'Constructieve staat funderingen', filled: false, documents: [] },
      { key: 'asbest', label: 'ASBEST', Icon: ShieldAlert, value: 'LEEG', sub: 'Inventarisatie Type A / B', filled: false, documents: [] },
      { key: 'bouwkundig', label: 'BOUWKUNDIG', Icon: FileText, value: 'LEEG', sub: 'Staat van het gebouw', filled: false, documents: [] },
      { key: 'energielabel', label: 'ENERGIELABEL', Icon: Leaf, value: 'LEEG', sub: 'Duurzaamheidsstatus', filled: false, documents: [] },
    ],
  }
}

function buildJuridischPage(favorite: FavoriteResponse): DossierPage {
  const hasKadaster = Boolean(favorite.parcel_id)
  return {
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
      { key: 'eigendom', label: 'EIGENDOM', Icon: Users, value: 'LEEG', sub: 'BRK eigendomsinformatie', filled: false, documents: [] },
      { key: 'erfpacht', label: 'ERFPACHT', Icon: Scale, value: 'LEEG', sub: 'Erfpachtvoorwaarden', filled: false, documents: [] },
    ],
  }
}

function buildPlanologischPage(): DossierPage {
  return {
    title: 'PLANOLOGISCH DOSSIER',
    tabLabel: 'Planologisch',
    Icon: Landmark,
    cards: [
      { key: 'bestemmingsplan', label: 'BESTEMMINGSPLAN', Icon: MapIcon, value: 'LEEG', sub: 'Officieel bestemmingsplan', filled: false, documents: [] },
      { key: 'milieuzones', label: 'MILIEUZONES', Icon: TreePine, value: 'LEEG', sub: 'Natura 2000, beschermd gebied', filled: false, documents: [] },
      { key: 'geluid', label: 'GELUID', Icon: Volume2, value: 'LEEG', sub: 'Geluidsbelasting Lden', filled: false, documents: [] },
      { key: 'stikstof', label: 'STIKSTOF', Icon: Leaf, value: 'LEEG', sub: 'AERIUS berekening', filled: false, documents: [] },
    ],
  }
}

export function buildPages(favorite: FavoriteResponse): DossierPage[] {
  return [
    buildNotitiesPage(),
    buildAcquisitiePage(favorite),
    buildTechnischPage(),
    buildJuridischPage(favorite),
    buildPlanologischPage(),
  ]
}

export function mergeDocuments(pages: DossierPage[], documents: ParcelDocumentMeta[]): DossierPage[] {
  // Collect all known card keys to detect unmapped document types
  const knownKeys = new Set(pages.flatMap((p) => p.cards.map((c) => c.key)))

  const byType: Record<string, ParcelDocumentMeta[]> = {}
  for (const document of documents) {
    // Unmapped document types fall back to 'documenten' (Notities catch-all)
    const key = knownKeys.has(document.document_type) ? document.document_type : 'documenten'
    const existing = byType[key] ?? []
    existing.push(document)
    byType[key] = existing
  }

  return pages.map((page) => ({
    ...page,
    cards: page.cards.map((card) => {
      const cardDocuments = byType[card.key] ?? []
      if (cardDocuments.length === 0) return card
      return {
        ...card,
        filled: true,
        value:
          card.value === 'LEEG'
            ? `${cardDocuments.length} BESTAND${cardDocuments.length > 1 ? 'EN' : ''}`
            : card.value,
        documents: cardDocuments,
      }
    }),
  }))
}

export function flattenCards(pages: DossierPage[]): DossierCardWithContext[] {
  return pages.flatMap((page) =>
    page.cards.map((card) => ({
      ...card,
      pageTitle: page.title,
      tabLabel: page.tabLabel,
    })),
  )
}
