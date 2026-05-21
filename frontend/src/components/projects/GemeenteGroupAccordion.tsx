import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { STAGES } from '@/components/projects/PipelineStagePill'
import { SavedParcelCard } from '@/components/projects/SavedParcelCard'
import type { FavoriteResponse, PipelineStage } from '@/lib/types/portfolio'

export interface GemeenteGroup {
  gemeente_naam: string
  gemeente_code: string | null
  parcels: FavoriteResponse[]
  stageCounts: Record<PipelineStage, number>
}

function CountBadge({ total }: { total: number }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-amber-400">
      <span className="text-[14px] font-bold text-aura-ink tabular-nums">{total}</span>
    </div>
  )
}

interface GemeenteGroupAccordionProps {
  group: GemeenteGroup
  isExpanded: boolean
  onToggle: () => void
  onOpenMap: (parcel: FavoriteResponse) => void
  onPotentieClick: (parcel: FavoriteResponse) => void
  onRisicoClick: (parcel: FavoriteResponse) => void
}

export function GemeenteGroupAccordion({
  group,
  isExpanded,
  onToggle,
  onOpenMap,
  onPotentieClick,
  onRisicoClick,
}: GemeenteGroupAccordionProps) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-white/60 backdrop-blur-[24px] rounded-[24px] border border-white/40 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Gemeente header */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <CountBadge total={group.parcels.length} />
          <div className="text-left">
            <p className="text-[15px] font-bold text-aura-ink tracking-tight">
              {group.gemeente_naam}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {group.parcels.length} {group.parcels.length === 1 ? 'perceel' : 'percelen'}
              {group.gemeente_code && (
                <span className="ml-1.5 text-slate-300">· {group.gemeente_code}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {STAGES.filter((s) => group.stageCounts[s] > 0).map((stage) => (
              <span key={stage} className="text-[10px] font-bold text-slate-400 tabular-nums">
                {group.stageCounts[stage]}
              </span>
            ))}
          </div>
          {isExpanded ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Parcel list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/40 p-4">
              <motion.div
                className="flex flex-col gap-3"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {group.parcels.map((parcel) => (
                  <SavedParcelCard
                    key={parcel.parcel_id}
                    parcel={parcel}
                    onOpenMap={() => onOpenMap(parcel)}
                    onPotentieClick={() => onPotentieClick(parcel)}
                    onRisicoClick={() => onRisicoClick(parcel)}
                  />
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
