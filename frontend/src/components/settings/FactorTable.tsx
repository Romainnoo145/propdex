import type { FactorMeta } from '@/lib/types/scoreWeights'

interface FactorTableProps {
  factors: FactorMeta[]
  weights: Record<string, number>
  presetWeights: Record<string, number>
  onChange: (key: string, weight: number) => void
  minActive?: number
}

/**
 * Factor toggle table (potentie or risico)
 *
 * Columns: Factor name | Description | Toggle
 * - Toggling off sets weight to 0
 * - Toggling on restores the current preset weight
 * - Shows validation warning when active count < minActive
 */
export function FactorTable({
  factors,
  weights,
  presetWeights,
  onChange,
  minActive = 3,
}: FactorTableProps) {
  const activeCount = factors.filter((f) => (weights[f.key] ?? 0) > 0).length
  const showWarning = activeCount < minActive

  const handleToggle = (key: string, checked: boolean) => {
    onChange(key, checked ? (presetWeights[key] ?? 5) : 0)
  }

  return (
    <div>
      <div className="space-y-1">
        {factors.map((factor) => {
          const isActive = (weights[factor.key] ?? 0) > 0

          return (
            <label
              key={factor.key}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-aura-glass-white/40 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => handleToggle(factor.key, e.target.checked)}
                className="h-4 w-4 shrink-0 rounded accent-aura-amber cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-sm font-medium text-aura-ink">
                  {factor.label}
                </span>
                <p className="text-xs text-neutral-500 truncate">
                  {factor.description}
                </p>
              </div>
            </label>
          )
        })}
      </div>
      {showWarning && (
        <p className="mt-2 text-xs text-red-500">
          Minimaal {minActive} factoren moeten actief zijn
        </p>
      )}
    </div>
  )
}
