/**
 * Configuratie (Beleid) — multi-level policy configuration hub.
 *
 * Main page: Three accordion-style level cards (Landelijk / Provinciaal / Gemeentelijk).
 * Expanding Gemeentelijk shows compact gemeente grid (wijk-size cards).
 * Clicking a gemeente navigates to rapport-style detail view.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import {
  ChevronDown,
  Landmark,
  Building2,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Shield,
  Scale,
  Home,
  Bell,
  Banknote,
  FileText,
  Eye,
  TreePine,
  Car,
  Leaf,
  DoorOpen,
  Church,
  Newspaper,
  Upload,
  FileCheck,
  Loader2,
  Check,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import ResultsShell from '@/components/layout/ResultsShell'
import { PDFViewerModal } from '@/components/ui/PDFViewerModal'
import { type SubsidieNiveau } from '@/lib/subsidies/curatedSubsidies'
import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'
import { useGemeenteProfile, SEVERITY_COLORS, type GemeenteProfile } from '@/hooks/useGemeenteProfile'
import { useRaadsinformatie, type RaadsinformatieResponse } from '@/hooks/useRaadsinformatie'
import { useHuisvestingsverordening, type HuisvestingsverordeningResponse } from '@/hooks/useHuisvestingsverordening'
import { useErfgoed, type ErfgoedResponse } from '@/hooks/useErfgoed'
import { useProvincieGeoJSON } from '@/hooks/useProvincieGeoJSON'
import { usePolicyDocuments, useUploadPolicyDocument, parseAiSummary, type PolicyDocument, type DocumentSummary } from '@/hooks/usePolicyDocuments'
import { geoJsonToSvgPath } from '@/lib/geo-utils'

import type { LucideIcon } from 'lucide-react'

/* ─── Gemeente intelligence data shape ──────────────────────── */

interface GemeenteIntelligenceData {
  profile: { data?: GemeenteProfile; isLoading: boolean; error: Error | null }
  raadsinformatie: { data?: RaadsinformatieResponse; isLoading: boolean; error: Error | null }
  huisvestingsverordening: { data?: HuisvestingsverordeningResponse; isLoading: boolean; error: Error | null }
  erfgoed: { data?: ErfgoedResponse; isLoading: boolean; error: Error | null }
}

/* ─── Route ─────────────────────────────────────────────────── */

export const Route = createFileRoute('/_authenticated/configuratie')({
  validateSearch: (search: Record<string, unknown>) => ({
    gemeente: typeof search.gemeente === 'string' && /^GM\d{4}$/.test(search.gemeente)
      ? (search.gemeente as string)
      : undefined,
    provincie: typeof search.provincie === 'string' && /^PV\d{2}$/.test(search.provincie)
      ? (search.provincie as string)
      : undefined,
    source: typeof search.source === 'string' ? (search.source as string) : undefined,
  }),
  component: ConfiguratiePage,
})

/* ─── Niveau config ─────────────────────────────────────────── */

interface NiveauConfig {
  key: SubsidieNiveau
  label: string
  icon: LucideIcon
  description: string
}

const NIVEAU_CONFIGS: NiveauConfig[] = [
  {
    key: 'landelijk',
    label: 'Landelijk (Rijksoverheid)',
    icon: Landmark,
    description: 'Rijkssubsidies, nationale regelgeving en RVO-instrumenten',
  },
  {
    key: 'provinciaal',
    label: 'Provinciaal',
    icon: Building2,
    description: '12 provincies — regionaal beleid, subsidies en verordeningen',
  },
  {
    key: 'gemeentelijk',
    label: 'Gemeentelijk',
    icon: MapPin,
    description: '342 gemeenten — lokaal beleid, vergunningklimaat en databronnen',
  },
]

/* ─── Gemeente data source catalog ──────────────────────────── */

/* ─── Shared data source type ───────────────────────────────── */

type DataSourceCategory = 'ruimtelijk' | 'juridisch' | 'financieel' | 'duurzaamheid' | 'monitoring'

interface DataSource {
  key: string
  label: string
  category: DataSourceCategory
  status: 'live' | 'roadmap'
  icon: LucideIcon
  description: string
}

const CATEGORY_CONFIG: { key: DataSourceCategory; label: string }[] = [
  { key: 'ruimtelijk', label: 'Ruimtelijk' },
  { key: 'juridisch', label: 'Juridisch' },
  { key: 'financieel', label: 'Financieel' },
  { key: 'duurzaamheid', label: 'Duurzaamheid' },
  { key: 'monitoring', label: 'Monitoring' },
]

/* ─── Gemeente data source catalog ──────────────────────────── */

const GEMEENTE_DATA_SOURCES: DataSource[] = [
  // Ruimtelijk
  { key: 'omgevingsvisie', label: 'Omgevingsvisie', category: 'ruimtelijk', status: 'roadmap', icon: TreePine, description: 'Langetermijnvisie op de leefomgeving — ontwikkelrichting, verdichtingsgebieden.' },
  { key: 'welstandsnota', label: 'Welstandsnota', category: 'ruimtelijk', status: 'roadmap', icon: Eye, description: 'Welstandseisen per gebied: materiaalgebruik, kleurschema, bouwhoogte.' },
  { key: 'woonvisie', label: 'Woonvisie', category: 'ruimtelijk', status: 'roadmap', icon: Home, description: 'Woningbouwprogramma: aantallen per segment, doelgroepen, prioriteitsgebieden.' },
  { key: 'parkeerbeleid', label: 'Parkeerbeleid', category: 'ruimtelijk', status: 'roadmap', icon: Car, description: 'Parkeernormen per woningtype en stedelijkheidszone.' },
  { key: 'huisvestingsverordening', label: 'Huisvestingsverordening', category: 'ruimtelijk', status: 'live', icon: Home, description: 'Regels voor woningvorming, splitsing en onttrekking.' },
  // Juridisch
  { key: 'vergunning-klimaat', label: 'Vergunning-klimaat', category: 'juridisch', status: 'live', icon: Shield, description: 'Vergunningsaanvragen en besluiten — tempo, goedkeuringspercentage en trends.' },
  { key: 'jurisprudentie', label: 'Jurisprudentie & AI-analyse', category: 'juridisch', status: 'live', icon: Scale, description: 'Relevante rechtszaken met AI-analyse van uitspraken.' },
  { key: 'raadsinformatie', label: 'Raadsinformatie', category: 'juridisch', status: 'live', icon: Building2, description: 'Gemeenteraadsvergaderingen, moties en besluiten over ruimtelijke ordening.' },
  { key: 'leegstandsverordening', label: 'Leegstandsverordening', category: 'juridisch', status: 'roadmap', icon: DoorOpen, description: 'Regels voor leegstandsmeldplicht — indicator voor transformatiekansen.' },
  // Financieel
  { key: 'gemeentelijke-subsidies', label: 'Gemeentelijke subsidies', category: 'financieel', status: 'roadmap', icon: Banknote, description: 'Gemeente-specifieke subsidies voor woningbouw en verduurzaming.' },
  { key: 'grondprijsbeleid', label: 'Grondprijsbeleid', category: 'financieel', status: 'roadmap', icon: FileText, description: 'Gemeentelijke grondprijzen per bestemming uit de grondprijzenbrief.' },
  // Duurzaamheid
  { key: 'duurzaamheidsbeleid', label: 'Duurzaamheidsbeleid', category: 'duurzaamheid', status: 'roadmap', icon: Leaf, description: 'Aanvullende duurzaamheidseisen: gasloos, BENG, groene daken.' },
  { key: 'beschermd-erfgoed', label: 'Beschermd erfgoed', category: 'duurzaamheid', status: 'live', icon: Landmark, description: 'Rijksmonumenten en beschermde stadsgezichten via het RCE-register.' },
  { key: 'erfgoedverordening', label: 'Erfgoedverordening', category: 'duurzaamheid', status: 'roadmap', icon: Church, description: 'Lokale gemeentelijke monumenten — eigen beschermingsregime.' },
  // Monitoring
  { key: 'bekendmakingen', label: 'Bekendmakingen monitoring', category: 'monitoring', status: 'live', icon: Bell, description: 'Automatische monitoring van officiële bekendmakingen.' },
  { key: 'nieuws-monitoring', label: 'Nieuws & beleidsmonitoring', category: 'monitoring', status: 'roadmap', icon: Newspaper, description: 'Automatische signalering van beleidswijzigingen en raadsbesluiten.' },
]

