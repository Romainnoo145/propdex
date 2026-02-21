import { useState } from 'react'
import { SVBP2012_HOOFDGROEPEN } from '@/lib/svbp2012'

interface BestemmingsplanLegendProps {
  visible: boolean
}

/**
 * Collapsible legend component displaying SVBP2012 hoofdgroep color swatches.
 * Only renders when bestemmingsplan layer is active.
 */
export function BestemmingsplanLegend({ visible }: BestemmingsplanLegendProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Early return if layer not visible
  if (!visible) return null

  return (
    <div
      className="fixed top-20 right-14 z-[var(--z-map-controls)] w-48 bg-grey-900 rounded-lg shadow-lg border border-grey-800"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-grey-100 hover:bg-grey-800 rounded-t-lg transition-colors"
      >
        <span>Legenda</span>
        <span className="text-grey-400 text-xs">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Color list */}
      {isExpanded && (
        <div className="px-3 pb-3 max-h-96 overflow-y-auto">
          <div className="space-y-1.5 pt-1">
            {SVBP2012_HOOFDGROEPEN.map((hoofdgroep) => (
              <div
                key={hoofdgroep.key}
                className="flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded-sm border border-black/10 flex-shrink-0"
                  style={{ backgroundColor: hoofdgroep.color }}
                />
                <span className="text-xs text-grey-300">
                  {hoofdgroep.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
