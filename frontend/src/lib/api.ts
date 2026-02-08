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
 * Get address autocomplete suggestions
 *
 * GET /api/properties/suggest?q={query}
 *
 * @param query - Search query string
 * @param accessToken - JWT access token from useAuth()
 * @param signal - AbortSignal for request cancellation (TanStack Query automatic cleanup)
 * @returns Array of address suggestions from PDOK Locatieserver
 */
export async function suggestAddresses(
  query: string,
  accessToken: string | null,
  signal?: AbortSignal
): Promise<SuggestResult[]> {
  const url = `${API_BASE}/suggest?q=${encodeURIComponent(query)}`

  return apiFetch<SuggestResult[]>(url, {
    method: 'GET',
    accessToken,
    signal,
  })
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
