/**
 * Monitoring and change detection type definitions
 * Matches backend schemas (backend/app/monitoring/router.py)
 * All fields use snake_case to match backend JSON responses exactly
 */

export interface MatchedParcel {
  parcel_id: string
  scan_id: string
  address: string | null
}

export interface MatchedReport {
  report_id: string
  report_name: string
}

export interface ChangeRecord {
  id: string
  project_id: string
  change_type: 'permit' | 'zoning'
  external_id: string
  title: string
  detected_at: string // ISO datetime
  change_date: string // ISO datetime
  gemeente_naam: string
  address: string | null
  source_url: string | null
  postcode: string | null
  matched_parcel_id?: string | null  // Phase 48 — geometrically verified via geocode + ST_Contains
  matched_parcels: MatchedParcel[] | null
  matched_reports: MatchedReport[] | null
  project_name?: string | null
  category_label?: string | null
}

export interface ChangeRecordListResponse {
  changes: ChangeRecord[]
  total: number
  read_change_ids?: string[]
  has_more?: boolean
}

export interface MarkAllReadResponse {
  status: string
  marked_count: number
}

export interface ProjectUnreadCount {
  project_id: string
  unread_count: number
}

export interface UnreadDetailResponse {
  total_unread: number
  projects_with_changes: number
  per_project: ProjectUnreadCount[]
}
