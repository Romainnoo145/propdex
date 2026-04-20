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
  GenerateReportFromParcelResponse,
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
  ParcelEnrichmentResponse,
  ParcelRiskProfileResponse,
  ScanCreateRequest,
  ScanResponse,
  ScanStatusResponse,
  ScanResultsResponse,
  ScanResultsFilters,
  ScanListResponse,
  ScanResultItem,
} from './types/scan'
import type {
  ChangeRecord,
  ChangeRecordListResponse,
  MarkAllReadResponse,
  MonitoringSubscriptionRequest,
  MonitoringSubscriptionResponse,
  UnreadDetailResponse,
} from './types/monitoring'
import type { ParcelDocumentMeta, ParcelDocumentListResponse } from './types/document'

const API_BASE = '/api/properties'
const REPORTS_BASE = '/api/reports'
const PROJECTS_BASE = '/api/projects'
const SCANS_BASE = '/api/scans'
const MONITORING_BASE = '/api/monitoring'
const PDOK_BASE_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1'

/**
 * Authenticated fetch wrapper with Bearer token injection
 *
 * @param url - API endpoint URL
 * @param options - Fetch options with required accessToken
 * @returns Parsed JSON response
 * @throws Error with detail message on non-OK response
 */
/**
 * Global token refresh hook — set by AuthProvider so apiFetch can
 * silently refresh an expired access token on 401 without importing
 * auth modules (avoids circular deps).
 */
let _tokenRefreshFn: (() => Promise<string | null>) | null = null
let _refreshInFlight: Promise<string | null> | null = null

export function setTokenRefreshFn(fn: (() => Promise<string | null>) | null) {
  _tokenRefreshFn = fn
}

/** Deduplicate concurrent refresh calls — all callers share one in-flight request. */
function deduplicatedRefresh(): Promise<string | null> {
  if (_refreshInFlight) return _refreshInFlight
  _refreshInFlight = _tokenRefreshFn!()
    .catch(() => null)
    .finally(() => { _refreshInFlight = null })
  return _refreshInFlight
}

/** Extract a human-readable error message from a FastAPI error response body. */
function extractErrorMessage(error: Record<string, unknown>, fallback: string): string {
  if (typeof error.detail === 'string') return error.detail
  if (Array.isArray(error.detail)) {
    return error.detail.map((d: Record<string, unknown>) => (d.msg as string) ?? JSON.stringify(d)).join('; ')
  }
  return fallback
}

/**
 * API error that carries the HTTP status of the failing response, so hooks
 * can make retry decisions without having to parse the error message. Used
 * e.g. by usePolicyDocuments to fail fast on 404 empty-slot responses.
 */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit & { accessToken: string | null }
): Promise<T> {
  const { accessToken, ...fetchOptions } = options

  const doFetch = async (token: string | null) => {
    const headers = new Headers(fetchOptions.headers)
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    if (fetchOptions.method && fetchOptions.method !== 'GET' && fetchOptions.body) {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    })
  }

  let response = await doFetch(accessToken)

  // On 401: try silent refresh once, then retry (deduplicated across concurrent calls)
  if (response.status === 401 && _tokenRefreshFn) {
    const newToken = await deduplicatedRefresh()
    if (newToken) {
      response = await doFetch(newToken)
    }
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Request failed with status ${response.status}` }))
    throw new ApiError(
      response.status,
      extractErrorMessage(error, `Request failed with status ${response.status}`),
    )
  }

  // 204 No Content — nothing to parse
  if (response.status === 204) {
    return undefined as T
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
    throw new Error(extractErrorMessage(error, `Delete failed with status ${response.status}`))
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
 * Regenerate report with fresh data from all API sources
 *
 * POST /api/reports/{reportId}/regenerate
 */
export async function regenerateReport(
  reportId: string,
  accessToken: string | null
): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>(`${REPORTS_BASE}/${reportId}/regenerate`, {
    method: 'POST',
    accessToken,
  })
}

/**
 * Update report notes (per-section JSON string)
 *
 * PATCH /api/reports/{reportId}/notes
 *
 * @param reportId - Report UUID to update
 * @param notes - Notes JSON string or null
 * @param accessToken - JWT access token from useAuth()
 * @returns Updated report detail
 */
export async function updateReportNotes(
  reportId: string,
  notes: string | null,
  accessToken: string | null,
): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>(`${REPORTS_BASE}/${reportId}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
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
    throw new Error(extractErrorMessage(error, `Export failed with status ${response.status}`))
  }

  return response.blob()
}

/**
 * Generate Risicobeoordeling Startdossier PDF
 *
 * POST /api/reports/{reportId}/dossier
 *
 * @param reportId - Report UUID to generate dossier for
 * @param accessToken - JWT access token from useAuth()
 * @returns PDF blob for download
 */
export async function generateStartdossier(
  reportId: string,
  accessToken: string | null
): Promise<Blob> {
  const headers = new Headers()

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${REPORTS_BASE}/${reportId}/dossier`, {
    method: 'POST',
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Dossier generation failed with status ${response.status}` }))
    throw new Error(extractErrorMessage(error, `Dossier generation failed with status ${response.status}`))
  }

  return response.blob()
}

