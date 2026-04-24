/**
 * Configuratie (Beleid) — multi-level policy configuration hub.
 *
 * Main page: Three accordion-style level cards (Landelijk / Provinciaal / Gemeentelijk).
 * Expanding Gemeentelijk shows compact gemeente grid (wijk-size cards).
 * Clicking a gemeente navigates to rapport-style detail view.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeUp } from "@/lib/animations";
import {
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
  FileCheck,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";
import ResultsShell from "@/components/layout/ResultsShell";
import { type SubsidieNiveau } from "@/lib/subsidies/curatedSubsidies";
import { useGemeenteGeoJSON } from "@/hooks/useGemeenteGeoJSON";
import {
  useGemeenteProfile,
  SEVERITY_COLORS,
  type GemeenteProfile,
} from "@/hooks/useGemeenteProfile";
import {
  useRaadsinformatie,
  type RaadsinformatieResponse,
} from "@/hooks/useRaadsinformatie";
import {
  useHuisvestingsverordening,
  type HuisvestingsverordeningResponse,
} from "@/hooks/useHuisvestingsverordening";
import { useErfgoed, type ErfgoedResponse } from "@/hooks/useErfgoed";
import { useProvincieGeoJSON } from "@/hooks/useProvincieGeoJSON";
import {
  usePolicyDocuments,
  useUploadPolicyDocument,
  parseAiSummary,
} from "@/hooks/usePolicyDocuments";
import { geoJsonToSvgPath } from "@/lib/geo-utils";
import { useAuth } from "@/lib/auth/useAuth";
import JurisprudentieDetailEnriched from "@/components/configuratie/JurisprudentieDetailEnriched";
import BekendmakingenDetailEnriched from "@/components/configuratie/BekendmakingenDetailEnriched";
import RvoSubsidiesDetailEnriched from "@/components/configuratie/RvoSubsidiesDetailEnriched";
import OmgevingswetDetailEnriched from "@/components/configuratie/OmgevingswetDetailEnriched";
import { VergunningKlimaatDetailEnriched } from "@/components/configuratie/VergunningKlimaatDetailEnriched";
import { RaadsinformatieDetailEnriched } from "@/components/configuratie/RaadsinformatieDetailEnriched";
import { HuisvestingsverordeningDetailEnriched } from "@/components/configuratie/HuisvestingsverordeningDetailEnriched";
import { BeschermdErfgoedDetailEnriched } from "@/components/configuratie/BeschermdErfgoedDetailEnriched";
import { DocumentSourceDetailView } from "@/components/configuratie/DocumentSourceDetailView";
import {
  GEMEENTE_DATA_SOURCES as _GEMEENTE,
  PROVINCIE_DATA_SOURCES as _PROVINCIE,
  LANDELIJK_DATA_SOURCES as _LANDELIJK,
  CATEGORY_CONFIG,
  type DataSourceEntry,
  type DataSourceCategory,
} from "@/lib/constants/dataSources";

import type { LucideIcon } from "lucide-react";

/* ─── Gemeente intelligence data shape ──────────────────────── */

interface GemeenteIntelligenceData {
  profile: { data?: GemeenteProfile; isLoading: boolean; error: Error | null };
  raadsinformatie: {
    data?: RaadsinformatieResponse;
    isLoading: boolean;
    error: Error | null;
  };
  huisvestingsverordening: {
    data?: HuisvestingsverordeningResponse;
    isLoading: boolean;
    error: Error | null;
  };
  erfgoed: { data?: ErfgoedResponse; isLoading: boolean; error: Error | null };
}

/* ─── Route ─────────────────────────────────────────────────── */

export const Route = createFileRoute("/_authenticated/beleid")({
  validateSearch: (search: Record<string, unknown>) => ({
    gemeente:
      typeof search.gemeente === "string" && /^GM\d{4}$/.test(search.gemeente)
        ? (search.gemeente as string)
        : undefined,
    provincie:
      typeof search.provincie === "string" && /^PV\d{2}$/.test(search.provincie)
        ? (search.provincie as string)
        : undefined,
    source:
      typeof search.source === "string" ? (search.source as string) : undefined,
    category:
      typeof search.category === "string"
        ? (search.category as string)
        : undefined,
    niveau:
      typeof search.niveau === "string" &&
      ["landelijk", "provinciaal", "gemeentelijk"].includes(search.niveau)
        ? (search.niveau as "landelijk" | "provinciaal" | "gemeentelijk")
        : undefined,
  }),
  component: ConfiguratiePage,
});

/* ─── Niveau config ─────────────────────────────────────────── */

interface NiveauConfig {
  key: SubsidieNiveau;
  label: string;
  icon: LucideIcon;
  description: string;
}

const NIVEAU_CONFIGS: NiveauConfig[] = [
  {
    key: "landelijk",
    label: "Landelijk (Rijksoverheid)",
    icon: Landmark,
    description: "Rijkssubsidies, nationale regelgeving en RVO-instrumenten",
  },
  {
    key: "provinciaal",
    label: "Provinciaal",
    icon: Building2,
    description: "12 provincies — regionaal beleid, subsidies en verordeningen",
  },
  {
    key: "gemeentelijk",
    label: "Gemeentelijk",
    icon: MapPin,
    description:
      "342 gemeenten — lokaal beleid, vergunningklimaat en databronnen",
  },
];

/* ─── Data source icon mapping ──────────────────────────────── */
/* Shared catalog data lives in @/lib/constants/dataSources; icons are */
/* local to this surface because they pull from lucide-react. */

interface DataSource extends DataSourceEntry {
  icon: LucideIcon;
}

