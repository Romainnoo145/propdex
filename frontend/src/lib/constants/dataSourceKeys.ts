/**
 * Vendor-managed catalog of data-source keys (M049/S01) — TS mirror of
 * backend/app/policy_documents/data_source_keys.py.
 *
 * DELIBERATELY SEPARATE from `frontend/src/lib/constants/dataSources.ts` (which is
 * the M045 cascade-level catalog for policy document uploads). Naming-confusion-risk
 * was the eng-review locked decision 2026-05-14.
 *
 * Drift caught by
 * `backend/tests/unit/test_data_source_keys_catalog.py::test_python_ts_catalog_key_sets_match`.
 */

export type SourceType = "A" | "B" | "C";

export interface DataSourceKeyEntry {
  key: string;
  label_nl: string;
  source_type: SourceType;
  description: string;
  voedt_factor: string[];
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  A: "Beleidsdocumenten",
  B: "Open APIs",
  C: "Betaalde integraties",
};

// Type A — cascade-uploads (PDF/document-based)
const TYPE_A_ENTRIES: DataSourceKeyEntry[] = [
  {
    key: "woonvisie",
    label_nl: "Woonvisie / Volkshuisvestingsprogramma",
    source_type: "A",
    description:
      "Gemeentelijk woningbouwprogramma per wijk — segmenten, doelgroepen, prioriteiten.",
    voedt_factor: ["woonvisie_match"],
  },
  {
    key: "omgevingsvisie",
    label_nl: "Omgevingsvisie (gemeente)",
    source_type: "A",
    description:
      "Langetermijnvisie op leefomgeving — ontwikkelrichting + verdichtingsgebieden.",
    voedt_factor: ["beleidsalignement"],
  },
  {
    key: "huisvestingsverordening",
    label_nl: "Huisvestingsverordening",
    source_type: "A",
    description: "Regels voor woningvorming, splitsing en onttrekking.",
    voedt_factor: ["splitsingsrisico"],
  },
  {
    key: "welstandsnota",
    label_nl: "Welstandsnota",
    source_type: "A",
    description: "Welstandseisen per gebied: materiaal, kleur, bouwhoogte.",
    voedt_factor: ["welstand_beperking"],
  },
  {
    key: "parkeerbeleid",
    label_nl: "Parkeerbeleid",
    source_type: "A",
    description: "Parkeernormen per woningtype en stedelijkheidszone.",
    voedt_factor: ["parkeerdruk"],
  },
  {
    key: "parkeernormen",
    label_nl: "Nota parkeernormen",
    source_type: "A",
    description: "Gemeentelijke parkeernorm-systematiek: auto-/fietsnormen per functie en gebied.",
    voedt_factor: ["parkeerdruk"],
  },
  {
    key: "duurzaamheidsbeleid",
    label_nl: "Duurzaamheidsbeleid",
    source_type: "A",
    description: "Aanvullende duurzaamheidseisen: gasloos, BENG, groene daken.",
    voedt_factor: ["duurzaamheid_kosten"],
  },
  {
    key: "erfgoedverordening",
    label_nl: "Erfgoedverordening",
    source_type: "A",
    description: "Lokale gemeentelijke monumenten — eigen beschermingsregime.",
    voedt_factor: ["monument"],
  },
  {
    key: "omgevingsverordening-provincie",
    label_nl: "Omgevingsverordening (provincie)",
    source_type: "A",
    description:
      "Provinciale regels voor ruimtegebruik, bouwhoogtes, beschermde gebieden.",
    voedt_factor: ["bestemming"],
  },
  {
    key: "provinciale-omgevingsvisie",
    label_nl: "Provinciale omgevingsvisie",
    source_type: "A",
    description: "Langetermijnvisie provincie — verstedelijking + landschap.",
    voedt_factor: ["beleidsalignement_provincie"],
  },
  {
    key: "woondeals",
    label_nl: "Woondeals & woningbouwafspraken",
    source_type: "A",
    description:
      "Regionale afspraken woningbouwaantallen + versnellingslocaties.",
    voedt_factor: ["woonvisie_match"],
  },
  {
    key: "provinciaal-erfgoed",
    label_nl: "Provinciaal erfgoed",
    source_type: "A",
    description:
      "Provinciale monumentenlijst + cultuurhistorische waardenkaart.",
    voedt_factor: ["monument"],
  },
  {
    key: "natuur-stikstof-provincie",
    label_nl: "Natuur & stikstof (provincie)",
    source_type: "A",
    description:
      "Natura 2000, stikstofbeleid, beperkingen bouw nabij natuurgebieden.",
    voedt_factor: ["stikstofrisico"],
  },
  {
    key: "energietransitie-res",
    label_nl: "Regionale Energiestrategie (RES)",
    source_type: "A",
    description: "Zoekgebieden wind/zon, warmtenetten per regio.",
    voedt_factor: ["energie_context"],
  },
  {
    key: "mobiliteitsbeleid",
    label_nl: "Mobiliteitsbeleid",
    source_type: "A",
    description:
      "OV-knooppunten, bereikbaarheid, mobiliteitstransitie per regio.",
    voedt_factor: ["bereikbaarheid"],
  },
  {
    key: "raadsinformatie",
    label_nl: "Raadsinformatie",
    source_type: "A",
    description: "Gemeenteraadsvergaderingen, moties, besluiten over RO.",
    voedt_factor: ["politiek_klimaat"],
  },
  {
    key: "leegstandsverordening",
    label_nl: "Leegstandsverordening",
    source_type: "A",
    description:
      "Regels leegstandsmeldplicht — indicator voor transformatiekansen.",
    voedt_factor: ["leegstandsdruk"],
  },
  {
    key: "gemeentelijke-subsidies",
    label_nl: "Gemeentelijke subsidies",
    source_type: "A",
    description:
      "Gemeente-specifieke subsidies voor woningbouw + verduurzaming.",
    voedt_factor: ["subsidie_potentie"],
  },
  {
    key: "provinciale-subsidies",
    label_nl: "Provinciale subsidies",
    source_type: "A",
    description:
      "Subsidies voor verduurzaming, transformatie, woningbouw vanuit provincie.",
    voedt_factor: ["subsidie_potentie"],
  },
  {
    key: "grondprijsbeleid",
    label_nl: "Grondprijsbeleid",
    source_type: "A",
    description:
      "Gemeentelijke grondprijzen per bestemming (grondprijzenbrief).",
    voedt_factor: ["grondwaarde_fit"],
  },
  {
    key: "omgevingsplan-bouwregels",
    label_nl: "Omgevingsplan bouwregels",
    source_type: "A",
    description:
      "DSO-derived bouwregels per gebied (max_bouwhoogte, max_bouwlagen, FAR).",
    voedt_factor: ["bestemming", "transformatiepotentie"],
  },
  {
    key: "omgevingswet-bbl",
    label_nl: "Omgevingswet & Bbl (landelijk)",
    source_type: "A",
    description:
      "Landelijk wettelijk kader: Omgevingswet + Besluit bouwwerken leefomgeving.",
    voedt_factor: ["vergunning_succeskans"],
  },
];