/* ─── Province data source catalog ──────────────────────────── */

const PROVINCIE_DATA_SOURCES: DataSource[] = [
  // Ruimtelijk
  { key: 'omgevingsverordening', label: 'Omgevingsverordening', category: 'ruimtelijk', status: 'roadmap', icon: FileText, description: 'Provinciale regels voor ruimtegebruik, bouwhoogtes, beschermde gebieden.' },
  { key: 'ruimtelijke-visie', label: 'Provinciale omgevingsvisie', category: 'ruimtelijk', status: 'roadmap', icon: TreePine, description: 'Langetermijnvisie op ruimtelijke ontwikkeling, verstedelijking en landschap.' },
  { key: 'woondeals', label: 'Woondeals & woningbouwafspraken', category: 'ruimtelijk', status: 'roadmap', icon: Home, description: 'Afspraken over woningbouwaantallen en versnellingslocaties per regio.' },
  // Financieel
  { key: 'provinciale-subsidies', label: 'Provinciale subsidies', category: 'financieel', status: 'roadmap', icon: Banknote, description: 'Subsidies voor verduurzaming, transformatie en woningbouw vanuit de provincie.' },
  // Duurzaamheid
  { key: 'natuur-stikstof', label: 'Natuur & stikstof', category: 'duurzaamheid', status: 'roadmap', icon: Leaf, description: 'Natura 2000, stikstofbeleid en beperkingen voor bouw nabij natuurgebieden.' },
  { key: 'erfgoed-provinciaal', label: 'Provinciaal erfgoed', category: 'duurzaamheid', status: 'roadmap', icon: Church, description: 'Provinciale monumentenlijst en cultuurhistorische waardenkaart.' },
  { key: 'energie-transitie', label: 'Energietransitie', category: 'duurzaamheid', status: 'roadmap', icon: Leaf, description: 'Regionale energiestrategie (RES), zoekgebieden wind/zon, warmtenetten.' },
  // Monitoring
  { key: 'mobiliteit', label: 'Mobiliteitsbeleid', category: 'monitoring', status: 'roadmap', icon: Car, description: 'OV-knooppunten, bereikbaarheid en mobiliteitstransitie per regio.' },
]

/* ─── Landelijk data source catalog ─────────────────────────── */

const LANDELIJK_DATA_SOURCES: DataSource[] = [
  // Ruimtelijk
  { key: 'omgevingswet', label: 'Omgevingswet & Bbl', category: 'ruimtelijk', status: 'live', icon: FileText, description: 'Bouwbesluit, vergunningvrij bouwen, procedures onder de Omgevingswet.' },
  { key: 'ladder-verstedelijking', label: 'Ladder duurzame verstedelijking', category: 'ruimtelijk', status: 'roadmap', icon: TreePine, description: 'Verplichte onderbouwing bij nieuwe woningbouwplannen buiten bestaand stedelijk gebied.' },
  { key: 'nationale-woonagenda', label: 'Nationale Woonagenda', category: 'ruimtelijk', status: 'roadmap', icon: Home, description: 'Volkshuisvestingsprogramma, woningbouwtargets en versnellingsafspraken.' },
  // Juridisch
  { key: 'woningwet', label: 'Woningwet & corporatieregels', category: 'juridisch', status: 'roadmap', icon: Scale, description: 'Regels voor sociale huur, DAEB/niet-DAEB scheiding, markttoets.' },
  { key: 'asbest-sloop', label: 'Asbest & sloopregels', category: 'juridisch', status: 'roadmap', icon: Shield, description: 'Inventarisatieplicht, saneringsregels bij renovatie en transformatie.' },
  // Financieel
  { key: 'rvo-subsidies', label: 'RVO subsidies & financiering', category: 'financieel', status: 'live', icon: Banknote, description: 'Woningbouwimpuls, SSEB, volkshuisvestingsfonds en andere rijkssubsidies via RVO.' },
  // Duurzaamheid
  { key: 'beng-energieprestatie', label: 'BENG & energieprestatie', category: 'duurzaamheid', status: 'roadmap', icon: Leaf, description: 'Eisen nieuwbouw energieprestatie, energielabel verplichting, EPBD-richtlijn.' },
  { key: 'stikstof-nationaal', label: 'Stikstof & Natura 2000', category: 'duurzaamheid', status: 'roadmap', icon: TreePine, description: 'PAS-melding, AERIUS-berekening, bouwvrijstelling status en procedures.' },
  // Monitoring
  { key: 'rijksbeleid-monitoring', label: 'Rijksbeleid monitoring', category: 'monitoring', status: 'roadmap', icon: Bell, description: 'Automatische signalering van wijzigingen in nationale wet- en regelgeving.' },
]

/* ─── Processed types ───────────────────────────────────────── */

interface ProcessedProvincie {
  provinciecode: string
  provincienaam: string
  svgData: { primaryD: string; viewBox: string }
}

/* ─── Processed gemeente type ───────────────────────────────── */

interface ProcessedGemeente {
  gemeentecode: string
  gemeentenaam: string
  svgData: { primaryD: string; viewBox: string }
}

/* ─── Accordion card ────────────────────────────────────────── */

interface AccordionLevelCardProps {
  config: NiveauConfig
  count: number | string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function AccordionLevelCard({ config, count, isOpen, onToggle, children }: AccordionLevelCardProps) {
  const Icon = config.icon
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white overflow-hidden transition-shadow hover:shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#FAFCFB]"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0E1111]">
          <Icon size={18} strokeWidth={1.5} className="text-[#F9A826]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-[#0E1111]">{config.label}</h3>
          <p className="text-[12px] text-slate-500 leading-snug mt-0.5">{config.description}</p>
        </div>
        <span className="text-[13px] font-bold text-slate-400 tabular-nums shrink-0">{count}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown size={18} className="text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#EAEFEF] px-5 py-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Data source insight card (expandable) ─────────────────── */

interface DataSourceCardProps {
  source: DataSource
  entityType?: string
  entityCode?: string
  gemeenteData?: GemeenteIntelligenceData
  gemeenteCode?: string
}

/** Returns { isLoading, error, metrics } for a live source based on its key and gemeente data. */
function getLiveMetrics(
  sourceKey: string,
  gemeenteData?: GemeenteIntelligenceData,
): { isLoading: boolean; error: boolean; metrics: React.ReactNode | null } {
  if (!gemeenteData) return { isLoading: false, error: false, metrics: null }

  switch (sourceKey) {
    case 'vergunning-klimaat': {
      const { data, isLoading, error } = gemeenteData.profile
      if (isLoading) return { isLoading: true, error: false, metrics: null }
      if (error || !data) return { isLoading: false, error: true, metrics: null }
      const rate = data.approval_rate_pct != null ? `${data.approval_rate_pct}%` : '—'
      const severityColor = SEVERITY_COLORS[data.severity_label] ?? SEVERITY_COLORS['Onbekend']
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            <span className="font-bold text-[#0E1111]">{rate}</span>{' goedgekeurd · '}
            <span className="font-bold text-[#0E1111]">{data.bekendmakingen_30d}</span>{' recent · '}
            <span style={{ color: severityColor }} className="font-bold">{data.severity_label}</span>
          </>
        ),
      }
    }
    case 'jurisprudentie': {
      const { data, isLoading, error } = gemeenteData.profile
      if (isLoading) return { isLoading: true, error: false, metrics: null }
      if (error || !data) return { isLoading: false, error: true, metrics: null }
      const doorlooptijd = data.avg_doorlooptijd_days != null ? `${data.avg_doorlooptijd_days}d` : '—'
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            {'Doorlooptijd: '}<span className="font-bold text-[#0E1111]">{doorlooptijd}</span>
            {' · '}<span className="font-bold text-[#0E1111]">{data.sample_size}</span>{' zaken'}
          </>
        ),
      }
    }
    case 'bekendmakingen': {
      const { data, isLoading, error } = gemeenteData.profile
      if (isLoading) return { isLoading: true, error: false, metrics: null }
      if (error || !data) return { isLoading: false, error: true, metrics: null }
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            <span className="font-bold text-[#0E1111]">{data.bekendmakingen_30d}</span>{' (30d) · '}
            <span className="font-bold text-[#0E1111]">{data.bekendmakingen_90d}</span>{' (90d)'}
          </>
        ),
      }
    }
    case 'raadsinformatie': {
      const { data, isLoading, error } = gemeenteData.raadsinformatie
      if (isLoading) return { isLoading: true, error: false, metrics: null }
      if (error || !data) return { isLoading: false, error: true, metrics: null }
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            <span className="font-bold text-[#0E1111]">{data.total_found}</span>{' stukken · '}
            {data.dekking ? (
              <span className="font-bold text-emerald-600">Gedekt</span>
            ) : (
              <span className="font-bold text-slate-400">Geen dekking</span>
            )}
          </>
        ),
      }
    }
    case 'huisvestingsverordening': {
      const { data, isLoading, error } = gemeenteData.huisvestingsverordening
      if (isLoading) return { isLoading: true, error: false, metrics: null }
      if (error || !data) return { isLoading: false, error: true, metrics: null }
      return {
        isLoading: false,
        error: false,
        metrics: data.heeft_verordening ? (
          <span className="font-bold text-[#0E1111]">{data.title ?? 'Verordening gevonden'}</span>
        ) : (
          <span className="text-slate-400">Geen verordening gevonden</span>
        ),
      }
    }
    case 'beschermd-erfgoed': {
      const { data, isLoading, error } = gemeenteData.erfgoed
      if (isLoading) return { isLoading: true, error: false, metrics: null }
      if (error || !data) return { isLoading: false, error: true, metrics: null }
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            <span className="font-bold text-[#0E1111]">{data.total}</span>{' beschermde gezichten'}
          </>
        ),
      }
    }
    default:
      return { isLoading: false, error: false, metrics: null }
  }
}

