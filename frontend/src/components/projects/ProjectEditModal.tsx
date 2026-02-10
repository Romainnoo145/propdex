import { useState } from 'react'
import FocusLock from 'react-focus-lock'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useUpdateProject } from '@/hooks/useProjects'
import { toast } from 'sonner'
import type { ProjectResponse } from '@/lib/types/project'

interface ProjectEditModalProps {
  isOpen: boolean
  onClose: () => void
  project: ProjectResponse | null
}

/**
 * Modal for editing an existing project.
 * Light theme — white card with shadow on dimmed backdrop.
 *
 * Parent should provide a key={project?.id} prop to reset state when project changes.
 */
export default function ProjectEditModal({
  isOpen,
  onClose,
  project,
}: ProjectEditModalProps) {
  // Initialize state from project prop (component remounts on project change via key prop)
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const updateMutation = useUpdateProject()

  useEscapeKey(onClose, isOpen)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!project || !name.trim()) return

    updateMutation.mutate(
      {
        projectId: project.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Project bijgewerkt')
          onClose()
        },
        onError: (error) => {
          toast.error(error.message || 'Fout bij bijwerken project')
        },
      }
    )
  }

  const handleCancel = () => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
    }
    onClose()
  }

  if (!isOpen || !project) return null

  return (
    <FocusLock>
      <div>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/20"
          style={{ zIndex: 'var(--z-modal)' }}
          onClick={handleCancel}
        />

        {/* Modal card */}
        <div
          role="dialog"
          aria-modal="true"
          className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
          style={{ zIndex: 'calc(var(--z-modal) + 1)' }}
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Project bewerken</h2>
            <button
              onClick={handleCancel}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Sluit"
            >
              <XIcon />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field */}
            <div>
              <label
                htmlFor="project-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Naam
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="Projectnaam..."
                autoFocus
              />
            </div>

            {/* Description field */}
            <div>
              <label
                htmlFor="project-description"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Omschrijving (optioneel)
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="Projectomschrijving..."
              />
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending || !name.trim()}
                className="rounded-lg border border-gray-200 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </FocusLock>
  )
}

// X icon for close button
function XIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
