/**
 * TypeScript types for portfolio / favorites API operations
 *
 * These types match backend/app/favorites/schemas.py exactly.
 * Backend serializes UUIDs and datetimes as strings in JSON.
 */

/**
 * Pipeline stage for a parcel favorite
 * Maps to ParcelFavorite.pipeline_stage in the backend
 */
export type PipelineStage =
  | 'Gesignaleerd'
  | 'Onderzoek'
  | 'Contact'
  | 'Besluit'
  | 'Afgerond'

/**
 * A single favorited parcel as returned by GET /api/parcels/favorites
 * Backend: FavoriteResponse
 */
export interface FavoriteResponse {
  /** Favorite UUID (serialized as string) */
  id: string
  /** Kadaster parcel identifier (e.g. "HTT02-A-1234") — NOT ParcelCache UUID */
  parcel_id: string
  /** User UUID */
  user_id: string
  /** CBS gemeentecode — nullable */
  gemeente_code: string | null
  /** Gemeente display name — nullable */
  gemeente_naam: string | null
  /** Wijk name — nullable */
  wijk_naam: string | null
  /** Current pipeline stage */
  pipeline_stage: PipelineStage
  /** Reason for completion (only set when stage is 'Afgerond') */
  afgerond_reden: string | null
  /** Free-text note */
  notitie: string | null
  /** Creation timestamp (ISO 8601 string) */
  created_at: string
  /** Last update timestamp (ISO 8601 string) */
  updated_at: string
}

/**
 * Wijk-level grouping within a gemeente
 * Backend: PortfolioWijkGroup
 */
export interface PortfolioWijkGroup {
  wijk_naam: string | null
  parcel_count: number
}

/**
 * Gemeente-level grouping with nested wijk breakdown
 * Backend: PortfolioGemeenteGroup
 */
export interface PortfolioGemeenteGroup {
  gemeente_code: string | null
  gemeente_naam: string | null
  total_count: number
  wijken: PortfolioWijkGroup[]
}

/**
 * Full portfolio response from GET /api/portfolio
 * Backend: PortfolioResponse
 */
export interface PortfolioResponse {
  gemeenten: PortfolioGemeenteGroup[]
  total_favorites: number
}