/**
 * Upload bestemmingsplan PDF for AI parsing
 *
 * POST /api/properties/upload-pdf?plan_idn={planIdn}
 *
 * @param planIdn - IMRO plan identifier (e.g., NL.IMRO.0363.BP2024CENTRUM-VA01)
 * @param file - PDF file to upload
 * @param accessToken - JWT access token from useAuth()
 * @returns Job status with job_id for polling
 */
export async function uploadBestemmingsplanPDF(
  planIdn: string,
  file: File,
  accessToken: string | null
): Promise<{ status: string; job_id: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const headers = new Headers()
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(
    `${API_BASE}/upload-pdf?plan_idn=${encodeURIComponent(planIdn)}`,
    {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Upload failed with status ${response.status}` }))
    throw new Error(extractErrorMessage(error, `Upload failed with status ${response.status}`))
  }

  return response.json()
}

/**
 * Poll AI parsing job status
 *
 * GET /api/properties/jobs/{jobId}/status
 *
 * Returns current status with parsed data when complete.
 */
export async function fetchAIParsingJobStatus(
  jobId: string,
  accessToken: string | null
): Promise<{ job_id: string; status: string; progress_pct: number; message: string | null; data: unknown | null; error: string | null }> {
  const headers = new Headers()
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(
    `${API_BASE}/jobs/${encodeURIComponent(jobId)}/status`,
    {
      headers,
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ detail: `Status check failed with ${response.status}` }))
    throw new Error(extractErrorMessage(err, `Status check failed with ${response.status}`))
  }

  return response.json()
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
    throw new Error(extractErrorMessage(error, `Delete failed with status ${response.status}`))
  }
}

/**
 * Assign a report to a project
 *
 * PATCH /api/reports/{reportId}/project
 *
 * @param reportId - Report UUID
 * @param projectId - Project UUID (or null to auto-assign by location)
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
 * Generate a full property intelligence report from a scan result parcel
 *
 * POST /api/reports/from-parcel
 *
 * Triggers the property aggregator pipeline (BAG, PDOK, DSO, RCE, SRU)
 * for the parcel's address and saves the result as a report.
 *
 * @param parcelId - ParcelCache UUID
 * @param accessToken - JWT access token from useAuth()
 * @param options - Optional notes and project_id
 * @returns Created report with full details
 */
export async function generateReportFromParcel(
  parcelId: string,
  accessToken: string | null,
  options?: { notes?: string; project_id?: string; address_override?: string }
): Promise<GenerateReportFromParcelResponse> {
  const headers = new Headers()
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  headers.set('Content-Type', 'application/json')

  const response = await fetch(`${REPORTS_BASE}/from-parcel`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      parcel_id: parcelId,
      ...(options?.notes && { notes: options.notes }),
      ...(options?.project_id && { project_id: options.project_id }),
      ...(options?.address_override && { address_override: options.address_override }),
    }),
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Request failed with status ${response.status}` }))
    throw new Error(extractErrorMessage(error, `Request failed with status ${response.status}`))
  }

  const payload = await response.json() as
    | GenerateReportFromParcelResponse
    | ReportDetailResponse

  // Backward-compatible fallback for pre-wrapper backend responses.
  if ('report' in payload && 'created' in payload) {
    return payload
  }

  return {
    report: payload,
    created: response.status === 201,
  }
}

/**
 * Generate a full property intelligence report from postcode + huisnummer.
 *
 * POST /api/reports/from-address
 *
 * Fallback flow for meldingen without matched parcel IDs.
 */
export async function generateReportFromAddress(
  input: {
    postcode: string
    huisnummer: number
    notes?: string
    project_id?: string
  },
  accessToken: string | null
): Promise<ReportDetailResponse> {
  return apiFetch<ReportDetailResponse>(`${REPORTS_BASE}/from-address`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      postcode: input.postcode,
      huisnummer: input.huisnummer,
      ...(input.notes && { notes: input.notes }),
      ...(input.project_id && { project_id: input.project_id }),
    }),
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
 * @param filters - Optional filters for has_pand, bestemming_type, area range, score, sort (including subscore sorts), pagination
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
  if (filters.search) params.set('search', filters.search)
  if (filters.bestemming_type) params.set('bestemming_type', filters.bestemming_type)
  if (filters.min_area_m2 !== undefined)
    params.set('min_area_m2', filters.min_area_m2.toString())
  if (filters.max_area_m2 !== undefined)
    params.set('max_area_m2', filters.max_area_m2.toString())
  if (filters.score_category) params.set('score_category', filters.score_category)
  if (filters.pand_status) params.set('pand_status', filters.pand_status)
  if (filters.min_score !== undefined) params.set('min_score', filters.min_score.toString())
  if (filters.exclude_null_scores !== undefined)
    params.set('exclude_null_scores', filters.exclude_null_scores.toString())
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

