/**
 * ScopeHub — beleid-style hero for the data-bronnen hub (M053/S05).
 *
 * Replaces the flat, low-contrast ScopePicker. Three calm, labeled level
 * groups (Landelijk · Provincie · Gemeente) rendered as defined solid-white
 * cards. The gemeente group renders SVG silhouettes (same compute pattern as
 * GemeenteBeleidGrid: useGemeenteGeoJSON + geoJsonToSvgPath, memoized) but ONLY
 * for the codes present in useGemeentenSummary, each carrying its status dot
 * (groen all-live / amber any-missing / rood any-broken — mirrors
 * GemeentePicker.dotColor).
 *
 * Clicking any scope opens ScopeDetailModal in-place (pop-up) instead of
 * navigating to the $entityType/$entityCode route.
 *
 * Aura tokens (DESIGN.md): Plus Jakarta Sans, Morning Mist #F2F6F3 group
 * backgrounds, solid white cards, Warm Amber #F9A826 as the only decorative
 * accent, Obsidian #0E1111 for text. Minimal Calm Intelligence — one focal
 * point per group, no gratuitous icons.
 */
import { useMemo, useState } from 'react'
import { Landmark, Building2, MapPin, Loader2 } from 'lucide-react'

import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'
import { geoJsonToSvgPath } from '@/lib/geo-utils'
import { useScopes, useGemeentenSummary } from '@/lib/queries/data-sources-admin'
import type {
  EntityType,
  GemeenteSummary,
} from '@/lib/types/data-sources-admin'
import { ScopeDetailModal } from '@/components/settings/data-bronnen/ScopeDetailModal'

interface SelectedScope {
  entityType: EntityType
  entityCode: string
  entityNaam: string
}

/** Status dot color — mirrors GemeentePicker.dotColor. */
function dotColor(summary: GemeenteSummary): string {
  if ((summary.status_counts.broken ?? 0) > 0) return 'bg-[#EF4444]'
  if ((summary.status_counts.missing ?? 0) > 0) return 'bg-[#F9A826]'
  return 'bg-[#22C55E]'
}

/** Pre-computed silhouette for a single monitored gemeente. */
interface SilhouetteGemeente {
  summary: GemeenteSummary
  svgData: { primaryD: string; viewBox: string } | null
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  )
}

