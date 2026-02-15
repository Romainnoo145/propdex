/**
 * Project type definitions matching backend schemas (backend/app/schemas/project.py)
 * All fields use snake_case to match backend JSON responses exactly
 */

// ProjectCreate — POST /api/projects body
export interface ProjectCreate {
  name: string // max 100 chars
  description?: string | null
}

// ProjectUpdate — PATCH /api/projects/{id} body
export interface ProjectUpdate {
  name?: string | null
  description?: string | null
}

// ProjectResponse — single project from API
export interface ProjectResponse {
  id: string // UUID
  name: string
  description: string | null
  created_at: string // ISO datetime
  updated_at: string // ISO datetime
  report_count: number
  parent_id: string | null      // Phase 26: Hierarchical projects
  gemeente_code: string | null  // Phase 26: CBS gemeente code
  wijk_naam: string | null      // Phase 26: CBS wijk name
  is_monitored: boolean         // Phase 26: Change monitoring flag
  unread_count: number          // Phase 26: Unread changes (computed)
  children: ProjectResponse[]   // Phase 26: Nested children for hierarchical display
}

// ProjectListResponse — GET /api/projects
export interface ProjectListResponse {
  projects: ProjectResponse[]
  total: number
}
