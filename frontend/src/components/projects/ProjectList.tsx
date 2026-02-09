import { useState } from 'react'
import { useProjects, useDeleteProject } from '@/hooks/useProjects'
import { toast } from 'sonner'
import type { ProjectResponse } from '@/lib/types/project'
import ProjectCreateModal from './ProjectCreateModal'
import ProjectEditModal from './ProjectEditModal'

// Demo projects shown when API is unavailable (no auth)
const DEMO_PROJECTS: ProjectResponse[] = [
  {
    id: 'demo-1',
    name: 'Herontwikkeling Venlo Centrum',
    description: 'Haalbaarheidsonderzoek voor 12 panden in het kernwinkelgebied',
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-08T14:30:00Z',
    report_count: 8,
  },
  {
    id: 'demo-2',
    name: 'Woningbouw Maastricht Zuid',
    description: 'Nieuwbouwlocaties rondom Randwyck station',
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-02-05T16:00:00Z',
    report_count: 5,
  },
  {
    id: 'demo-3',
    name: 'Monumenten Inventarisatie Utrecht',
    description: null,
    created_at: '2026-02-06T11:00:00Z',
    updated_at: '2026-02-06T11:00:00Z',
    report_count: 3,
  },
]

/**
 * Project list component with CRUD operations.
 * Light theme — off-white background with dark typography.
 * Falls back to demo data when API is unavailable.
 */
export default function ProjectList() {
  const { data, isLoading, isError } = useProjects()
  const deleteMutation = useDeleteProject()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectResponse | null>(
    null
  )

  // Use demo data when API unavailable (no auth or error)
  const isDemo = !data && !isLoading
  const projects = data?.projects ?? (isDemo ? DEMO_PROJECTS : [])

  const handleEdit = (project: ProjectResponse) => {
    if (isDemo) return
    setSelectedProject(project)
    setEditModalOpen(true)
  }

  const handleDelete = (project: ProjectResponse) => {
    if (isDemo) return
    const confirmed = window.confirm(
      'Project verwijderen? Rapporten worden niet verwijderd.'
    )
    if (!confirmed) return

    deleteMutation.mutate(project.id, {
      onSuccess: () => {
        toast.success('Project verwijderd')
      },
      onError: (error) => {
        toast.error(error.message || 'Fout bij verwijderen project')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="py-8 text-center text-gray-400">
        <p>Laden...</p>
      </div>
    )
  }

  const hasProjects = projects.length > 0

  return (
    <div className="space-y-4">
      {/* Demo banner */}
      {isDemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Voorbeelddata — start de backend om projecten te beheren
        </div>
      )}

      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">
          {hasProjects
            ? `${projects.length} ${projects.length === 1 ? 'project' : 'projecten'}`
            : 'Nog geen projecten'}
        </h3>
        <button
          onClick={() => setCreateModalOpen(true)}
          disabled={isDemo}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nieuw project +
        </button>
      </div>

      {/* Project list */}
      {hasProjects ? (
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm transition-colors hover:bg-gray-50"
            >
              {/* Project info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{project.name}</h4>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    {project.report_count} {project.report_count === 1 ? 'rapport' : 'rapporten'}
                  </span>
                </div>
                {project.description && (
                  <p className="mt-1 truncate text-sm text-gray-500">
                    {project.description}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {!isDemo && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(project)}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Bewerk project"
                    title="Bewerk project"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => handleDelete(project)}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    aria-label="Verwijder project"
                    title="Verwijder project"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Empty state
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="mb-4 text-gray-500">Nog geen projecten aangemaakt</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Maak je eerste project
          </button>
        </div>
      )}

      {/* Modals */}
      <ProjectCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
      <ProjectEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={selectedProject}
      />
    </div>
  )
}

// Pencil icon for edit button
function PencilIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

// Trash icon for delete button
function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}
