/**
 * Report type definitions matching backend schemas (backend/app/schemas/report.py)
 * All fields use snake_case to match backend JSON responses exactly
 */

// ReportSaveRequest — POST /api/reports body
export interface ReportSaveRequest {
  report_data: Record<string, unknown>; // Full PropertyReportResponse dict
  notes?: string | null;
  project_id?: string | null; // UUID string
}

// ReportListItem — lightweight item in list view
export interface ReportListItem {
  id: string;
  report_name: string;
  postcode: string;
  city: string;
  notes: string | null;
  project_id: string | null;
  source_parcel_id: string | null;
  completeness_score: number;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

// ReportListResponse — GET /api/reports
export interface ReportListResponse {
  reports: ReportListItem[];
  total: number;
}

// ReportDetailResponse — GET /api/reports/{id}, POST /api/reports
export interface ReportDetailResponse {
  id: string;
  report_name: string;
  report_data: Record<string, unknown>; // Full PropertyReportResponse as JSONB
  postcode: string;
  city: string;
  notes: string | null;
  project_id: string | null;
  source_parcel_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateReportFromParcelResponse {
  report: ReportDetailResponse;
  created: boolean;
}

// ReportFreshnessResponse — GET /api/reports/{id}/freshness
export interface ReportFreshnessResponse {
  report_id: string;
  has_updates: boolean;
  updated_sections: Array<Record<string, unknown>>;
}

// ReportUpdateNotes — PATCH /api/reports/{id}/notes
export interface ReportUpdateNotes {
  notes: string | null;
}

// ReportAssignProject — PATCH /api/reports/{id}/project
export interface ReportAssignProject {
  project_id: string | null;
}

// Sort parameters
export type SortField = 'created' | 'updated' | 'address';
export type SortOrder = 'asc' | 'desc';

// Filters for report list query
export interface ReportFilters {
  city?: string;
  project_id?: string;
  search?: string;
  sort_by?: SortField;
  sort_order?: SortOrder;
  skip?: number;
  limit?: number;
}
