/**
 * GemeenteBeleidDetail — detail workspace for a selected gemeente.
 * Shows the gemeente SVG silhouette, name, and 16 data source sections
 * (6 live, 10 roadmap) grouped by availability status.
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '@/lib/animations'
import {
  ArrowLeft,
  Shield,
  Scale,
  Building2,
  Home,
  Landmark,
  Bell,
  Banknote,
  Eye,
  TreePine,
  Car,
  Leaf,
  DoorOpen,
  Church,
  Newspaper,
} from 'lucide-react'
import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'
import { geoJsonToSvgPath } from '@/lib/geo-utils'
import { SectionInsightCard } from '@/components/reports/components/SectionInsightCard'
import type { LucideIcon } from 'lucide-react'

/* ─── Data source catalog ──────────────────────────────────── */

interface GemeenteDataSource {
  key: string
  label: string
  kicker: string
  status: 'live' | 'roadmap'
  icon: LucideIcon
  description: string
}

const GEMEENTE_DATA_SOURCES: GemeenteDataSource[] = [
  // ── Live (6) ──
  {
    key: 'vergunning-klimaat',
    label: 'Vergunning-klimaat',
    kicker: 'Live',
    status: 'live',
    icon: Shield,
    description: 'Vergunningsaanvragen en besluiten in deze gemeente — tempo, goedkeuringspercentage en trends.',
  },
  {
    key: 'jurisprudentie',
    label: 'Jurisprudentie & AI-analyse',
    kicker: 'Live',
    status: 'live',
    icon: Scale,
    description: 'Relevante rechtszaken met AI-analyse van uitspraken die impact hebben op vastgoedontwikkeling.',
  },
  {
    key: 'raadsinformatie',
    label: 'Raadsinformatie',
    kicker: 'Live',
    status: 'live',
    icon: Building2,
    description: 'Gemeenteraadsvergaderingen, moties en besluiten over ruimtelijke ordening en woningbouw.',
  },
  {
    key: 'huisvestingsverordening',
    label: 'Huisvestingsverordening',
    kicker: 'Live',
    status: 'live',
    icon: Home,
    description: 'Regels voor woningvorming, splitsing en onttrekking — bepaalt wat u mag doen met bestaande woningen.',
  },
  {
    key: 'beschermd-erfgoed',
    label: 'Beschermd erfgoed',
    kicker: 'Live',
    status: 'live',
    icon: Landmark,
    description: 'Rijksmonumenten en beschermde stadsgezichten in deze gemeente via het RCE-register.',
  },
  {
    key: 'bekendmakingen',
    label: 'Bekendmakingen monitoring',
    kicker: 'Live',
    status: 'live',
    icon: Bell,
    description: 'Automatische monitoring van officiële bekendmakingen: bestemmingsplanwijzigingen, vergunningen, milieubesluiten.',
  },
  // ── Roadmap (10) ──
  {
    key: 'gemeentelijke-subsidies',
    label: 'Gemeentelijke subsidies',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: Banknote,
    description: 'Gemeente-specifieke subsidies en regelingen voor woningbouw, verduurzaming en transformatie.',
  },
  {
    key: 'welstandsnota',
    label: 'Welstandsnota',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: Eye,
    description: 'Welstandseisen per gebied: materiaalgebruik, kleurschema, dakvormen, bouwhoogte.',
  },
  {
    key: 'omgevingsvisie',
    label: 'Omgevingsvisie',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: TreePine,
    description: 'Langetermijnvisie op de leefomgeving — gewenste ontwikkelrichting, verdichtingsgebieden, functiemenging.',
  },
  {
    key: 'woonvisie',
    label: 'Woonvisie',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: Home,
    description: 'Woningbouwprogramma: aantallen per segment (sociaal, midden, vrij), doelgroepen, prioriteitsgebieden.',
  },
  {
    key: 'parkeerbeleid',
    label: 'Parkeerbeleid',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: Car,
    description: 'Parkeernormen per woningtype en stedelijkheidszone — impact op bouwkosten en vergunningseisen.',
  },
  {
    key: 'duurzaamheidsbeleid',
    label: 'Duurzaamheidsbeleid',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: Leaf,
    description: 'Aanvullende duurzaamheidseisen: gasloos, BENG, groene daken, klimaatadaptatie, circulair bouwen.',
  },
  {
    key: 'leegstandsverordening',
    label: 'Leegstandsverordening',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: DoorOpen,
    description: 'Regels voor leegstandsmeldplicht — indicator voor transformatiekansen bij leegstaande panden.',
  },
  {
    key: 'erfgoedverordening',
    label: 'Erfgoedverordening',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: Church,
    description: 'Lokale gemeentelijke monumenten naast rijksmonumenten — eigen beschermingsregime voor verbouw.',
  },
  {
    key: 'nieuws-monitoring',
    label: 'Nieuws & beleidsmonitoring',
    kicker: 'Configuratie',
    status: 'roadmap',
    icon: Newspaper,
    description: 'Automatische signalering van relevante beleidswijzigingen, raadsbesluiten en coalitieakkoorden.',
  },
]

