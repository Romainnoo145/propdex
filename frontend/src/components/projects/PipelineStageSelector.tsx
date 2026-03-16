import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import type { PipelineStage } from '@/lib/types/portfolio'
import { STAGE_STYLES } from './PipelineStagePill'
import { useUpdatePipelineStage } from '@/hooks/useFavorites'

const STAGE_ORDER: PipelineStage[] = ['Gesignaleerd', 'Onderzoek', 'Contact', 'Besluit', 'Afgerond']

interface PipelineStageSelectorProps {
  currentStage: PipelineStage
  parcelId: string
  onClose: () => void
  onAfgerond: () => void
}

export function PipelineStageSelector({
  currentStage,
  parcelId,
  onClose,
  onAfgerond,
}: PipelineStageSelectorProps) {
  const { mutate } = useUpdatePipelineStage()
  const containerRef = useRef<HTMLDivElement>(null)

  // Outside-click detection
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleStageClick = (stage: PipelineStage) => {
    if (stage === 'Afgerond') {
      onAfgerond()
      onClose()
    } else {
      mutate({ parcelId, stage })
      onClose()
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-full mt-1 right-0 bg-white rounded-xl shadow-lg border border-neutral-200 p-1 min-w-[180px] z-50"
    >
      {STAGE_ORDER.map((stage) => {
        const isActive = stage === currentStage
        return (
          <button
            key={stage}
            onClick={() => handleStageClick(stage)}
            className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-left transition-colors hover:bg-neutral-50 ${STAGE_STYLES[stage]}`}
          >
            <span>{stage}</span>
            {isActive && <Check size={14} strokeWidth={2.5} />}
          </button>
        )
      })}
    </div>
  )
}
