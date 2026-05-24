import { useState } from 'react'
import FocusLock from 'react-focus-lock'
import { toast } from 'sonner'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useUpdateParcelProjectType } from '@/hooks/useParcelProjectType'
import { PROJECT_TYPE_LABELS } from '@/lib/types/projectType'
import type { ProjectType } from '@/lib/types/projectType'

/**
 * The 5 selectable project types (excludes 'onbepaald' — that is implicit default state).
 */
const SELECTABLE_TYPES: ProjectType[] = [
  'nieuwbouw_wonen',
  'transformatie_wonen',
  'optoppen',
  'splitsen',
  'commercieel_naar_wonen',
]

interface ProjectTypePickerModalProps {
  open: boolean
  onClose: () => void
  parcelId: string
  /** null for first-time, current value for edit-mode (pre-select) */
  currentType: ProjectType | null
  /** Called when user clicks "Later bepalen" — parent handles localStorage */
  onSkip: () => void
}

/**
 * Picker modal for selecting a project type per parcel.
 *
 * First-open mode: all 5 pills unselected, "Later bepalen" button below.
 * Edit mode (currentType != null): current pill pre-highlighted in amber.
 *
 * Aura design system: Pure Glass bg, Plus Jakarta Sans, Warm Amber active.
 */
export function ProjectTypePickerModal({
  open,
  onClose,
  parcelId,
  currentType,
  onSkip,
}: ProjectTypePickerModalProps) {
  const updateMutation = useUpdateParcelProjectType()
  const [pendingType, setPendingType] = useState<ProjectType | null>(null)

  useEscapeKey(onClose, open)

  if (!open) return null

  const handleSelect = (type: ProjectType) => {
    if (updateMutation.isPending) return
    setPendingType(type)
    updateMutation.mutate(
      { parcelId, projectType: type },
      {
        onSuccess: () => {
          setPendingType(null)
          onClose()
        },
        onError: (err) => {
          setPendingType(null)
          toast.error(err.message || 'Opslaan mislukt, probeer het opnieuw.')
        },
      },
    )
  }

  const handleSkip = () => {
    onSkip()
    onClose()
  }

  return (
    <FocusLock>
      <div>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-aura-canvas/70 backdrop-blur-sm"
          style={{ zIndex: 'var(--z-modal)' }}
          onClick={onClose}
        />

        {/* Modal panel */}
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 'calc(var(--z-modal) + 1)' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-type-picker-title"
            className="w-full max-w-md bg-aura-glass-white/70 backdrop-blur-[24px] rounded-[32px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.10)] border border-white/40"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <h2
              id="project-type-picker-title"
              className="text-2xl font-bold tracking-tight text-aura-obsidian"
            >
              Wat wil je hier bouwen?
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Kies het projecttype zodat de scoring beter past bij jouw plannen.
            </p>

            {/* Pills grid — 2 columns, 5 items (last item spans or sits alone) */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {SELECTABLE_TYPES.map((type) => {
                const isActive = currentType === type && !pendingType
                const isPending = pendingType === type
                const isLoading = isPending && updateMutation.isPending

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelect(type)}
                    disabled={updateMutation.isPending}
                    aria-pressed={isActive}
                    className={[
                      'rounded-2xl px-4 py-3 text-sm font-semibold text-left transition',
                      'disabled:cursor-not-allowed',
                      isActive || isPending
                        ? 'bg-aura-amber text-aura-obsidian border border-aura-amber shadow-[0_4px_14px_rgba(249,168,38,0.35)]'
                        : 'bg-white/60 text-aura-obsidian border border-aura-obsidian/10 hover:border-aura-amber hover:bg-white/80',
                    ].join(' ')}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        {PROJECT_TYPE_LABELS[type]}
                      </span>
                    ) : (
                      PROJECT_TYPE_LABELS[type]
                    )}
                  </button>
                )
              })}
            </div>

            {/* Skip */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={handleSkip}
                disabled={updateMutation.isPending}
                className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-700 transition disabled:cursor-not-allowed"
              >
                Later bepalen
              </button>
            </div>
          </div>
        </div>
      </div>
    </FocusLock>
  )
}
