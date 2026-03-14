import { cn } from '@/lib/utils'
import type { PresetDef } from '@/lib/types/scoreWeights'

interface PresetCardsProps {
  presets: PresetDef[]
  activePreset: string
  onSelect: (preset: PresetDef) => void
}

/**
 * Preset selection cards for score weight profiles
 *
 * Renders 4 preset cards in a 2x2 grid.
 * Active card shows amber border + ring highlight.
 * Selecting a preset propagates its config to the parent form.
 */
export function PresetCards({ presets, activePreset, onSelect }: PresetCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {presets.map((preset) => {
        const isActive = preset.id === activePreset
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className={cn(
              'rounded-2xl border p-5 text-left cursor-pointer transition-all',
              'hover:border-aura-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aura-amber',
              isActive
                ? 'border-aura-amber bg-aura-amber/5 ring-1 ring-aura-amber'
                : 'border-neutral-200 bg-white',
            )}
          >
            <p className="font-semibold text-aura-ink">{preset.name}</p>
            <p className="mt-1 text-sm text-neutral-600">{preset.description}</p>
          </button>
        )
      })}
    </div>
  )
}