const SOURCE_ICONS: Record<string, LucideIcon> = {
  // Gemeente — Ruimtelijk
  omgevingsvisie: TreePine,
  welstandsnota: Eye,
  woonvisie: Home,
  parkeerbeleid: Car,
  huisvestingsverordening: Home,
  // Gemeente — Juridisch
  "vergunning-klimaat": Shield,
  jurisprudentie: Scale,
  raadsinformatie: Building2,
  leegstandsverordening: DoorOpen,
  // Gemeente — Financieel
  "gemeentelijke-subsidies": Banknote,
  grondprijsbeleid: FileText,
  // Gemeente — Duurzaamheid
  duurzaamheidsbeleid: Leaf,
  "beschermd-erfgoed": Landmark,
  erfgoedverordening: Church,
  // Gemeente — Monitoring
  bekendmakingen: Bell,
  "nieuws-monitoring": Newspaper,
  // Provincie — Ruimtelijk
  omgevingsverordening: FileText,
  "ruimtelijke-visie": TreePine,
  woondeals: Home,
  // Provincie — Financieel
  "provinciale-subsidies": Banknote,
  // Provincie — Duurzaamheid
  "natuur-stikstof": Leaf,
  "erfgoed-provinciaal": Church,
  "energie-transitie": Leaf,
  // Provincie — Monitoring
  mobiliteit: Car,
  // Landelijk — Ruimtelijk
  omgevingswet: FileText,
  "ladder-verstedelijking": TreePine,
  "nationale-woonagenda": Home,
  // Landelijk — Juridisch
  woningwet: Scale,
  "asbest-sloop": Shield,
  // Landelijk — Financieel
  "rvo-subsidies": Banknote,
  // Landelijk — Duurzaamheid
  "beng-energieprestatie": Leaf,
  "stikstof-nationaal": TreePine,
  // Landelijk — Monitoring
  "rijksbeleid-monitoring": Bell,
};

const GEMEENTE_DATA_SOURCES: DataSource[] = _GEMEENTE.map((s) => ({
  ...s,
  icon: SOURCE_ICONS[s.key] ?? FileText,
}));

const PROVINCIE_DATA_SOURCES: DataSource[] = _PROVINCIE.map((s) => ({
  ...s,
  icon: SOURCE_ICONS[s.key] ?? FileText,
}));

const LANDELIJK_DATA_SOURCES: DataSource[] = _LANDELIJK.map((s) => ({
  ...s,
  icon: SOURCE_ICONS[s.key] ?? FileText,
}));

/* ─── Processed types ───────────────────────────────────────── */

interface ProcessedProvincie {
  provinciecode: string;
  provincienaam: string;
  svgData: { primaryD: string; viewBox: string };
}

/* ─── Processed gemeente type ───────────────────────────────── */

interface ProcessedGemeente {
  gemeentecode: string;
  gemeentenaam: string;
  svgData: { primaryD: string; viewBox: string };
}

/* ─── Data source insight card (expandable) ─────────────────── */

interface DataSourceCardProps {
  source: DataSource;
  entityType?: string;
  entityCode?: string;
  gemeenteData?: GemeenteIntelligenceData;
  gemeenteCode?: string;
}

/** Returns { isLoading, error, metrics } for a live source based on its key and gemeente data. */
function getLiveMetrics(
  sourceKey: string,
  gemeenteData?: GemeenteIntelligenceData,
): { isLoading: boolean; error: boolean; metrics: React.ReactNode | null } {
  if (!gemeenteData) return { isLoading: false, error: false, metrics: null };

  switch (sourceKey) {
    case "vergunning-klimaat": {
      const { data, isLoading, error } = gemeenteData.profile;
      if (isLoading) return { isLoading: true, error: false, metrics: null };
      if (error || !data)
        return { isLoading: false, error: true, metrics: null };
      const rate =
        data.approval_rate_pct != null ? `${data.approval_rate_pct}%` : "—";
      const severityColor =
        SEVERITY_COLORS[data.severity_label] ?? SEVERITY_COLORS["Onbekend"];
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            <span className="font-bold text-[#0E1111]">{rate}</span>
            {" goedgekeurd · "}
            <span className="font-bold text-[#0E1111]">
              {data.bekendmakingen_30d}
            </span>
            {" recent · "}
            <span style={{ color: severityColor }} className="font-bold">
              {data.severity_label}
            </span>
          </>
        ),
      };
    }
    case "jurisprudentie": {
      const { data, isLoading, error } = gemeenteData.profile;
      if (isLoading) return { isLoading: true, error: false, metrics: null };
      if (error || !data)
        return { isLoading: false, error: true, metrics: null };
      const doorlooptijd =
        data.avg_doorlooptijd_days != null
          ? `${data.avg_doorlooptijd_days}d`
          : "—";
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            {"Doorlooptijd: "}
            <span className="font-bold text-[#0E1111]">{doorlooptijd}</span>
            {" · "}
            <span className="font-bold text-[#0E1111]">{data.sample_size}</span>
            {" zaken"}
          </>
        ),
      };
    }
    case "bekendmakingen": {
      const { data, isLoading, error } = gemeenteData.profile;
      if (isLoading) return { isLoading: true, error: false, metrics: null };
      if (error || !data)
        return { isLoading: false, error: true, metrics: null };
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            <span className="font-bold text-[#0E1111]">
              {data.bekendmakingen_30d}
            </span>
            {" (30d) · "}
            <span className="font-bold text-[#0E1111]">
              {data.bekendmakingen_90d}
            </span>
            {" (90d)"}
          </>
        ),
      };
    }
    case "raadsinformatie": {
      const { data, isLoading, error } = gemeenteData.raadsinformatie;
      if (isLoading) return { isLoading: true, error: false, metrics: null };
      if (error || !data)
        return { isLoading: false, error: true, metrics: null };
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            <span className="font-bold text-[#0E1111]">{data.total_found}</span>
            {" stukken · "}
            {data.dekking ? (
              <span className="font-bold text-[#B07D18]">Gedekt</span>
            ) : (
              <span className="font-bold text-slate-400">Geen dekking</span>
            )}
          </>
        ),
      };
    }
    case "huisvestingsverordening": {
      const { data, isLoading, error } = gemeenteData.huisvestingsverordening;
      if (isLoading) return { isLoading: true, error: false, metrics: null };
      if (error || !data)
        return { isLoading: false, error: true, metrics: null };
      return {
        isLoading: false,
        error: false,
        metrics: data.heeft_verordening ? (
          <span className="font-bold text-[#0E1111]">
            {data.title ?? "Verordening gevonden"}
          </span>
        ) : (
          <span className="text-slate-400">Geen verordening gevonden</span>
        ),
      };
    }
    case "beschermd-erfgoed": {
      const { data, isLoading, error } = gemeenteData.erfgoed;
      if (isLoading) return { isLoading: true, error: false, metrics: null };
      if (error || !data)
        return { isLoading: false, error: true, metrics: null };
      return {
        isLoading: false,
        error: false,
        metrics: (
          <>
            <span className="font-bold text-[#0E1111]">{data.total}</span>
            {" beschermde gezichten"}
          </>
        ),
      };
    }
    default:
      return { isLoading: false, error: false, metrics: null };
  }
}

