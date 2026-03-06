import { useState } from 'react'
import FocusLock from 'react-focus-lock'
import { X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useCreateProject } from '@/hooks/useProjects'
import { toast } from 'sonner'

interface ProjectCreateModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Modal for creating a new project.
 * Light theme — white card with shadow on dimmed backdrop.
 */
export default function ProjectCreateModal({
  isOpen,
  onClose,
}: ProjectCreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createMutation = useCreateProject()

  useEscapeKey(onClose, isOpen)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    createMutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Project aangemaakt')
          setName('')
          setDescription('')
          onClose()
        },
        onError: (error) => {
          toast.error(error.message || 'Fout bij aanmaken project')
        },
      }
    )
  }

  const handleCancel = () => {
    setName('')
    setDescription('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <FocusLock>
      <div>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-grey-950/80"
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
            <h2 className="text-lg font-semibold text-gray-900">Nieuw project</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-grey-400 transition-colors hover:bg-grey-800 hover:text-white"
              aria-label="Sluit"
            >
              <X className="h-5 w-5" />
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
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-grey-400 transition-colors hover:bg-grey-800 hover:text-white"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !name.trim()}
                className="rounded-lg border border-grey-700 bg-amber-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-amber-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? 'Opslaan...' : 'Project Aanmaken'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </FocusLock>
  )
}

