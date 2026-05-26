import { useState } from 'react'
import type { FavoriteResponse } from '@/lib/types/portfolio'
import {
  projectTypeChipLabel,
  shouldShowProjectTypeChip,
} from '@/lib/types/projectTypeChip'
import { PipelineStagePill } from './PipelineStagePill'
import { PipelineStageSelector } from './PipelineStageSelector'
import { AfgerondModal } from './AfgerondModal'

interface FavoritedParcelCardProps {
  favorite: FavoriteResponse
  onOpenMap?: () => void
}

export function FavoritedParcelCard({ favorite, onOpenMap }: FavoritedParcelCardProps) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [afgerondOpen, setAfgerondOpen] = useState(false)

  const formattedDate = new Date(favorite.created_at).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const displayAddress = favorite.address ?? favorite.gemeente_naam ?? favorite.gemeente_code ?? '—'

  return (
    <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4 space-y-3 transition-all hover:border-aura-amber/35 hover:shadow-[0_0_0_1px_rgba(217,170,56,0.12)]">
      {/* Row 1: Address + stage pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-aura-ink leading-tight truncate">{displayAddress}</p>
          <p className="text-xs font-mono text-neutral-400 truncate">{favorite.parcel_id}</p>
          {shouldShowProjectTypeChip(favorite.project_type) && (
            <span className="inline-flex max-w-full items-center self-start rounded-full bg-amber-50/80 border border-aura-amber/30 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 truncate">
              {projectTypeChipLabel(favorite.project_type!)}
            </span>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <PipelineStagePill
            stage={favorite.pipeline_stage}
            onClick={() => setSelectorOpen(!selectorOpen)}
            afgerondReden={favorite.afgerond_reden}
          />
          {selectorOpen && (
            <PipelineStageSelector
              currentStage={favorite.pipeline_stage}
              parcelId={favorite.parcel_id}
              onClose={() => setSelectorOpen(false)}
              onAfgerond={() => setAfgerondOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Row 2: Date + ghost button */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-400">{formattedDate}</span>
        {onOpenMap && (
          <button
            onClick={onOpenMap}
            className="text-xs text-aura-amber underline underline-offset-2 hover:text-aura-amber/80 transition-colors"
          >
            Bekijk op kaart &rarr;
          </button>
        )}
      </div>

      <AfgerondModal
        parcelId={favorite.parcel_id}
        isOpen={afgerondOpen}
        onClose={() => setAfgerondOpen(false)}
      />
    </div>
  )
}
