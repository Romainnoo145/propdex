import { useNavigate } from '@tanstack/react-router'
import type { PipelineStage } from '@/lib/types/portfolio'
import { STAGE_STYLES } from './PipelineStagePill'

interface PipelineStageFilterProps {
  activeStage: PipelineStage | undefined
}

export const ALL_STAGES: PipelineStage[] = [
  'Gesignaleerd',
  'Onderzoek',
  'Contact',
  'Besluit',
  'Afgerond',
]

/**
 * Horizontal pill bar for filtering the portfolio view by pipeline stage.
 *
 * Renders "Alle fases" + 5 stage pills.
 * Uses URL param `portfolio_stage` for persistence and browser back/forward support.
 */
export function PipelineStageFilter({ activeStage }: PipelineStageFilterProps) {
  const navigate = useNavigate()

  const clearFilter = () => {
    navigate({
      from: '/projecten',
      search: (prev) => ({ ...prev, portfolio_stage: undefined }),
    })
  }

  const setFilter = (stage: PipelineStage) => {
    navigate({
      from: '/projecten',
      search: (prev) => ({ ...prev, portfolio_stage: stage }),
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* "Alle fases" button — active when no filter */}
      <button
        onClick={clearFilter}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          !activeStage
            ? 'bg-aura-obsidian text-white'
            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
        }`}
      >
        Alle fases
      </button>

      {/* Stage pills */}
      {ALL_STAGES.map((stage) => (
        <button
          key={stage}
          onClick={() => setFilter(stage)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            activeStage === stage
              ? 'bg-aura-obsidian text-white'
              : `${STAGE_STYLES[stage]} hover:opacity-80`
          }`}
        >
          {stage}
        </button>
      ))}
    </div>
  )
}
