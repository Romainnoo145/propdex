import type { PipelineStage } from '@/lib/types/portfolio'

interface PipelineStagePillProps {
  stage: PipelineStage
  onClick?: () => void
  afgerondReden?: string | null
}

export const STAGE_STYLES: Record<PipelineStage, string> = {
  Gesignaleerd: 'bg-[#D1E2D8]/40 text-[#1A1C1E]',
  Onderzoek: 'bg-[#F9A826]/20 text-[#F9A826]',
  Contact: 'bg-blue-50 text-blue-700',
  Besluit: 'bg-purple-50 text-purple-700',
  Afgerond: 'bg-neutral-100 text-neutral-600',
}

export function PipelineStagePill({ stage, onClick, afgerondReden }: PipelineStagePillProps) {
  const pillClass = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_STYLES[stage]}`

  return (
    <div className="flex flex-col items-end gap-0.5">
      {onClick ? (
        <button
          onClick={onClick}
          className={`${pillClass} cursor-pointer hover:opacity-80 transition-opacity`}
        >
          {stage}
        </button>
      ) : (
        <span className={pillClass}>{stage}</span>
      )}
      {afgerondReden && stage === 'Afgerond' && (
        <span className="text-[10px] text-neutral-400">{afgerondReden}</span>
      )}
    </div>
  )
}