/**
 * Get vector tile URL for scan results
 *
 * Returns MapLibre-compatible tile URL template for MVT tiles.
 * Tiles are served by Martin tile server at /api/scans/{scanId}/tiles/{z}/{x}/{y}.pbf
 *
 * @param scanId - Scan UUID
 * @returns Tile URL template with {z}/{x}/{y} placeholders
 */
export function getScanTileUrl(scanId: string, cacheBuster?: string): string {
  const TILE_SCHEMA_VERSION = '14'
  // Absolute URL required — MapLibre fetches vector tiles in a web worker
  // which cannot resolve relative paths.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const cb = cacheBuster ? `&cb=${cacheBuster}` : ''
  return `${origin}${SCANS_BASE}/${scanId}/tiles/{z}/{x}/{y}.pbf?v=${TILE_SCHEMA_VERSION}${cb}`
}

/**
 * Fetch wijk boundaries for a gemeente from CBS WFS via backend
 *
 * GET /api/scans/wijken?gemeente_code={code}
 *
 * @param gemeenteCode - CBS gemeentecode (e.g., '0983' for Venlo)
 * @param accessToken - JWT access token
 * @returns GeoJSON FeatureCollection with wijk polygons
 */
export async function fetchWijken(
  gemeenteCode: string,
  accessToken: string | null
): Promise<GeoJSON.FeatureCollection> {
  return apiFetch<GeoJSON.FeatureCollection>(
    `${SCANS_BASE}/wijken?gemeente_code=${encodeURIComponent(gemeenteCode)}`,
    {
      method: 'GET',
      accessToken,
    }
  )
}

/**
 * Fetch parcel centroid in WGS84 for map fly-to
 *
 * GET /api/scans/parcels/{parcelId}/centroid
 *
 * @param parcelId - ParcelCache UUID
 * @param accessToken - JWT access token
 * @returns {lng, lat} in WGS84
 */
export async function fetchParcelCentroid(
  parcelId: string,
  accessToken: string | null
): Promise<{
  lng: number
  lat: number
  address: string | null
  parcel_code?: string | null
  gemeente_code?: string | null
  area_m2?: number | null
  has_pand?: boolean | null
  bouwjaar?: number | null
  pand_status?: string | null
  geometry?: GeoJSON.Geometry | null
}> {
  return apiFetch<{
    lng: number
    lat: number
    address: string | null
    parcel_code?: string | null
    gemeente_code?: string | null
    area_m2?: number | null
    has_pand?: boolean | null
    bouwjaar?: number | null
    pand_status?: string | null
    geometry?: GeoJSON.Geometry | null
  }>(
    `${SCANS_BASE}/parcels/${parcelId}/centroid`,
    { method: 'GET', accessToken }
  )
}

/**
 * Resolve parcel by clicked WGS84 map point.
 *
 * GET /api/scans/parcels/at-point?lng=...&lat=...
 */
export async function fetchParcelAtPoint(
  lng: number,
  lat: number,
  accessToken: string | null,
  options?: { scanId?: string | null }
): Promise<{
  parcel_id: string
  lng: number
  lat: number
  address: string | null
  parcel_code?: string | null
  gemeente_code?: string | null
  area_m2?: number | null
  has_pand: boolean
  bouwjaar?: number | null
  pand_status?: string | null
  score?: number | null
  potentie_score?: number | null
  risico_score?: number | null
  score_category?: string | null
  score_breakdown?: Record<string, unknown> | null
  vacancy_signal?: string | null
  vacancy_confidence?: number | null
  vacancy_reasons?: string[] | null
  vacancy_model_version?: string | null
  market_signals?: {
    listing_duration_days: number
    price_change_count: number
    listing_snapshots_count: number
    days_since_last_seen: number
  } | null
  opportunity_signals?: string[] | null
  building_metrics?: Record<string, unknown> | null
  bestemmingen?: Record<string, unknown>[] | null
  has_report: boolean
  geometry?: GeoJSON.Geometry | null
}> {
  const query = new URLSearchParams({
    lng: String(lng),
    lat: String(lat),
  })
  if (options?.scanId) {
    query.set('scan_id', options.scanId)
  }
  return apiFetch<{
    parcel_id: string
    lng: number
    lat: number
    address: string | null
    parcel_code?: string | null
    gemeente_code?: string | null
    area_m2?: number | null
    has_pand: boolean
    bouwjaar?: number | null
    pand_status?: string | null
    score?: number | null
    potentie_score?: number | null
    risico_score?: number | null
    score_category?: string | null
    score_breakdown?: Record<string, unknown> | null
    vacancy_signal?: string | null
    market_signals?: {
      listing_duration_days: number
      price_change_count: number
      listing_snapshots_count: number
      days_since_last_seen: number
    } | null
    opportunity_signals?: string[] | null
    building_metrics?: Record<string, unknown> | null
    bestemmingen?: Record<string, unknown>[] | null
    primary_bestemming_type?: string | null
    has_report: boolean
    geometry?: GeoJSON.Geometry | null
  }>(
    `${SCANS_BASE}/parcels/at-point?${query.toString()}`,
    { method: 'GET', accessToken }
  )
}

