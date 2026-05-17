/**
 * SavedParcelCard — Full-width parcel card for the /opgeslagen portfolio view.
 *
 * Layout: [BAG thumbnail] [Address + meta + stage pill] [Score badges]
 *
 * Card click → navigates to /opgeslagen/perceel/$parcelId
 * // Plan 04 mounts /opgeslagen/perceel/$parcelId — until that lands clicks land on 404.
 *
 * Design: Pure Glass (bg-white/60 backdrop-blur-[24px]), Morning Mist canvas,
 * Plus Jakarta Sans, Warm Amber accent — Aura design system.
 */
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/animations'
import { useAerialCrop } from '@/hooks/useScans'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ScoreBadge } from '@/components/projects/ScoreDetailModal'
import { PipelineStagePill } from '@/components/projects/PipelineStagePill'
import type { FavoriteResponse } from '@/lib/types/portfolio'

interface SavedParcelCardProps {
  parcel: FavoriteResponse
  onOpenMap?: () => void
  onPotentieClick?: () => void
  onRisicoClick?: () => void
}

export function SavedParcelCard({
  parcel,
  onOpenMap: _onOpenMap,
  onPotentieClick,
  onRisicoClick,
}: SavedParcelCardProps) {
  const navigate = useNavigate()
  const aerialQuery = useAerialCrop(parcel.parcel_cache_id ?? parcel.parcel_id)
  const thumbnailUrl = aerialQuery.data
  const thumbnailLoading = aerialQuery.isLoading

  const handleCardClick = () => {
    // Plan 04 mounts /opgeslagen/perceel/$parcelId — until that lands clicks land on 404.
    void navigate({
      to: '/opgeslagen/perceel/$parcelId' as never,
      params: { parcelId: parcel.parcel_id } as never,
    })
  }

  return (
    <motion.div
      variants={fadeUp}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleCardClick()
      }}
      className="w-full bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[28px] p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer flex items-center gap-4 group"
      style={{ willChange: 'transform' }}
    >
      {/* LEFT: BAG-thumbnail (square 96x96) */}
      <div className="shrink-0 w-24 h-24 rounded-2xl overflow-hidden bg-aura-canvas border border-white/40">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : thumbnailLoading ? (
          <Skeleton className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px]">
            geen foto
          </div>
        )}
      </div>

      {/* MIDDLE: Address + meta + stage pill */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="text-[15px] font-semibold text-aura-ink truncate">
          {parcel.address ?? 'Onbekend adres'}
        </div>
        <div className="text-[12px] text-slate-500 truncate">
          {[parcel.wijk_naam, parcel.gemeente_naam].filter(Boolean).join(' · ') ||
            'Onbekende gemeente'}
        </div>
        <div className="mt-1">
          <PipelineStagePill
            parcelId={parcel.parcel_id}
            currentStage={parcel.pipeline_stage}
          />
        </div>
      </div>

      {/* RIGHT: Score cluster — ScoreBadge takes `type` + `score` (NOT variant/value).
          stopPropagation on outer wrapper so card-click doesn't fire on badge-click.
          ScoreBadge's onClick has no event arg per its real signature. */}
      <div
        className="shrink-0 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {parcel.potentie_score != null && (
          <ScoreBadge
            type="potentie"
            score={parcel.potentie_score}
            size="sm"
            onClick={() => onPotentieClick?.()}
          />
        )}
        {parcel.risico_score != null && (
          <ScoreBadge
            type="risico"
            score={parcel.risico_score}
            size="sm"
            onClick={() => onRisicoClick?.()}
          />
        )}
      </div>
    </motion.div>
  )
}
