import { normalizeAreaName, normalizeGemeenteCode } from '@/lib/geo/normalizers'
import type { FavoriteResponse } from '@/lib/types/portfolio'

interface GemeenteMatchParams {
  gemeenteCode?: string | null
  gemeenteNaam?: string | null
}

export function favoriteBelongsToGemeente(
  favorite: FavoriteResponse,
  { gemeenteCode, gemeenteNaam }: GemeenteMatchParams,
): boolean {
  const targetCode = normalizeGemeenteCode(gemeenteCode)
  const favoriteCode = normalizeGemeenteCode(favorite.gemeente_code)

  if (targetCode && favoriteCode) {
    return targetCode === favoriteCode
  }

  if (gemeenteNaam && favorite.gemeente_naam) {
    return normalizeAreaName(favorite.gemeente_naam) === normalizeAreaName(gemeenteNaam)
  }

  return false
}

export function filterFavoritesForGemeente(
  favorites: FavoriteResponse[] | undefined,
  params: GemeenteMatchParams,
): FavoriteResponse[] {
  if (!favorites) return []
  return favorites.filter((favorite) => favoriteBelongsToGemeente(favorite, params))
}
