import { useNavigate } from '@tanstack/react-router'
import type { ProvinceOption } from '@/hooks/useMunicipalityWorkspaceStats'
import { geoJsonToSvgPath } from '@/lib/geo-utils'

interface PortfolioProvincieViewProps {
  provinceOptions: ProvinceOption[]
  provinciesWithFavorites: Set<string>
  favoriteCountByProvince: Map<string, number>
  provincieGeojson: GeoJSON.FeatureCollection | null | undefined
  onProvinceSelect: (code: string) => void
}

/**
 * Full grid of all 12 provinces in portfolio mode.
 *
 * Active provinces (with favorited parcels) have amber border + are clickable.
 * Inactive provinces are greyed out (opacity-40) and non-interactive.
 */
export function PortfolioProvincieView({
  provinceOptions,
  provinciesWithFavorites,
  favoriteCountByProvince,
  onProvinceSelect,
}: PortfolioProvincieViewProps) {
  const navigate = useNavigate()

  if (provinceOptions.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 animate-pulse aspect-[4/3]"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {provinceOptions.map((province) => {
        const isActive = provinciesWithFavorites.has(province.code)
        const count = favoriteCountByProvince.get(province.code) ?? 0
        const svgData = geoJsonToSvgPath(province.geometry)

        return (
          <div
            key={province.code}
            onClick={isActive ? () => onProvinceSelect(province.code) : undefined}
            className={`overflow-hidden rounded-xl border bg-aura-glass-white/60 transition-all ${
              isActive
                ? 'border-aura-amber/40 cursor-pointer hover:border-aura-amber/70 hover:shadow-[0_0_0_1px_rgba(217,170,56,0.14)]'
                : 'border-neutral-200 opacity-40 cursor-default'
            }`}
          >
            {/* SVG silhouette */}
            <div className="relative aspect-[4/3] border-b border-neutral-200 bg-aura-glass-white/40">
              <svg
                viewBox={svgData.viewBox}
                className="h-full w-full"
                preserveAspectRatio="xMidYMid meet"
              >
                <path
                  d={svgData.d}
                  className={
                    isActive
                      ? 'fill-aura-amber/24 stroke-aura-amber'
                      : 'fill-neutral-300/40 stroke-neutral-400'
                  }
                  strokeWidth="1"
                />
              </svg>
            </div>

            {/* Text area */}
            <div className="px-3 py-2.5">
              <p className="truncate text-base font-semibold text-aura-ink">
                {province.naam}
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                {isActive ? `${count} ${count === 1 ? 'perceel' : 'percelen'} opgeslagen` : 'Geen percelen'}
              </p>
              {isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate({ to: '/map' })
                  }}
                  className="mt-1.5 text-xs text-aura-amber underline underline-offset-2 hover:text-aura-amber/80 transition-colors"
                >
                  Bekijk op kaart &rarr;
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
