import { useMemo } from 'react'
import { Heart, ChevronRight, MapPin } from 'lucide-react'
import { useParcelFavorites } from '@/hooks/useFavorites'

interface TopWijkenLandingProps {
  gemeenteCode: string
  onSelectWijk: (code: string, naam: string) => void
  onSwitchToWijken: () => void
}

interface WijkFavCount {
  wijkNaam: string
  count: number
}

/**
 * Default landing — "Jouw top wijken" sorted by favorited parcel count.
 * Uses useParcelFavorites to derive top 5 wijken in this gemeente.
 * Shows empty state when no favorites exist.
 */
export function TopWijkenLanding({ gemeenteCode, onSelectWijk, onSwitchToWijken }: TopWijkenLandingProps) {
  const { data: favorites, isLoading } = useParcelFavorites()

  const topWijken = useMemo((): WijkFavCount[] => {
    if (!favorites) return []

    // Filter to this gemeente and group by wijk_naam
    const counts = new Map<string, number>()
    for (const fav of favorites) {
      if (fav.gemeente_code === gemeenteCode && fav.wijk_naam) {
        counts.set(fav.wijk_naam, (counts.get(fav.wijk_naam) ?? 0) + 1)
      }
    }

    return [...counts.entries()]
      .map(([wijkNaam, count]) => ({ wijkNaam, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [favorites, gemeenteCode])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <span
          className="text-[10px] font-black text-slate-400 uppercase"
          style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Jouw top wijken
        </span>
        <p className="text-[13px] text-slate-400 mt-2">Laden...</p>
      </div>
    )
  }

  if (topWijken.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <Heart size={18} className="text-slate-300" />
        </div>
        <p className="text-[13px] text-slate-400 text-center leading-relaxed">
          Nog geen favorieten in deze gemeente
        </p>
        <button
          onClick={onSwitchToWijken}
          className="h-[36px] px-4 rounded-full bg-[#F2F6F3] text-[12px] font-semibold text-[#0E1111] hover:bg-[#E8EDEB] transition-colors flex items-center gap-1.5"
        >
          <MapPin size={12} />
          Verken de wijken
        </button>
      </div>
    )
  }

  return (
    <div>
      <span
        className="text-[10px] font-black text-slate-400 uppercase block mb-3"
        style={{ letterSpacing: '0.2em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Jouw top wijken
      </span>

      <div className="space-y-0">
        {topWijken.map(({ wijkNaam, count }) => (
          <button
            key={wijkNaam}
            onClick={() => onSelectWijk('', wijkNaam)}
            className="group w-full flex items-center justify-between py-2.5 border-b border-slate-100/80 last:border-0 text-left transition-colors duration-150 hover:bg-slate-50/50 rounded-lg px-1"
          >
            <span className="text-[13px] font-medium text-slate-700 truncate">
              {wijkNaam}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1 text-[11px] text-[#F9A826] font-semibold tabular-nums">
                <Heart size={10} fill="#F9A826" />
                {count}
              </span>
              <ChevronRight size={14} className="text-slate-200 group-hover:text-[#F9A826] transition-colors duration-150" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