const LIVE_SOURCES = GEMEENTE_DATA_SOURCES.filter((s) => s.status === 'live')
const ROADMAP_SOURCES = GEMEENTE_DATA_SOURCES.filter((s) => s.status === 'roadmap')

/* ─── Component ────────────────────────────────────────────── */

interface GemeenteBeleidDetailProps {
  gemeenteCode: string
  onBack: () => void
}

export function GemeenteBeleidDetail({ gemeenteCode, onBack }: GemeenteBeleidDetailProps) {
  const { data: geojson } = useGemeenteGeoJSON()

  // Find matching gemeente feature
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

  // Generate larger SVG for hero
  const svgData = useMemo(() => {
    if (!gemeente) return null
    const geom = gemeente.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return null
    return geoJsonToSvgPath(geom)
  }, [gemeente])

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ────────────────────────────────────── */}
      <motion.button
        variants={fadeUp}
        initial="hidden"
        animate="show"
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
      >
        <ArrowLeft size={14} />
        Alle gemeenten
      </motion.button>

      {/* ── Hero: SVG + name ──────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-6"
      >
        {svgData && (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-[20px] border border-[#EAEFEF] bg-[#F2F6F3]">
            <svg viewBox={svgData.viewBox} className="h-16 w-16">
              <path
                d={svgData.d}
                fill="#F9A826"
                fillOpacity={0.15}
                stroke="#F9A826"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Gemeente
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            {gemeenteNaam}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">{gemeenteCode}</p>
        </div>
      </motion.div>

      {/* ── Live data sources ─────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex size-3 items-center justify-center">
            <div className="size-2.5 rounded-full bg-emerald-500" />
          </div>
          <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-600">
            Beschikbare bronnen
          </h2>
          <span className="text-[11px] font-bold text-slate-400 tabular-nums">{LIVE_SOURCES.length}</span>
          <div className="h-px flex-1 bg-[#EAEFEF]" />
        </div>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {LIVE_SOURCES.map((source) => (
            <motion.div key={source.key} variants={fadeUp}>
              <SectionInsightCard
                kicker={source.kicker}
                title={source.label}
                Icon={source.icon}
              >
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  {source.description}
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="size-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-semibold text-emerald-600">Actief</span>
                </div>
              </SectionInsightCard>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* ── Roadmap / Configuration sources ────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex size-3 items-center justify-center">
            <div className="size-2.5 rounded-full bg-[#F9A826]" />
          </div>
          <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-[#F9A826]">
            Te configureren bronnen
          </h2>
          <span className="text-[11px] font-bold text-slate-400 tabular-nums">{ROADMAP_SOURCES.length}</span>
          <div className="h-px flex-1 bg-[#EAEFEF]" />
        </div>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {ROADMAP_SOURCES.map((source) => (
            <motion.div key={source.key} variants={fadeUp}>
              <SectionInsightCard
                kicker={source.kicker}
                title={source.label}
                Icon={source.icon}
              >
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  {source.description}
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="size-1.5 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-semibold text-slate-400">Document uploaden</span>
                </div>
              </SectionInsightCard>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
