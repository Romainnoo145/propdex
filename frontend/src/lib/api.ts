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
import type {
  ReportFilters,
  ReportListResponse,
  ReportDetailResponse,
  ReportSaveRequest,
  ReportFreshnessResponse,
} from './types/report'
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectResponse,
  ProjectListResponse,
} from './types/project'
import type {
  ScanCreateRequest,
  ScanResponse,
  ScanStatusResponse,
  ScanResultsResponse,
  ScanResultsFilters,
} from './types/scan'

const API_BASE = '/api/properties'
const REPORTS_BASE = '/api/reports'
const PROJECTS_BASE = '/api/projects'
const SCANS_BASE = '/api/scans'
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
 * @param options - Optional settings (forceRefresh to bypass cache)
 * @returns Complete property report
 */
export async function lookupProperty(
  input: AddressInput,
  accessToken: string | null,
  options?: { forceRefresh?: boolean }
): Promise<PropertyReportResponse> {
  const params = new URLSearchParams()
  if (options?.forceRefresh) {
    params.set('force_refresh', 'true')
  }
  const queryString = params.toString()
  const url = `${API_BASE}/lookup${queryString ? `?${queryString}` : ''}`

  return apiFetch<PropertyReportResponse>(url, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(input),
  })
}

/**
 * Fetch list of saved reports with optional filters
 *
 * GET /api/reports
 *
 * @param filters - Optional filters for city, project, search, sort, pagination
 * @param accessToken - JWT access token from useAuth()
 * @returns List of reports with total count
 */
export async function fetchReports(
  filters: ReportFilters,
  accessToken: string | null
): Promise<ReportListResponse> {
  const params = new URLSearchParams()

  if (filters.city) params.set('city', filters.city)
  if (filters.project_id) params.set('project_id', filters.project_id)
  if (filters.search) params.set('search', filters.search)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_order) params.set('sort_order', filters.sort_order)
  if (filters.skip !== undefined) params.set('skip', filters.skip.toString())
  if (filters.limit !== undefined) params.set('limit', filters.limit.toString())

  const url = `${REPORTS_BASE}${params.toString() ? `?${params}` : ''}`

  return apiFetch<ReportListResponse>(url, {
    method: 'GET',
    accessToken,
  })
}

/**
 * Fetch single report by ID
 *
 * GET /api/reports/{reportId}
 *
 * @param reportId - Report UUID
 * @param accessToken - JWT access token from useAuth()
 * @returns Full report details with report_data JSONB
 */
export async function fetchReport(
  reportId: string,
  accessToken: string | null
): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>(`${REPORTS_BASE}/${reportId}`, {
    method: 'GET',
    accessToken,
  })
}

/**
 * Save a new property report
 *
 * POST /api/reports
 *
 * @param request - Report save request with report_data, notes, project_id
 * @param accessToken - JWT access token from useAuth()
 * @returns Created report with ID
 */
export async function saveReport(
  request: ReportSaveRequest,
  accessToken: string | null
): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>(REPORTS_BASE, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(request),
  })
}

/**
 * Delete a saved report
 *
 * DELETE /api/reports/{reportId}
 *
 * @param reportId - Report UUID to delete
 * @param accessToken - JWT access token from useAuth()
 */