function DataSourceCard({ source, entityType, entityCode, gemeenteData, gemeenteCode }: DataSourceCardProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null)
  const [polling, setPolling] = useState(false)
  const Icon = source.icon
  const isLive = source.status === 'live'
  const uploadMutation = useUploadPolicyDocument()

  const { data: docsData } = usePolicyDocuments(
    entityType ?? '',
    entityCode ?? '',
    source.key,
    !!entityType && !!entityCode,
    polling ? 3000 : false,
  )
  const docCount = docsData?.total ?? 0
  const isComplete = isLive || docCount > 0

  // AI summary state derived from documents
  const firstDoc = docsData?.documents?.[0]
  const isAnyParsing = docsData?.documents?.some(d => d.status === 'parsing') ?? false
  const isAnyError = docsData?.documents?.some(d => d.status === 'error') ?? false
  const aiSummary = firstDoc ? parseAiSummary(firstDoc.ai_summary) : null

  // Toggle polling when parsing status changes
  useEffect(() => {
    setPolling(isAnyParsing)
  }, [isAnyParsing])

  const handleUpload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!entityType || !entityCode) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.docx,.xlsx,.jpg,.jpeg,.png'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      uploadMutation.mutate({ entityType, entityCode, sourceKey: source.key, file })
    }
    input.click()
  }, [entityType, entityCode, source.key, uploadMutation])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (!entityType || !entityCode) return
    const file = e.dataTransfer.files[0]
    if (!file) return
    uploadMutation.mutate({ entityType, entityCode, sourceKey: source.key, file })
  }, [entityType, entityCode, source.key, uploadMutation])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleView = useCallback((e: React.MouseEvent, docId: string, filename?: string) => {
    e.stopPropagation()
    if (!entityType || !entityCode) return
    setPdfViewer({
      url: `/api/policy-documents/${entityType}/${entityCode}/${docId}`,
      title: filename || 'Beleidsdocument',
    })
  }, [entityType, entityCode])

  return (
    <motion.div
      layout
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`rounded-[24px] border bg-white transition-all cursor-pointer ${
        isDragging
          ? 'border-[#F9A826] border-dashed bg-[#FFF8EC] shadow-md scale-[1.02]'
          : isComplete
            ? 'border-emerald-200 hover:shadow-md'
            : 'border-[#EAEFEF] hover:shadow-md'
      }`}
      onClick={() => setIsOpen((v) => !v)}
    >
      {/* Card header — taller with more breathing room */}
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          {/* Kicker with status */}
          <div className="flex items-center gap-2">
            <div className={`size-1.5 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${
              isComplete ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              {isLive ? 'Actief' : docCount > 0 ? 'Geconfigureerd' : 'Te configureren'}
            </p>
          </div>
          {/* Title */}
          <h3 className="mt-2 text-[16px] font-bold tracking-tight text-[#0E1111] leading-snug">
            {source.label}
          </h3>
          {/* Short description always visible */}
          <p className="mt-1 text-[11px] text-slate-400 leading-snug line-clamp-2">
            {source.description}
          </p>
        </div>
        {/* Icon + details button */}
        <div className="flex items-center gap-2 shrink-0">
          {gemeenteCode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate({ to: '/configuratie', search: { gemeente: gemeenteCode, source: source.key } })
              }}
              className="flex items-center gap-1 rounded-full border border-[#EAEFEF] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 transition-colors hover:border-[#0E1111] hover:text-[#0E1111]"
              title="Bekijk details"
            >
              Bekijk details
              <ArrowRight size={11} />
            </button>
          )}
          <div className="relative">
            <div className={`flex size-11 items-center justify-center rounded-full ${
              isComplete ? 'bg-emerald-600' : 'bg-[#0E1111]'
            }`}>
              <Icon className="size-5 text-[#F9A826]" strokeWidth={2} />
            </div>
          {isAnyParsing && (
            <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-amber-400 ring-2 ring-white">
              <Loader2 className="animate-spin text-white" size={10} />
            </span>
          )}
          {!isAnyParsing && aiSummary && (
            <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-violet-500 ring-2 ring-white">
              <Sparkles className="text-white" size={9} />
            </span>
          )}
          {!isAnyParsing && !aiSummary && isAnyError && (
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-red-500 ring-2 ring-white" />
          )}
          </div>
        </div>
      </div>

      {/* Collapsed footer: doc badges + live metrics */}
      {!isOpen && (docCount > 0 || isLive) && (() => {
        const liveMetrics = isLive ? getLiveMetrics(source.key, gemeenteData) : null
        return (
          <div className="px-5 pb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {docCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 shrink-0">
                  <FileCheck size={11} />
                  {docCount} doc{docCount !== 1 ? 's' : ''}
                </span>
              )}
              {/* AI parsing status indicators */}
              {isAnyParsing && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600 shrink-0">
                  <Loader2 className="animate-spin" size={11} />
                  AI analyseert...
                </span>
              )}
              {!isAnyParsing && isAnyError && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600 shrink-0">
                  <AlertCircle size={11} />
                  Fout bij analyse
                </span>
              )}
              {!isAnyParsing && !isAnyError && aiSummary && (
                <>
                  <span className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
                    {aiSummary.summary}
                  </span>
                  {aiSummary.key_facts.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-600 shrink-0">
                      <Sparkles size={11} />
                      {aiSummary.key_facts.length} feit{aiSummary.key_facts.length !== 1 ? 'en' : ''}
                    </span>
                  )}
                </>
              )}
              {/* Live source metrics */}
              {isLive && liveMetrics?.isLoading && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <Loader2 className="animate-spin" size={12} />
                  Laden...
                </span>
              )}
              {isLive && liveMetrics?.error && (
                <span className="text-[11px] text-slate-400 font-medium">
                  Data niet beschikbaar
                </span>
              )}
              {isLive && liveMetrics?.metrics && (
                <span className="text-[11px] text-slate-500 font-medium truncate">
                  {liveMetrics.metrics}
                </span>
              )}
            </div>
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 shrink-0">
                <Check size={11} strokeWidth={3} />
                Auto-sync
              </span>
            )}
          </div>
        )
      })()}

      {/* Drag hint when no docs yet and not expanded */}
      {!isOpen && !isLive && docCount === 0 && entityType && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-slate-300 italic">Sleep een document hierheen</p>
        </div>
      )}

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#EAEFEF] px-5 py-4 space-y-3">
              {/* AI Summary section */}
              {isAnyParsing && (
                <div className="rounded-[14px] bg-amber-50/60 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin text-amber-500" size={14} />
                    <p className="text-[11px] font-bold text-amber-700">AI analyse bezig...</p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-amber-200/60 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-amber-200/60 animate-pulse" />
                  </div>
                </div>
              )}
              {!isAnyParsing && isAnyError && firstDoc?.ai_summary && (
                <div className="rounded-[14px] bg-red-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="text-red-500 shrink-0" size={14} />
                    <p className="text-[11px] font-bold text-red-700">Analyse mislukt</p>
                  </div>
                  <p className="mt-1 text-[11px] text-red-600">
                    {(() => {
                      try {
                        const parsed = JSON.parse(firstDoc.ai_summary!)
                        return parsed.error ?? 'Onbekende fout bij AI-analyse'
                      } catch {
                        return 'Onbekende fout bij AI-analyse'
                      }
                    })()}
                  </p>
                </div>
              )}
              {!isAnyParsing && aiSummary && (
                <div className="rounded-[14px] bg-violet-50/60 px-4 py-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-violet-500" size={14} />
                    <p className="text-[11px] font-bold text-violet-700">AI Samenvatting</p>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{aiSummary.summary}</p>
                  {aiSummary.key_facts.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Kernfeiten</p>
                      <ul className="space-y-0.5">
                        {aiSummary.key_facts.map((fact, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                            <span className="mt-1 size-1 rounded-full bg-violet-400 shrink-0" />
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Object.keys(aiSummary.extracted_values).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Waarden</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {Object.entries(aiSummary.extracted_values).map(([key, value]) => (
                          <div key={key} className="flex items-baseline gap-1 text-[11px]">
                            <span className="text-slate-400 truncate">{key}:</span>
                            <span className="font-semibold text-[#0E1111] truncate">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Documents list with view buttons */}
              {docCount > 0 && docsData?.documents && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Documenten</p>
                  {docsData.documents.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 rounded-[12px] bg-[#F2F6F3] px-3 py-2"
                    >
                      <FileCheck size={13} className="text-emerald-500 shrink-0" />
                      <span className="text-[11px] font-medium text-[#0E1111] truncate flex-1">{doc.filename}</span>
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                        {doc.file_size >= 1024 * 1024
                          ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB`
                          : `${(doc.file_size / 1024).toFixed(0)} KB`}
                      </span>
                      {/* View button */}
                      <button
                        onClick={(e) => handleView(e, doc.id, doc.filename)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white border border-[#EAEFEF] text-slate-400 transition-colors hover:border-[#0E1111] hover:text-[#0E1111]"
                        title="Bekijken"
                      >
                        <Eye size={13} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Drop zone / upload area */}
              {entityType && entityCode && !isLive && (
                <div
                  className={`rounded-[14px] border-2 border-dashed p-4 text-center transition-colors ${
                    isDragging ? 'border-[#F9A826] bg-[#FFF8EC]' : 'border-[#EAEFEF] hover:border-slate-300'
                  }`}
                  onClick={handleUpload}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 size={20} className="mx-auto animate-spin text-[#F9A826]" />
                  ) : (
                    <>
                      <Upload size={20} className="mx-auto text-slate-300" />
                      <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
                        {docCount > 0 ? 'Nog een document toevoegen' : 'Document uploaden'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Klik of sleep een bestand hierheen
                      </p>
                    </>
                  )}
                </div>
              )}

              {isLive && (
                <div className="flex items-center gap-2 rounded-[12px] bg-emerald-50 px-3 py-2">
                  <Check size={14} strokeWidth={3} className="text-emerald-500" />
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Deze bron wordt automatisch bijgewerkt vanuit onze datapipeline
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {pdfViewer && (
        <PDFViewerModal
          url={pdfViewer.url}
          title={pdfViewer.title}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </motion.div>
  )
}

/* ─── Progress bar ──────────────────────────────────────────── */

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full bg-[#F2F6F3] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
        {completed}/{total}
      </span>
    </div>
  )
}

/* ─── Category pill tab bar + content ───────────────────────── */

interface CategoryTabbedSourcesProps {
  sources: DataSource[]
  entityType?: string
  entityCode?: string
  gemeenteData?: GemeenteIntelligenceData
  gemeenteCode?: string
}

function CategoryTabbedSources({ sources, entityType, entityCode, gemeenteData, gemeenteCode }: CategoryTabbedSourcesProps) {
  // Only show categories that have sources
  const availableCategories = useMemo(() => {
    const categoriesWithSources = new Set(sources.map((s) => s.category))
    return CATEGORY_CONFIG.filter((c) => categoriesWithSources.has(c.key))
  }, [sources])

  const [activeCategory, setActiveCategory] = useState<DataSourceCategory>(
    availableCategories[0]?.key ?? 'ruimtelijk',
  )

  const filtered = useMemo(
    () => sources.filter((s) => s.category === activeCategory),
    [sources, activeCategory],
  )

  const liveSources = filtered.filter((s) => s.status === 'live')

  return (
    <div className="space-y-5">
      {/* Pill tab bar */}
      <div className="flex w-full h-[40px] rounded-full p-1 bg-[#F2F6F3]">
        {availableCategories.map((cat) => {
          const isActive = cat.key === activeCategory
          const count = sources.filter((s) => s.category === cat.key).length
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="relative flex-1 h-full rounded-full flex items-center justify-center gap-1.5 transition-colors"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: '11px',
                fontWeight: isActive ? 700 : 600,
                color: isActive ? undefined : '#94a3b8',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="category-tab"
                  className="absolute inset-0 rounded-full bg-[#0E1111]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>
                {cat.label}
              </span>
              <span className={`relative z-10 text-[9px] tabular-nums ${isActive ? 'text-slate-400' : 'text-slate-300'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Progress + card grid */}
      <motion.div
        key={activeCategory}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="space-y-4"
      >
        <ProgressBar completed={liveSources.length} total={filtered.length} />
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className={
            filtered.length === 1
              ? "grid gap-4 grid-cols-1"
              : filtered.length === 2
                ? "grid gap-4 grid-cols-1 sm:grid-cols-2"
                : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {filtered.map((source) => (
            <motion.div key={source.key} variants={fadeUp}>
              <DataSourceCard source={source} entityType={entityType} entityCode={entityCode} gemeenteData={gemeenteData} gemeenteCode={gemeenteCode} />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

/* ─── Entity detail view (reusable for gemeente + provincie) ── */

interface EntityDetailProps {
  entityType: 'Gemeente' | 'Provincie'
  entityCode: string
  entityName: string
  svgData: { d: string; viewBox: string } | null
  sources: DataSource[]
  onBack: () => void
  gemeenteData?: GemeenteIntelligenceData
}

function EntityDetail({ entityType, entityCode, entityName, svgData, sources, onBack, gemeenteData }: EntityDetailProps) {
  const liveCount = sources.filter((s) => s.status === 'live').length
  const roadmapCount = sources.filter((s) => s.status === 'roadmap').length

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <motion.button
        variants={fadeUp}
        initial="hidden"
        animate="show"
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
      >
        <ArrowLeft size={14} />
        Configuratie
      </motion.button>

      {/* Hero */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center gap-5">
        {svgData && (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-[16px] border border-[#EAEFEF] bg-[#F2F6F3]">
            <svg viewBox={svgData.viewBox} className="h-14 w-14">
              <path d={svgData.d} fill="#F9A826" fillOpacity={0.15} stroke="#F9A826" strokeWidth={1.5} strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {entityType} · Beleidsconfiguratie
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">{entityName}</h1>
          <p className="mt-1 text-[12px] text-slate-500">
            {entityCode} · {liveCount} actief · {roadmapCount} te configureren
          </p>
          {entityType === 'Gemeente' && gemeenteData && (
            <div className="mt-2 flex flex-wrap gap-2">
              {/* Approval rate */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {gemeenteData.profile.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  gemeenteData.profile.data?.approval_rate_pct != null
                    ? `${gemeenteData.profile.data.approval_rate_pct}% goedgekeurd`
                    : '—'
                )}
              </span>
              {/* Bekendmakingen 30d */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {gemeenteData.profile.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  gemeenteData.profile.data?.bekendmakingen_30d != null
                    ? `${gemeenteData.profile.data.bekendmakingen_30d} bekendmakingen (30d)`
                    : '—'
                )}
              </span>
              {/* Severity badge */}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: gemeenteData.profile.isLoading
                    ? undefined
                    : `${SEVERITY_COLORS[gemeenteData.profile.data?.severity_label ?? 'Onbekend'] ?? SEVERITY_COLORS['Onbekend']}18`,
                  color: gemeenteData.profile.isLoading
                    ? undefined
                    : SEVERITY_COLORS[gemeenteData.profile.data?.severity_label ?? 'Onbekend'] ?? SEVERITY_COLORS['Onbekend'],
                }}
              >
                {gemeenteData.profile.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  gemeenteData.profile.data?.severity_label ?? '—'
                )}
              </span>
              {/* Raadsstukken */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {gemeenteData.raadsinformatie.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  gemeenteData.raadsinformatie.data?.total_found != null
                    ? `${gemeenteData.raadsinformatie.data.total_found} raadsstukken`
                    : '—'
                )}
              </span>
              {/* Erfgoed */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {gemeenteData.erfgoed.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  gemeenteData.erfgoed.data?.total != null
                    ? `${gemeenteData.erfgoed.data.total} beschermde gezichten`
                    : '—'
                )}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Category pill tabs + source rows */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <CategoryTabbedSources sources={sources} entityType={entityType === 'Gemeente' ? 'gemeente' : entityType === 'Provincie' ? 'provincie' : 'landelijk'} entityCode={entityCode} gemeenteData={gemeenteData} gemeenteCode={entityType === 'Gemeente' ? entityCode : undefined} />
      </motion.div>
    </div>
  )
}

/* ─── Gemeente detail wrapper ───────────────────────────────── */

function GemeenteDetail({ gemeenteCode, onBack }: { gemeenteCode: string; onBack: () => void }) {
  const { data: geojson } = useGemeenteGeoJSON()

  const gemeente = useMemo(() => {
    if (!geojson) return null
    return geojson.features.find((f) => {
      const props = f.properties as Record<string, unknown> | null
      return String(props?.statcode ?? '') === gemeenteCode
    }) ?? null
  }, [geojson, gemeenteCode])

  const gemeenteNaam = gemeente
    ? String((gemeente.properties as Record<string, unknown>)?.statnaam ?? gemeenteCode)
    : gemeenteCode

  const svgData = useMemo(() => {
    if (!gemeente) return null
    const geom = gemeente.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return null
    return geoJsonToSvgPath(geom)
  }, [gemeente])

  // Gemeente intelligence hooks — disabled when name hasn't resolved
  const resolvedNaam = gemeenteNaam !== gemeenteCode ? gemeenteNaam : null
  const profileQuery = useGemeenteProfile(resolvedNaam)
  const raadsinformatieQuery = useRaadsinformatie(resolvedNaam)
  const huisvestingsverordeningQuery = useHuisvestingsverordening(resolvedNaam)
  const erfgoedQuery = useErfgoed(resolvedNaam)

  const gemeenteData: GemeenteIntelligenceData = useMemo(() => ({
    profile: { data: profileQuery.data, isLoading: profileQuery.isLoading, error: profileQuery.error },
    raadsinformatie: { data: raadsinformatieQuery.data, isLoading: raadsinformatieQuery.isLoading, error: raadsinformatieQuery.error },
    huisvestingsverordening: { data: huisvestingsverordeningQuery.data, isLoading: huisvestingsverordeningQuery.isLoading, error: huisvestingsverordeningQuery.error },
    erfgoed: { data: erfgoedQuery.data, isLoading: erfgoedQuery.isLoading, error: erfgoedQuery.error },
  }), [profileQuery, raadsinformatieQuery, huisvestingsverordeningQuery, erfgoedQuery])

  return (
    <EntityDetail
      entityType="Gemeente"
      entityCode={gemeenteCode}
      entityName={gemeenteNaam}
      svgData={svgData}
      sources={GEMEENTE_DATA_SOURCES}
      onBack={onBack}
      gemeenteData={gemeenteData}
    />
  )
}

/* ─── Gemeente grid (compact, inside accordion) ─────────────── */

function CompactGemeenteGrid({ onSelectGemeente }: { onSelectGemeente: (code: string) => void }) {
  const { data: geojson, isLoading } = useGemeenteGeoJSON()
  const [search, setSearch] = useState('')

  const gemeenten = useMemo<ProcessedGemeente[]>(() => {
    if (!geojson) return []
    return geojson.features
      .map((feature) => {
        const props = feature.properties as Record<string, unknown> | null
        const gemeentecode = String(props?.statcode ?? '')
        const gemeentenaam = String(props?.statnaam ?? '')
        const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
        if (!gemeentecode || !gemeentenaam || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return null
        const { d, viewBox } = geoJsonToSvgPath(geometry)
        return { gemeentecode, gemeentenaam, svgData: { primaryD: d, viewBox } }
      })
      .filter((g): g is ProcessedGemeente => g !== null)
      .sort((a, b) => a.gemeentenaam.localeCompare(b.gemeentenaam, 'nl'))
  }, [geojson])

  const filtered = useMemo(() => {
    if (!search.trim()) return gemeenten
    const q = search.trim().toLowerCase()
    return gemeenten.filter((g) => g.gemeentenaam.toLowerCase().includes(q) || g.gemeentecode.toLowerCase().includes(q))
  }, [gemeenten, search])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-64 rounded-full bg-[#F2F6F3] animate-pulse" />
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-[16px] bg-[#F2F6F3] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek gemeente..."
          className="h-9 w-full rounded-full border border-[#EAEFEF] bg-white pl-9 pr-4 text-[12px] text-[#0E1111] placeholder:text-slate-400 outline-none transition-colors focus:border-[#F9A826]"
        />
      </div>

      {search.trim() && (
        <p className="text-[11px] text-slate-500">
          {filtered.length} gemeente{filtered.length !== 1 ? 'n' : ''} gevonden
        </p>
      )}

      <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {filtered.map((g) => (
          <button
            key={g.gemeentecode}
            onClick={() => onSelectGemeente(g.gemeentecode)}
            className="group flex flex-col items-center gap-2 rounded-[16px] border border-[#EAEFEF] bg-white p-3 transition-all hover:border-[#F9A826] hover:shadow-sm"
          >
            <div className="flex size-12 items-center justify-center">
              <svg viewBox={g.svgData.viewBox} className="h-10 w-10">
                <path
                  d={g.svgData.primaryD}
                  fill="#F9A826"
                  fillOpacity={0.12}
                  stroke="#F9A826"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  className="transition-all group-hover:fill-opacity-25"
                />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-[#0E1111] text-center leading-tight line-clamp-2">
              {g.gemeentenaam}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-[12px] text-slate-400">
          Geen gemeenten gevonden voor &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  )
}

/* ─── Provincie detail wrapper ──────────────────────────────── */

function ProvincieDetail({ provincieCode, onBack }: { provincieCode: string; onBack: () => void }) {
  const { data: geojson } = useProvincieGeoJSON()

  const provincie = useMemo(() => {
    if (!geojson) return null
    return geojson.features.find((f) => {
      const props = f.properties as Record<string, unknown> | null
      return String(props?.statcode ?? '') === provincieCode
    }) ?? null
  }, [geojson, provincieCode])

  const provincieNaam = provincie
    ? String((provincie.properties as Record<string, unknown>)?.statnaam ?? provincieCode)
    : provincieCode

  const svgData = useMemo(() => {
    if (!provincie) return null
    const geom = provincie.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return null
    return geoJsonToSvgPath(geom)
  }, [provincie])

  return (
    <EntityDetail
      entityType="Provincie"
      entityCode={provincieCode}
      entityName={provincieNaam}
      svgData={svgData}
      sources={PROVINCIE_DATA_SOURCES}
      onBack={onBack}
    />
  )
}

/* ─── Province grid (compact, inside accordion) ─────────────── */

function CompactProvincieGrid({ onSelectProvincie }: { onSelectProvincie: (code: string) => void }) {
  const { data: geojson, isLoading } = useProvincieGeoJSON()

  const provincies = useMemo<ProcessedProvincie[]>(() => {
    if (!geojson) return []
    return geojson.features
      .map((feature) => {
        const props = feature.properties as Record<string, unknown> | null
        const provinciecode = String(props?.statcode ?? '')
        const provincienaam = String(props?.statnaam ?? '')
        const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
        if (!provinciecode || !provincienaam || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return null
        const { d, viewBox } = geoJsonToSvgPath(geometry)
        return { provinciecode, provincienaam, svgData: { primaryD: d, viewBox } }
      })
      .filter((p): p is ProcessedProvincie => p !== null)
      .sort((a, b) => a.provincienaam.localeCompare(b.provincienaam, 'nl'))
  }, [geojson])

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-[16px] bg-[#F2F6F3] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
      {provincies.map((p) => (
        <button
          key={p.provinciecode}
          onClick={() => onSelectProvincie(p.provinciecode)}
          className="group flex flex-col items-center gap-2 rounded-[16px] border border-[#EAEFEF] bg-white p-3 transition-all hover:border-[#F9A826] hover:shadow-sm"
        >
          <div className="flex size-12 items-center justify-center">
            <svg viewBox={p.svgData.viewBox} className="h-10 w-10">
              <path
                d={p.svgData.primaryD}
                fill="#F9A826"
                fillOpacity={0.12}
                stroke="#F9A826"
                strokeWidth={1.5}
                strokeLinejoin="round"
                className="transition-all group-hover:fill-opacity-25"
              />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-[#0E1111] text-center leading-tight line-clamp-2">
            {p.provincienaam}
          </span>
        </button>
      ))}
    </div>
  )
}

/* ─── Landelijk content (curated subsidies, compact) ────────── */

function LandelijkContent() {
  return <CategoryTabbedSources sources={LANDELIJK_DATA_SOURCES} />
}

/* ─── Source detail workspace (skeleton — T02/T03 add content) ── */

/* ─── Metric card helper ────────────────────────────────────── */

function MetricCard({ label, value, unit, muted }: { label: string; value: string | number | null | undefined; unit?: string; muted?: boolean }) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
      <p className="text-[28px] font-black leading-none text-[#0E1111]">
        {value != null ? value : '—'}{unit && <span className="ml-1 text-[14px] font-semibold text-slate-400">{unit}</span>}
      </p>
      <p className={`mt-1.5 text-[12px] font-semibold ${muted ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
    </div>
  )
}

/* ─── Source detail loading / empty helpers ──────────────────── */

function SourceDetailLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-[20px] border border-[#EAEFEF] bg-white p-12">
      <Loader2 className="size-5 animate-spin text-slate-400" />
      <span className="text-[13px] text-slate-400">Data laden…</span>
    </div>
  )
}

function SourceDetailEmpty({ message }: { message?: string }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-slate-400">{message ?? 'Geen data beschikbaar.'}</p>
    </div>
  )
}

function SourceDetailError({ error }: { error: Error | null }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
      <p className="text-[13px] text-red-400">{error?.message ?? 'Er is een fout opgetreden.'}</p>
    </div>
  )
}

/* ─── Per-source detail renderers ───────────────────────────── */

function VergunningKlimaatDetail({ profile, isLoading, error }: { profile?: GemeenteProfile; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <SourceDetailLoading />
  if (error) return <SourceDetailError error={error} />
  if (!profile) return <SourceDetailEmpty />

  const sevColor = SEVERITY_COLORS[profile.severity_label] ?? SEVERITY_COLORS['Onbekend']
  const permitEntries = Object.entries(profile.permit_type_distribution ?? {})

  return (
    <div className="space-y-5">
      {/* Severity badge */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ backgroundColor: sevColor }}>
          {profile.severity_label}
        </span>
        <span className="text-[12px] text-slate-400">op basis van {profile.sample_size} vergunningen</span>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Goedkeuringspercentage" value={profile.approval_rate_pct != null ? `${profile.approval_rate_pct.toFixed(1)}` : null} unit="%" />
        <MetricCard label="Afwijzingspercentage" value={profile.rejection_rate_pct != null ? `${profile.rejection_rate_pct.toFixed(1)}` : null} unit="%" />
        <MetricCard label="Gem. doorlooptijd" value={profile.avg_doorlooptijd_days != null ? `${Math.round(profile.avg_doorlooptijd_days)}` : null} unit="dagen" />
      </div>

      {/* Bekendmakingen trend */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <h3 className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-slate-400">Bekendmakingen trend</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[22px] font-black text-[#0E1111]">{profile.bekendmakingen_30d}</p>
            <p className="text-[11px] text-slate-400">afgelopen 30 dagen</p>
          </div>
          <div>
            <p className="text-[22px] font-black text-[#0E1111]">{profile.bekendmakingen_90d}</p>
            <p className="text-[11px] text-slate-400">afgelopen 90 dagen</p>
          </div>
          <div>
            <p className="text-[22px] font-black text-[#0E1111]">{profile.bekendmakingen_365d}</p>
            <p className="text-[11px] text-slate-400">afgelopen 365 dagen</p>
          </div>
        </div>
      </div>

      {/* Permit type distribution */}
      {permitEntries.length > 0 && (
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
          <h3 className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-slate-400">Vergunningtype verdeling</h3>
          <div className="space-y-2">
            {permitEntries.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-[13px] text-[#0E1111]">{type}</span>
                <span className="text-[13px] font-bold text-[#0E1111]">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function JurisprudentieDetail({ profile, isLoading, error }: { profile?: GemeenteProfile; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <SourceDetailLoading />
  if (error) return <SourceDetailError error={error} />
  if (!profile) return <SourceDetailEmpty />

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <MetricCard label="Gem. doorlooptijd" value={profile.avg_doorlooptijd_days != null ? `${Math.round(profile.avg_doorlooptijd_days)}` : null} unit="dagen" />
        <MetricCard label="Steekproefomvang" value={profile.sample_size} />
      </div>
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
        <a href="/jurisprudentie" className="inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-600 hover:underline">
          Bekijk volledige jurisprudentie-analyse
          <ArrowRight size={14} />
        </a>
      </div>
    </div>
  )
}

function BekendmakingenDetail({ profile, isLoading, error }: { profile?: GemeenteProfile; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <SourceDetailLoading />
  if (error) return <SourceDetailError error={error} />
  if (!profile) return <SourceDetailEmpty />

  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard label="Afgelopen 30 dagen" value={profile.bekendmakingen_30d} />
      <MetricCard label="Afgelopen 90 dagen" value={profile.bekendmakingen_90d} />
      <MetricCard label="Afgelopen 365 dagen" value={profile.bekendmakingen_365d} />
    </div>
  )
}

function RaadsinformatieDetail({ data, isLoading, error }: { data?: RaadsinformatieResponse; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <SourceDetailLoading />
  if (error) return <SourceDetailError error={error} />
  if (!data) return <SourceDetailEmpty />

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <MetricCard label="Gevonden stukken" value={data.total_found} />
        <div className="flex items-center gap-2 rounded-full border border-[#EAEFEF] px-3 py-1.5">
          <span className={`size-2 rounded-full ${data.dekking ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span className="text-[12px] font-semibold text-slate-500">{data.dekking ? 'Goede dekking' : 'Beperkte dekking'}</span>
        </div>
      </div>

      {/* Stukken list */}
      {data.stukken.length > 0 ? (
        <div className="max-h-[480px] space-y-0 overflow-y-auto rounded-[16px] border border-[#EAEFEF] bg-white divide-y divide-[#EAEFEF]">
          {data.stukken.map((stuk) => (
            <div key={stuk.doc_id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#0E1111] leading-snug">{stuk.titel}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {stuk.datum && <span className="text-[11px] text-slate-400">{stuk.datum}</span>}
                    {stuk.type && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {stuk.type}
                      </span>
                    )}
                  </div>
                  {stuk.samenvatting && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500 line-clamp-2">{stuk.samenvatting}</p>
                  )}
                </div>
                {stuk.bron_url && (
                  <a href={stuk.bron_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex-shrink-0 text-slate-400 hover:text-emerald-600 transition-colors">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <SourceDetailEmpty message="Geen raadsstukken gevonden." />
      )}
    </div>
  )
}

function HuisvestingsverordeningDetail({ data, isLoading, error }: { data?: HuisvestingsverordeningResponse; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <SourceDetailLoading />
  if (error) return <SourceDetailError error={error} />
  if (!data) return <SourceDetailEmpty />

  if (!data.heeft_verordening) {
    return <SourceDetailEmpty message="Geen huisvestingsverordening gevonden voor deze gemeente." />
  }

  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-6 space-y-4">
      {data.title && <h3 className="text-[16px] font-black text-[#0E1111]">{data.title}</h3>}
      {data.identifier && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Kenmerk</span>
          <span className="text-[13px] text-[#0E1111]">{data.identifier}</span>
        </div>
      )}
      {data.modified && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Laatst gewijzigd</span>
          <span className="text-[13px] text-[#0E1111]">{data.modified}</span>
        </div>
      )}
      {data.subject && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Onderwerp</span>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{data.subject}</p>
        </div>
      )}
      {data.url && (
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-600 hover:underline">
          Bekijk bron
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  )
}

function BeschermdErfgoedDetail({ data, isLoading, error }: { data?: ErfgoedResponse; isLoading: boolean; error: Error | null }) {
  if (isLoading) return <SourceDetailLoading />
  if (error) return <SourceDetailError error={error} />
  if (!data) return <SourceDetailEmpty />

  if (data.beschermde_gezichten.length === 0) {
    return <SourceDetailEmpty message="Geen beschermde gezichten gevonden." />
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-slate-500"><span className="font-bold text-[#0E1111]">{data.total}</span> beschermde gezichten</p>

      <div className="overflow-hidden rounded-[16px] border border-[#EAEFEF] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#EAEFEF] bg-slate-50/50">
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Naam</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Type</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Aangewezen</th>
              <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-400">Oppervlakte (ha)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAEFEF]">
            {data.beschermde_gezichten.map((item, i) => (
              <tr key={`${item.naam}-${i}`}>
                <td className="px-5 py-3 font-semibold text-[#0E1111]">{item.naam}</td>
                <td className="px-5 py-3 text-slate-500">{item.type}</td>
                <td className="px-5 py-3 text-slate-500">{item.aangewezen ?? '—'}</td>
                <td className="px-5 py-3 text-right text-slate-500">{item.oppervlakte_ha != null ? item.oppervlakte_ha.toFixed(1) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Document source detail (roadmap sources with upload + AI) ─ */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'parsing':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
          <Loader2 size={10} className="animate-spin" /> Analyseren…
        </span>
      )
    case 'parsed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
          <Check size={10} /> Geanalyseerd
        </span>
      )
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">
          <AlertCircle size={10} /> Fout
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          <Upload size={10} /> Geüpload
        </span>
      )
  }
}

function DocumentSourceDetail({
  sourceKey,
  sourceDescription,
  gemeenteCode,
}: {
  sourceKey: string
  sourceDescription: string
  gemeenteCode: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [polling, setPolling] = useState(false)

  const uploadMutation = useUploadPolicyDocument()

  const { data: docsData, isLoading } = usePolicyDocuments(
    'gemeente',
    gemeenteCode,
    sourceKey,
    true,
    polling ? 3000 : false,
  )

  const documents = docsData?.documents ?? []
  const isAnyParsing = documents.some((d) => d.status === 'parsing')

  // Toggle polling when parsing status changes
  useEffect(() => {
    setPolling(isAnyParsing)
  }, [isAnyParsing])

  // Find first parsed summary
  const firstSummary = useMemo(() => {
    for (const doc of documents) {
      const parsed = parseAiSummary(doc.ai_summary)
      if (parsed) return { summary: parsed, document: doc }
    }
    return null
  }, [documents])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      uploadMutation.mutate({ entityType: 'gemeente', entityCode: gemeenteCode, sourceKey, file })
      // Reset so re-selecting same file triggers change
      e.target.value = ''
    },
    [gemeenteCode, sourceKey, uploadMutation],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      uploadMutation.mutate({ entityType: 'gemeente', entityCode: gemeenteCode, sourceKey, file })
    },
    [gemeenteCode, sourceKey, uploadMutation],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  if (isLoading) return <SourceDetailLoading />

  // Hidden file input
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
      className="hidden"
      onChange={handleFileChange}
    />
  )

  // ── Empty state (no documents) ───────────────────────────────
  if (documents.length === 0) {
    return (
      <div className="space-y-5">
        {fileInput}
        <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-6">
          <p className="text-[13px] leading-relaxed text-slate-500">{sourceDescription}</p>
        </div>

        {/* Upload CTA zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`flex flex-col items-center gap-3 rounded-[16px] border-2 border-dashed p-10 text-center transition-colors ${
            isDragging ? 'border-[#F9A826] bg-[#FFF8EC]' : 'border-slate-200 bg-slate-50/50'
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-slate-100">
            <Upload size={22} className="text-slate-400" />
          </div>
          <p className="text-[14px] font-bold text-[#0E1111]">Upload een document om AI-analyse te starten</p>
          <p className="text-[12px] text-slate-400">Sleep een bestand hierheen of klik op de knop</p>
          <button
            onClick={handleUploadClick}
            disabled={uploadMutation.isPending}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#0E1111] px-5 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Uploaden…
              </>
            ) : (
              <>
                <Upload size={14} /> Kies bestand
              </>
            )}
          </button>
          <p className="text-[10px] text-slate-300">PDF, DOCX, XLSX, JPG, PNG</p>
        </div>
      </div>
    )
  }

  // ── Populated state ──────────────────────────────────────────
  return (
    <div className="space-y-5">
      {fileInput}

      {/* AI Summary (first parsed document) */}
      {firstSummary && (
        <div className="rounded-[16px] border border-violet-200 bg-violet-50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-500" />
            <h3 className="text-[13px] font-black uppercase tracking-[0.15em] text-violet-600">AI-samenvatting</h3>
          </div>
          <p className="text-[13px] leading-relaxed text-slate-700">{firstSummary.summary.summary}</p>

          {firstSummary.summary.key_facts.length > 0 && (
            <div>
              <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-violet-500">Kernpunten</h4>
              <ul className="space-y-1">
                {firstSummary.summary.key_facts.map((fact, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-600">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-violet-400" />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(firstSummary.summary.extracted_values).length > 0 && (
            <div>
              <h4 className="mb-2 text-[11px] font-black uppercase tracking-wider text-violet-500">Geëxtraheerde waarden</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {Object.entries(firstSummary.summary.extracted_values).map(([key, val]) => (
                  <div key={key} className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-slate-400">{key}</span>
                    <span className="text-[12px] font-semibold text-[#0E1111]">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-violet-400">
            Bron: {firstSummary.document.filename}
          </p>
        </div>
      )}

      {/* Document list */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#EAEFEF] px-5 py-3">
          <h3 className="text-[13px] font-black uppercase tracking-[0.15em] text-slate-400">
            Documenten ({documents.length})
          </h3>
          <button
            onClick={handleUploadClick}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            {uploadMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Upload
          </button>
        </div>
        <div className="divide-y divide-[#EAEFEF]">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="shrink-0 text-slate-400" />
                  <p className="truncate text-[13px] font-semibold text-[#0E1111]">{doc.filename}</p>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>{new Date(doc.created_at).toLocaleDateString('nl-NL')}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <DocumentStatusBadge status={doc.status} />
                {doc.status === 'parsed' && (
                  <a
                    href={`/api/policy-documents/gemeente/${gemeenteCode}/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline"
                  >
                    Bekijk PDF <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone for additional uploads */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex items-center justify-center gap-3 rounded-[16px] border-2 border-dashed px-5 py-6 text-center transition-colors ${
          isDragging ? 'border-[#F9A826] bg-[#FFF8EC]' : 'border-slate-200 bg-slate-50/30'
        }`}
      >
        <Upload size={16} className="text-slate-300" />
        <p className="text-[12px] text-slate-400">Sleep een extra document hierheen om toe te voegen</p>
      </div>
    </div>
  )
}

/* ─── Source detail workspace ───────────────────────────────── */

function SourceDetailWorkspace({ sourceKey, gemeenteCode, onBack }: { sourceKey: string; gemeenteCode: string; onBack: () => void }) {
  const source = GEMEENTE_DATA_SOURCES.find((s) => s.key === sourceKey)

  // Resolve gemeenteNaam from geojson (hooks need display name, not code)
  const { data: geojson } = useGemeenteGeoJSON()
  const gemeenteNaam = useMemo(() => {
    if (!geojson) return null
    const feature = geojson.features.find(f => String((f.properties as Record<string, unknown>)?.statcode ?? '') === gemeenteCode)
    return feature ? String((feature.properties as Record<string, unknown>)?.statnaam ?? gemeenteCode) : gemeenteCode
  }, [geojson, gemeenteCode])

  // Only call hooks with resolved name (not the code fallback)
  const resolvedNaam = gemeenteNaam && gemeenteNaam !== gemeenteCode ? gemeenteNaam : null

  const { data: profile, isLoading: profileLoading, error: profileError } = useGemeenteProfile(resolvedNaam)
  const { data: raadsData, isLoading: raadsLoading, error: raadsError } = useRaadsinformatie(resolvedNaam)
  const { data: huisvData, isLoading: huisvLoading, error: huisvError } = useHuisvestingsverordening(resolvedNaam)
  const { data: erfgoedData, isLoading: erfgoedLoading, error: erfgoedError } = useErfgoed(resolvedNaam)

  // Breadcrumb label
  const breadcrumbLabel = gemeenteNaam ?? gemeenteCode

  if (!source) {
    return (
      <div className="space-y-6">
        <motion.button
          variants={fadeUp}
          initial="hidden"
          animate="show"
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
        >
          <ArrowLeft size={14} />
          Terug naar gemeente
        </motion.button>
        <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
          <p className="text-[13px] text-slate-400">Databron &ldquo;{sourceKey}&rdquo; niet gevonden.</p>
        </div>
      </div>
    )
  }

  const Icon = source.icon

  // Render the source-specific detail content
  const renderDetail = () => {
    switch (sourceKey) {
      case 'vergunning-klimaat':
        return <VergunningKlimaatDetail profile={profile} isLoading={profileLoading} error={profileError} />
      case 'jurisprudentie':
        return <JurisprudentieDetail profile={profile} isLoading={profileLoading} error={profileError} />
      case 'bekendmakingen':
        return <BekendmakingenDetail profile={profile} isLoading={profileLoading} error={profileError} />
      case 'raadsinformatie':
        return <RaadsinformatieDetail data={raadsData} isLoading={raadsLoading} error={raadsError} />
      case 'huisvestingsverordening':
        return <HuisvestingsverordeningDetail data={huisvData} isLoading={huisvLoading} error={huisvError} />
      case 'beschermd-erfgoed':
        return <BeschermdErfgoedDetail data={erfgoedData} isLoading={erfgoedLoading} error={erfgoedError} />
      default:
        return (
          <DocumentSourceDetail
            sourceKey={sourceKey}
            sourceDescription={source?.description ?? ''}
            gemeenteCode={gemeenteCode}
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <motion.button
        variants={fadeUp}
        initial="hidden"
        animate="show"
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
      >
        <ArrowLeft size={14} />
        Terug naar {breadcrumbLabel}
      </motion.button>

      {/* Source heading */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center gap-4">
        <div className={`flex size-14 items-center justify-center rounded-full ${source.status === 'live' ? 'bg-emerald-600' : 'bg-[#0E1111]'}`}>
          <Icon className="size-7 text-[#F9A826]" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Databron · {source.category}
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">{source.label}</h1>
          <p className="mt-1 text-[12px] text-slate-500">{source.description}</p>
        </div>
      </motion.div>

      {/* Source-specific detail content */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        {renderDetail()}
      </motion.div>
    </div>
  )
}

/* ─── Main page ─────────────────────────────────────────────── */

function ConfiguratiePage() {
  const navigate = useNavigate()
  const { gemeente: activeGemeente, provincie: activeProvincie, source: activeSource } = Route.useSearch()
  const [openNiveau, setOpenNiveau] = useState<SubsidieNiveau | null>(null)
  const { data: gemeenteGeoJSON } = useGemeenteGeoJSON(openNiveau === 'gemeentelijk' || !!activeGemeente)
  const { data: provincieGeoJSON } = useProvincieGeoJSON(openNiveau === 'provinciaal' || !!activeProvincie)

  const landelijkCount = LANDELIJK_DATA_SOURCES.length
  const gemeenteCount = gemeenteGeoJSON?.features?.length ?? '342'
  const provincieCount = provincieGeoJSON?.features?.length ?? '12'

  const handleToggle = useCallback((niveau: SubsidieNiveau) => {
    setOpenNiveau((prev) => (prev === niveau ? null : niveau))
  }, [])

  const handleSelectGemeente = useCallback(
    (code: string) => {
      navigate({ to: '/configuratie', search: { gemeente: code } })
    },
    [navigate],
  )

  const handleSelectProvincie = useCallback(
    (code: string) => {
      navigate({ to: '/configuratie', search: { provincie: code } })
    },
    [navigate],
  )

  const handleBackToMain = useCallback(() => {
    navigate({ to: '/configuratie', search: {} })
  }, [navigate])

  // If source workspace is selected, show full-page source detail
  if (activeGemeente && activeSource) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <SourceDetailWorkspace
            sourceKey={activeSource}
            gemeenteCode={activeGemeente}
            onBack={() => navigate({ to: '/configuratie', search: { gemeente: activeGemeente } })}
          />
        </div>
      </ResultsShell>
    )
  }

  // If gemeente is selected, show detail view
  if (activeGemeente) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <GemeenteDetail gemeenteCode={activeGemeente} onBack={handleBackToMain} />
        </div>
      </ResultsShell>
    )
  }

  // If provincie is selected, show detail view
  if (activeProvincie) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <ProvincieDetail provincieCode={activeProvincie} onBack={handleBackToMain} />
        </div>
      </ResultsShell>
    )
  }

  return (
    <ResultsShell>
      <div className="mx-auto max-w-4xl">
        {/* Hero */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p
            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Beleidsconfiguratie
          </p>
          <h1 className="mt-1 text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            Configuratie
          </h1>
          <p className="mt-2 text-[13px] text-slate-500" style={{ textWrap: 'pretty' }}>
            Beheer databronnen en beleidsdocumenten per bestuursniveau
          </p>
        </motion.div>

        {/* Accordion levels */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mt-6 space-y-3"
        >
          {NIVEAU_CONFIGS.map((config) => (
            <motion.div key={config.key} variants={fadeUp}>
              <AccordionLevelCard
                config={config}
                count={
                  config.key === 'landelijk'
                    ? `${landelijkCount} bronnen`
                    : config.key === 'provinciaal'
                      ? `${provincieCount} provincies`
                      : `${gemeenteCount} gemeenten`
                }
                isOpen={openNiveau === config.key}
                onToggle={() => handleToggle(config.key)}
              >
                {config.key === 'landelijk' && <LandelijkContent />}
                {config.key === 'provinciaal' && (
                  <CompactProvincieGrid onSelectProvincie={handleSelectProvincie} />
                )}
                {config.key === 'gemeentelijk' && (
                  <CompactGemeenteGrid onSelectGemeente={handleSelectGemeente} />
                )}
              </AccordionLevelCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Configuratie · 3 bestuursniveaus
        </p>
      </div>
    </ResultsShell>
  )
}
