import type { ScanStatusResponse } from '@/lib/types/scan'

interface ScanProgressOverlayProps {
  status: ScanStatusResponse
  onCancel: () => void
  isCancelling: boolean
}

/**
 * Dutch phase labels for scan progress
 */
function phaseLabel(phase: string | null): string {
  switch (phase) {
    case 'fetching_parcels':
      return 'Percelen ophalen van Kadaster...'
    case 'cross_referencing_bag':
      return 'Gebouwen controleren...'
    case 'querying_bestemmingen':
      return 'Bestemmingen opvragen...'
    default:
      return 'Scan starten...'
  }
}

/**
 * Scan progress overlay component
 *
 * Fixed-position overlay showing scan progress with:
 * - Animated spinner (or completion icon)
 * - Dutch phase label + percentage
 * - Smooth animated progress bar
 * - Parcel counts with failed count
 * - Cancel button
 */
export default function ScanProgressOverlay({
  status,
  onCancel,
  isCancelling,
}: ScanProgressOverlayProps) {
  const isCompleted = status.status === 'completed'
  const isFailed = status.status === 'failed'

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-white shadow-lg rounded-lg p-4 min-w-[360px]">
        {/* Top row: Icon + phase label + percentage */}
        <div className="flex items-center gap-3 mb-3">
          {/* Icon */}
          {isCompleted ? (
            <svg
              className="h-5 w-5 text-green-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : isFailed ? (
            <svg
              className="h-5 w-5 text-red-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          ) : (
            <svg
              className="animate-spin h-5 w-5 text-blue-500"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}

          {/* Label + percentage */}
          <div className="flex-1">
            {isCompleted ? (
              <span className="text-sm font-medium text-green-700">
                Scan voltooid ({status.results_count} percelen)
              </span>
            ) : isFailed ? (
              <span className="text-sm font-medium text-red-700">Scan mislukt</span>
            ) : (
              <span className="text-sm font-medium text-gray-700">
                {phaseLabel(status.current_phase)}
              </span>
            )}
          </div>

          {!isCompleted && !isFailed && (
            <span className="text-sm font-semibold text-blue-600">
              {Math.round(status.progress_pct)}%
            </span>
          )}
        </div>

        {/* Progress bar (hidden on completed/failed) */}
        {!isCompleted && !isFailed && (
          <div className="bg-gray-200 rounded-full h-2 mb-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${status.progress_pct}%` }}
            />
          </div>
        )}

        {/* Bottom row: Parcel counts + cancel button */}
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-3">
            <span>
              {status.parcels_processed} / {status.parcels_total} percelen
            </span>
            {status.parcels_failed > 0 && (
              <span className="text-amber-600 font-medium">
                {status.parcels_failed} mislukt
              </span>
            )}
          </div>

          {/* Cancel button (only show during running state) */}
          {!isCompleted && !isFailed && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isCancelling ? 'Annuleren...' : 'Annuleren'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