/**
 * Resolve a ParcelCache UUID from address components.
 *
 * GET /api/scans/parcels/resolve?street=...&huisnummer=...&postcode=...
 */
export async function resolveParcelByAddress(
  params: { street: string; huisnummer: number; postcode?: string },
  accessToken: string | null
): Promise<{ parcel_id: string; lng: number; lat: number; address: string | null }> {
  const query = new URLSearchParams({
    street: params.street,
    huisnummer: String(params.huisnummer),
  })
  if (params.postcode) {
    query.set('postcode', params.postcode)
  }

  return apiFetch<{ parcel_id: string; lng: number; lat: number; address: string | null }>(
    `${SCANS_BASE}/parcels/resolve?${query.toString()}`,
    { method: 'GET', accessToken }
  )
}

/**
 * Fetch on-demand enrichment for a parcel (vergunningen via SRU)
 *
 * GET /api/scans/parcels/{parcelId}/enrich
 *
 * Returns cached enrichment if available and fresh (< 7 days old).
 * Otherwise fetches fresh data from SRU API.
 *
 * @param parcelId - ParcelCache UUID
 * @param accessToken - JWT access token
 * @returns Parcel enrichment with vergunningen and cache status
 */
export async function fetchParcelEnrichment(
  parcelId: string,
  accessToken: string | null
): Promise<ParcelEnrichmentResponse> {
  return apiFetch<ParcelEnrichmentResponse>(
    `${SCANS_BASE}/parcels/${parcelId}/enrich`,
    { method: 'GET', accessToken }
  )
}

/**
 * Fetch fysiek risicoprofiel for a parcel (foundation risk, soil, asbest, contamination)
 *
 * GET /api/scans/parcels/{parcelId}/risk-profile
 *
 * @param parcelId - ParcelCache UUID
 * @param accessToken - JWT access token
 * @returns Fysiek risicoprofiel with sub-risk components
 */
export async function fetchParcelRiskProfile(
  parcelId: string,
  accessToken: string | null
): Promise<ParcelRiskProfileResponse> {
  return apiFetch<ParcelRiskProfileResponse>(
    `${SCANS_BASE}/parcels/${parcelId}/risk-profile`,
    { method: 'GET', accessToken }
  )
}

/**
 * Fetch the latest scan result data for a single parcel (score breakdown, building metrics, etc.)
 *
 * GET /api/scans/parcels/{parcelId}/scan-data
 *
 * @param parcelId - ParcelCache UUID
 * @param accessToken - JWT access token
 * @returns ScanResultItem with full score breakdown
 */
export async function fetchParcelScanData(
  parcelId: string,
  accessToken: string | null
): Promise<ScanResultItem> {
  return apiFetch<ScanResultItem>(
    `${SCANS_BASE}/parcels/${parcelId}/scan-data`,
    { method: 'GET', accessToken }
  )
}

/**
 * Fetch aerial crop image for a parcel as a blob URL
 *
 * GET /api/scans/parcels/{parcelId}/aerial-crop
 *
 * Returns a blob URL suitable for use as an <img> src, or null on error.
 * The backend proxies PDOK WMS and returns a JPEG image.
 *
 * @param parcelId - ParcelCache UUID
 * @param accessToken - JWT access token
 * @returns Blob URL string or null on failure
 */
