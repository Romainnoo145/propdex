import type { FactorMeta } from '@/lib/types/scoreWeights'

interface FactorTableProps {
  factors: FactorMeta[]
  weights: Record<string, number>
  presetWeights: Record<string, number>
  onChange: (key: string, weight: number) => void
  minActive?: number
}

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
              className="flex items-center gap-3 rounded-[12px] px-3.5 py-2.5 hover:bg-[#F2F6F3] transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => handleToggle(factor.key, e.target.checked)}
                className="h-4 w-4 shrink-0 rounded accent-[#F9A826] cursor-pointer"
              />
              <div className="min-w-0">
                <span className="text-[13px] font-semibold text-[#0E1111]">
                  {factor.label}
                </span>
                <p className="text-[11px] text-slate-400 truncate">
                  {factor.description}
                </p>
              </div>
            </label>
          )
        })}
      </div>
      {showWarning && (
        <p className="mt-2 text-[11px] text-red-500">
          Minimaal {minActive} factoren moeten actief zijn
        </p>
      )}
    </div>
  )
}
