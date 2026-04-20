/**
 * TypeScript types for scan API operations
 *
 * These types match backend/app/scans/schemas.py exactly.
 * Backend serializes UUIDs and datetimes as strings in JSON.
 */

/**
 * Request schema for triggering a new area scan
 * Backend: ScanCreateRequest
 */
export interface ScanCreateRequest {
  /** CBS gemeentecode (e.g., '0363' for Amsterdam) */
  gemeente_code: string
  /** Display name (e.g., 'Amsterdam') */
  gemeente_naam: string
  /** Override existing scan and start fresh */
  force_rescan?: boolean
  /** Optional bounding box [minLon, minLat, maxLon, maxLat] in EPSG:4326 (WGS84).
   *  If provided, scan is limited to this area instead of entire gemeente.
   *  Backend converts to EPSG:28992 for BAG WFS queries. */
  bbox_wgs84?: [number, number, number, number]
  /** CBS wijk name (for auto-creating project folder) */
  wijk_naam?: string
  /** Optional existing project folder to link this scan to */
  project_id?: string
}

/**
 * Response schema returned after triggering a scan
 * Backend: ScanResponse
 */
export interface ScanResponse {
  /** Scan UUID (serialized as string) */
  scan_id: string
  /** Scan status: pending | running | completed | failed | cancelled | existing */
  status: string
  /** Gemeente display name */
  gemeente_naam: string
  /** CBS gemeentecode */
  gemeente_code: string
  /** Scan creation timestamp (for existing scans) */
  scan_date: string | null
  /** True if scan is >30 days old */
  needs_rescan: boolean
  /** Additional context message */
  message: string | null
}

/**
 * Response schema for polling scan progress
 * Backend: ScanStatusResponse
 */
export interface ScanStatusResponse {
  /** Scan UUID (serialized as string) */
  scan_id: string
  /** Scan status: pending | running | completed | failed | cancelled */
  status: string
  /** Overall progress percentage (0-100) */
  progress_pct: number
  /** Current processing phase: fetching_parcels | cross_referencing_bag | querying_bestemmingen */
  current_phase: string | null
  /** Total parcels discovered */
  parcels_total: number
  /** Parcels processed so far */
  parcels_processed: number
  /** Parcels that failed processing */
  parcels_failed: number
  /** Number of ScanResult rows created */
  results_count: number
  /** Job start timestamp (ISO 8601 string) */
  started_at: string | null
  /** Job completion timestamp (ISO 8601 string) */
  completed_at: string | null
}

/**
 * CBS stedelijkheid (urbanity) classification
 * Klasse 1 = Zeer sterk stedelijk, 5 = Niet stedelijk
 */
export interface CbsStedelijkheid {
  klasse: number | null
  omschrijving: string
  omgevingsadressendichtheid: number | null
}

/**
 * CBS age distribution percentages per wijk
 * Phase 78: Extended demographics
 */
export interface CbsLeeftijdsVerdeling {
  perc_0_14: number | null
  perc_15_24: number | null
  perc_25_44: number | null
  perc_45_64: number | null
  perc_65_plus: number | null
}

/**
 * CBS household composition per wijk
 * Phase 78: Extended demographics
 */
export interface CbsHuishoudens {
  totaal: number | null
  eenpersoons: number | null
  zonder_kinderen: number | null
  met_kinderen: number | null
  gemiddelde_grootte: number | null
}

/**
 * CBS income metrics per wijk
 * Phase 78: Extended demographics & income
 */
export interface CbsInkomen {
  gem_per_ontvanger: number | null
  gem_per_inwoner: number | null
  gem_gestandaardiseerd: number | null
  perc_laagste_40: number | null
  perc_hoogste_20: number | null
  /** Separate peiljaar when income data comes from an older CBS dataset */
  peiljaar?: number | null
}

/**
 * CBS facility proximity distances per wijk (km)
 * Phase 79: Voorzieningen Nabijheid (dataset 86134NED)
 */
export interface CbsNabijheid {
  bron: string
  dataset: string
  peiljaar: number
  afstanden: {
    supermarkt_km: number | null
    huisarts_km: number | null
    basisschool_km: number | null
    kinderdagverblijf_km: number | null
    treinstation_km: number | null
    overstapstation_km: number | null
  }
}