export async function fetchAerialCrop(
  parcelId: string,
  accessToken: string | null
): Promise<string | null> {
  try {
    const headers: HeadersInit = {}
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    const response = await fetch(
      `${SCANS_BASE}/parcels/${parcelId}/aerial-crop`,
      { method: 'GET', headers, credentials: 'include' }
    )
    if (!response.ok) return null
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/**
 * Fetch paginated scan history for the authenticated organization
 * GET /api/scans
 */
export async function fetchScanHistory(
  accessToken: string | null,
  params?: { offset?: number; limit?: number; status?: string }
): Promise<ScanListResponse> {
  const query = new URLSearchParams()
  if (params?.offset !== undefined) query.set('offset', params.offset.toString())
  if (params?.limit !== undefined) query.set('limit', params.limit.toString())
  if (params?.status) query.set('status', params.status)

  const url = `${SCANS_BASE}${query.toString() ? `?${query}` : ''}`
  return apiFetch<ScanListResponse>(url, { method: 'GET', accessToken })
}

/** Response shape for aggregated funda market signals per scan. */
export interface FundaSummaryResponse {
  scan_id: string
  listings_with_data: number
  avg_listing_duration_days: number | null
  total_price_changes: number
  avg_days_since_last_seen: number | null
  total_listing_snapshots: number
}

/**
 * Fetch aggregated funda market signals for a scan.
 * GET /api/scans/{scanId}/funda-summary
 */
export async function fetchFundaSummary(
  scanId: string,
  accessToken: string | null
): Promise<FundaSummaryResponse> {
  return apiFetch<FundaSummaryResponse>(
    `${SCANS_BASE}/${scanId}/funda-summary`,
    { method: 'GET', accessToken }
  )
}

/**
 * Fetch paginated scans for a specific project
 * GET /api/projects/{projectId}/scans
 */
export async function fetchProjectScans(
  projectId: string,
  accessToken: string | null,
  params?: { offset?: number; limit?: number }
): Promise<ScanListResponse> {
  const query = new URLSearchParams()
  if (params?.offset !== undefined) query.set('offset', params.offset.toString())
  if (params?.limit !== undefined) query.set('limit', params.limit.toString())

  const url = `${PROJECTS_BASE}/${projectId}/scans${query.toString() ? `?${query}` : ''}`
  return apiFetch<ScanListResponse>(url, { method: 'GET', accessToken })
}

/**
 * Fetch unread change notification counts
 *
 * GET /api/monitoring/unread
 *
 * @param accessToken - JWT access token
 * @returns Total unread count and per-project breakdown
 */
export async function fetchUnreadCounts(
  accessToken: string | null
): Promise<UnreadDetailResponse> {
  return apiFetch<UnreadDetailResponse>(`${MONITORING_BASE}/unread`, {
    accessToken,
    method: 'GET',
  })
}

/**
 * Fetch all change history across the organization (no project filter)
 *
 * GET /api/monitoring/changes (without project_id)
 *
 * @param accessToken - JWT access token
 * @param limit - Max records to return
 * @param offset - Pagination offset
 * @param includeMatches - Include matched parcels/reports
 * @returns Paginated list of change records with project_name context
 */
export async function fetchAllChanges(
  accessToken: string | null,
  limit = 100,
  offset = 0,
  includeMatches = false,
  gemeenteNaam?: string
): Promise<ChangeRecordListResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })
  if (includeMatches) params.set('include_matches', 'true')
  if (gemeenteNaam) params.set('gemeente_naam', gemeenteNaam)

  return apiFetch<ChangeRecordListResponse>(
    `${MONITORING_BASE}/changes?${params}`,
    { accessToken, method: 'GET' }
  )
}

/**
 * Fetch change history for a specific project
 *
 * GET /api/monitoring/changes
 *
 * @param projectId - Project UUID
 * @param accessToken - JWT access token
 * @param options - Optional limit, offset, includeMatches
 * @returns Paginated list of change records
 */
export async function fetchProjectChanges(
  projectId: string,
  accessToken: string | null,
  limit = 50,
  offset = 0,
  includeMatches = false
): Promise<ChangeRecordListResponse> {
  const params = new URLSearchParams({
    project_id: projectId,
    limit: limit.toString(),
    offset: offset.toString(),
  })
  if (includeMatches) params.set('include_matches', 'true')

  return apiFetch<ChangeRecordListResponse>(
    `${MONITORING_BASE}/changes?${params}`,
    { accessToken, method: 'GET' }
  )
}

/**
 * Fetch bekendmakingen matching a specific parcel's postcode
 *
 * GET /api/monitoring/changes-for-parcel/{parcelId}
 *
 * @param parcelId - ParcelCache UUID
 * @param accessToken - JWT access token
 * @returns List of matching change records
 */
export async function fetchChangesForParcel(
  parcelId: string,
  accessToken: string | null
): Promise<ChangeRecord[]> {
  return apiFetch<ChangeRecord[]>(
    `${MONITORING_BASE}/changes-for-parcel/${parcelId}`,
    { accessToken, method: 'GET' }
  )
}

/**
 * Mark a project's changes as viewed (clears unread badge)
 *
 * POST /api/monitoring/viewed/{projectId}
 *
 * @param projectId - Project UUID
 * @param accessToken - JWT access token
 */
export async function markProjectViewed(
  projectId: string,
  accessToken: string | null
): Promise<void> {
  await apiFetch(`${MONITORING_BASE}/viewed/${projectId}`, {
    accessToken,
    method: 'POST',
  })
}

/**
 * Mark a single change as read for the current user
 *
 * POST /api/monitoring/changes/{changeId}/read
 *
 * Idempotent — safe to call multiple times (ON CONFLICT DO NOTHING).
 *
 * @param changeId - Change UUID
 * @param accessToken - JWT access token
 */
export async function markChangeRead(
  changeId: string,
  accessToken: string | null
): Promise<void> {
  await apiFetch(`${MONITORING_BASE}/changes/${changeId}/read`, {
    accessToken,
    method: 'POST',
  })
}

/**
 * Mark a single change as unread for the current user
 *
 * DELETE /api/monitoring/changes/{changeId}/read
 *
 * @param changeId - Change UUID
 * @param accessToken - JWT access token
 */
export async function markChangeUnread(
  changeId: string,
  accessToken: string | null
): Promise<void> {
  await apiFetch(`${MONITORING_BASE}/changes/${changeId}/read`, {
    accessToken,
    method: 'DELETE',
  })
}

