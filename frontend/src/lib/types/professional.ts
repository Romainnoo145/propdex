/**
 * Professional (kwaliteitsborger) type definitions matching backend schemas
 * (backend/app/schemas/professional.py)
 * All fields use snake_case to match backend JSON responses exactly.
 */

/** Single professional (kwaliteitsborger) response from GET /api/professionals */
export interface ProfessionalResponse {
  id: string
  naam: string
  bedrijfsnaam: string | null
  werkgebied: string[]
  gevolgklassen: string[]
  email: string | null
  telefoon: string | null
  website: string | null
  tlokb_url: string | null
  is_active: boolean
}

/** Paginated professional list response with applied filter context */
export interface ProfessionalListResponse {
  professionals: ProfessionalResponse[]
  total: number
  gemeente_filter: string | null
  gevolgklasse_filter: string | null
}

/** Query filters for the professionals endpoint */
export interface ProfessionalFilters {
  gemeente?: string
  gevolgklasse?: string
}
