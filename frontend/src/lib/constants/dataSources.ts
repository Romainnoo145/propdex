/**
 * Shared data-source catalog (M045/S05 T00).
 *
 * Single source of truth for cascade source_keys across:
 *   - /beleid hub (visualization + live data fetches)
 *   - /instellingen/beleid-beheer admin upload UI
 *   - backend source_keys.py (Python mirror)
 *
 * NOTE: LucideIcon refs stay OUT of this shared file — only beleid.tsx needs them.
 */
export type DataSourceCategory =
  | "ruimtelijk"
  | "juridisch"
  | "financieel"
  | "duurzaamheid"
  | "monitoring";

export type DataSourceStatus = "live" | "roadmap";

export type CascadeLevel = "landelijk" | "provincie" | "gemeente";

export interface DataSourceEntry {
  key: string;
  label: string;
  category: DataSourceCategory;
  status: DataSourceStatus;
  description: string;
}

export const LEVEL_LABELS: Record<CascadeLevel, string> = {
  landelijk: "Landelijk",
  provincie: "Provinciaal",
  gemeente: "Gemeentelijk",
};

export const CATEGORY_CONFIG: Array<{
  key: DataSourceCategory;
  label: string;
}> = [
  { key: "ruimtelijk", label: "Ruimtelijk" },
  { key: "juridisch", label: "Juridisch" },
  { key: "financieel", label: "Financieel" },
  { key: "duurzaamheid", label: "Duurzaamheid" },
  { key: "monitoring", label: "Monitoring" },
];

/* ─── Gemeente data source catalog ──────────────────────────── */

export const GEMEENTE_DATA_SOURCES: DataSourceEntry[] = [
  // Ruimtelijk
  {
    key: "omgevingsvisie",
    label: "Omgevingsvisie",
    category: "ruimtelijk",
    status: "roadmap",
    description:
      "Langetermijnvisie op de leefomgeving — ontwikkelrichting, verdichtingsgebieden.",
  },
  {
    key: "welstandsnota",
    label: "Welstandsnota",
    category: "ruimtelijk",
    status: "roadmap",
    description:
      "Welstandseisen per gebied: materiaalgebruik, kleurschema, bouwhoogte.",
  },
  {
    key: "woonvisie",
    label: "Woonvisie",
    category: "ruimtelijk",
    status: "roadmap",
    description:
      "Woningbouwprogramma: aantallen per segment, doelgroepen, prioriteitsgebieden.",
  },
  {
    key: "parkeerbeleid",
    label: "Parkeerbeleid",
    category: "ruimtelijk",
    status: "roadmap",
    description: "Parkeernormen per woningtype en stedelijkheidszone.",
  },
  {
    key: "parkeernormen",
    label: "Nota parkeernormen",
    category: "ruimtelijk",
    status: "live",
    description:
      "Gemeentelijke parkeernorm-systematiek: auto-/fietsnormen per functie en gebied.",
  },
  {
    key: "huisvestingsverordening",
    label: "Huisvestingsverordening",
    category: "ruimtelijk",
    status: "live",
    description: "Regels voor woningvorming, splitsing en onttrekking.",
  },
  // Juridisch
  {
    key: "vergunning-klimaat",
    label: "Vergunning-klimaat",
    category: "juridisch",
    status: "live",
    description:
      "Vergunningsaanvragen en besluiten — tempo, goedkeuringspercentage en trends.",
  },
  {
    key: "jurisprudentie",
    label: "Jurisprudentie & AI-analyse",
    category: "juridisch",
    status: "live",
    description: "Relevante rechtszaken met AI-analyse van uitspraken.",
  },
  {
    key: "raadsinformatie",
    label: "Raadsinformatie",
    category: "juridisch",
    status: "live",
    description:
      "Gemeenteraadsvergaderingen, moties en besluiten over ruimtelijke ordening.",
  },
  {
    key: "leegstandsverordening",
    label: "Leegstandsverordening",
    category: "juridisch",
    status: "roadmap",
    description:
      "Regels voor leegstandsmeldplicht — indicator voor transformatiekansen.",
  },
  // Financieel
  {
    key: "gemeentelijke-subsidies",
    label: "Gemeentelijke subsidies",
    category: "financieel",
    status: "roadmap",
    description:
      "Gemeente-specifieke subsidies voor woningbouw en verduurzaming.",
  },
  {
    key: "grondprijsbeleid",
    label: "Grondprijsbeleid",
    category: "financieel",
    status: "roadmap",
    description:
      "Gemeentelijke grondprijzen per bestemming uit de grondprijzenbrief.",
  },
  // Duurzaamheid
  {
    key: "duurzaamheidsbeleid",
    label: "Duurzaamheidsbeleid",
    category: "duurzaamheid",
    status: "roadmap",
    description: "Aanvullende duurzaamheidseisen: gasloos, BENG, groene daken.",
  },
  {
    key: "beschermd-erfgoed",
    label: "Beschermd erfgoed",
    category: "duurzaamheid",
    status: "live",
    description:
      "Rijksmonumenten en beschermde stadsgezichten via het RCE-register.",
  },
  {
    key: "erfgoedverordening",
    label: "Erfgoedverordening",
    category: "duurzaamheid",
    status: "roadmap",
    description: "Lokale gemeentelijke monumenten — eigen beschermingsregime.",
  },
  // Monitoring
  {
    key: "bekendmakingen",
    label: "Bekendmakingen monitoring",
    category: "monitoring",
    status: "live",
    description: "Automatische monitoring van officiële bekendmakingen.",
  },
  {
    key: "nieuws-monitoring",
    label: "Nieuws & beleidsmonitoring",
    category: "monitoring",
    status: "roadmap",
    description:
      "Automatische signalering van beleidswijzigingen en raadsbesluiten.",
  },
];

