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

  const handleToggle = (key: string) => {
    const isActive = (weights[key] ?? 0) > 0
    onChange(key, isActive ? 0 : (presetWeights[key] ?? 5))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {factors.map((factor) => {
          const isActive = (weights[factor.key] ?? 0) > 0

          return (
            <button
              key={factor.key}
              type="button"
              onClick={() => handleToggle(factor.key)}
              title={factor.description}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold border-2 transition-all ${
                isActive
                  ? 'border-[#0E1111] bg-[#F9A826] text-[#0E1111]'
                  : 'border-[#0E1111]/20 bg-white text-slate-400 hover:border-[#0E1111]/40 hover:text-slate-600'
              }`}
            >
              {factor.label}
            </button>
          )
        })}
      </div>
      {showWarning && (
        <p className="mt-3 text-[11px] text-red-500">
          Minimaal {minActive} factoren moeten actief zijn
        </p>
      )}
    </div>
  )
}
