/** Mirror of backend data_sources_schemas.py DTOs — M049/S03. Keep in sync. */

export type SourceType = 'A' | 'B' | 'C'

export type SourceStatus = 'live' | 'broken' | 'missing' | 'not_applicable'

export type ActionType =
  | 'upload'
  | 'configure_credential'
  | 'view_versions'
  | 'refresh'
  | 'view_action_item'

export interface Action {
  action: ActionType
  enabled: boolean
  label_nl: string
  reason_disabled: string | null
}

export interface DataSourceRow {
  source_key: string
  label_nl: string
  source_type: SourceType
  status: SourceStatus
  last_checked: string | null // ISO datetime
  error_message: string | null
  configuratie: Record<string, unknown> | null
  available_actions: Action[]
}

export interface GemeenteDataSourcesPayload {
  gemeente_code: string // matches ^GM\d{4}$
  gemeente_naam: string
  cascade_uploads: DataSourceRow[]
  open_apis: DataSourceRow[]
  paid_integrations: DataSourceRow[]
}

export interface GemeenteSummary {
  gemeente_code: string
  gemeente_naam: string
  total_sources: number
  status_counts: Record<SourceStatus, number>
  last_activity_at: string | null // ISO datetime
}
