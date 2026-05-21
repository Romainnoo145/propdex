import { Heart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ProjectTypePickerModal } from '@/components/parcel/ProjectTypePickerModal'
import { useParcelFavorites, useToggleFavorite } from '@/hooks/useFavorites'
import type { ScanResultItem } from '@/lib/types/scan'

interface HeartButtonProps {
  parcel: ScanResultItem
  /** Gemeente display name from scan context (not available on ScanResultItem) */
  gemeenteNaam?: string | null
  /** Wijk name from scan context (not available on ScanResultItem) */
  wijkNaam?: string | null
}

/**
 * Show the project-type picker only after a NEW favorite is created (not on un-favorite).
 *
 * M052/S01 (FUND-01): save success → picker → PUT project-type.
 * Exported for Wave-0 unit test: shouldShowProjectTypePicker in useToggleFavorite.test.ts.
 */
export function shouldShowProjectTypePicker(isFavorited: boolean, data: unknown): boolean {
  return !isFavorited && data != null
}

/**
 * Heart toggle button for favoriting/unfavoriting a parcel.
 *
 * Positioned next to the close button in ParcelPanelShell via headerActions prop.
 * Filled amber when favorited, unfilled when not.
 * Uses optimistic update — toggle is instant, rolls back on API error.
 *
 * IMPORTANT: Uses parcel.parcel_code (Kadaster string), NOT parcel.parcel_id (UUID)
 */
export function HeartButton({ parcel, gemeenteNaam, wijkNaam }: HeartButtonProps) {
  const favoritesQuery = useParcelFavorites()
  const toggleFavorite = useToggleFavorite()
  const [showPicker, setShowPicker] = useState(false)

  const isFavorited = useMemo(
    () => (favoritesQuery.data ?? []).some((f) => f.parcel_id === parcel.parcel_code),
    [favoritesQuery.data, parcel.parcel_code],
  )

  // Guard: no Kadaster ID = can't favorite
  if (!parcel.parcel_code) return null

  return (
    <>
      <button
        type="button"
        onClick={() =>
          toggleFavorite.mutate(
            { parcel, isFavorited, gemeenteNaam, wijkNaam },
            {
              onSuccess: (data) => {
                if (shouldShowProjectTypePicker(isFavorited, data)) {
                  setShowPicker(true)
                }
              },
            },
          )
        }
        disabled={toggleFavorite.isPending}
        className="flex h-8 w-8 items-center justify-center text-aura-obsidian transition-colors hover:text-red-500 disabled:opacity-60"
        aria-label={isFavorited ? 'Verwijder uit portfolio' : 'Toevoegen aan portfolio'}
      >
        <Heart
          className={`h-4 w-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : ''}`}
        />
      </button>

      {showPicker && (
        <ProjectTypePickerModal
          open={showPicker}
          onClose={() => setShowPicker(false)}
          parcelId={parcel.parcel_code}
          currentType={null}
          onSkip={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