// Type B — open APIs
const TYPE_B_ENTRIES: DataSourceKeyEntry[] = [
  {
    key: "bag-panden",
    label_nl: "BAG Panden",
    source_type: "B",
    description:
      "Pand-geometrie + bouwjaar + status uit Basisregistratie Adressen en Gebouwen.",
    voedt_factor: ["pand_status", "bouwjaar"],
  },
  {
    key: "bag-adressen",
    label_nl: "BAG Adressen + PDOK Locatieserver",
    source_type: "B",
    description: "Adres-lookup via PDOK suggest + lookup endpoints.",
    voedt_factor: [],
  },
  {
    key: "3d-bag",
    label_nl: "3D BAG (hoogte + bouwlagen)",
    source_type: "B",
    description: "CityJSON-derived 3D-geometrie: hoogte, bouwlagen, dakvorm.",
    voedt_factor: ["transformatiepotentie"],
  },
  {
    key: "cbs-statline",
    label_nl: "CBS StatLine (wijk- en buurtcijfers)",
    source_type: "B",
    description:
      "Demografie, inkomen, woningvoorraad per wijk uit CBS OData v4.",
    voedt_factor: ["demografie", "marktcontext"],
  },
  {
    key: "bodemloket",
    label_nl: "Bodemloket (bodemkwaliteit)",
    source_type: "B",
    description: "Bodemverontreiniging, asbestrisico, sanering historie.",
    voedt_factor: ["bodemkwaliteit"],
  },
  {
    key: "pdok-funderingsrisico",
    label_nl: "PDOK funderingsrisico (KCAF)",
    source_type: "B",
    description:
      "Funderingsrisico per postcode — paalrot, droogtegevoeligheid.",
    voedt_factor: ["funderingsrisico"],
  },
  {
    key: "pdok-natura2000",
    label_nl: "PDOK Natura 2000 (WFS)",
    source_type: "B",
    description: "Natura 2000 gebieden + afstand tot beschermd gebied.",
    voedt_factor: ["stikstofrisico"],
  },
  {
    key: "rws-overstroming-wms",
    label_nl: "RWS Overstromingsrisico (WMS)",
    source_type: "B",
    description: "Overstromingskaart binnendijks / buitendijks per parcel.",
    voedt_factor: ["overstromingsrisico"],
  },
  {
    key: "rivm-geluid-lden",
    label_nl: "RIVM Geluid Lden (WMS)",
    source_type: "B",
    description: "Geluidsbelasting verkeer/spoor in dB per parcel.",
    voedt_factor: ["geluidsbelasting"],
  },
  {
    key: "rivm-luchtkwaliteit",
    label_nl: "RIVM Luchtkwaliteit NO2 + PM10",
    source_type: "B",
    description: "Stikstofdioxide + fijnstof concentraties per parcel.",
    voedt_factor: ["luchtkwaliteit"],
  },
  {
    key: "sru-bekendmakingen",
    label_nl: "SRU Bekendmakingen (officielebekendmakingen.nl)",
    source_type: "B",
    description: "Vergunningen + bekendmakingen via SRU API.",
    voedt_factor: ["vergunning_succeskans"],
  },
  {
    key: "rechtspraak-jurisprudentie",
    label_nl: "Rechtspraak.nl jurisprudentie",
    source_type: "B",
    description: "Relevante uitspraken bestuursrecht + AI-analyse.",
    voedt_factor: ["juridisch_klimaat"],
  },
  {
    key: "dso-omgevingsplan",
    label_nl: "DSO Omgevingsplan (PLU WMS)",
    source_type: "B",
    description: "Bestemming + maatvoering via DSO/PLU WMS.",
    voedt_factor: ["bestemming"],
  },
  {
    key: "koop-sru-cvdr",
    label_nl: "KOOP SRU CVDR (decentrale regelgeving)",
    source_type: "B",
    description:
      "Verordeningen + beleidsregels van gemeente/provincie/waterschap.",
    voedt_factor: ["juridisch_klimaat"],
  },
  {
    key: "rce-rijksmonumenten",
    label_nl: "RCE Rijksmonumenten + beschermd stadsgezicht",
    source_type: "B",
    description: "Rijksbeschermd erfgoed via RCE API.",
    voedt_factor: ["monument"],
  },
  {
    key: "ep-online-energielabel",
    label_nl: "EP-Online energielabel",
    source_type: "B",
    description: "Energielabel + BENG-indicatoren per adres via RVO.",
    voedt_factor: ["energielabel"],
  },
  {
    key: "kadaster-cadastral-pdok",
    label_nl: "Kadastrale percelen (PDOK)",
    source_type: "B",
    description: "Kadastrale grens + perceeloppervlakte via PDOK BRK-open.",
    voedt_factor: ["oppervlakte"],
  },
];

