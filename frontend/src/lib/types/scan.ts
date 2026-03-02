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
  /** Development opportunity score (0-100) */
  score: number | null
  /** Score category: High | Medium | Low */
  score_category: string | null
  /** Per-factor score contributions for transparency */
  score_breakdown: Record<string, unknown> | null
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
  building_metrics: Record<string, unknown> | null
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
