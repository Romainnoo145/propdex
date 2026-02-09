import { useState } from 'react'
import { useProjects, useDeleteProject } from '@/hooks/useProjects'
import { toast } from 'sonner'
import type { ProjectResponse } from '@/lib/types/project'
import ProjectCreateModal from './ProjectCreateModal'
import ProjectEditModal from './ProjectEditModal'

/**
 * Project list component with CRUD operations.
 * Shows flat list of projects with report counts and edit/delete actions.
 */
export default function ProjectList() {
  const { data, isLoading } = useProjects()
  const deleteMutation = useDeleteProject()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectResponse | null>(
    null
  )

  const handleEdit = (project: ProjectResponse) => {
    setSelectedProject(project)
    setEditModalOpen(true)
  }

  const handleDelete = (project: ProjectResponse) => {
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
      <div className="py-8 text-center text-white/40">
        <p>Laden...</p>
      </div>
    )
  }

  const hasProjects = data && data.projects.length > 0

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60">
          {hasProjects
            ? `${data.projects.length} ${data.projects.length === 1 ? 'project' : 'projecten'}`
            : 'Nog geen projecten'}
        </h3>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          Nieuw project +
        </button>
      </div>

      {/* Project list */}
      {hasProjects ? (
        <div className="space-y-2">
          {data.projects.map((project) => (
            <div
              key={project.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
            >
              {/* Project info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-white">{project.name}</h4>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                    {project.report_count}
                  </span>
                </div>
                {project.description && (
                  <p className="mt-1 truncate text-sm text-white/50">
                    {project.description}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(project)}
                  className="rounded p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Bewerk project"
                  title="Bewerk project"
                >
                  <PencilIcon />
                </button>
                <button
                  onClick={() => handleDelete(project)}
                  disabled={deleteMutation.isPending}
                  className="rounded p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-red-400 disabled:opacity-50"
                  aria-label="Verwijder project"
                  title="Verwijder project"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Empty state
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center">
          <p className="mb-4 text-white/50">Nog geen projecten aangemaakt</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
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
