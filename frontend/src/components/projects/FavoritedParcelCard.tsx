import type { FavoriteResponse } from '@/lib/types/portfolio'
import { PipelineStagePill } from './PipelineStagePill'

interface FavoritedParcelCardProps {
  favorite: FavoriteResponse
  onOpenMap?: () => void
}

export function FavoritedParcelCard({ favorite, onOpenMap }: FavoritedParcelCardProps) {
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
        </div>
        <PipelineStagePill stage={favorite.pipeline_stage} />
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
    </div>
  )
}
