/**
 * ChatFavoritesList — inline favorites list for MY_FAVORITES intent.
 */

import { Heart } from 'lucide-react'
import type { FavoriteSummary } from '@/hooks/useChat'

const STAGE_COLORS: Record<string, string> = {
  Gesignaleerd: 'bg-blue-100 text-blue-700',
  Onderzoek: 'bg-amber-100 text-amber-700',
  Contact: 'bg-purple-100 text-purple-700',
  Besluit: 'bg-emerald-100 text-emerald-700',
  Afgerond: 'bg-slate-100 text-slate-500',
}

interface Props {
  favorites: FavoriteSummary[]
  count: number
  message?: string
}

export function ChatFavoritesList({ favorites, count, message }: Props) {
  if (favorites.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-slate-400">
        <Heart size={16} />
        <span>{message || 'Geen opgeslagen percelen gevonden.'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-[#0E1111]">
        {count} opgeslagen {count === 1 ? 'perceel' : 'percelen'}
      </p>
      <div className="space-y-1">
        {favorites.slice(0, 15).map((f) => (
          <div
            key={f.parcel_id}
            className="flex items-center justify-between rounded-lg border border-[#EAEFEF] bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#0E1111] truncate">
                {f.address || f.parcel_id}
              </p>
              {f.gemeente_naam && (
                <p className="text-[10px] text-slate-400">{f.gemeente_naam}{f.wijk_naam ? ` · ${f.wijk_naam}` : ''}</p>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[f.pipeline_stage] || 'bg-slate-100 text-slate-500'}`}>
              {f.pipeline_stage}
            </span>
          </div>
        ))}
      </div>
      {count > 15 && (
        <p className="text-[11px] text-slate-400">
          {15} van {count} getoond
        </p>
      )}
    </div>
  )
}
