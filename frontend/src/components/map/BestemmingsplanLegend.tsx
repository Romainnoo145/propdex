import { SVBP2012_HOOFDGROEPEN } from '@/lib/svbp2012'

interface BestemmingsplanLegendProps {
  visible: boolean
}

/**
 * Compact bestemmingsplan color legend.
 * Positioned bottom-right above the OverlayPicker button.
 * No header — just the color swatches.
 */
export function BestemmingsplanLegend({ visible }: BestemmingsplanLegendProps) {
  if (!visible) return null

  return (
    <div className="absolute bottom-16 right-4 z-[var(--z-map-controls)] w-44 bg-white border border-neutral-200 rounded-xl shadow-lg py-2 px-3 max-h-80 overflow-y-auto">
      <div className="space-y-1">
        {SVBP2012_HOOFDGROEPEN.map((hoofdgroep) => (
          <div key={hoofdgroep.key} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm border border-black/10 flex-shrink-0"
              style={{ backgroundColor: hoofdgroep.color }}
            />
            <span className="text-[11px] text-neutral-700">{hoofdgroep.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
