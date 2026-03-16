import type { PipelineStage } from '@/lib/types/portfolio'

interface PipelineStagePillProps {
  stage: PipelineStage
}

const STAGE_STYLES: Record<PipelineStage, string> = {
  Gesignaleerd: 'bg-[#D1E2D8]/40 text-[#1A1C1E]',
  Onderzoek: 'bg-[#F9A826]/20 text-[#F9A826]',
  Contact: 'bg-blue-50 text-blue-700',
  Besluit: 'bg-purple-50 text-purple-700',
  Afgerond: 'bg-neutral-100 text-neutral-600',
}

export function PipelineStagePill({ stage }: PipelineStagePillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_STYLES[stage]}`}
    >
      {stage}
    </span>
  )
}