/**
 * CBS crime statistics per wijk
 * Phase 80: Criminaliteitsdata (dataset 47018NED on dataderden.cbs.nl)
 */
export interface CbsCriminaliteit {
  bron: string
  dataset: string
  peiljaar: number
  totaal_misdrijven: number | null
  per_1000_inwoners: number | null
  categorien: {
    vermogensdelicten: { aantal: number | null; per_1000: number | null }
    vernieling: { aantal: number | null; per_1000: number | null }
    geweld: { aantal: number | null; per_1000: number | null }
  }
}

/**
 * CBS neighborhood metrics stored in AreaScan.neighborhood_metrics JSONB
 * Fetched from CBS StatLine during scan job
 */
export interface CbsNeighborhoodMetrics {
  bron: string
  dataset: string
  peiljaar: number
  nabijheid?: CbsNabijheid
  criminaliteit?: CbsCriminaliteit
  data: {
    gemiddelde_woz_waarde: number | null
    stedelijkheid: CbsStedelijkheid
    demografie: {
      aantal_inwoners: number | null
      percentage_huurwoningen: number | null
      percentage_koopwoningen: number | null
    }
    bouwjaar_distributie: {
      percentage_bouwjaar_voor_2000: number | null
      percentage_bouwjaar_vanaf_2000: number | null
    }
    // Phase 78: Extended demographics & income
    leeftijdsverdeling?: CbsLeeftijdsVerdeling
    huishoudens?: CbsHuishoudens
    inkomen?: CbsInkomen
  }
}

/**
 * Schema for a single parcel result in scan list
 * Backend: ScanResultItem
 */
export interface MarketSignals {
  /** Number of days listing has been visible */
  listing_duration_days: number
  /** Number of observed price changes */
  price_change_count: number
  /** Number of captured listing snapshots */
  listing_snapshots_count: number
  /** Days since this listing was last observed */
  days_since_last_seen: number
}

/**
 * Typed building metrics from scan pipeline
 * Populated from PLU WMS maatvoering layer and Phase 72 BAG pand footprint
 * Backend: ScanResult.flags["building_metrics"]
 */
export interface BuildingMetrics {
  /** Footprint area of all BAG panden on this parcel (m2) — Phase 72 */
  pand_oppervlakte_m2?: number | null
  /** Maximum site coverage percentage from PLU WMS / DSO maatvoeringen */
  max_bebouwingspercentage?: number | null
  /** Maximum floor area ratio (FSI) from PLU WMS / DSO maatvoeringen */
  max_floor_area_ratio?: number | null
  /** Maximum building height in meters from PLU WMS maatvoering — Phase 73 */
  max_bouwhoogte?: number | null
  /** Maximum number of building floors from PLU WMS maatvoering — Phase 73 */
  max_bouwlagen?: number | null
  /** Actual building height in meters from 3D BAG (b3_h_dak_50p - b3_h_maaiveld) — Phase 74 */
  actual_bouwhoogte?: number | null
  /** Actual floor count from 3D BAG (b3_bouwlagen) — Phase 74 */
  actual_bouwlagen?: number | null
}

/**
 * Score v3.0 per-factor result with full metadata
 * Backend: FactorResult dataclass in score_v3_factors.py
 */
export interface ScoreFactorV3 {
  waarde: unknown
  genormaliseerde_score: number // 0-1
  gewicht: number
  bijdrage: number
  categorie: 'potentie' | 'risico'
  toelichting_kort: string
  toelichting_lang: string
  data_bronnen: string[]
  missing: boolean
}

/**
 * Score v3.0 breakdown: factor name -> factor result
 */
export interface ScoreBreakdownV3 {
  [factorName: string]: ScoreFactorV3
}

/**
 * Score v3.0 dual-subscore output
 */
export interface ScoresV3 {
  potentie: number
  risico: number
  overall: number
}

