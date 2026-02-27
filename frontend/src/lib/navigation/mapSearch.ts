import { normalizeGemeenteCode } from '@/lib/geo/normalizers'

interface MapSearchBase {
  _t: number
}

export interface MapParcelSearch extends MapSearchBase {
  parcel_id: string
  fallback_address?: string
}

export interface MapAddressSearch extends MapSearchBase {
  postcode: string
  huisnummer: number
}

export interface MapGemeenteWijkSearch extends MapSearchBase {
  gemeente_code: string
  wijk_naam?: string
}

export function toMapParcelSearch(input: {
  parcelId: string
  fallbackAddress?: string | null
  timestamp?: number
}): MapParcelSearch {
  const search: MapParcelSearch = {
    parcel_id: input.parcelId,
    _t: input.timestamp ?? Date.now(),
  }

  const fallbackAddress = input.fallbackAddress?.trim()
  if (fallbackAddress) {
    search.fallback_address = fallbackAddress
  }

  return search
}

export function toMapAddressSearch(input: {
  postcode: string
  huisnummer: number
  timestamp?: number
}): MapAddressSearch {
  return {
    postcode: input.postcode,
    huisnummer: input.huisnummer,
    _t: input.timestamp ?? Date.now(),
  }
}

export function toMapGemeenteWijkSearch(input: {
  gemeenteCode: string
  wijkNaam?: string | null
  timestamp?: number
}): MapGemeenteWijkSearch {
  const normalizedCode = normalizeGemeenteCode(input.gemeenteCode)
  const search: MapGemeenteWijkSearch = {
    gemeente_code: normalizedCode ?? input.gemeenteCode.trim().toUpperCase(),
    _t: input.timestamp ?? Date.now(),
  }

  const wijkNaam = input.wijkNaam?.trim()
  if (wijkNaam) {
    search.wijk_naam = wijkNaam
  }

  return search
}