function DataSourceCard({
  source,
  entityType,
  entityCode,
  gemeenteData,
  gemeenteCode,
}: DataSourceCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperuser = user?.is_superuser ?? false;
  const [isDragging, setIsDragging] = useState(false);
  const [polling, setPolling] = useState(false);
  const Icon = source.icon;
  const isLive = source.status === "live";
  const uploadMutation = useUploadPolicyDocument();

  const { data: docsData } = usePolicyDocuments(
    entityType ?? "",
    entityCode ?? "",
    source.key,
    !!entityType && !!entityCode,
    polling ? 3000 : false,
  );
  const docCount = docsData?.total ?? 0;
  const isComplete = isLive || docCount > 0;

  // AI summary state derived from documents
  const firstDoc = docsData?.documents?.[0];
  const isAnyParsing =
    docsData?.documents?.some((d) => d.status === "parsing") ?? false;
  const isAnyError =
    docsData?.documents?.some((d) => d.status === "error") ?? false;
  const aiSummary = firstDoc ? parseAiSummary(firstDoc.ai_summary) : null;

  // Toggle polling when parsing status changes
  useEffect(() => {
    setPolling(isAnyParsing);
  }, [isAnyParsing]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (!entityType || !entityCode) return;
      const file = e.dataTransfer.files[0];
      if (!file) return;
      uploadMutation.mutate({
        entityType,
        entityCode,
        sourceKey: source.key,
        file,
      });
    },
    [entityType, entityCode, source.key, uploadMutation],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleCardClick = useCallback(() => {
    if (gemeenteCode) {
      navigate({
        to: "/beleid",
        search: {
          gemeente: gemeenteCode,
          provincie: undefined,
          source: source.key,
          category: source.category,
          niveau: undefined,
        },
      });
    } else if (entityType === "provincie" && entityCode) {
      navigate({
        to: "/beleid",
        search: {
          gemeente: undefined,
          provincie: entityCode,
          source: source.key,
          category: source.category,
          niveau: undefined,
        },
      });
    } else {
      // Landelijk — no gemeente, no provincie. All sources click through,
      // including document sources (no status check).
      navigate({
        to: "/beleid",
        search: {
          gemeente: undefined,
          provincie: undefined,
          source: source.key,
          category: source.category,
          niveau: undefined,
        },
      });
    }
  }, [
    gemeenteCode,
    entityType,
    entityCode,
    navigate,
    source.key,
    source.category,
  ]);

  const liveMetrics = isLive ? getLiveMetrics(source.key, gemeenteData) : null;

  return (
    <motion.div
      layout
      onDrop={isSuperuser ? handleDrop : undefined}
      onDragOver={isSuperuser ? handleDragOver : undefined}
      onDragLeave={isSuperuser ? handleDragLeave : undefined}
      onClick={handleCardClick}
      className={`group relative rounded-2xl border-2 transition-all cursor-pointer h-full flex flex-col ${
        isDragging
          ? "border-[#F9A826] border-dashed bg-[#FFF8EC] shadow-md scale-[1.02]"
          : isComplete
            ? "border-[#F9A826]/30 bg-amber-50/40 hover:border-[#F9A826]/60 hover:shadow-md"
            : "border-dashed border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <div className="p-5 space-y-3 flex flex-col flex-1">
        {/* Top row: icon + status */}
        <div className="flex items-start justify-between">
          <div
            className={`flex size-10 items-center justify-center rounded-xl ${
              isComplete ? "bg-[#0E1111]" : "bg-slate-100"
            }`}
          >
            <Icon
              className={`size-5 ${isComplete ? "text-[#F9A826]" : "text-slate-400"}`}
              strokeWidth={1.8}
            />
          </div>
          {isAnyParsing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <Loader2 className="animate-spin" size={10} />
              Analyseert
            </span>
          )}
        </div>

        {/* Title + description */}
        <div className="flex-1">
          <h3 className="text-[15px] font-bold tracking-tight text-[#0E1111] leading-snug">
            {source.label}
          </h3>
          <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
            {source.description}
          </p>
        </div>

        {/* Footer: metrics / doc info / upload hint */}
        <div className="pt-1 border-t border-slate-100">
          {isLive && liveMetrics?.metrics && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 leading-snug">
                {liveMetrics.metrics}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B07D18]">
                <Check size={10} strokeWidth={3} />
                Auto-sync
              </span>
            </div>
          )}
          {isLive && liveMetrics?.isLoading && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <Loader2 className="animate-spin" size={11} />
              Laden...
            </span>
          )}
          {isLive &&
            !liveMetrics?.isLoading &&
            !liveMetrics?.metrics &&
            !liveMetrics?.error && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B07D18]">
                <Check size={10} strokeWidth={3} />
                Auto-sync actief
              </span>
            )}
          {!isLive && docCount > 0 && (
            <div className="flex items-center gap-2">
              <FileCheck size={12} className="text-[#F9A826] shrink-0" />
              <span className="text-[11px] font-medium text-[#0E1111] truncate">
                {firstDoc?.filename ??
                  `${docCount} document${docCount !== 1 ? "en" : ""}`}
              </span>
              {aiSummary && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                  <Sparkles size={9} />
                  AI
                </span>
              )}
            </div>
          )}
          {!isLive && docCount === 0 && entityType && isSuperuser && (
            <p className="text-[11px] text-slate-300 italic">
              Sleep een document hierheen of klik om te uploaden
            </p>
          )}
          {!isLive && docCount === 0 && entityType && !isSuperuser && (
            <p className="text-[11px] text-slate-300 italic">
              Nog geen document toegevoegd
            </p>
          )}
        </div>
      </div>

      {gemeenteCode && (
        <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight size={14} className="text-slate-400" />
        </div>
      )}
    </motion.div>
  );
}

/* ─── Progress bar ──────────────────────────────────────────── */

function ProgressBar({
  completed,
  total,
  label,
}: {
  completed: number;
  total: number;
  label?: string;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-slate-500">
            {label}
          </span>
          <span className="text-[12px] font-bold text-[#0E1111] tabular-nums">
            {completed} van {total}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-[#F2F6F3] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#F9A826]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        {!label && (
          <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">
            {completed}/{total}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Category pill tab bar + content ───────────────────────── */

interface CategoryTabbedSourcesProps {
  initialCategory?: string;
  sources: DataSource[];
  entityType?: string;
  entityCode?: string;
  gemeenteData?: GemeenteIntelligenceData;
  gemeenteCode?: string;
}

function CategoryTabbedSources({
  sources,
  entityType,
  entityCode,
  gemeenteData,
  gemeenteCode,
  initialCategory,
}: CategoryTabbedSourcesProps) {
  // Only show categories that have sources
  const availableCategories = useMemo(() => {
    const categoriesWithSources = new Set(sources.map((s) => s.category));
    return CATEGORY_CONFIG.filter((c) => categoriesWithSources.has(c.key));
  }, [sources]);

  const [activeCategory, setActiveCategory] = useState<DataSourceCategory>(
    () => {
      if (
        initialCategory &&
        availableCategories.some((c) => c.key === initialCategory)
      ) {
        return initialCategory as DataSourceCategory;
      }
      return availableCategories[0]?.key ?? "ruimtelijk";
    },
  );

  const filtered = useMemo(
    () => sources.filter((s) => s.category === activeCategory),
    [sources, activeCategory],
  );

  return (
    <div className="space-y-5">
      {/* Pill tab bar */}
      <div className="flex w-full h-[40px] rounded-full p-1 bg-[#F2F6F3]">
        {availableCategories.map((cat) => {
          const isActive = cat.key === activeCategory;
          const count = sources.filter((s) => s.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="relative flex-1 h-full rounded-full flex items-center justify-center gap-1.5 transition-colors"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "11px",
                fontWeight: isActive ? 700 : 600,
                color: isActive ? undefined : "#94a3b8",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="category-tab"
                  className="absolute inset-0 rounded-full bg-[#0E1111]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${isActive ? "text-white" : ""}`}>
                {cat.label}
              </span>
              <span
                className={`relative z-10 text-[9px] tabular-nums ${isActive ? "text-slate-400" : "text-slate-300"}`}
              >
                {count}
              </span>
            </button>
          );
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
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-5 grid-cols-1 sm:grid-cols-2"
        >
          {filtered.map((source) => (
            <motion.div key={source.key} variants={fadeUp}>
              <DataSourceCard
                source={source}
                entityType={entityType}
                entityCode={entityCode}
                gemeenteData={gemeenteData}
                gemeenteCode={gemeenteCode}
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─── Entity detail view (reusable for gemeente + provincie) ── */

interface EntityDetailProps {
  entityType: "Gemeente" | "Provincie";
  entityCode: string;
  entityName: string;
  svgData: { d: string; viewBox: string } | null;
  sources: DataSource[];
  onBack: () => void;
  gemeenteData?: GemeenteIntelligenceData;
  initialCategory?: string;
}

function EntityDetail({
  entityType,
  entityCode,
  entityName,
  svgData,
  sources,
  onBack,
  gemeenteData,
  initialCategory,
}: EntityDetailProps) {
  const liveCount = sources.filter((s) => s.status === "live").length;
  const roadmapCount = sources.filter((s) => s.status === "roadmap").length;
  const totalCount = sources.length;

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
        Beleid
      </motion.button>

      {/* Hero */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-5"
      >
        {svgData && (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-[16px] border border-[#EAEFEF] bg-[#F2F6F3]">
            <svg viewBox={svgData.viewBox} className="h-14 w-14">
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
            {entityType} · Beleidsconfiguratie
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            {entityName}
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            {entityCode} · {liveCount} actief · {roadmapCount} te configureren
          </p>
          {entityType === "Gemeente" && gemeenteData && (
            <div className="mt-2 flex flex-wrap gap-2">
              {/* Approval rate */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {gemeenteData.profile.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : gemeenteData.profile.data?.approval_rate_pct != null ? (
                  `${gemeenteData.profile.data.approval_rate_pct}% goedgekeurd`
                ) : (
                  "—"
                )}
              </span>
              {/* Bekendmakingen 30d */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {gemeenteData.profile.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : gemeenteData.profile.data?.bekendmakingen_30d != null ? (
                  `${gemeenteData.profile.data.bekendmakingen_30d} bekendmakingen (30d)`
                ) : (
                  "—"
                )}
              </span>
              {/* Severity badge */}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: gemeenteData.profile.isLoading
                    ? undefined
                    : `${SEVERITY_COLORS[gemeenteData.profile.data?.severity_label ?? "Onbekend"] ?? SEVERITY_COLORS["Onbekend"]}18`,
                  color: gemeenteData.profile.isLoading
                    ? undefined
                    : (SEVERITY_COLORS[
                        gemeenteData.profile.data?.severity_label ?? "Onbekend"
                      ] ?? SEVERITY_COLORS["Onbekend"]),
                }}
              >
                {gemeenteData.profile.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  (gemeenteData.profile.data?.severity_label ?? "—")
                )}
              </span>
              {/* Raadsstukken */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {gemeenteData.raadsinformatie.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : gemeenteData.raadsinformatie.data?.total_found != null ? (
                  `${gemeenteData.raadsinformatie.data.total_found} raadsstukken`
                ) : (
                  "—"
                )}
              </span>
              {/* Erfgoed */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                {gemeenteData.erfgoed.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : gemeenteData.erfgoed.data?.total != null ? (
                  `${gemeenteData.erfgoed.data.total} beschermde gezichten`
                ) : (
                  "—"
                )}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Overall progress bar */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <ProgressBar
          completed={liveCount}
          total={totalCount}
          label="Geconfigureerde bronnen"
        />
      </motion.div>

      {/* Category pill tabs + source rows */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <CategoryTabbedSources
          sources={sources}
          entityType={
            entityType === "Gemeente"
              ? "gemeente"
              : entityType === "Provincie"
                ? "provincie"
                : "landelijk"
          }
          entityCode={entityCode}
          gemeenteData={gemeenteData}
          gemeenteCode={entityType === "Gemeente" ? entityCode : undefined}
          initialCategory={initialCategory}
        />
      </motion.div>
    </div>
  );
}

/* ─── Gemeente detail wrapper ───────────────────────────────── */

function GemeenteDetail({
  gemeenteCode,
  onBack,
  initialCategory,
}: {
  gemeenteCode: string;
  onBack: () => void;
  initialCategory?: string;
}) {
  const { data: geojson } = useGemeenteGeoJSON();

  const gemeente = useMemo(() => {
    if (!geojson) return null;
    return (
      geojson.features.find((f) => {
        const props = f.properties as Record<string, unknown> | null;
        return String(props?.statcode ?? "") === gemeenteCode;
      }) ?? null
    );
  }, [geojson, gemeenteCode]);

  const gemeenteNaam = gemeente
    ? String(
        (gemeente.properties as Record<string, unknown>)?.statnaam ??
          gemeenteCode,
      )
    : gemeenteCode;

  const svgData = useMemo(() => {
    if (!gemeente) return null;
    const geom = gemeente.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return null;
    return geoJsonToSvgPath(geom);
  }, [gemeente]);

  // Gemeente intelligence hooks — disabled when name hasn't resolved
  const resolvedNaam = gemeenteNaam !== gemeenteCode ? gemeenteNaam : null;
  const profileQuery = useGemeenteProfile(resolvedNaam);
  const raadsinformatieQuery = useRaadsinformatie(resolvedNaam);
  const huisvestingsverordeningQuery = useHuisvestingsverordening(resolvedNaam);
  const erfgoedQuery = useErfgoed(resolvedNaam);

  const gemeenteData: GemeenteIntelligenceData = useMemo(
    () => ({
      profile: {
        data: profileQuery.data,
        isLoading: profileQuery.isLoading,
        error: profileQuery.error,
      },
      raadsinformatie: {
        data: raadsinformatieQuery.data,
        isLoading: raadsinformatieQuery.isLoading,
        error: raadsinformatieQuery.error,
      },
      huisvestingsverordening: {
        data: huisvestingsverordeningQuery.data,
        isLoading: huisvestingsverordeningQuery.isLoading,
        error: huisvestingsverordeningQuery.error,
      },
      erfgoed: {
        data: erfgoedQuery.data,
        isLoading: erfgoedQuery.isLoading,
        error: erfgoedQuery.error,
      },
    }),
    [
      profileQuery,
      raadsinformatieQuery,
      huisvestingsverordeningQuery,
      erfgoedQuery,
    ],
  );

  return (
    <EntityDetail
      entityType="Gemeente"
      entityCode={gemeenteCode}
      entityName={gemeenteNaam}
      svgData={svgData}
      sources={GEMEENTE_DATA_SOURCES}
      onBack={onBack}
      gemeenteData={gemeenteData}
      initialCategory={initialCategory}
    />
  );
}

/* ─── Gemeente grid (compact, inside accordion) ─────────────── */

function CompactGemeenteGrid({
  onSelectGemeente,
}: {
  onSelectGemeente: (code: string) => void;
}) {
  const { data: geojson, isLoading } = useGemeenteGeoJSON();
  const [search, setSearch] = useState("");

  const gemeenten = useMemo<ProcessedGemeente[]>(() => {
    if (!geojson) return [];
    return geojson.features
      .map((feature) => {
        const props = feature.properties as Record<string, unknown> | null;
        const gemeentecode = String(props?.statcode ?? "");
        const gemeentenaam = String(props?.statnaam ?? "");
        const geometry = feature.geometry as
          | GeoJSON.Polygon
          | GeoJSON.MultiPolygon;
        if (
          !gemeentecode ||
          !gemeentenaam ||
          (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
        )
          return null;
        const { d, viewBox } = geoJsonToSvgPath(geometry);
        return {
          gemeentecode,
          gemeentenaam,
          svgData: { primaryD: d, viewBox },
        };
      })
      .filter((g): g is ProcessedGemeente => g !== null)
      .sort((a, b) => a.gemeentenaam.localeCompare(b.gemeentenaam, "nl"));
  }, [geojson]);

  const filtered = useMemo(() => {
    if (!search.trim()) return gemeenten;
    const q = search.trim().toLowerCase();
    return gemeenten.filter(
      (g) =>
        g.gemeentenaam.toLowerCase().includes(q) ||
        g.gemeentecode.toLowerCase().includes(q),
    );
  }, [gemeenten, search]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-64 rounded-full bg-[#F2F6F3] animate-pulse" />
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-[16px] bg-[#F2F6F3] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <MapPin
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
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
          {filtered.length} gemeente{filtered.length !== 1 ? "n" : ""} gevonden
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
  );
}

/* ─── Provincie detail wrapper ──────────────────────────────── */

function ProvincieDetail({
  provincieCode,
  onBack,
  initialCategory,
}: {
  provincieCode: string;
  onBack: () => void;
  initialCategory?: string;
}) {
  const { data: geojson } = useProvincieGeoJSON();

  const provincie = useMemo(() => {
    if (!geojson) return null;
    return (
      geojson.features.find((f) => {
        const props = f.properties as Record<string, unknown> | null;
        return String(props?.statcode ?? "") === provincieCode;
      }) ?? null
    );
  }, [geojson, provincieCode]);

  const provincieNaam = provincie
    ? String(
        (provincie.properties as Record<string, unknown>)?.statnaam ??
          provincieCode,
      )
    : provincieCode;

  const svgData = useMemo(() => {
    if (!provincie) return null;
    const geom = provincie.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") return null;
    return geoJsonToSvgPath(geom);
  }, [provincie]);

  return (
    <EntityDetail
      entityType="Provincie"
      entityCode={provincieCode}
      entityName={provincieNaam}
      svgData={svgData}
      sources={PROVINCIE_DATA_SOURCES}
      onBack={onBack}
      initialCategory={initialCategory}
    />
  );
}

/* ─── Province grid (compact, inside accordion) ─────────────── */

function CompactProvincieGrid({
  onSelectProvincie,
}: {
  onSelectProvincie: (code: string) => void;
}) {
  const { data: geojson, isLoading } = useProvincieGeoJSON();

  const provincies = useMemo<ProcessedProvincie[]>(() => {
    if (!geojson) return [];
    return geojson.features
      .map((feature) => {
        const props = feature.properties as Record<string, unknown> | null;
        const provinciecode = String(props?.statcode ?? "");
        const provincienaam = String(props?.statnaam ?? "");
        const geometry = feature.geometry as
          | GeoJSON.Polygon
          | GeoJSON.MultiPolygon;
        if (
          !provinciecode ||
          !provincienaam ||
          (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
        )
          return null;
        const { d, viewBox } = geoJsonToSvgPath(geometry);
        return {
          provinciecode,
          provincienaam,
          svgData: { primaryD: d, viewBox },
        };
      })
      .filter((p): p is ProcessedProvincie => p !== null)
      .sort((a, b) => a.provincienaam.localeCompare(b.provincienaam, "nl"));
  }, [geojson]);

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] rounded-2xl bg-[#F2F6F3] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {provincies.map((p) => (
        <button
          key={p.provinciecode}
          onClick={() => onSelectProvincie(p.provinciecode)}
          className="group flex items-center gap-4 rounded-2xl border-2 border-aura-obsidian/40 bg-aura-glass-white/60 px-5 py-4 text-left transition-all hover:border-aura-obsidian/60 hover:shadow-sm"
        >
          <div className="flex size-14 shrink-0 items-center justify-center">
            <svg viewBox={p.svgData.viewBox} className="h-12 w-12">
              <path
                d={p.svgData.primaryD}
                fill="#F9A826"
                fillOpacity={0.15}
                stroke="#F9A826"
                strokeWidth={1.5}
                strokeLinejoin="round"
                className="transition-all group-hover:fill-opacity-30"
              />
            </svg>
          </div>
          <span className="text-[15px] font-bold leading-snug text-aura-obsidian">
            {p.provincienaam}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ─── Landelijk content (curated subsidies, compact) ────────── */

function LandelijkContent({
  initialCategory,
}: {
  initialCategory?: string;
}) {
  return (
    <CategoryTabbedSources
      sources={LANDELIJK_DATA_SOURCES}
      entityType="landelijk"
      entityCode="NL"
      initialCategory={initialCategory}
    />
  );
}

/* ─── Source detail workspace (skeleton — T02/T03 add content) ── */

/* ─── Metric card helper ────────────────────────────────────── */

function MetricCard({
  label,
  value,
  unit,
  muted,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white p-5">
      <p className="text-[28px] font-black leading-none text-[#0E1111]">
        {value != null ? value : "—"}
        {unit && (
          <span className="ml-1 text-[14px] font-semibold text-slate-400">
            {unit}
          </span>
        )}
      </p>
      <p
        className={`mt-1.5 text-[12px] font-semibold ${muted ? "text-slate-400" : "text-slate-500"}`}
      >
        {label}
      </p>
    </div>
  );
}

/* ─── Source detail workspace ───────────────────────────────── */

function SourceDetailWorkspace({
  sourceKey,
  gemeenteCode,
  onBack,
}: {
  sourceKey: string;
  gemeenteCode: string;
  onBack: () => void;
}) {
  const source = GEMEENTE_DATA_SOURCES.find((s) => s.key === sourceKey);

  // Resolve gemeenteNaam from geojson (hooks need display name, not code)
  const { data: geojson } = useGemeenteGeoJSON();
  const gemeenteNaam = useMemo(() => {
    if (!geojson) return null;
    const feature = geojson.features.find(
      (f) =>
        String((f.properties as Record<string, unknown>)?.statcode ?? "") ===
        gemeenteCode,
    );
    return feature
      ? String(
          (feature.properties as Record<string, unknown>)?.statnaam ??
            gemeenteCode,
        )
      : gemeenteCode;
  }, [geojson, gemeenteCode]);

  // Only call hooks with resolved name (not the code fallback)
  const resolvedNaam =
    gemeenteNaam && gemeenteNaam !== gemeenteCode ? gemeenteNaam : null;

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useGemeenteProfile(resolvedNaam);
  const {
    data: raadsData,
    isLoading: raadsLoading,
    error: raadsError,
  } = useRaadsinformatie(resolvedNaam);
  const {
    data: huisvData,
    isLoading: huisvLoading,
    error: huisvError,
  } = useHuisvestingsverordening(resolvedNaam);
  const {
    data: erfgoedData,
    isLoading: erfgoedLoading,
    error: erfgoedError,
  } = useErfgoed(resolvedNaam);

  // Breadcrumb label — graceful fallback to "gemeente" if naam not loaded
  // (matches provincie pattern; avoids showing the raw gemeenteCode like "GM0983")
  const breadcrumbLabel = gemeenteNaam ?? "gemeente";

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
          <p className="text-[13px] text-slate-400">
            Databron &ldquo;{sourceKey}&rdquo; niet gevonden.
          </p>
        </div>
      </div>
    );
  }

  const Icon = source.icon;

  // Render the source-specific detail content
  const renderDetail = () => {
    switch (sourceKey) {
      case "vergunning-klimaat":
        return <VergunningKlimaatDetailEnriched gemeenteNaam={resolvedNaam} />;
      case "jurisprudentie":
        return <JurisprudentieDetailEnriched gemeenteNaam={resolvedNaam} />;
      case "bekendmakingen":
        return (
          <BekendmakingenDetailEnriched
            gemeenteNaam={resolvedNaam}
            profile={profile}
            profileLoading={profileLoading}
            profileError={profileError}
          />
        );
      case "raadsinformatie":
        return <RaadsinformatieDetailEnriched gemeenteNaam={resolvedNaam} />;
      case "huisvestingsverordening":
        return (
          <HuisvestingsverordeningDetailEnriched gemeenteNaam={resolvedNaam} />
        );
      case "beschermd-erfgoed":
        return <BeschermdErfgoedDetailEnriched gemeenteNaam={resolvedNaam} />;
      default:
        return (
          <DocumentSourceDetailView
            entityType="gemeente"
            entityCode={gemeenteCode}
            sourceKey={sourceKey}
          />
        );
    }
  };

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
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-4"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-[#0E1111]">
          <Icon className="size-7 text-[#F9A826]" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Databron · {source.category}
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            {source.label}
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            {source.description}
          </p>
        </div>
      </motion.div>

      {/* Source-specific detail content */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        {renderDetail()}
      </motion.div>
    </div>
  );
}

/* ─── Provincie source detail workspace ────────────────────── */

function ProvincieSourceDetailWorkspace({
  sourceKey,
  provincieCode,
  onBack,
}: {
  sourceKey: string;
  provincieCode: string;
  onBack: () => void;
}) {
  const source = PROVINCIE_DATA_SOURCES.find((s) => s.key === sourceKey);

  // Resolve provincie naam from geojson for breadcrumb consistency
  // with the gemeente workspace's "Terug naar Venlo" pattern.
  const { data: provincieGeoJSON } = useProvincieGeoJSON(true);
  const provincieNaam = useMemo(() => {
    if (!provincieGeoJSON) return null;
    const feature = provincieGeoJSON.features.find(
      (f) =>
        String((f.properties as Record<string, unknown>)?.statcode ?? "") ===
        provincieCode,
    );
    return feature
      ? String(
          (feature.properties as Record<string, unknown>)?.statnaam ??
            provincieCode,
        )
      : provincieCode;
  }, [provincieGeoJSON, provincieCode]);

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
          Terug naar {provincieNaam ?? "provincie"}
        </motion.button>
        <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
          <p className="text-[13px] text-slate-400">
            Databron &ldquo;{sourceKey}&rdquo; niet gevonden.
          </p>
        </div>
      </div>
    );
  }

  const Icon = source.icon;

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
        Terug naar {provincieNaam ?? "provincie"}
      </motion.button>

      {/* Source heading — mirrors gemeente SourceDetailWorkspace */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-4"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-[#0E1111]">
          <Icon className="size-7 text-[#F9A826]" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Databron · {source.category}
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            {source.label}
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            {source.description}
          </p>
        </div>
      </motion.div>

      {/* Always the shared shell — no enriched cases at provincie level */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <DocumentSourceDetailView
          entityType="provincie"
          entityCode={provincieCode}
          sourceKey={sourceKey}
        />
      </motion.div>
    </div>
  );
}

/* ─── Landelijk source detail view ──────────────────────────── */

function LandelijkSourceDetail({
  sourceKey,
  onBack,
}: {
  sourceKey: string;
  onBack: () => void;
}) {
  const source = LANDELIJK_DATA_SOURCES.find((s) => s.key === sourceKey);

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
          Terug naar overzicht
        </motion.button>
        <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center">
          <p className="text-[13px] text-slate-400">
            Databron &ldquo;{sourceKey}&rdquo; niet gevonden.
          </p>
        </div>
      </div>
    );
  }

  const Icon = source.icon;

  const renderLandelijkDetail = () => {
    switch (sourceKey) {
      case "rvo-subsidies":
        return <RvoSubsidiesDetailEnriched />;
      case "omgevingswet":
        return <OmgevingswetDetailEnriched />;
      default:
        return (
          <DocumentSourceDetailView
            entityType="landelijk"
            entityCode="NL"
            sourceKey={sourceKey}
          />
        );
    }
  };

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
        Terug naar overzicht
      </motion.button>

      {/* Source heading */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-4"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-[#0E1111]">
          <Icon className="size-7 text-[#F9A826]" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Databron · {source.category}
          </p>
          <h1 className="text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            {source.label}
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            {source.description}
          </p>
        </div>
      </motion.div>

      {/* Source-specific detail content */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        {renderLandelijkDetail()}
      </motion.div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────── */

function ConfiguratiePage() {
  const navigate = useNavigate();
  const {
    gemeente: activeGemeente,
    provincie: activeProvincie,
    source: activeSource,
    category: activeCategory,
    niveau: activeNiveau,
  } = Route.useSearch();
  const { data: gemeenteGeoJSON } = useGemeenteGeoJSON(
    activeNiveau === "gemeentelijk" || !!activeGemeente,
  );
  const { data: provincieGeoJSON } = useProvincieGeoJSON(
    activeNiveau === "provinciaal" || !!activeProvincie,
  );

  const landelijkCount = LANDELIJK_DATA_SOURCES.length;
  const gemeenteCount = gemeenteGeoJSON?.features?.length ?? "342";
  const provincieCount = provincieGeoJSON?.features?.length ?? "12";

  const handleSelectGemeente = useCallback(
    (code: string) => {
      navigate({ to: "/beleid", search: { gemeente: code, provincie: undefined, source: undefined, category: undefined, niveau: undefined } });
    },
    [navigate],
  );

  const handleSelectProvincie = useCallback(
    (code: string) => {
      navigate({ to: "/beleid", search: { gemeente: undefined, provincie: code, source: undefined, category: undefined, niveau: undefined } });
    },
    [navigate],
  );

  const handleBackToMain = useCallback(() => {
    navigate({ to: "/beleid", search: { gemeente: undefined, provincie: undefined, source: undefined, category: undefined, niveau: undefined } });
  }, [navigate]);

  // If source workspace is selected, show full-page source detail
  if (activeGemeente && activeSource) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <SourceDetailWorkspace
            sourceKey={activeSource}
            gemeenteCode={activeGemeente}
            onBack={() =>
              navigate({
                to: "/beleid",
                search: { gemeente: activeGemeente, provincie: undefined, source: undefined, category: activeCategory, niveau: undefined },
              })
            }
          />
        </div>
      </ResultsShell>
    );
  }

  // Provincie source workspace — must be checked BEFORE activeProvincie alone
  if (activeProvincie && activeSource) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <ProvincieSourceDetailWorkspace
            sourceKey={activeSource}
            provincieCode={activeProvincie}
            onBack={() =>
              navigate({
                to: "/beleid",
                search: { gemeente: undefined, provincie: activeProvincie, source: undefined, category: activeCategory, niveau: undefined },
              })
            }
          />
        </div>
      </ResultsShell>
    );
  }

  // If gemeente is selected, show detail view
  if (activeGemeente) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <GemeenteDetail
            gemeenteCode={activeGemeente}
            onBack={handleBackToMain}
            initialCategory={activeCategory}
          />
        </div>
      </ResultsShell>
    );
  }

  // If provincie is selected, show detail view
  if (activeProvincie) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <ProvincieDetail
            provincieCode={activeProvincie}
            onBack={handleBackToMain}
            initialCategory={activeCategory}
          />
        </div>
      </ResultsShell>
    );
  }

  // If landelijk source is selected (no gemeente, no provincie), show landelijk detail view
  if (activeSource && !activeGemeente && !activeProvincie) {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl">
          <LandelijkSourceDetail
            sourceKey={activeSource}
            onBack={() =>
              navigate({
                to: "/beleid",
                search: { gemeente: undefined, provincie: undefined, source: undefined, niveau: "landelijk", category: activeCategory },
              })
            }
          />
        </div>
      </ResultsShell>
    );
  }

  // Niveau sub-pages
  if (activeNiveau === "landelijk") {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl space-y-6">
          <motion.button
            variants={fadeUp}
            initial="hidden"
            animate="show"
            onClick={handleBackToMain}
            className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
          >
            <ArrowLeft size={14} />
            Beleid
          </motion.button>
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Bestuursniveau
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
              Landelijk
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Rijkssubsidies, nationale regelgeving en RVO-instrumenten
            </p>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <LandelijkContent initialCategory={activeCategory} />
          </motion.div>
        </div>
      </ResultsShell>
    );
  }

  if (activeNiveau === "provinciaal") {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl space-y-6">
          <motion.button
            variants={fadeUp}
            initial="hidden"
            animate="show"
            onClick={handleBackToMain}
            className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
          >
            <ArrowLeft size={14} />
            Beleid
          </motion.button>
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Bestuursniveau
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
              Provinciaal
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              12 provincies — regionaal beleid, subsidies en verordeningen
            </p>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <CompactProvincieGrid onSelectProvincie={handleSelectProvincie} />
          </motion.div>
        </div>
      </ResultsShell>
    );
  }

  if (activeNiveau === "gemeentelijk") {
    return (
      <ResultsShell>
        <div className="mx-auto max-w-4xl space-y-6">
          <motion.button
            variants={fadeUp}
            initial="hidden"
            animate="show"
            onClick={handleBackToMain}
            className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#0E1111]"
          >
            <ArrowLeft size={14} />
            Beleid
          </motion.button>
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Bestuursniveau
            </p>
            <h1 className="mt-1 text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
              Gemeentelijk
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              342 gemeenten — lokaal beleid, vergunningklimaat en databronnen
            </p>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <CompactGemeenteGrid onSelectGemeente={handleSelectGemeente} />
          </motion.div>
        </div>
      </ResultsShell>
    );
  }

  return (
    <ResultsShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Bestuursniveau
          </p>
          <h1 className="mt-1 text-[28px] font-black leading-none tracking-tight text-[#0E1111]">
            Beleid
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            Kies een bestuursniveau om databronnen en beleidsdocumenten te beheren.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-3 gap-3"
        >
          {NIVEAU_CONFIGS.map((config) => (
            <motion.button
              key={config.key}
              variants={fadeUp}
              onClick={() =>
                navigate({ to: "/beleid", search: { gemeente: undefined, provincie: undefined, source: undefined, category: undefined, niveau: config.key } })
              }
              className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-aura-obsidian/40 bg-aura-glass-white/60 px-5 py-5 text-left transition-all hover:border-aura-obsidian/60 hover:shadow-sm"
            >
              <span className="block text-[15px] font-bold leading-snug text-aura-obsidian">
                {config.label}
              </span>
              <span className="mt-1.5 block text-[12px] leading-relaxed text-slate-400">
                {config.description}
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </ResultsShell>
  );
}
