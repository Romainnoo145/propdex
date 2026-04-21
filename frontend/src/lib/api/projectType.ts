import { apiFetch } from '@/lib/api'
import type { ProjectType, ProjectTypeResponse } from '@/lib/types/projectType'

export async function fetchProjectType(
  parcelId: string,
  accessToken: string,
): Promise<ProjectTypeResponse> {
  return apiFetch<ProjectTypeResponse>(
    `/api/parcels/${parcelId}/project-type`,
    { method: 'GET', accessToken },
  )
}

export async function updateProjectType(
  parcelId: string,
  projectType: ProjectType,
  accessToken: string,
): Promise<ProjectTypeResponse> {
  return apiFetch<ProjectTypeResponse>(
    `/api/parcels/${parcelId}/project-type`,
    {
      method: 'PUT',
      accessToken,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_type: projectType }),
    },
  )
}