export async function deleteReport(
  reportId: string,
  accessToken: string | null
): Promise<void> {
  const headers = new Headers()

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${REPORTS_BASE}/${reportId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Delete failed with status ${response.status}` }))
    throw new Error(error.detail || `Delete failed with status ${response.status}`)
  }
}

/**
 * Check if a report has updates (freshness check)
 *
 * GET /api/reports/{reportId}/freshness
 *
 * @param reportId - Report UUID
 * @param accessToken - JWT access token from useAuth()
 * @returns Freshness data with has_updates boolean
 */
export async function fetchReportFreshness(
  reportId: string,
  accessToken: string | null
): Promise<ReportFreshnessResponse> {
  return apiFetch<ReportFreshnessResponse>(`${REPORTS_BASE}/${reportId}/freshness`, {
    method: 'GET',
    accessToken,
  })
}

/**
 * Refresh a report with latest data
 *
 * PUT /api/reports/{reportId}/refresh
 *
 * @param reportId - Report UUID to refresh
 * @param accessToken - JWT access token from useAuth()
 * @returns Updated report detail
 */
export async function refreshReport(
  reportId: string,
  accessToken: string | null
): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>(`${REPORTS_BASE}/${reportId}/refresh`, {
    method: 'PUT',
    accessToken,
  })
}

/**
 * Export report as PDF
 *
 * GET /api/reports/{reportId}/export/pdf
 *
 * @param reportId - Report UUID to export
 * @param accessToken - JWT access token from useAuth()
 * @returns PDF blob for download
 */
export async function exportReportPDF(
  reportId: string,
  accessToken: string | null
): Promise<Blob> {
  const headers = new Headers()

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${REPORTS_BASE}/${reportId}/export/pdf`, {
    method: 'GET',
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Export failed with status ${response.status}` }))
    throw new Error(error.detail || `Export failed with status ${response.status}`)
  }

  return response.blob()
}

/**
 * Fetch all unique cities from saved reports
 *
 * GET /api/reports/cities
 *
 * @param accessToken - JWT access token from useAuth()
 * @returns Array of city names
 */
export async function fetchCities(
  accessToken: string | null
): Promise<string[]> {
  return apiFetch<string[]>(`${REPORTS_BASE}/cities`, {
    method: 'GET',
    accessToken,
  })
}

/**
 * Fetch list of projects
 *
 * GET /api/projects
 *
 * @param accessToken - JWT access token from useAuth()
 * @returns List of projects with report counts
 */
export async function fetchProjects(
  accessToken: string | null
): Promise<ProjectListResponse> {
  return apiFetch<ProjectListResponse>(PROJECTS_BASE, {
    method: 'GET',
    accessToken,
  })
}

/**
 * Create a new project
 *
 * POST /api/projects
 *
 * @param data - Project creation data (name + optional description)
 * @param accessToken - JWT access token from useAuth()
 * @returns Created project with report_count=0
 */
export async function createProject(
  data: ProjectCreate,
  accessToken: string | null
): Promise<ProjectResponse> {
  return apiFetch<ProjectResponse>(PROJECTS_BASE, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(data),
  })
}

/**
 * Update an existing project
 *
 * PATCH /api/projects/{projectId}
 *
 * @param projectId - Project UUID
 * @param data - Project update data (name and/or description)
 * @param accessToken - JWT access token from useAuth()
 * @returns Updated project with report_count
 */
export async function updateProject(
  projectId: string,
  data: ProjectUpdate,
  accessToken: string | null
): Promise<ProjectResponse> {
  return apiFetch<ProjectResponse>(`${PROJECTS_BASE}/${projectId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(data),
  })
}

/**
 * Delete a project
 *
 * DELETE /api/projects/{projectId}
 *
 * Sets all reports' project_id to NULL (FK ondelete=SET NULL).
 * Hard deletes the project.
 *
 * @param projectId - Project UUID to delete
 * @param accessToken - JWT access token from useAuth()
 */
export async function deleteProject(
  projectId: string,
  accessToken: string | null
): Promise<void> {
  const headers = new Headers()

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${PROJECTS_BASE}/${projectId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Delete failed with status ${response.status}` }))
    throw new Error(error.detail || `Delete failed with status ${response.status}`)
  }
}

/**
 * Assign a report to a project (or remove from project)
 *
 * PATCH /api/reports/{reportId}/project
 *
 * @param reportId - Report UUID
 * @param projectId - Project UUID (or null to remove from project)
 * @param accessToken - JWT access token from useAuth()
 * @returns Updated report detail
 */
export async function assignReportToProject(
  reportId: string,
  projectId: string | null,
  accessToken: string | null
): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>(`${REPORTS_BASE}/${reportId}/project`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ project_id: projectId }),
  })
}

/**
 * Trigger a new area scan for a gemeente
 *
 * POST /api/scans
 *
 * @param request - Scan creation request with gemeente_code, gemeente_naam, and optional force_rescan
 * @param accessToken - JWT access token from useAuth()
 * @returns Scan response with scan_id for polling
 */
export async function triggerScan(
  request: ScanCreateRequest,
  accessToken: string | null
): Promise<ScanResponse> {
  return apiFetch<ScanResponse>(SCANS_BASE, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(request),
  })
}

/**
 * Fetch scan status and progress
 *
 * GET /api/scans/{scanId}
 *
 * @param scanId - Scan UUID
 * @param accessToken - JWT access token from useAuth()
 * @returns Scan status with progress details
 */
export async function fetchScanStatus(
  scanId: string,
  accessToken: string | null
): Promise<ScanStatusResponse> {
  return apiFetch<ScanStatusResponse>(`${SCANS_BASE}/${scanId}`, {
    method: 'GET',
    accessToken,
  })
}

/**
 * Cancel a running scan
 *
 * POST /api/scans/{scanId}/cancel
 *
 * @param scanId - Scan UUID to cancel
 * @param accessToken - JWT access token from useAuth()
 * @returns Confirmation message with scan_id
 */
export async function cancelScan(
  scanId: string,
  accessToken: string | null
): Promise<{ message: string; scan_id: string }> {
  return apiFetch<{ message: string; scan_id: string }>(
    `${SCANS_BASE}/${scanId}/cancel`,
    {
      method: 'POST',
      accessToken,
    }
  )
}

/**
 * Fetch scan results with optional filters and pagination
 *
 * GET /api/scans/{scanId}/results
 *
 * @param scanId - Scan UUID
 * @param filters - Optional filters for has_pand, bestemming_type, area range, score, sort, pagination
 * @param accessToken - JWT access token from useAuth()
 * @returns Paginated scan results with total count
 */
export async function fetchScanResults(
  scanId: string,
  filters: ScanResultsFilters,
  accessToken: string | null
): Promise<ScanResultsResponse> {
  const params = new URLSearchParams()

  if (filters.has_pand !== undefined)
    params.set('has_pand', filters.has_pand.toString())
  if (filters.bestemming_type) params.set('bestemming_type', filters.bestemming_type)
  if (filters.min_area_m2 !== undefined)
    params.set('min_area_m2', filters.min_area_m2.toString())
  if (filters.max_area_m2 !== undefined)
    params.set('max_area_m2', filters.max_area_m2.toString())
  if (filters.score_category) params.set('score_category', filters.score_category)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_order) params.set('sort_order', filters.sort_order)
  if (filters.offset !== undefined) params.set('offset', filters.offset.toString())
  if (filters.limit !== undefined) params.set('limit', filters.limit.toString())

  const url = `${SCANS_BASE}/${scanId}/results${params.toString() ? `?${params}` : ''}`

  return apiFetch<ScanResultsResponse>(url, {
    method: 'GET',
    accessToken,
  })
}