// Type C — paid integrations
const TYPE_C_ENTRIES: DataSourceKeyEntry[] = [
  {
    key: "brk-eigendom",
    label_nl: "BRK Eigendom (Kadaster)",
    source_type: "C",
    description:
      "Eigenaar + zakelijk recht + koopsom via Haal-Centraal BRK bevragen.",
    voedt_factor: ["eigendom_context"],
  },
  {
    key: "brk-hypotheek",
    label_nl: "BRK Hypotheken",
    source_type: "C",
    description: "Hypotheek-status + geldverstrekker via BRK bevragen.",
    voedt_factor: ["financieel_context"],
  },
  {
    key: "brk-beslag",
    label_nl: "BRK Beslagen + privaatrechtelijke beperkingen",
    source_type: "C",
    description: "Beslagen, kwalitatieve verplichtingen, erfdienstbaarheden.",
    voedt_factor: ["juridisch_klimaat"],
  },
  {
    key: "nvm-transactiedata",
    label_nl: "NVM transactiedata (Brainbay)",
    source_type: "C",
    description: "Werkelijke transactieprijzen + doorlooptijden via NVM.",
    voedt_factor: ["marktwaarde"],
  },
  {
    key: "vindsubsidies",
    label_nl: "Vindsubsidies database",
    source_type: "C",
    description:
      "Aggregator van Nederlandse subsidies — actuele dekking + criteria.",
    voedt_factor: ["subsidie_potentie"],
  },
];

export const DATA_SOURCE_KEYS: DataSourceKeyEntry[] = [
  ...TYPE_A_ENTRIES,
  ...TYPE_B_ENTRIES,
  ...TYPE_C_ENTRIES,
];

export function getEntry(key: string): DataSourceKeyEntry | null {
  return DATA_SOURCE_KEYS.find((e) => e.key === key) ?? null;
}

export function getEntriesByType(sourceType: SourceType): DataSourceKeyEntry[] {
  return DATA_SOURCE_KEYS.filter((e) => e.source_type === sourceType);
}