/* ─── Province data source catalog ──────────────────────────── */

export const PROVINCIE_DATA_SOURCES: DataSourceEntry[] = [
  // Ruimtelijk
  {
    key: "omgevingsverordening",
    label: "Omgevingsverordening",
    category: "ruimtelijk",
    status: "roadmap",
    description:
      "Provinciale regels voor ruimtegebruik, bouwhoogtes, beschermde gebieden.",
  },
  {
    key: "ruimtelijke-visie",
    label: "Provinciale omgevingsvisie",
    category: "ruimtelijk",
    status: "roadmap",
    description:
      "Langetermijnvisie op ruimtelijke ontwikkeling, verstedelijking en landschap.",
  },
  {
    key: "woondeals",
    label: "Woondeals & woningbouwafspraken",
    category: "ruimtelijk",
    status: "roadmap",
    description:
      "Afspraken over woningbouwaantallen en versnellingslocaties per regio.",
  },
  // Financieel
  {
    key: "provinciale-subsidies",
    label: "Provinciale subsidies",
    category: "financieel",
    status: "roadmap",
    description:
      "Subsidies voor verduurzaming, transformatie en woningbouw vanuit de provincie.",
  },
  // Duurzaamheid
  {
    key: "natuur-stikstof",
    label: "Natuur & stikstof",
    category: "duurzaamheid",
    status: "roadmap",
    description:
      "Natura 2000, stikstofbeleid en beperkingen voor bouw nabij natuurgebieden.",
  },
  {
    key: "erfgoed-provinciaal",
    label: "Provinciaal erfgoed",
    category: "duurzaamheid",
    status: "roadmap",
    description:
      "Provinciale monumentenlijst en cultuurhistorische waardenkaart.",
  },
  {
    key: "energie-transitie",
    label: "Energietransitie",
    category: "duurzaamheid",
    status: "roadmap",
    description:
      "Regionale energiestrategie (RES), zoekgebieden wind/zon, warmtenetten.",
  },
  // Monitoring
  {
    key: "mobiliteit",
    label: "Mobiliteitsbeleid",
    category: "monitoring",
    status: "roadmap",
    description:
      "OV-knooppunten, bereikbaarheid en mobiliteitstransitie per regio.",
  },
];

/* ─── Landelijk data source catalog ─────────────────────────── */

export const LANDELIJK_DATA_SOURCES: DataSourceEntry[] = [
  // Ruimtelijk
  {
    key: "omgevingswet",
    label: "Omgevingswet & Bbl",
    category: "ruimtelijk",
    status: "live",
    description:
      "Bouwbesluit, vergunningvrij bouwen, procedures onder de Omgevingswet.",
  },
  {
    key: "ladder-verstedelijking",
    label: "Ladder duurzame verstedelijking",
    category: "ruimtelijk",
    status: "roadmap",
    description:
      "Verplichte onderbouwing bij nieuwe woningbouwplannen buiten bestaand stedelijk gebied.",
  },
  {
    key: "nationale-woonagenda",
    label: "Nationale Woonagenda",
    category: "ruimtelijk",
    status: "roadmap",
    description:
      "Volkshuisvestingsprogramma, woningbouwtargets en versnellingsafspraken.",
  },
  // Juridisch
  {
    key: "woningwet",
    label: "Woningwet & corporatieregels",
    category: "juridisch",
    status: "roadmap",
    description:
      "Regels voor sociale huur, DAEB/niet-DAEB scheiding, markttoets.",
  },
  {
    key: "asbest-sloop",
    label: "Asbest & sloopregels",
    category: "juridisch",
    status: "roadmap",
    description:
      "Inventarisatieplicht, saneringsregels bij renovatie en transformatie.",
  },
  // Financieel
  {
    key: "rvo-subsidies",
    label: "RVO subsidies & financiering",
    category: "financieel",
    status: "live",
    description:
      "Woningbouwimpuls, SSEB, volkshuisvestingsfonds en andere rijkssubsidies via RVO.",
  },
  // Duurzaamheid
  {
    key: "beng-energieprestatie",
    label: "BENG & energieprestatie",
    category: "duurzaamheid",
    status: "roadmap",
    description:
      "Eisen nieuwbouw energieprestatie, energielabel verplichting, EPBD-richtlijn.",
  },
  {
    key: "stikstof-nationaal",
    label: "Stikstof & Natura 2000",
    category: "duurzaamheid",
    status: "roadmap",
    description:
      "PAS-melding, AERIUS-berekening, bouwvrijstelling status en procedures.",
  },
  // Monitoring
  {
    key: "rijksbeleid-monitoring",
    label: "Rijksbeleid monitoring",
    category: "monitoring",
    status: "roadmap",
    description:
      "Automatische signalering van wijzigingen in nationale wet- en regelgeving.",
  },
];

export function getSourcesForLevel(level: CascadeLevel): DataSourceEntry[] {
  if (level === "landelijk") return LANDELIJK_DATA_SOURCES;
  if (level === "provincie") return PROVINCIE_DATA_SOURCES;
  return GEMEENTE_DATA_SOURCES;
}

export function getSourceLabel(
  level: CascadeLevel,
  key: string,
): string | null {
  return getSourcesForLevel(level).find((s) => s.key === key)?.label ?? null;
}
