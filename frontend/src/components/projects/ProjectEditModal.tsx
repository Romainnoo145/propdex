import { useState, useEffect } from 'react'
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
 * Centered glassmorphism modal with backdrop blur.
 */
export default function ProjectEditModal({
  isOpen,
  onClose,
  project,
}: ProjectEditModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const updateMutation = useUpdateProject()

  // Pre-fill form when project changes
  useEffect(() => {
    if (project) {
      /* eslint-disable react-hooks/set-state-in-effect -- intentional form pre-fill on modal open */
      setName(project.name)
      setDescription(project.description || '')
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [project])

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
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          style={{ zIndex: 'var(--z-modal)' }}
          onClick={handleCancel}
        />

        {/* Modal card */}
        <div
          role="dialog"
          aria-modal="true"
          className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/60 p-6 shadow-2xl backdrop-blur-xl"
          style={{ zIndex: 'calc(var(--z-modal) + 1)' }}
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Project bewerken</h2>
            <button
              onClick={handleCancel}
              className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
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
                className="mb-1.5 block text-sm font-medium text-white/80"
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
                placeholder="Projectnaam..."
                autoFocus
              />
            </div>

            {/* Description field */}
            <div>
              <label
                htmlFor="project-description"
                className="mb-1.5 block text-sm font-medium text-white/80"
              >
                Omschrijving (optioneel)
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
                placeholder="Projectomschrijving..."
              />
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending || !name.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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
