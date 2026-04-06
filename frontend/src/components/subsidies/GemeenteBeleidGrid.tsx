/**
 * GemeenteBeleidGrid — searchable grid of ~340 Dutch gemeente SVG cards.
 * Used on the gemeentelijk tab of the subsidies page.
 * Fetches CBS gemeente boundaries via useGemeenteGeoJSON,
 * projects each geometry to an SVG path, and renders GemeenteCard.
 */

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'
import { geoJsonToSvgPath } from '@/lib/geo-utils'
import { GemeenteCard } from '@/components/projects/GemeenteCard'
import {
  GemeenteCardGrid,
  GemeenteCardGridSkeleton,
} from '@/components/projects/GemeenteCardGrid'

interface GemeenteBeleidGridProps {
  onSelectGemeente: (code: string) => void
}

/**
 * Each processed feature carries its pre-computed SVG data
 * so we avoid re-projecting 340 geometries on every render.
 */
interface ProcessedGemeente {
  gemeentecode: string
  gemeentenaam: string
  svgData: { primaryD: string; viewBox: string }
}

export function GemeenteBeleidGrid({ onSelectGemeente }: GemeenteBeleidGridProps) {
  const { data: geojson, isLoading } = useGemeenteGeoJSON()
  const [search, setSearch] = useState('')

  // Pre-compute SVG paths for all ~340 gemeenten (heavy — memoized)
  const gemeenten = useMemo<ProcessedGemeente[]>(() => {
    if (!geojson) return []

    return geojson.features
      .map((feature) => {
        const props = feature.properties as Record<string, unknown> | null
        const gemeentecode = String(props?.statcode ?? '')
        const gemeentenaam = String(props?.statnaam ?? '')
        const geometry = feature.geometry as
          | GeoJSON.Polygon
          | GeoJSON.MultiPolygon

        if (
          !gemeentecode ||
          !gemeentenaam ||
          (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
        ) {
          return null
        }

        const { d, viewBox } = geoJsonToSvgPath(geometry)
        return {
          gemeentecode,
          gemeentenaam,
          svgData: { primaryD: d, viewBox },
        }
      })
      .filter((g): g is ProcessedGemeente => g !== null)
      .sort((a, b) => a.gemeentenaam.localeCompare(b.gemeentenaam, 'nl'))
  }, [geojson])

  // Filter by search term (case-insensitive)
  const filtered = useMemo(() => {
    if (!search.trim()) return gemeenten
    const q = search.trim().toLowerCase()
    return gemeenten.filter(
      (g) =>
        g.gemeentenaam.toLowerCase().includes(q) ||
        g.gemeentecode.toLowerCase().includes(q),
    )
  }, [gemeenten, search])

  if (isLoading) {
    return <GemeenteCardGridSkeleton count={9} />
  }

  return (
    <div className="space-y-5">
      {/* Search input */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek gemeente..."
          className="h-10 w-full rounded-full border border-[#EAEFEF] bg-white pl-9 pr-4 text-[13px] text-[#0E1111] placeholder:text-slate-400 outline-none transition-colors focus:border-[#F9A826]"
        />
      </div>

      {/* Results count when filtering */}
      {search.trim() && (
        <p className="text-[12px] text-slate-500">
          {filtered.length} gemeente{filtered.length !== 1 ? 'n' : ''} gevonden
        </p>
      )}

      {/* Card grid */}
      <GemeenteCardGrid>
        {filtered.map((g) => (
          <GemeenteCard
            key={g.gemeentecode}
            gemeenteName={g.gemeentenaam}
            gemeenteCode={g.gemeentecode}
            svgData={g.svgData}
            totalUnread={0}
            onClick={() => onSelectGemeente(g.gemeentecode)}
          />
        ))}
      </GemeenteCardGrid>

      {filtered.length === 0 && !isLoading && (
        <p className="py-12 text-center text-[13px] text-slate-400">
          Geen gemeenten gevonden voor &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  )
}
