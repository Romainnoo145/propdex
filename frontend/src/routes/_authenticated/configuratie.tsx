/**
 * Configuratie (Beleid) — multi-level policy configuration hub.
 *
 * Main page: Three accordion-style level cards (Landelijk / Provinciaal / Gemeentelijk).
 * Expanding Gemeentelijk shows compact gemeente grid (wijk-size cards).
 * Clicking a gemeente navigates to rapport-style detail view.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { staggerContainer, fadeUp } from '@/lib/animations'
import {
  ChevronDown,
  Landmark,
  Building2,
  MapPin,
  ArrowLeft,
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
import { usePolicyDocuments, useUploadPolicyDocument } from '@/hooks/usePolicyDocuments'
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

function DataSourceCard({ source, entityType, entityCode, gemeenteData }: DataSourceCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null)
  const Icon = source.icon
  const isLive = source.status === 'live'
  const uploadMutation = useUploadPolicyDocument()

  const { data: docsData } = usePolicyDocuments(
    entityType ?? '',
    entityCode ?? '',
    source.key,
    !!entityType && !!entityCode,
  )
  const docCount = docsData?.total ?? 0
  const isComplete = isLive || docCount > 0

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
        {/* Icon in dark circle */}
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
          isComplete ? 'bg-emerald-600' : 'bg-[#0E1111]'
        }`}>
          <Icon className="size-5 text-[#F9A826]" strokeWidth={2} />
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
}

function CategoryTabbedSources({ sources, entityType, entityCode, gemeenteData }: CategoryTabbedSourcesProps) {
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
              <DataSourceCard source={source} entityType={entityType} entityCode={entityCode} gemeenteData={gemeenteData} />
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
        <CategoryTabbedSources sources={sources} entityType={entityType === 'Gemeente' ? 'gemeente' : entityType === 'Provincie' ? 'provincie' : 'landelijk'} entityCode={entityCode} gemeenteData={gemeenteData} />
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

/* ─── Main page ─────────────────────────────────────────────── */

function ConfiguratiePage() {
  const navigate = useNavigate()
  const { gemeente: activeGemeente, provincie: activeProvincie } = Route.useSearch()
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