/**
 * Mark all changes as read for the current user (bulk action)
 *
 * POST /api/monitoring/changes/read-all
 * POST /api/monitoring/changes/read-all?project_id={projectId}
 *
 * @param accessToken - JWT access token
 * @param projectId - Optional project filter (omit for all org changes)
 * @returns Status and count of changes marked read
 */
export async function markAllChangesRead(
  accessToken: string | null,
  projectId?: string
): Promise<MarkAllReadResponse> {
  const params = projectId ? `?project_id=${projectId}` : ''
  return apiFetch<MarkAllReadResponse>(
    `${MONITORING_BASE}/changes/read-all${params}`,
    {
      accessToken,
      method: 'POST',
    }
  )
}

export async function refreshMonitoring(
  accessToken: string | null,
  projectId: string
): Promise<{ status: string; new_changes: number; total_detected: number }> {
  return apiFetch<{ status: string; new_changes: number; total_detected: number }>(
    `${MONITORING_BASE}/refresh/${projectId}`,
    {
      accessToken,
      method: 'POST',
    }
  )
}

export async function setGemeenteMonitoringSubscription(
  accessToken: string | null,
  input: MonitoringSubscriptionRequest
): Promise<MonitoringSubscriptionResponse> {
  return apiFetch<MonitoringSubscriptionResponse>(`${MONITORING_BASE}/subscriptions`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// ==========================================
// Jurisprudence (Rechtspraak) API bindings
// ==========================================

export interface JurisprudenceResult {
  ecli: string
  title: string
  summary: string
  date: string
}

export interface JurisprudenceDocument {
  ecli: string
  text: string
  instantie: string
  datum_uitspraak: string
}

export async function searchJurisprudence(
  query: string,
  accessToken: string | null,
  maxResults = 10
): Promise<{ status: string; results: JurisprudenceResult[] }> {
  return apiFetch<{ status: string; results: JurisprudenceResult[] }>(
    `/api/jurisprudence/search?q=${encodeURIComponent(query)}&max_results=${maxResults}`,
    { method: 'GET', accessToken }
  )
}

export async function getJurisprudenceDoc(
  ecli: string,
  accessToken: string | null
): Promise<{ status: string; document: JurisprudenceDocument }> {
  return apiFetch<{ status: string; document: JurisprudenceDocument }>(
    `/api/jurisprudence/doc/${encodeURIComponent(ecli)}`,
    { method: 'GET', accessToken }
  )
}

// ==========================================
// Gemeente Rulings Feed types + bindings
// ==========================================

export interface GemeenteRulingsFeedItem {
  ecli: string
  court_code: string
  instantie: string
  datum_uitspraak: string
  title: string
  summary: string
  extracted_gemeente: string | null
  geo_relevance: 'gemeente' | 'arrondissement'
  uitkomst: string | null
  vergunningstype: string | null
  fetched_at: string | null
}

export interface WinLossRatio {
  toegewezen: number
  afgewezen: number
  gedeeltelijk: number
  onbekend: number
  total: number
}

export interface GemeenteRulingsFeedResponse {
  status: string
  rulings: GemeenteRulingsFeedItem[]
  win_loss: WinLossRatio
  doorlooptijd?: Record<string, DoorlooptijdStats>
  ingestion_status: 'fresh' | 'refreshing' | 'pending'
  count: number
}

/**
 * Fetch auto-populated ruling feed for a gemeente from cached rulings.
 *
 * GET /api/jurisprudence/rulings/{gemeenteNaam}
 *
 * @param gemeenteNaam - Municipality name
 * @param accessToken - JWT access token
 * @returns Feed response with rulings, win_loss ratio, and ingestion status
 */
export async function getGemeenteRulingsFeed(
  gemeenteNaam: string,
  accessToken: string | null
): Promise<GemeenteRulingsFeedResponse> {
  return apiFetch<GemeenteRulingsFeedResponse>(
    `/api/jurisprudence/rulings/${encodeURIComponent(gemeenteNaam)}`,
    { method: 'GET', accessToken }
  )
}

// ==========================================
// Jurisprudence AI Analysis types + bindings
// ==========================================

export interface RulingAnalysis {
  ecli: string
  bezwaargrond: string
  uitkomst: 'toegewezen' | 'afgewezen' | 'gedeeltelijk' | 'onbekend'
  relevantie: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  vergunningstype: string
}

export interface DoorlooptijdStats {
  vergunningstype: string
  count: number
  avg_dagen: number | null
  min_dagen: number | null
  max_dagen: number | null
  insufficient_data?: boolean
}

export interface JuridischAnalysisResult {
  gemeente_naam: string
  // M046/S01 RM-1: scores are null when dev-type sample is below threshold.
  // Callers must check succeskans_missing before rendering a number.
  juridisch_klimaat_score: number | null
  vergunnings_succeskans: number | null
  succeskans_missing?: boolean
  succeskans_reason?: string | null
  dev_type_ruling_count?: number
  risico_samenvatting: string
  top_risico_factoren: string[]
  ruling_analyses: RulingAnalysis[]
  doorlooptijd: Record<string, DoorlooptijdStats> | null
  disclaimer: string
  analyzed_at: string
}

export interface JurisprudenceAnalysisResponse {
  status: 'queued' | 'in_progress' | 'complete' | 'failed' | 'partial'
  job_id?: string | null
  result?: JuridischAnalysisResult
  error?: string
  analyzed_count?: number
  pending_count?: number
}

/**
 * @deprecated Use analyzeGemeenteRulings instead. Kept for backward compat.
 */
export async function triggerJurisprudenceAnalysis(
  ecliList: string[],
  gemeenteNaam: string,
  accessToken: string | null
): Promise<JurisprudenceAnalysisResponse> {
  return apiFetch<JurisprudenceAnalysisResponse>(
    '/api/jurisprudence/analyze',
    {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ ecli_list: ecliList, gemeente_naam: gemeenteNaam }),
    }
  )
}

