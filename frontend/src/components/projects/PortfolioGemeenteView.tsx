import { useNavigate } from '@tanstack/react-router'
import type { GemeenteScopeCard } from '@/hooks/useMunicipalityWorkspaceStats'
import type { PortfolioGemeenteGroup } from '@/lib/types/portfolio'
import { geoJsonToSvgDualPath, geoJsonToSvgPath } from '@/lib/geo-utils'

interface PortfolioGemeenteViewProps {
  /** From portfolio API, filtered to selected province */
  gemeenten: PortfolioGemeenteGroup[]
  /** For SVG silhouettes and province mapping */
  allGemeenteCards: GemeenteScopeCard[]
  /** Province geometry for dual-path SVG background */
  selectedProvinceGeometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon
  onGemeenteSelect: (gemeenteCode: string) => void
}

/**
 * Grid of gemeente cards filtered to the selected province.
 * Only shows gemeenten with favorited parcels.
 */
export function PortfolioGemeenteView({
  gemeenten,
  allGemeenteCards,
  selectedProvinceGeometry,
  onGemeenteSelect,
}: PortfolioGemeenteViewProps) {
  const navigate = useNavigate()

  if (gemeenten.length === 0) {
    return (
      <p className="text-sm text-neutral-500 px-1">
        Geen gemeenten met opgeslagen percelen gevonden voor deze provincie.
      </p>
    )
  }

  // Build lookup map for GeoJSON cards
  const cardsByCode = new Map(allGemeenteCards.map((c) => [c.code, c]))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {gemeenten.map((gemeente) => {
        const code = gemeente.gemeente_code ?? ''
        const card = cardsByCode.get(code)

        let svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null = null
        if (card) {
          const raw = selectedProvinceGeometry
            ? geoJsonToSvgDualPath(card.geometry, selectedProvinceGeometry, [])
            : geoJsonToSvgPath(card.geometry)
          svgData = 'primaryD' in raw
            ? raw
            : { primaryD: raw.d, viewBox: raw.viewBox }
        }

        return (
          <div
            key={code}
            onClick={() => onGemeenteSelect(code)}
            className="overflow-hidden rounded-xl border border-aura-amber/40 bg-aura-glass-white/60 cursor-pointer transition-all hover:border-aura-amber/70 hover:shadow-[0_0_0_1px_rgba(217,170,56,0.14)]"
          >
            {/* SVG silhouette */}
            <div className="relative aspect-[4/3] border-b border-neutral-200 bg-aura-glass-white/40">
              {svgData ? (
                <svg
                  viewBox={svgData.viewBox}
                  className="h-full w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {svgData.backgroundD && (
                    <path
                      d={svgData.backgroundD}
                      className="fill-neutral-400/18 stroke-neutral-400/20"
                      strokeWidth="0.5"
                    />
                  )}
                  <path
                    d={svgData.primaryD}
                    className="fill-aura-amber/24 stroke-aura-amber"
                    strokeWidth="1"
                  />
                </svg>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-xs text-neutral-400">{gemeente.gemeente_naam ?? code}</span>
                </div>
              )}
            </div>

            {/* Text area */}
            <div className="px-3 py-2.5">
              <p className="truncate text-base font-semibold text-aura-ink">
                {gemeente.gemeente_naam ?? code}
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                {gemeente.total_count} {gemeente.total_count === 1 ? 'perceel' : 'percelen'} opgeslagen
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigate({ to: '/map', search: { gemeente_code: code } as Record<string, string> })
                }}
                className="mt-1.5 text-xs text-aura-amber underline underline-offset-2 hover:text-aura-amber/80 transition-colors"
              >
                Bekijk op kaart &rarr;
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
