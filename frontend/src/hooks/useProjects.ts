/**
 * TanStack Query hooks for project operations
 *
 * Provides hooks for:
 * - Fetching project lists
 * - Creating projects
 * - Updating projects
 * - Deleting projects
 * - Assigning reports to projects
 *
 * All hooks require authentication and invalidate relevant caches on mutation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  assignReportToProject,
  apiFetch,
} from '@/lib/api'
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectResponse,
  ProjectListResponse,
} from '@/lib/types/project'
import type { ReportDetailResponse } from '@/lib/types/report'

/**
 * Fetch list of projects with report counts
 *
 * Query key: ['projects']
 * Stale time: 10 minutes (projects change rarely)
 */
export function useProjects() {
  const { accessToken } = useAuth()

  return useQuery<ProjectListResponse, Error>({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(accessToken),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!accessToken,
  })
}

/**
 * Fetch hierarchical monitored projects (gemeente -> wijk)
 *
 * Query key: ['projects', 'monitored']
 * Stale time: 5 minutes (monitoring state changes more frequently)
 */
export function useMonitoredProjects() {
  const { accessToken } = useAuth()
  return useQuery<ProjectListResponse, Error>({
    queryKey: ['projects', 'monitored'],
    queryFn: () => apiFetch<ProjectListResponse>(
      '/api/monitoring/projects',
      { accessToken, method: 'GET' }
    ),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })
}

/**
 * Create a new project
 *
 * Invalidates project list cache on success.
 */
export function useCreateProject() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<ProjectResponse, Error, ProjectCreate>({
    mutationFn: (data: ProjectCreate) => createProject(data, accessToken),
    onSuccess: () => {
      // Invalidate project list (new project appears in list)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

/**
 * Update an existing project
 *
 * Invalidates project and report list caches on success.
 */
export function useUpdateProject() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    ProjectResponse,
    Error,
    { projectId: string; data: ProjectUpdate }
  >({
    mutationFn: ({ projectId, data }) => updateProject(projectId, data, accessToken),
    onSuccess: () => {
      // Invalidate project list (project name may have changed)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      // Invalidate report lists (report grouping labels may change if project renamed)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

/**
 * Delete a project
 *
 * Invalidates project and report list caches on success.
 */
export function useDeleteProject() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: (projectId: string) => deleteProject(projectId, accessToken),
    onSuccess: () => {
      // Invalidate project list
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      // Invalidate report lists (reports move to "Geen project")
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

/**
 * Assign a report to a project (or remove from project)
 *
 * Invalidates report and project caches on success.
 */
export function useAssignReportToProject() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    ReportDetailResponse,
    Error,
    { reportId: string; projectId: string | null }
  >({
    mutationFn: ({ reportId, projectId }) =>
      assignReportToProject(reportId, projectId, accessToken),
    onSuccess: (_data, { reportId }) => {
      // Invalidate the specific report
      queryClient.invalidateQueries({ queryKey: ['report', reportId] })
      // Invalidate all report lists (report project assignment changed)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      // Invalidate project list (report counts change)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
