import { Heart } from 'lucide-react'
import { useMemo } from 'react'
import { useParcelFavorites, useToggleFavorite } from '@/hooks/useFavorites'
import type { ScanResultItem } from '@/lib/types/scan'

interface HeartButtonProps {
  parcel: ScanResultItem
}

/**
 * Heart toggle button for favoriting/unfavoriting a parcel
 *
 * Positioned next to the close button in ParcelPanelShell via headerActions prop.
 * Filled amber when favorited, unfilled when not.
 * Uses optimistic update — toggle is instant, rolls back on API error.
 *
 * IMPORTANT: Uses parcel.parcel_code (Kadaster string), NOT parcel.parcel_id (UUID)
 */
export function HeartButton({ parcel }: HeartButtonProps) {
  const favoritesQuery = useParcelFavorites()
  const toggleFavorite = useToggleFavorite()

  const isFavorited = useMemo(
    () => (favoritesQuery.data ?? []).some((f) => f.parcel_id === parcel.parcel_code),
    [favoritesQuery.data, parcel.parcel_code],
  )

  // Guard: no Kadaster ID = can't favorite
  if (!parcel.parcel_code) return null

  return (
    <button
      type="button"
      onClick={() => toggleFavorite.mutate({ parcel, isFavorited })}
      disabled={toggleFavorite.isPending}
      className="flex h-8 w-8 items-center justify-center text-aura-obsidian transition-colors hover:text-aura-amber disabled:opacity-60"
      aria-label={isFavorited ? 'Verwijder uit portfolio' : 'Toevoegen aan portfolio'}
    >
      <Heart
        className={`h-4 w-4 transition-colors ${isFavorited ? 'fill-aura-amber text-aura-amber' : ''}`}
      />
    </button>
  )
}
