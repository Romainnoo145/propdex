import type { FactorMeta } from '@/lib/types/scoreWeights'
import { DEFAULT_WEIGHTS } from '@/lib/types/scoreWeights'

interface FactorTableProps {
  factors: FactorMeta[]
  weights: Record<string, number>
  onChange: (key: string, weight: number) => void
  minActive?: number
}

/**
 * Compact factor weight table (potentie or risico)
 *
 * Columns: Factor name | Toggle (active/inactive) | Weight (1-10)
 * - Toggling off sets weight to 0 (disabled)
 * - Toggling on restores default weight
 * - Weight dropdown 1-10, disabled when factor is off
 * - Shows validation warning when active count < minActive
 */
export function FactorTable({
  factors,
  weights,
  onChange,
  minActive = 3,
}: FactorTableProps) {
  const activeCount = factors.filter((f) => (weights[f.key] ?? 0) > 0).length
  const showWarning = activeCount < minActive

  const handleToggle = (key: string, checked: boolean) => {
    if (!checked) {
      onChange(key, 0)
    } else {
      // Restore from default weights based on category
      const cat = factors.find((f) => f.key === key)?.categorie
      const defaultVal =
        cat === 'potentie'
          ? (DEFAULT_WEIGHTS.potentie_weights[key] ?? 5)
          : (DEFAULT_WEIGHTS.risico_weights[key] ?? 5)
      onChange(key, defaultVal)
    }
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-neutral-500">Factor</th>
            <th className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-neutral-500 w-20">Actief</th>
            <th className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-neutral-500 w-24">Gewicht</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {factors.map((factor) => {
            const weight = weights[factor.key] ?? 0
            const isActive = weight > 0

            return (
              <tr key={factor.key} className="hover:bg-aura-glass-white/40 transition-colors">
                <td className="py-2.5 pr-4">
                  <span
                    className="text-sm text-aura-ink cursor-help"
                    title={factor.description}
                  >
                    {factor.label}
                  </span>
                </td>
                <td className="py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => handleToggle(factor.key, e.target.checked)}
                    className="h-4 w-4 rounded accent-aura-amber cursor-pointer"
                  />
                </td>
                <td className="py-2.5 text-center">
                  <select
                    value={isActive ? weight : ''}
                    disabled={!isActive}
                    onChange={(e) => onChange(factor.key, Number(e.target.value))}
                    className="rounded border border-neutral-200 px-2 py-1 text-sm text-aura-ink disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-aura-amber"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {showWarning && (
        <p className="mt-2 text-xs text-red-500">
          Minimaal {minActive} factoren moeten actief zijn
        </p>
      )}
    </div>
  )
}
