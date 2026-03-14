/**
 * BRK Bevragen V2 ownership types
 *
 * Mirrors backend/app/schemas/brk_ownership.py exactly.
 * CRITICAL: BRK eigendomsdata MUST NEVER be cached or stored (Kadaster Tier 3).
 */

export interface ZakelijkGerechtigde {
  eigenaar_type: 'natuurlijk_persoon' | 'rechtspersoon' | 'overheid' | 'onbekend'
  naam: string | null
  kvk_nummer: string | null
  statutaire_zetel: string | null
  zakelijk_recht_type: string | null
  aandeel: string | null
  koopsom: number | null
  koopjaar: number | null
}

export interface Hypotheek {
  hypotheekhouder_naam: string | null
  bedrag: number | null
  aard: string | null
}

export interface Beslag {
  aard: string | null
}

export interface PerceelOwnership {
  perceel_identificatie: string
  gerechtigden: ZakelijkGerechtigde[]
  heeft_hypotheek: boolean
  hypotheken: Hypotheek[]
  beslagen: Beslag[]
}

export interface BRKOwnershipResponse {
  status: 'available' | 'unavailable' | 'error'
  data: PerceelOwnership[] | null
  reason: string | null
  fetched_at: string | null
  admin_hint: string | null
}
