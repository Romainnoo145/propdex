import type { ReactNode } from 'react'
import type { ProjectResponse } from '@/lib/types/project'
import type { UnreadDetailResponse } from '@/lib/types/monitoring'
import { useWijkGeoJSON } from '@/hooks/useWijkGeoJSON'
import { geoJsonToSvgPath } from '@/lib/geo-utils'
import { GemeenteCardGrid, GemeenteCardGridSkeleton } from './GemeenteCardGrid'

interface WijkCardGridProps {
  /** The selected gemeente-level project */
  gemeente: ProjectResponse
  /** Wijk children filtered by parent from allProjects */
  wijkProjects: ProjectResponse[]
  /** Unread counts from useUnreadCounts (passed from parent) */
  unreadData: UnreadDetailResponse | undefined
  /** Callback to clear selectedGemeenteId — returns to gemeente view */
  onBack: () => void
  /**
   * Render prop for each wijk card.
   * The parent provides a sub-component that can call hooks (e.g. useProjectScans)
   * per card without violating React's rules of hooks (no hooks in .map() callbacks).
   */
  renderCard: (
    wijk: ProjectResponse,
    svgData: { d: string; viewBox: string } | null,
    unreadCount: number
  ) => ReactNode
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
  renderCard,
}: WijkCardGridProps) {
  const { data: wijkGeojson, isLoading } = useWijkGeoJSON(gemeente.gemeente_code)

  return (
    <div className="space-y-4">
      {/* Breadcrumb navigation */}
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

      {/* Loading skeleton while CBS WFS boundary data loads */}
      {isLoading ? (
        <GemeenteCardGridSkeleton count={wijkProjects.length || 3} />
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

            const svgData = feature
              ? geoJsonToSvgPath(
                  feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
                )
              : null

            return renderCard(wijk, svgData, unreadCount)
          })}
        </GemeenteCardGrid>
      )}
    </div>
  )
}
