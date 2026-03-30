/**
 * ChatCountPreview — count-first preview with refinement suggestions.
 */

import { Search, ArrowRight } from 'lucide-react'

interface Props {
  count: number
  message: string
  suggestions: string[]
  onSuggestion: (text: string) => void
  onForceResults: () => void
}

export function ChatCountPreview({ count, message, suggestions, onSuggestion, onForceResults }: Props) {
  return (
    <div className="space-y-3">
      {/* Count display */}
      <div className="flex items-center gap-2">
        <Search size={16} className="text-slate-400" />
        <span className="text-[13px] font-semibold text-aura-obsidian">
          {count.toLocaleString('nl-NL')} resultaten
        </span>
      </div>
      <p className="text-[13px] text-slate-600">{message}</p>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[12px] text-slate-600 hover:border-amber-400 hover:text-amber-700 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Force results */}
      <button
        onClick={onForceResults}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-amber-600 transition-colors"
      >
        Toon resultaten
        <ArrowRight size={14} />
      </button>
    </div>
  )
}
