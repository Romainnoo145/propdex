/**
 * Authenticated API client for property endpoints
 *
 * Follows the pattern from auth/api.ts:
 * - Raw fetch (no axios)
 * - credentials: 'include' for httpOnly cookies
 * - Bearer token authentication
 */

import type {
  AddressInput,
  PropertyReportResponse,
  SuggestResult,
} from './types/property'

const API_BASE = '/api/properties'
const PDOK_BASE_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1'

/**
 * Authenticated fetch wrapper with Bearer token injection
 *
 * @param url - API endpoint URL
 * @param options - Fetch options with required accessToken
 * @returns Parsed JSON response
 * @throws Error with detail message on non-OK response
 */
export async function apiFetch<T>(
  url: string,
  options: RequestInit & { accessToken: string | null }
): Promise<T> {
  const { accessToken, ...fetchOptions } = options

  const headers = new Headers(fetchOptions.headers)

  // Add Authorization header if token exists
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  // Set Content-Type for non-GET requests with body
  if (fetchOptions.method && fetchOptions.method !== 'GET' && fetchOptions.body) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include', // CRITICAL: Send httpOnly cookies
  })

  if (!response.ok) {
    // Try to parse error detail from backend
    const error = await response
      .json()
      .catch(() => ({ detail: `Request failed with status ${response.status}` }))
    throw new Error(error.detail || `Request failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * Get address autocomplete suggestions directly from PDOK Locatieserver
 *
 * Calls the public PDOK API directly (no auth required) for responsive autocomplete.
 * This avoids routing through the backend for a simple pass-through query.
 *
 * @param query - Search query string
 * @param _accessToken - Unused (kept for API compatibility)
 * @param signal - AbortSignal for request cancellation (TanStack Query automatic cleanup)
 * @returns Array of address suggestions from PDOK Locatieserver
 */
export async function suggestAddresses(
  query: string,
  _accessToken: string | null,
  signal?: AbortSignal
): Promise<SuggestResult[]> {
  const params = new URLSearchParams({
    q: query,
    rows: '7',
    fq: 'type:adres',
  })

  const response = await fetch(`${PDOK_BASE_URL}/suggest?${params}`, { signal })

  if (!response.ok) {
    throw new Error(`PDOK suggest failed with status ${response.status}`)
  }

  const data = await response.json()
  return data?.response?.docs ?? []
}

/** PDOK address details from lookup endpoint */
export interface PdokAddressDetails {
  postcode: string
  huisnummer: number
  huis_nlt: string
  straatnaam: string
  woonplaatsnaam: string
  centroide_ll: string
  id: string
}

/**
 * Look up full address details from PDOK by suggestion ID
 *
 * The suggest endpoint only returns id + weergavenaam.
 * This lookup returns postcode, huisnummer, coordinates, etc.
 */
export async function lookupPdokAddress(
  pdokId: string
): Promise<PdokAddressDetails> {
  const params = new URLSearchParams({ id: pdokId })
  const response = await fetch(`${PDOK_BASE_URL}/lookup?${params}`)

  if (!response.ok) {
    throw new Error(`PDOK lookup failed with status ${response.status}`)
  }

  const data = await response.json()
  const docs = data?.response?.docs
  if (!docs || docs.length === 0) {
    throw new Error('Address not found in PDOK')
  }

  return docs[0] as PdokAddressDetails
}

/**
 * Look up property data by Dutch address
 *
 * POST /api/properties/lookup
 *
 * Returns complete property intelligence report with:
 * - Address and building data (BAG)
 * - Cadastral parcels (PDOK)
 * - Zoning rules and dimensions (DSO)
 * - Monument status (RCE + BAG + Kadaster)
 * - Map data with geometries
 * - AI-parsed bestemmingsplan (if available)
 *
 * @param input - Address input (postcode + huisnummer + optional letter/addition)
 * @param accessToken - JWT access token from useAuth()
 * @returns Complete property report
 */
export async function lookupProperty(
  input: AddressInput,
  accessToken: string | null
): Promise<PropertyReportResponse> {
  return apiFetch<PropertyReportResponse>(`${API_BASE}/lookup`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(input),
  })
}
