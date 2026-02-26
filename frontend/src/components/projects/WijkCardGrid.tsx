import type { ReactNode } from 'react'
import type { ProjectResponse } from '@/lib/types/project'
import type { UnreadDetailResponse } from '@/lib/types/monitoring'
import { useWijkGeoJSON } from '@/hooks/useWijkGeoJSON'
import { geoJsonToSvgPath, geoJsonToSvgDualPath } from '@/lib/geo-utils'
import { Skeleton } from '@/components/feedback/Skeleton'
import { GemeenteCardGrid } from './GemeenteCardGrid'

interface WijkCardGridProps {
  /** The selected gemeente-level project */
  gemeente: ProjectResponse
  /** Wijk children filtered by parent from allProjects */
  wijkProjects: ProjectResponse[]
  /** Unread counts from useUnreadCounts (passed from parent) */
  unreadData: UnreadDetailResponse | undefined
  /** Callback to return to gemeente grid — omit when using DrilldownBreadcrumb for navigation */
  onBack?: () => void
  /** Gemeente GeoJSON for background context in wijk cards (null = no background) */
  gemeenteGeojson: GeoJSON.FeatureCollection | null
  /**
   * Render prop for each wijk card.
   * The parent provides a sub-component that can call hooks (e.g. useProjectScans)
   * per card without violating React's rules of hooks (no hooks in .map() callbacks).
   */
  renderCard: (
    wijk: ProjectResponse,
    svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null,
    unreadCount: number
  ) => ReactNode
  /** Presentation mode for cards */
  layout?: 'grid' | 'list'
}

/**
 * Data-fetching container for wijk cards.
 *
 * Fetches CBS WFS wijk boundaries via useWijkGeoJSON, computes SVG silhouettes,
 * matches wijk projects to GeoJSON features by statnaam, and renders each card
 * via the renderCard render prop.
 *
 * Using renderCard instead of rendering WijkCard directly allows the parent
 * (ProjectList) to wrap each card in a sub-component that calls useProjectScans
 * per wijk — a valid hook call at component top level, not inside .map().
 *
 * Includes a breadcrumb back button to return to the gemeente grid view.
 * Shows a loading skeleton while wijk GeoJSON is loading.
 *
 * Feature matching uses `statnaam` (NOT statcode) — see Research Pitfall 1.
 * gemeenteCode is passed directly to fetchWijken without GM prefix stripping
 * (the backend's wijk_service.py handles normalisation).
 */
export function WijkCardGrid({
  gemeente,
  wijkProjects,
  unreadData,
  onBack,
  gemeenteGeojson,
  renderCard,
  layout = 'grid',
}: WijkCardGridProps) {
  const { data: wijkGeojson, isLoading } = useWijkGeoJSON(gemeente.gemeente_code)

  // Find gemeente feature once for background context in all wijk cards
  const gemeenteFeature = gemeenteGeojson?.features.find(
    (f) => f.properties?.statcode === gemeente.gemeente_code
  )
  const gemeenteGeom = gemeenteFeature?.geometry as
    | GeoJSON.Polygon
    | GeoJSON.MultiPolygon
    | undefined

  return (
    <div className="space-y-3">
      {/* Breadcrumb navigation — only when onBack is provided (standalone use) */}
      {onBack && (
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="text-sm text-grey-400 hover:text-grey-100 transition-colors"
          >
            &larr; Gemeenten
          </button>
          <span className="text-grey-600">/</span>
          <span className="text-sm font-medium text-grey-100">{gemeente.name}</span>
        </div>
      )}

      {/* Loading skeleton while CBS WFS boundary data loads */}
      {isLoading ? (
        <WijkCardGridSkeleton count={wijkProjects.length || 3} layout={layout} />
      ) : (
        layout === 'list' ? (
          <div className="space-y-2.5">
            {wijkProjects.map((wijk) => {
              const unreadCount =
                unreadData?.per_project.find((p) => p.project_id === wijk.id)
                  ?.unread_count ?? 0

              // Match wijk to CBS WFS feature by statnaam (NOT statcode — Research Pitfall 1)
              const feature = wijkGeojson?.features.find(
                (f) => f.properties?.statnaam === wijk.wijk_naam
              )

              const wijkGeom = feature?.geometry as
                | GeoJSON.Polygon
                | GeoJSON.MultiPolygon
                | undefined

              // Collect sibling wijk geometries (all other wijken in the gemeente)
              const siblingGeoms: (GeoJSON.Polygon | GeoJSON.MultiPolygon)[] = []
              if (wijkGeojson && wijkGeom) {
                for (const f of wijkGeojson.features) {
                  if (f.properties?.statnaam === wijk.wijk_naam) continue
                  const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
                  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
                    siblingGeoms.push(g)
                  }
                }
              }

              let svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null = null
              if (wijkGeom && gemeenteGeom) {
                svgData = geoJsonToSvgDualPath(wijkGeom, gemeenteGeom, siblingGeoms)
              } else if (wijkGeom) {
                const single = geoJsonToSvgPath(wijkGeom)
                svgData = { primaryD: single.d, viewBox: single.viewBox }
              }

              return renderCard(wijk, svgData, unreadCount)
            })}
          </div>
        ) : (
          <GemeenteCardGrid>
            {wijkProjects.map((wijk) => {
              const unreadCount =
                unreadData?.per_project.find((p) => p.project_id === wijk.id)
                  ?.unread_count ?? 0

              // Match wijk to CBS WFS feature by statnaam (NOT statcode — Research Pitfall 1)
              const feature = wijkGeojson?.features.find(
                (f) => f.properties?.statnaam === wijk.wijk_naam
              )

              const wijkGeom = feature?.geometry as
                | GeoJSON.Polygon
                | GeoJSON.MultiPolygon
                | undefined

              // Collect sibling wijk geometries (all other wijken in the gemeente)
              const siblingGeoms: (GeoJSON.Polygon | GeoJSON.MultiPolygon)[] = []
              if (wijkGeojson && wijkGeom) {
                for (const f of wijkGeojson.features) {
                  if (f.properties?.statnaam === wijk.wijk_naam) continue
                  const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
                  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
                    siblingGeoms.push(g)
                  }
                }
              }

              let svgData: { primaryD: string; backgroundD?: string; siblingsD?: string; viewBox: string } | null = null
              if (wijkGeom && gemeenteGeom) {
                svgData = geoJsonToSvgDualPath(wijkGeom, gemeenteGeom, siblingGeoms)
              } else if (wijkGeom) {
                const single = geoJsonToSvgPath(wijkGeom)
                svgData = { primaryD: single.d, viewBox: single.viewBox }
              }

              return renderCard(wijk, svgData, unreadCount)
            })}
          </GemeenteCardGrid>
        )
      )}
    </div>
  )
}

function WijkCardGridSkeleton({
  count = 3,
  layout = 'grid',
}: {
  count?: number
  layout?: 'grid' | 'list'
}) {
  if (layout === 'list') {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900"
          >
            <div className="aspect-[16/8] border-b border-overlay/[0.08] bg-grey-850/60 p-3">
              <Skeleton className="h-full w-full rounded-md bg-grey-800/70" />
            </div>
            <div className="px-3.5 py-2.5">
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-overlay/[0.08] bg-grey-900"
        >
          <div className="aspect-[16/8] border-b border-overlay/[0.08] bg-grey-850/60 p-3">
            <Skeleton className="h-full w-full rounded-md bg-grey-800/70" />
          </div>
          <div className="px-3.5 py-2.5">
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