export interface ScanResultItem {
  /** ParcelCache UUID (serialized as string) */
  parcel_id: string
  /** Kadaster parcel identifier */
  parcel_code: string
  /** Street address from BAG */
  address: string | null
  /** CBS gemeentecode */
  gemeente_code: string | null
  /** Parcel area in square meters */
  area_m2: number | null
  /** Whether parcel has existing building */
  has_pand: boolean
  /** BAG construction year */
  bouwjaar: number | null
  /** BAG building status */
  pand_status: string | null
  /** Zoning designations from DSO */
  bestemmingen: Record<string, unknown>[] | null
  /** Primary bestemming type via backend S04 count-voting — single source of truth for UI tile */
  primary_bestemming_type?: string | null
  /** Development opportunity score (0-100) */
  score: number | null
  /** Score category: High | Medium | Low */
  score_category: string | null
  /** Per-factor score contributions for transparency */
  score_breakdown: Record<string, unknown> | null
  /** Score v3.0 potentie subscore (0-100, null for v2.1 scans) */
  potentie_score?: number | null
  /** Score v3.0 risico subscore (0-100, null for v2.1 scans) */
  risico_score?: number | null
  /** Use-case specific scores: optoppen/splitsen/transformatie/nieuwbouw */
  use_case_scores?: Record<string, { use_case: string; label: string; score: number; category: string; top_factors: string[]; description: string }> | null
  /** Vacancy classification for development focus */
  vacancy_signal: string | null
  /** Vacancy confidence score (0-1) */
  vacancy_confidence: number | null
  /** Top explainable reasons for vacancy confidence */
  vacancy_reasons: string[] | null
  /** Version id of vacancy confidence model */
  vacancy_model_version: string | null
  /** External market friction signals (Funda snapshots) */
  market_signals: MarketSignals | null
  /** Human-readable development opportunity signals */
  opportunity_signals: string[] | null
  /** Zoning build metrics (if available in source data) */
  building_metrics: BuildingMetrics | null
  /** Whether this parcel already has a saved report */
  has_report: boolean
}

/**
 * Response schema for paginated scan results list
 * Backend: ScanResultsResponse
 */
export interface ScanResultsResponse {
  /** Scan UUID (serialized as string) */
  scan_id: string
  /** Gemeente display name */
  gemeente_naam: string
  /** Wijk name when the scan is scoped to a wijk */
  wijk_naam?: string | null
  /** CBS neighborhood metrics for the scanned wijk */
  neighborhood_metrics?: CbsNeighborhoodMetrics | null
  /** Scan creation timestamp (ISO 8601 string) */
  scan_date: string
  /** Total parcels scanned (before qualification) */
  parcels_total: number
  /** Total ranked results (before pagination) */
  total: number
  /** Total results before score threshold filter (for hidden-count display) */
  total_unfiltered: number
  /** Current offset */
  offset: number
  /** Page size */
  limit: number
  /** Paginated result items */
  results: ScanResultItem[]
}

/**
 * Filter parameters for scan results query
 * Maps to backend query parameters
 */
export interface ScanResultsFilters {
  /** Filter by building presence */
  has_pand?: boolean
  /** Free-text search across parcel code, address, status and bestemming */
  search?: string
  /** Filter by bestemming type */
  bestemming_type?: string
  /** Minimum parcel area (square meters) */
  min_area_m2?: number
  /** Maximum parcel area (square meters) */
  max_area_m2?: number
  /** Filter by score category */
  score_category?: string
  /** Filter by building status */
  pand_status?: string
  /** Minimum score threshold for default filter preset */
  min_score?: number
  /** Exclude parcels with null scores */
  exclude_null_scores?: boolean
  /** Sort field name (score, vacancy_subscore, buildability_subscore, area_m2, address, bouwjaar) */
  sort_by?: string
  /** Sort direction: asc | desc */
  sort_order?: string
  /** Pagination offset */
  offset?: number
  /** Page size limit */
  limit?: number
}

/**
 * Bekendmaking record from SRU API
 * Backend: BekendmakingRecord
 */
export interface BekendmakingRecord {
  /** Title of the announcement */
  title: string
  /** Unique identifier for the publication */
  identifier: string
  /** Type of announcement (e.g., "Omgevingsvergunning") */
  type: string
  /** Publication date as ISO date string */
  date: string
  /** Municipality name (gemeente) */
  municipality: string
  /** Link to official publication */
  url: string
}

