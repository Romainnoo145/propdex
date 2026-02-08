/**
 * TypeScript types matching backend property schemas
 *
 * IMPORTANT: Backend returns JSON with snake_case keys.
 * These types use snake_case to match backend exactly.
 */

// Minimal GeoJSON namespace - avoids external dependency
export namespace GeoJSON {
  export type Geometry = Record<string, unknown>
}

/**
 * Request schema for property lookup by address
 */
export interface AddressInput {
  postcode: string
  huisnummer: number
  huisletter?: string
  toevoeging?: string
}

/**
 * PDOK Locatieserver suggest API response
 * Uses index signature since we need to extract fields empirically
 */
export interface SuggestResult {
  weergavenaam: string
  id: string
  type: string
  score: number
  [key: string]: unknown
}

/**
 * Structured address data from BAG API
 */
export interface BAGAddressResponse {
  nummeraanduiding_id: string
  verblijfsobject_id: string | null
  straat: string
  huisnummer: number
  huisletter: string | null
  toevoeging: string | null
  postcode: string
  woonplaats: string
}

/**
 * Building/pand details from BAG API
 */
export interface BuildingData {
  pand_id: string
  bouwjaar: number | null
  status: string | null
  oppervlakte: number | null
  gebruiksdoel: string[]
  geometry: GeoJSON.Geometry | null
}

/**
 * Cadastral parcel data from PDOK Cadastral API
 */
export interface CadastralParcel {
  kadastrale_aanduiding: string | null
  perceelnummer: string | null
  sectie: string | null
  oppervlakte: number | null
  geometry: GeoJSON.Geometry | null
}

/**
 * Building dimension constraints from zoning regulations
 */
export interface BuildingDimensions {
  max_hoogte: number | null
  max_bebouwingspercentage: number | null
  max_floor_area_ratio: number | null
  max_goothoogte: number | null
  max_bouwhoogte: number | null
}

/**
 * Zoning rule for a specific area with permitted functions
 */
export interface ZoningRule {
  bestemming: string
  omschrijving: string | null
  building_dimensions: BuildingDimensions | null
  geometry: GeoJSON.Geometry | null
}

/**
 * Zoning plan (bestemmingsplan) information
 */
export interface ZoningPlan {
  plan_id: string
  plan_naam: string
  plan_type: string | null
  plan_status: string | null
  plan_datum: string | null
  rules: ZoningRule[]
}

/**
 * Complete zoning data for a property location
 */
export interface ZoningData {
  plans: ZoningPlan[]
  primary_bestemming: string | null
  building_dimensions: BuildingDimensions | null
  data_gaps: string[]
  source: string
  fallback_used: boolean
}

/**
 * Monument information from a single source
 */
export interface MonumentSourceResult {
  source: string
  is_monument: boolean | null
  monument_type: string | null
  monument_nummer: string | null
  monument_naam: string | null
  error: string | null
}

/**
 * Aggregated monument status from multiple sources
 */
export interface MonumentStatus {
  sources: MonumentSourceResult[]
  has_conflict: boolean
  conflict_note: string | null
  consensus_status: string | null
  restrictions_summary: string[]
  is_monument: boolean
}

/**
 * Map rendering data with geometries and tile configuration
 */
export interface MapData {
  center_rd: number[] | null
  center_wgs84: number[] | null
  property_geometry: GeoJSON.Geometry | null
  parcel_geometries: GeoJSON.Geometry[]
  zoning_geometries: GeoJSON.Geometry[]
}

/**
 * Metadata about data source and caching
 */
export interface DataSourceInfo {
  source: string
  cached_at: string | null
  age_seconds: number | null
  is_cached: boolean
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null
}

/**
 * Source metadata for a specific report section
 */
export interface SectionSourceInfo {
  section: string
  sources: DataSourceInfo[]
  cached_at: string | null
  age_seconds: number | null
}

/**
 * Building dimension constraints extracted by AI from bestemmingsplan text
 */
export interface BuildingDimensionsAI {
  max_bouwhoogte: number | null
  max_goothoogte: number | null
  max_bebouwingspercentage: number | null
  max_oppervlakte: number | null
  max_inhoud: number | null
  overige: Record<string, string>
}

/**
 * Single zoning rule extracted from bestemmingsplan PDF by AI
 */
export interface BestemmingsregelExtract {
  artikel: string
  bestemming: string
  toegestane_gebruiken: string[]
  verboden_gebruiken: string[]
  bouwregels: BuildingDimensionsAI | null
  parkeereis: string | null
  milieu_restricties: string[]
  bijzondere_voorwaarden: string[]
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  disclaimer: string | null
}

/**
 * Complete AI-parsed bestemmingsplan output from Claude
 */
export interface BestemmingsplanParsed {
  plan_naam: string
  plan_idn: string
  regels: BestemmingsregelExtract[]
  overall_confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  disclaimers: string[]
  samenvatting: string
}

/**
 * AI-parsed data section for inclusion in property report
 */
export interface AIParsingSection {
  parsed_plan: BestemmingsplanParsed | null
  job_id: string | null
  status: 'complete' | 'in_progress' | 'queued' | 'failed' | 'not_available' | 'pdf_not_found'
  upload_required: boolean
  error_message: string | null
  disclaimer_banner: string
}

/**
 * Extended property report with zoning, monuments, and map data
 *
 * Includes all data from PropertyLookupResponse plus additional
 * Phase 3 intelligence sections.
 */
export interface PropertyReportResponse {
  // Core property data
  address: BAGAddressResponse
  building: BuildingData | null
  cadastral_parcels: CadastralParcel[]
  data_sources: DataSourceInfo[]
  completeness_score: number
  errors: string[]
  resolved_at: string

  // Phase 3 additions
  zoning: ZoningData | null
  monuments: MonumentStatus | null
  map_data: MapData | null
  section_sources: SectionSourceInfo[]

  // Phase 4 additions
  ai_parsing: AIParsingSection | null
}
