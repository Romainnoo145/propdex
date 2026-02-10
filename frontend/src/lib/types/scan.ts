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
  /** Zoning designations from DSO */
  bestemmingen: Record<string, unknown>[] | null
  /** Development opportunity score (0-100) */
  score: number | null
  /** Score category: High | Medium | Low */
  score_category: string | null
  /** Per-factor score contributions for transparency */
  score_breakdown: Record<string, unknown> | null
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
  /** Scan creation timestamp (ISO 8601 string) */
  scan_date: string
  /** Total matching results (before pagination) */
  total: number
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
  /** Filter by bestemming type */
  bestemming_type?: string
  /** Minimum parcel area (square meters) */
  min_area_m2?: number
  /** Maximum parcel area (square meters) */
  max_area_m2?: number
  /** Filter by score category */
  score_category?: string
  /** Sort field name */
  sort_by?: string
  /** Sort direction: asc | desc */
  sort_order?: string
  /** Pagination offset */
  offset?: number
  /** Page size limit */
  limit?: number
}