/**
 * @deprecated Use analyzeGemeenteRulings + pollRulingAnalysis instead. Kept for backward compat.
 */
export async function pollJurisprudenceAnalysis(
  jobId: string,
  accessToken: string | null
): Promise<JurisprudenceAnalysisResponse> {
  return apiFetch<JurisprudenceAnalysisResponse>(
    `/api/jurisprudence/analyze/${jobId}`,
    { method: 'GET', accessToken }
  )
}

/** Response from the per-ruling analysis endpoint */
export interface AnalyzeGemeenteResponse {
  status: 'complete' | 'partial' | 'in_progress' | 'not_found'
  gemeente_naam: string
  // M046/S01 RM-1: scores are null when dev-type sample is below threshold (< 5).
  juridisch_klimaat_score: number | null
  vergunnings_succeskans: number | null
  succeskans_missing?: boolean
  succeskans_reason?: string | null
  dev_type_ruling_count?: number
  total_ruling_count?: number
  ruling_analyses: RulingAnalysis[]
  analyzed_count: number
  pending_count: number
  total_count: number
  job_id?: string | null
  analyzed_at?: string
}

/**
 * Trigger per-ruling AI analysis for a gemeente.
 *
 * POST /api/jurisprudence/analyze/{gemeenteNaam}
 *
 * Returns partial result immediately with scores from already-analyzed rulings.
 * Enqueues ARQ job for un-analyzed rulings if any remain.
 */
export async function analyzeGemeenteRulings(
  gemeenteNaam: string,
  accessToken: string | null
): Promise<AnalyzeGemeenteResponse> {
  return apiFetch<AnalyzeGemeenteResponse>(
    `/api/jurisprudence/analyze/${encodeURIComponent(gemeenteNaam)}`,
    { method: 'POST', accessToken }
  )
}

/**
 * Poll status of per-ruling AI analysis for a gemeente.
 *
 * GET /api/jurisprudence/analyze/status/{gemeenteNaam}
 */
export async function pollRulingAnalysis(
  gemeenteNaam: string,
  accessToken: string | null
): Promise<AnalyzeGemeenteResponse> {
  return apiFetch<AnalyzeGemeenteResponse>(
    `/api/jurisprudence/analyze/status/${encodeURIComponent(gemeenteNaam)}`,
    { method: 'GET', accessToken }
  )
}

// ==========================================
// Jurisprudentie Explorer types + bindings
// ==========================================

export interface ExplorerRuling {
  ecli: string
  court_code: string
  instantie: string | null
  datum_uitspraak: string | null
  title: string | null
  summary: string | null
  extracted_gemeente: string | null
  uitkomst: string | null
  vergunningstype: string | null
  rechtsgronden: string[]
  doorlooptijd_dagen: number | null
  ai_analysis: Record<string, unknown> | null
}

export interface FacetItem {
  value: string
  count: number
}

export interface DoorlooptijdPerType {
  vergunningstype: string
  count: number
  avg_dagen: number | null
  min_dagen: number | null
  max_dagen: number | null
}

export interface OpponentProfile {
  naam: string
  zaken: number
  gewonnen: number
  verloren: number
}

export interface ExplorerResponse {
  results: ExplorerRuling[]
  total_count: number
  has_more: boolean
  facets: {
    gemeente: FacetItem[]
    vergunningstype: FacetItem[]
    uitkomst: FacetItem[]
    rechtsgrond: FacetItem[]
    rechtbank_niveau: FacetItem[]
  }
  doorlooptijd_per_type: DoorlooptijdPerType[]
  opponent_profiles: OpponentProfile[]
}

export interface ExplorerFilters {
  gemeente?: string
  vergunningstype?: string
  uitkomst?: string
  rechtsgrond?: string
  rechtbank_niveau?: string
  periode?: string
}

/**
 * Fetch explorer results with faceted filtering and pagination.
 *
 * GET /api/jurisprudence/explorer
 */
