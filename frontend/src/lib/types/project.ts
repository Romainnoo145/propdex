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
}

// ProjectListResponse — GET /api/projects
export interface ProjectListResponse {
  projects: ProjectResponse[]
  total: number
}
