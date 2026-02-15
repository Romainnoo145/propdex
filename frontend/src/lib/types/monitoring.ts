/**
 * Monitoring and change detection type definitions
 * Matches backend schemas (backend/app/monitoring/router.py)
 * All fields use snake_case to match backend JSON responses exactly
 */

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
}

export interface ChangeRecordListResponse {
  changes: ChangeRecord[]
  total: number
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
