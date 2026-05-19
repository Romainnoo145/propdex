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

/**
 * BRK persistent record read-shape (M050/S01).
 *
 * Mirrors backend/app/schemas/brk_ownership_record.py::BRKOwnershipRecordRead.
 * Distinct from the Phase 105 ephemeral types above: this is the *persisted*
 * rechtspersoon-only record after AVG strip. Natuurlijk persoon rows are NEVER
 * persisted (D8) — consumers see an empty array in that case.
 *
 * Returned by:
 * - GET  /api/parcels/{parcel_id}/brk        (M050/S06 read-path)
 * - POST /api/parcels/{parcel_id}/brk/persist (M050/S02 write-path)
 */
export interface BRKOwnershipRecordRead {
  id: string
  organization_id: string
  parcel_id: string
  eigenaar_type: 'rechtspersoon' | 'overheid'
  eigenaar_naam: string | null
  kvk_nummer: string | null
  statutaire_zetel: string | null
  zakelijk_recht_type: string | null
  aandeel: string | null
  /** Decimal serialized as string by backend Pydantic */
  koopsom: number | string | null
  koopjaar: number | null
  heeft_hypotheek: boolean
  /** ISO-8601 string */
  fetched_at: string
}