export function ScopeHub() {
  const scopesQuery = useScopes()
  const gemeentenQuery = useGemeentenSummary()
  const { data: geojson, isLoading: geojsonLoading } = useGemeenteGeoJSON()

  const [selected, setSelected] = useState<SelectedScope | null>(null)

  const scopes = scopesQuery.data ?? []
  const landelijk = scopes.find((s) => s.entity_type === 'landelijk') ?? null
  const provincies = scopes.filter((s) => s.entity_type === 'provincie')

  const gemeenten = gemeentenQuery.data ?? []

  // Lookup of statcode → svg path, computed once over all geojson features but
  // only resolved for the monitored gemeente codes (cheap: 1 pass + N lookups).
  const svgByCode = useMemo(() => {
    const map = new Map<string, { primaryD: string; viewBox: string }>()
    if (!geojson) return map
    const wanted = new Set(gemeenten.map((g) => g.gemeente_code))
    if (wanted.size === 0) return map
    for (const feature of geojson.features) {
      const props = feature.properties as Record<string, unknown> | null
      const code = String(props?.statcode ?? '')
      if (!code || !wanted.has(code)) continue
      const geometry = feature.geometry as
        | GeoJSON.Polygon
        | GeoJSON.MultiPolygon
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
        continue
      const { d, viewBox } = geoJsonToSvgPath(geometry)
      map.set(code, { primaryD: d, viewBox })
    }
    return map
  }, [geojson, gemeenten])

  const silhouettes = useMemo<SilhouetteGemeente[]>(
    () =>
      gemeenten
        .map((summary) => ({
          summary,
          svgData: svgByCode.get(summary.gemeente_code) ?? null,
        }))
        .sort((a, b) =>
          a.summary.gemeente_naam.localeCompare(b.summary.gemeente_naam, 'nl'),
        ),
    [gemeenten, svgByCode],
  )

  return (
    <div className="space-y-8" data-component="scope-hub">
      {/* ── LANDELIJK ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <GroupLabel>Landelijk</GroupLabel>
        {scopesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Scopes laden…
          </div>
        ) : landelijk ? (
          <button
            type="button"
            onClick={() =>
              setSelected({
                entityType: 'landelijk',
                entityCode: landelijk.entity_code,
                entityNaam: landelijk.entity_naam,
              })
            }
            className="group flex w-full max-w-md items-center gap-4 rounded-[20px] border border-[#EAEFEF] bg-white p-5 text-left transition-all hover:border-[#F9A826]/50 hover:shadow-sm"
            data-entity-type="landelijk"
            data-entity-code={landelijk.entity_code}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#0E1111] transition-colors">
              <Landmark
                size={22}
                strokeWidth={1.5}
                className="text-[#F9A826]"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold tracking-tight text-[#0E1111]">
                {landelijk.entity_naam}
              </span>
              <span className="mt-0.5 block text-[12px] text-slate-500">
                Rijksbeleid &amp; nationale databronnen
              </span>
            </span>
          </button>
        ) : (
          <p className="text-[12px] text-slate-400">Geen landelijke scope.</p>
        )}
      </section>

      {/* ── PROVINCIE ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <GroupLabel>Provincie</GroupLabel>
        {scopesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Provincies laden…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {provincies.map((p) => (
              <button
                key={p.entity_code}
                type="button"
                onClick={() =>
                  setSelected({
                    entityType: 'provincie',
                    entityCode: p.entity_code,
                    entityNaam: p.entity_naam,
                  })
                }
                className="group flex items-center gap-2.5 rounded-[16px] border border-[#EAEFEF] bg-white px-4 py-3 text-left transition-all hover:border-[#F9A826]/50 hover:shadow-sm"
                data-entity-type="provincie"
                data-entity-code={p.entity_code}
              >
                <Building2
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-slate-400 transition-colors group-hover:text-[#F9A826]"
                />
                <span className="truncate text-[13px] font-semibold text-[#0E1111]">
                  {p.entity_naam}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── GEMEENTE ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <GroupLabel>Gemeente</GroupLabel>
        {gemeentenQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Gemeenten laden…
          </div>
        ) : silhouettes.length === 0 ? (
          <p className="text-[12px] text-slate-400">
            Nog geen gemeenten gemonitord.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {silhouettes.map(({ summary, svgData }) => (
              <button
                key={summary.gemeente_code}
                type="button"
                onClick={() =>
                  setSelected({
                    entityType: 'gemeente',
                    entityCode: summary.gemeente_code,
                    entityNaam: summary.gemeente_naam,
                  })
                }
                className="group flex flex-col overflow-hidden rounded-[16px] border border-[#EAEFEF] bg-white text-left transition-all hover:border-[#F9A826]/50 hover:shadow-sm"
                data-entity-type="gemeente"
                data-entity-code={summary.gemeente_code}
              >
                {/* Silhouette */}
                <div className="relative aspect-[4/3] border-b border-[#EAEFEF] bg-[#F2F6F3]">
                  <span
                    className={`absolute right-2.5 top-2.5 size-2 rounded-full ${dotColor(summary)}`}
                    aria-hidden
                  />
                  {svgData ? (
                    <svg
                      viewBox={svgData.viewBox}
                      className="h-full w-full"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <path
                        d={svgData.primaryD}
                        fill="#F9A826"
                        fillOpacity={0.14}
                        stroke="#F9A826"
                        strokeWidth={1}
                        strokeLinejoin="round"
                        className="transition-all duration-200 group-hover:fill-opacity-25"
                      />
                    </svg>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      {geojsonLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <MapPin size={20} strokeWidth={1.5} />
                      )}
                    </div>
                  )}
                </div>
                {/* Label */}
                <div className="px-3 py-2.5">
                  <span
                    className="block truncate text-[13px] font-semibold text-[#0E1111]"
                    title={summary.gemeente_naam}
                  >
                    {summary.gemeente_naam}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {summary.total_sources} bronnen
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <ScopeDetailModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        entityType={selected?.entityType ?? null}
        entityCode={selected?.entityCode ?? null}
        entityNaam={selected?.entityNaam}
      />
    </div>
  )
}
