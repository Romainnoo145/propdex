import { USE_CASE_COLORS } from '@/lib/types/scoreWeights'

interface UseCaseScoreCardsProps {
  scores: Record<string, {
    use_case: string
    label: string
    score: number
    category: string
    description: string
  }> | null | undefined
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

/**
 * Compact 2x2 grid of use-case development scores.
 * Shows optoppen/splitsen/transformatie/nieuwbouw at a glance.
 */
export function UseCaseScoreCards({ scores }: UseCaseScoreCardsProps) {
  if (!scores) return null

  const entries = Object.entries(scores)
  if (entries.length === 0) return null

  return (
    <div className="mt-4">
      <span
        className="text-[10px] font-extrabold uppercase block mb-2"
        style={{ letterSpacing: '0.15em', color: '#94a3b8' }}
      >
        Ontwikkelkansen
      </span>
      <div className="grid grid-cols-4 gap-1.5">
        {entries.map(([key, uc]) => (
          <div
            key={key}
            className="rounded-xl px-2.5 py-2 text-center"
            style={{
              background: `${USE_CASE_COLORS[key] ?? '#94a3b8'}08`,
              border: `1px solid ${USE_CASE_COLORS[key] ?? '#94a3b8'}20`,
            }}
          >
            <span
              className="text-[18px] font-black tabular-nums block"
              style={{ color: scoreColor(uc.score) }}
            >
              {Math.round(uc.score)}
            </span>
            <span
              className="text-[10px] font-semibold block mt-0.5"
              style={{ color: USE_CASE_COLORS[key] ?? '#94a3b8' }}
            >
              {uc.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