export async function fetchExplorerResults(
  accessToken: string | null,
  filters: ExplorerFilters,
  limit: number,
  offset: number
): Promise<ExplorerResponse> {
  const params = new URLSearchParams()
  params.set('limit', limit.toString())
  params.set('offset', offset.toString())

  if (filters.gemeente) params.set('gemeente', filters.gemeente)
  if (filters.vergunningstype) params.set('vergunningstype', filters.vergunningstype)
  if (filters.uitkomst) params.set('uitkomst', filters.uitkomst)
  if (filters.rechtsgrond) params.set('rechtsgrond', filters.rechtsgrond)
  if (filters.rechtbank_niveau) params.set('rechtbank_niveau', filters.rechtbank_niveau)
  if (filters.periode) params.set('periode', filters.periode)

  return apiFetch<ExplorerResponse>(
    `/api/jurisprudence/explorer?${params}`,
    { method: 'GET', accessToken }
  )
}

/** Response from doorlooptijd stats endpoint */
export interface DoorlooptijdResponse {
  status: string
  [vergunningstype: string]: DoorlooptijdStats | string
}

/**
 * Get aggregated doorlooptijd statistics per vergunningstype for a gemeente.
 *
 * GET /api/jurisprudence/doorlooptijd/{gemeenteNaam}
 */
export async function getDoorlooptijdStats(
  gemeenteNaam: string,
  accessToken: string | null
): Promise<Record<string, DoorlooptijdStats>> {
  const raw = await apiFetch<Record<string, unknown>>(
    `/api/jurisprudence/doorlooptijd/${encodeURIComponent(gemeenteNaam)}`,
    { method: 'GET', accessToken }
  )
  // The endpoint returns { status: "success", ...stats }
  // Strip status and overall_avg to return only vergunningstype entries
  const result: Record<string, DoorlooptijdStats> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'status' && key !== 'overall_avg' && typeof value === 'object' && value !== null) {
      result[key] = value as DoorlooptijdStats
    }
  }
  return result
}

// ── Trend Data ──────────────────────────────────────────────────────────

export interface MonthBucket {
  month: string            // "YYYY-MM"
  total: number
  toegewezen: number
  afgewezen: number
  gedeeltelijk: number
  klimaat_score: number
  avg_doorlooptijd: number | null
}

export interface TrendSummary {
  total_rulings: number
  avg_doorlooptijd: number | null
  succes_pct: number
  months_with_data: number
}

export interface TrendResponse {
  gemeente_naam: string
  months: MonthBucket[]
  summary: TrendSummary
}

/**
 * Fetch rolling 12-month trend data for a gemeente.
 *
 * GET /api/jurisprudence/trend/{gemeenteNaam}
 */
export async function fetchTrendData(
  gemeenteNaam: string,
  accessToken: string
): Promise<TrendResponse> {
  return apiFetch<TrendResponse>(
    `/api/jurisprudence/trend/${encodeURIComponent(gemeenteNaam)}`,
    { method: 'GET', accessToken }
  )
}

// ==========================================
// Document Upload API bindings
// ==========================================

const DOCUMENTS_BASE = '/api/documents'

/**
 * Fetch all documents for a parcel
 *
 * GET /api/documents/{parcelId}/documents
 */
export async function fetchParcelDocuments(
  parcelId: string,
  accessToken: string | null
): Promise<ParcelDocumentListResponse> {
  return apiFetch<ParcelDocumentListResponse>(
    `${DOCUMENTS_BASE}/${parcelId}/documents`,
    { method: 'GET', accessToken }
  )
}

/**
 * Upload a document for a parcel in a specific dossier category
 *
 * POST /api/documents/{parcelId}/documents?document_type={type}
 *
 * Uses raw fetch (NOT apiFetch) because apiFetch auto-sets Content-Type
 * to application/json which breaks multipart/form-data uploads.
 */
export async function uploadParcelDocument(
  parcelId: string,
  documentType: string,
  file: File,
  accessToken: string | null
): Promise<ParcelDocumentMeta> {
  const formData = new FormData()
  formData.append('file', file)

  const headers: HeadersInit = {}
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(
    `${DOCUMENTS_BASE}/${parcelId}/documents?document_type=${encodeURIComponent(documentType)}`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: `Upload failed with status ${response.status}` }))
    throw new Error(extractErrorMessage(error, `Upload failed with status ${response.status}`))
  }

  return response.json()
}

/**
 * Delete a document for a parcel
 *
 * DELETE /api/documents/{parcelId}/documents/{documentId}
 */
export async function deleteParcelDocument(
  parcelId: string,
  documentId: string,
  accessToken: string | null
): Promise<void> {
  await apiFetch(`${DOCUMENTS_BASE}/${parcelId}/documents/${documentId}`, {
    method: 'DELETE',
    accessToken,
  })
}

/**
 * Build the download URL for a parcel document.
 *
 * Used by the download handler to fetch the file blob with auth.
 */
export function getDocumentDownloadUrl(
  parcelId: string,
  documentId: string
): string {
  return `${DOCUMENTS_BASE}/${parcelId}/documents/${documentId}`
}
