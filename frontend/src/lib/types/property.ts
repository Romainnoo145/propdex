/**
 * TypeScript types matching backend property schemas
 *
 * IMPORTANT: Backend returns JSON with snake_case keys.
 * These types use snake_case to match backend exactly.
 */

// Minimal GeoJSON type - avoids external dependency
export type GeoJSONGeometry = Record<string, unknown>

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
  status_datum: string | null
  documentdatum: string | null
  documentnummer: string | null
  oppervlakte: number | null
  gebruiksdoel: string[]
  geometry: GeoJSONGeometry | null
}

/**
 * Cadastral parcel data from PDOK Cadastral API
 */
export interface CadastralParcel {
  kadastrale_aanduiding: string | null
  perceelnummer: string | null
  sectie: string | null
  oppervlakte: number | null
  geometry: GeoJSONGeometry | null
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
  geometry: GeoJSONGeometry | null
}

/**
 * Function designation refining a bestemming (e.g., horeca, kantoren)
 */
export interface FunctieAanduiding {
  naam: string
  groep: string | null
}

/**
 * Area designation / overlay zone (e.g., noise zone, archaeology, safety)
 */
export interface GebiedsAanduiding {
  naam: string
  groep: string | null
}

/**
 * Regulation text article from a bestemmingsplan
 */
export interface PlanTekst {
  titel: string
  inhoud: string | null
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
  functie_aanduidingen: FunctieAanduiding[]
  gebieds_aanduidingen: GebiedsAanduiding[]
  teksten: PlanTekst[]
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
  cached_at: string | null
  age_seconds: number | null
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
  rce_detail?: {
    rijksmonumentnummer: string | null
    redengevende_omschrijving: string | null
    oorspronkelijke_functie: string | null
    bouwjaar_van: number | null
    bouwjaar_tot: number | null
    architect: string | null
    bouwstijl: string | null
    monument_register_url: string | null
  } | null
}

/**
 * Map rendering data with geometries and tile configuration
 */
export interface MapData {
  center_rd: number[] | null
  center_wgs84: number[] | null
  property_geometry: GeoJSONGeometry | null
  parcel_geometries: GeoJSONGeometry[]
  zoning_geometries: GeoJSONGeometry[]
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
  max_floor_area_ratio?: number | null
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

export interface EnergyLabel {
  energieklasse: string | null
  registratie_datum: string | null
  geldig_tot: string | null
  is_geldig: boolean | null
  berekenings_type: string | null
  soort_opname: string | null
  opname_datum: string | null
  bag_vbo_id: string | null
  is_geregistreerd: boolean
  niet_geregistreerd_reden: string | null
}

export interface WOZWaarde {
  vastgestelde_waarde: number | null
  peildatum: string | null
  toestandspeildatum: string | null
}

export interface WOZData {
  woz_objectnummer: string | null
  meest_recente_waarde: number | null
  meest_recente_peildatum: string | null
  waarden: WOZWaarde[]
  grondoppervlakte: number | null
  low_confidence: boolean
  low_confidence_reden: string | null
  bron: string
}

export interface BRKOwnership {
  status: 'available' | 'unavailable' | 'error'
  data: Array<{
    perceel_identificatie: string
    gerechtigden: Array<{
      eigenaar_type: 'natuurlijk_persoon' | 'rechtspersoon' | 'overheid' | 'onbekend'
      zakelijk_recht_type: string | null
      aandeel: string | null
    }>
    heeft_hypotheek: boolean
  }> | null
  reason: string | null
  fetched_at: string | null
  admin_hint: string | null
}

export interface MarketSignals {
  listing_duration_days: number
  price_change_count: number
  listing_snapshots_count: number
  days_since_last_seen: number
  source?: string
}

export interface BuildabilityDelta {
  parcel_area_m2: number | null
  current_built_area_m2: number | null
  current_built_ratio_pct: number | null
  max_bebouwingspercentage_pct: number | null
  max_buildable_area_m2: number | null
  remaining_buildable_area_m2: number | null
  current_far: number | null
  max_far: number | null
  remaining_far: number | null
  limit_source?: string | null
  limit_confidence?: 'high' | 'medium' | 'low' | null
  confidence: 'high' | 'medium' | 'low'
  missing_fields: string[]
  notes: string[]
}

export interface WkbRefinementInput {
  constructieve_wijziging: boolean | null
  uitbreiding_m2: number | null
  functiewijziging: boolean | null
}

export interface WkbRuleHit {
  code: string
  title: string
  impact: 'increase' | 'decrease' | 'uncertainty'
  reason: string
}

export interface WkbLayerBResult {
  applied: boolean
  input: WkbRefinementInput | null
  effect_note: string | null
  available_inputs: string[]
}

export interface WkbPrecheck {
  status: 'likely_required' | 'uncertain' | 'likely_not_required' | 'not_applicable'
  confidence: 'high' | 'medium' | 'low'
  triggered_rules: WkbRuleHit[]
  missing_inputs: string[]
  required_documents: string[]
  disclaimer: string
  layer_b: WkbLayerBResult
}

// Phase 9 additions (v9.0 Professional Marketplace)
export interface WkbClassification {
  wkb_applicable: boolean
  gevolgklasse: 'GK1' | 'niet_van_toepassing' | 'onbekend'
  exclusion_reason: 'rijksmonument' | 'verbouwing' | null
  disclaimer: string
}

export interface AsbestIndicator {
  risk: 'hoog' | 'middel' | 'geen' | 'onbekend'
  bouwjaar: number | null
  norm_reference: string | null
  reden: string
}

export interface PermitPrecedentReference {
  change_record_id: string
  title: string
  change_date: string
  outcome: string
  source_url: string | null
}

export interface PermitPrecedentBenchmark {
  gemeente_scope: string
  comparable_type: string
  sample_size: number
  lookback_days: number
  median_processing_days: number | null
  p75_processing_days: number | null
  outcome_distribution: Record<string, number>
  low_sample_warning: string | null
  references: PermitPrecedentReference[]
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

  // Phase 7 additions
  energy_label?: EnergyLabel | null
  woz_data?: WOZData | null
  market_signals?: MarketSignals | null
  buildability_delta?: BuildabilityDelta | null
  wkb_precheck?: WkbPrecheck | null
  // Phase 9 additions (v9.0 Professional Marketplace)
  wkb_classification?: WkbClassification | null
  asbest_indicator?: AsbestIndicator | null
  permit_precedents?: PermitPrecedentBenchmark | null
  brk_ownership?: BRKOwnership | null
}
