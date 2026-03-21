import type { PresetDef } from '@/lib/types/scoreWeights'
import { Check } from 'lucide-react'

interface PresetCardsProps {
  presets: PresetDef[]
  activePreset: string
  onSelect: (preset: PresetDef) => void
}

export function PresetCards({ presets, activePreset, onSelect }: PresetCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {presets.map((preset) => {
        const isActive = preset.id === activePreset
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className={`relative rounded-[16px] border-2 p-5 text-left transition-all ${
              isActive
                ? 'border-[#0E1111] bg-[#F9A826]'
                : 'border-[#0E1111]/40 bg-white hover:border-[#0E1111]/60 hover:shadow-sm'
            }`}
          >
            {isActive && (
              <Check size={14} className="absolute right-3 top-3 text-[#0E1111]" />
            )}
            <p className="text-[13px] font-bold text-[#0E1111]">{preset.name}</p>
            <p className={`mt-1.5 text-[11px] leading-relaxed ${
              isActive ? 'text-[#0E1111]/60' : 'text-slate-400'
            }`}>
              {preset.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}
