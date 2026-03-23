import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import { fadeUp } from './animations'
import { useParcelFavorites } from '@/hooks/useFavorites'

interface FavorietenModalProps {
  gemeenteNaam: string
  onClose: () => void
}

export function FavorietenModal({ gemeenteNaam, onClose }: FavorietenModalProps) {
  const { data: favorites } = useParcelFavorites()

  const gemeenteFavorites = useMemo(() => {
    if (!favorites) return []
    return favorites.filter((f) => f.gemeente_naam?.toLowerCase() === gemeenteNaam.toLowerCase())
  }, [favorites, gemeenteNaam])

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
            <motion.div
              key={fav.id}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="bg-[#F8FAF9] rounded-[14px] px-4 py-3 flex items-center justify-between"
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
              <Heart size={14} fill="#EF4444" className="text-[#EF4444] shrink-0" />
            </motion.div>
          ))}
        </div>
      )}
    </GemeenteModal>
  )
}