// ---------------------------------------------------------------------------
// Enrichment data interfaces — stored in scan_results.flags JSONB
// ---------------------------------------------------------------------------

export interface EnergielabelData {
  energieklasse: string
  is_geregistreerd: boolean
  registratie_datum: string | null
  geldig_tot: string | null
}

export interface WozData {
  meest_recente_waarde: number | null
  meest_recente_peildatum: string | null
  low_confidence: boolean
  low_confidence_reden?: string | null
  bron?: string
}

export interface BodemData {
  dossiers_count: number
  has_known_contamination: boolean
  disclaimer: string
}

export interface BodemtypeData {
  dominant_type: string | null
  dominant_type_label: string | null
  soilcode: string | null
}

export interface FunderingsrisicoData {
  fgr: string | null
  legenda: string | null
  percvoor1970: number | null
}

export interface VergunningenData {
  records: Array<{ title: string; type: string; date: string; url: string }>
  total_postcode_count: number
}

export interface Natura2000Data {
  naam: string
  nr: string
  bescherming: string
  binnen_5km: boolean
}

export interface OverstromingsrisicoData {
  description: string
  qualitative_value: string
  in_risk_zone: boolean
}

export interface GeluidData {
  lden_db: number
  classification: string
  boven_grenswaarde: boolean
}

export interface LuchtkwaliteitData {
  no2_ugm3: number
  pm10_ugm3: number
  boven_grenswaarde: boolean
}

/**
 * Response schema for per-parcel fysiek risicoprofiel
 * Backend: ParcelRiskProfileResponse (scans/schemas.py)
 */
export interface ParcelRiskProfileResponse {
  parcel_id: string
  fysiek_risico_profiel: import('@/lib/types/property').FysiekRisicoProfiel | null
  is_cached: boolean
}

/**
 * Response schema for parcel enrichment
 * Backend: ParcelEnrichmentResponse
 */
export interface ParcelEnrichmentResponse {
  /** ParcelCache UUID (serialized as string) */
  parcel_id: string
  /** Tier 2 enrichment data (vergunningen, etc.) */
  enrichment_data: {
    /** List of vergunningen from SRU API */
    vergunningen: BekendmakingRecord[]
    /** Error message if enrichment failed */
    error?: string
  } | null
  /** Timestamp when enrichment was last updated (ISO 8601 string) */
  enriched_at: string | null
  /** True if returned from cache, False if freshly fetched */
  is_cached: boolean
  /** Pre-cached energielabel data from scan flags */
  energielabel?: EnergielabelData | null
  /** Pre-cached WOZ waarde data from scan flags */
  woz_data?: WozData | null
  /** Pre-cached bodem contamination data from scan flags */
  bodem_data?: BodemData | null
  /** Pre-cached funderingsrisico data from scan flags */
  funderingsrisico_data?: FunderingsrisicoData | null
  /** Pre-cached Natura 2000 proximity data from scan flags */
  natura2000_data?: Natura2000Data | null
  /** Pre-cached flood risk data from scan flags */
  overstromingsrisico_data?: OverstromingsrisicoData | null
  /** Pre-cached noise level data from scan flags */
  geluid_data?: GeluidData | null
  /** Pre-cached air quality data from scan flags */
  luchtkwaliteit_data?: LuchtkwaliteitData | null
}

/**
 * Schema for a single scan in the history list
 * Backend: ScanListItem (scans/schemas.py)
 */
export interface ScanListItem {
  scan_id: string
  gemeente_naam: string
  gemeente_code: string
  wijk_naam: string | null
  neighborhood_metrics?: CbsNeighborhoodMetrics | null
  bbox_wgs84?: [number, number, number, number] | null
  scan_date: string
  status: string
  parcel_count: number
  project_id: string | null
}

/**
 * Response schema for paginated scan history list
 * Backend: ScanListResponse (scans/schemas.py)
 */
export interface ScanListResponse {
  scans: ScanListItem[]
  total: number
  offset: number
  limit: number
}
