import { Check } from 'lucide-react'

import type { ScanStatusResponse } from '@/lib/types/scan'

interface ScanProgressOverlayProps {
  status: ScanStatusResponse
  onCancel: () => void
  isCancelling: boolean
  onViewResults?: () => void
}

const SCAN_STEPS = [
  { id: 'fetching_parcels', label: 'Kadaster ophalen', sublabel: 'Percelen van Kadaster WFS' },
  { id: 'cross_referencing_bag', label: 'BAG controleren', sublabel: 'Gebouwen cross-refereren' },
  { id: 'querying_bestemmingen', label: 'Bestemmingen', sublabel: 'DSO API opvragen' },
] as const

type StepState = 'pending' | 'active' | 'completed'

function getStepState(stepId: string, currentPhase: string | null, isCompleted: boolean, isFailed: boolean): StepState {
  if (isCompleted) return 'completed'
  if (currentPhase === null) return 'pending'
  const stepIndex = SCAN_STEPS.findIndex((s) => s.id === stepId)
  const currentIndex = SCAN_STEPS.findIndex((s) => s.id === currentPhase)
  if (stepIndex < currentIndex) return 'completed'
  if (stepIndex === currentIndex) return isFailed ? 'active' : 'active'
  return 'pending'
}

function StepCircle({ number, state }: { number: number; state: StepState }) {
  const base = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0'
  if (state === 'completed')
    return <div className={`${base} bg-success text-on-accent`}><Check className="w-3.5 h-3.5" strokeWidth={2.5} /></div>
  if (state === 'active')
    return <div className={`${base} bg-amber-accent text-on-accent`}>{number}</div>
  return <div className={`${base} bg-grey-800 text-grey-400`}>{number}</div>
}

/**
 * Scan progress overlay — three-step stepper with Industrial Amber tokens
 *
 * Shows Kadaster / BAG / Bestemmingen progress stepper during running state.
 * Completed/failed states show a semantic icon + message + CTA/dismiss.
 */
export default function ScanProgressOverlay({ status, onCancel, isCancelling, onViewResults }: ScanProgressOverlayProps) {
  const isCompleted = status.status === 'completed'
  const isFailed = status.status === 'failed'
  const isRunning = !isCompleted && !isFailed

  const currentStepSublabel = isRunning && status.current_phase
    ? SCAN_STEPS.find((s) => s.id === status.current_phase)?.sublabel
    : null

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[var(--z-map-controls)]">
      <div className="bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md border border-grey-800 shadow-lg rounded-lg p-4 min-w-[380px]">

        {/* Terminal states: icon + message */}
        {(isCompleted || isFailed) && (
          <div className="flex items-center gap-3 mb-3">
            {isCompleted ? (
              <svg className="h-5 w-5 text-success shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-error shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            )}
            <span className={`text-sm font-medium ${isCompleted ? 'text-success' : 'text-error'}`}>
              {isCompleted ? `Scan voltooid (${status.results_count} percelen)` : 'Scan mislukt'}
            </span>
          </div>
        )}

        {/* Completed: CTA button to view results */}
        {isCompleted && onViewResults && (
          <button
            onClick={onViewResults}
            className="mt-3 w-full py-1.5 px-3 text-xs font-medium text-on-accent bg-amber-accent hover:bg-amber-accent-hover rounded transition-colors"
          >
            Bekijk resultaten
          </button>
        )}

        {/* Failed: dismiss link */}
        {isFailed && (
          <button
            onClick={onCancel}
            className="mt-2 text-xs text-grey-400 hover:text-grey-100 underline transition-colors"
          >
            Sluiten
          </button>
        )}

        {/* Running: three-step stepper */}
        {isRunning && (
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center mb-3">
            {SCAN_STEPS.map((step, index) => {
              const state = getStepState(step.id, status.current_phase, false, false)
              const prevStep = index > 0 ? SCAN_STEPS[index - 1] : undefined
              const prevCompleted = prevStep
                ? getStepState(prevStep.id, status.current_phase, false, false) === 'completed'
                : false
              return (
                <>
                  {index > 0 && (
                    <div key={`line-${step.id}`} className={`h-0.5 mx-2 ${prevCompleted ? 'bg-success' : 'bg-grey-800'}`} />
                  )}
                  <div key={step.id} className="flex flex-col items-center gap-1">
                    <StepCircle number={index + 1} state={state} />
                    <span className={`text-xs whitespace-nowrap ${
                      state === 'active' ? 'text-amber-accent' : state === 'completed' ? 'text-success' : 'text-grey-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                </>
              )
            })}
          </div>
        )}

        {/* Phase label + percentage */}
        {isRunning && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-grey-100">
              {status.current_phase === null
                ? 'Scan starten...'
                : SCAN_STEPS.find((s) => s.id === status.current_phase)?.label ?? 'Verwerken...'}
            </span>
            <span className="text-sm font-semibold text-amber-accent">
              {Math.round(status.progress_pct)}%
            </span>
          </div>
        )}

        {/* Progress bar */}
        {isRunning && (
          <div className="bg-grey-800 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="bg-amber-accent h-full transition-all duration-500 ease-out"
              style={{ width: `${status.progress_pct}%` }}
            />
          </div>
        )}

        {/* Sublabel — current step context */}
        {currentStepSublabel && (
          <p className="text-xs text-grey-400 mb-2">{currentStepSublabel}</p>
        )}

        {/* Parcel counter + cancel */}
        <div className="flex items-center justify-between text-xs text-grey-400">
          <div className="flex items-center gap-3">
            <span>{status.parcels_processed} / {status.parcels_total} percelen</span>
            {status.parcels_failed > 0 && (
              <span className="text-warning font-medium">{status.parcels_failed} mislukt</span>
            )}
          </div>
          {isRunning && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="text-grey-400 hover:text-grey-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isCancelling ? 'Annuleren...' : 'Annuleren'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
