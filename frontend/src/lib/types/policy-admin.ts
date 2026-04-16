/** Mirror of backend admin_schemas.py DTOs — M045/S05. */

export interface AdminPolicyOverviewRow {
  entity_type: string
  entity_code: string
  entity_display_name: string
  source_key: string
  source_key_label: string
  latest_version_id: string
  latest_version_number: number
  latest_filename: string
  latest_uploaded_at: string // ISO
  latest_uploader_name: string
  version_count: number
  auto_ingest: boolean
}

export interface AdminPolicyOverviewTotals {
  total_docs: number
  total_gemeenten: number
  latest_upload_at: string | null
}

export interface AdminPolicyOverviewResponse {
  landelijk: AdminPolicyOverviewRow[]
  provinciaal: AdminPolicyOverviewRow[]
  gemeentelijk: AdminPolicyOverviewRow[]
  totals: AdminPolicyOverviewTotals
}

export interface AdminPolicyVersionRow {
  id: string
  version_number: number
  filename: string
  file_size: number
  content_type: string
  uploaded_at: string
  uploader_name: string
}

export interface AdminPolicyVersionsResponse {
  entity_type: string
  entity_code: string
  source_key: string
  source_key_label: string
  versions: AdminPolicyVersionRow[]
}
