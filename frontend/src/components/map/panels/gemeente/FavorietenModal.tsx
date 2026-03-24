import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Heart, ChevronRight } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import { fadeUp } from './animations'
import { useParcelFavorites } from '@/hooks/useFavorites'
import { filterFavoritesForGemeente } from '@/lib/favorites'
import { toMapParcelSearch } from '@/lib/navigation/mapSearch'

interface FavorietenModalProps {
  gemeenteNaam: string
  gemeenteCode: string
  onClose: () => void
}

export function FavorietenModal({ gemeenteNaam, gemeenteCode, onClose }: FavorietenModalProps) {
  const navigate = useNavigate()
  const { data: favorites } = useParcelFavorites()

  const gemeenteFavorites = useMemo(
    () => filterFavoritesForGemeente(favorites, { gemeenteCode, gemeenteNaam }),
    [favorites, gemeenteCode, gemeenteNaam],
  )

  const openParcel = (parcelId: string, fallbackAddress?: string | null) => {
    navigate({
      to: '/map',
      search: toMapParcelSearch({
        parcelId,
        fallbackAddress,
      }),
    })
    onClose()
  }

  return (
    <GemeenteModal
      title="Favorieten"
      subtitle={`${gemeenteFavorites.length} percelen in ${gemeenteNaam}`}
      onClose={onClose}
    >
      {gemeenteFavorites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Heart size={32} className="text-slate-200 mb-3" />
          <p className="text-[14px] font-semibold text-slate-500">Geen favorieten</p>
          <p className="text-[12px] text-slate-400 mt-1">
            Sla percelen op in deze gemeente om ze hier te zien.
          </p>
        </div>
      )}

      {gemeenteFavorites.length > 0 && (
        <div className="space-y-2">
          {gemeenteFavorites.map((fav) => (
            <motion.button
              key={fav.id}
              type="button"
              variants={fadeUp}
              initial="hidden"
              animate="show"
              onClick={() => openParcel(fav.parcel_id, fav.address)}
              className="w-full bg-[#F8FAF9] rounded-[14px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors hover:bg-[#EEF3EF]"
            >
              <div className="min-w-0 flex-1">
                <span className="text-[13px] font-bold text-[#0E1111] block truncate">
                  {fav.address || fav.parcel_id}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {fav.wijk_naam && (
                    <span className="text-[10px] text-slate-400">{fav.wijk_naam}</span>
                  )}
                  <span className="text-[10px] text-slate-300 tabular-nums">{fav.parcel_id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Heart size={14} fill="#EF4444" className="text-[#EF4444]" />
                <ChevronRight size={14} className="text-slate-400" />
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </GemeenteModal>
  )
}
