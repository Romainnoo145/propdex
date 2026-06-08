/**
 * ScopeHub — beleid-style hero for the data-bronnen hub (M053/S05).
 *
 * Clicking any scope opens its bronnen in a LeftPanelShell — the same shell the
 * map's parcel/gemeente panels use. It portals into the layout's left panel slot
 * (leftPanelPortalRef) and setLeftPanelOpen shrinks <main>, so this page gets the
 * exact Dynamic Split-Canvas behaviour as the map.
 *
 * One UNIFORM card across all three levels (Landelijk · Provincie · Gemeente).
 * ALL ~340 gemeenten are listed (from the CBS geojson); only the monitored ones
 * (those in useGemeentenSummary, e.g. Venlo) carry data — those cards POP in amber
 * with a status dot, the rest are quiet white. A monogram chip gives the dense grid
 * visual rhythm without silhouettes. A top search bar live-filters by name.
 *
 * Aura tokens (DESIGN.md): Plus Jakarta Sans, Warm Amber #F9A826 as the only
 * decorative accent (marks where intelligence sits), Obsidian #0E1111 for text.
 */
import { useMemo, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'

import { useScopes, useGemeentenSummary } from '@/lib/queries/data-sources-admin'
import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'
import { useProvincieGeoJSON } from '@/hooks/useProvincieGeoJSON'
import { geoJsonToSvgPath } from '@/lib/geo-utils'
import type {
  EntityType,
  GemeenteSummary,
} from '@/lib/types/data-sources-admin'
import { LeftPanelShell } from '@/components/map/panels/LeftPanelShell'
import { GemeenteCard } from '@/components/projects/GemeenteCard'
import { ScopeDataSourcesView } from '@/components/settings/data-bronnen/ScopeDataSourcesView'

interface GemeenteEntry {
  code: string
  naam: string
  svgData: { primaryD: string; viewBox: string }
}

interface SelectedScope {
  entityType: EntityType
  entityCode: string
  entityNaam: string
}

function GroupLabel({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {children}
      </span>
      <span className="text-[11px] font-semibold text-slate-300">{count}</span>
    </div>
  )
}

export function ScopeHub() {
  const scopesQuery = useScopes()
  const gemeentenQuery = useGemeentenSummary()
  const geojsonQuery = useGemeenteGeoJSON()
  const provincieGeojsonQuery = useProvincieGeoJSON()

  const [selected, setSelected] = useState<SelectedScope | null>(null)
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const match = (naam: string) =>
    needle === '' || naam.toLowerCase().includes(needle)

  const scopes = scopesQuery.data ?? []
  const landelijk = scopes.find((s) => s.entity_type === 'landelijk') ?? null
  const provincies = scopes.filter((s) => s.entity_type === 'provincie')

  // Monitored gemeenten (those with real data) keyed by code, for status + pop.
  const summaryByCode = useMemo(() => {
    const m = new Map<string, GemeenteSummary>()
    for (const g of gemeentenQuery.data ?? []) m.set(g.gemeente_code, g)
    return m
  }, [gemeentenQuery.data])

  // ALL ~340 gemeenten from the CBS geojson with their SVG silhouette (the same
  // images as the beleid grid — geoJsonToSvgPath), sorted by name. Memoized (heavy).
  const allGemeenten = useMemo<GemeenteEntry[]>(() => {
    const feats = geojsonQuery.data?.features ?? []
    return feats
      .map((f) => {
        const p = (f.properties ?? {}) as Record<string, unknown>
        const code = String(p.statcode ?? '')
        const naam = String(p.statnaam ?? '')
        const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | null
        if (
          !code ||
          !naam ||
          !geom ||
          (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')
        ) {
          return null
        }
        const { d, viewBox } = geoJsonToSvgPath(geom)
        return { code, naam, svgData: { primaryD: d, viewBox } }
      })
      .filter((g): g is GemeenteEntry => g !== null)
      .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'))
  }, [geojsonQuery.data])

  // Province silhouettes keyed by statcode (PV..) — same images as the map's province layer.
  const provincieSvgByCode = useMemo(() => {
    const m = new Map<string, { primaryD: string; viewBox: string }>()
    for (const f of provincieGeojsonQuery.data?.features ?? []) {
      const p = (f.properties ?? {}) as Record<string, unknown>
      const code = String(p.statcode ?? '')
      const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | null
      if (!code || !geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) continue
      const { d, viewBox } = geoJsonToSvgPath(geom)
      m.set(code, { primaryD: d, viewBox })
    }
    return m
  }, [provincieGeojsonQuery.data])

  // Landelijk silhouette = all provinces merged into one MultiPolygon (the NL outline).
  const landelijkSvg = useMemo(() => {
    const coords: GeoJSON.Position[][][] = []
    for (const f of provincieGeojsonQuery.data?.features ?? []) {
      const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | null
      if (!g) continue
      if (g.type === 'Polygon') coords.push(g.coordinates)
      else if (g.type === 'MultiPolygon') coords.push(...g.coordinates)
    }
    if (coords.length === 0) return null
    const { d, viewBox } = geoJsonToSvgPath({ type: 'MultiPolygon', coordinates: coords })
    return { primaryD: d, viewBox }
  }, [provincieGeojsonQuery.data])

  // Filtered groups.
  const landelijkVisible = landelijk && match(landelijk.entity_naam)
  const provinciesVisible = provincies.filter((p) => match(p.entity_naam))
  const gemeentenVisible = allGemeenten.filter((g) => match(g.naam))

  return (
    <div className="space-y-6" data-component="scope-hub">
      {/* The detail panel portals into the layout's left slot (LeftPanelShell →
          leftPanelPortalRef) and setLeftPanelOpen shrinks <main> — the exact
          Dynamic Split-Canvas the map's parcel/gemeente panels use. */}
      {selected && (
        <LeftPanelShell onClose={() => setSelected(null)}>
          <div className="px-8 pt-12 pb-8">
            <ScopeDataSourcesView
              entityType={selected.entityType}
              entityCode={selected.entityCode}
            />
          </div>
        </LeftPanelShell>
      )}

      <div className="min-w-0 space-y-6">
        {/* ── SEARCH ──────────────────────────────────────────────── */}
        <div className="relative max-w-md">
          <Search
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek scope…"
            aria-label="Zoek scope"
            className="w-full rounded-full border border-[#EAEFEF] bg-white py-2.5 pl-10 pr-4 text-[13px] text-[#0E1111] placeholder:text-slate-400 focus:border-[#F9A826]/60 focus:outline-none"
          />
        </div>

        {/* ── LANDELIJK ───────────────────────────────────────────── */}
        {scopesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Scopes laden…
          </div>
        ) : landelijkVisible && landelijk ? (
          <section className="space-y-3">
            <GroupLabel count={1}>Landelijk</GroupLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <div
                className={
                  selected?.entityType === 'landelijk' &&
                  selected.entityCode === landelijk.entity_code
                    ? 'rounded-xl ring-2 ring-[#0E1111]/40'
                    : undefined
                }
              >
                <GemeenteCard
                  gemeenteName={landelijk.entity_naam}
                  gemeenteCode={landelijk.entity_code}
                  svgData={landelijkSvg}
                  totalUnread={0}
                  onClick={() =>
                    setSelected({
                      entityType: 'landelijk',
                      entityCode: landelijk.entity_code,
                      entityNaam: landelijk.entity_naam,
                    })
                  }
                />
              </div>
            </div>
          </section>
        ) : null}

        {/* ── PROVINCIE ───────────────────────────────────────────── */}
        {!scopesQuery.isLoading && provinciesVisible.length > 0 && (
          <section className="space-y-3">
            <GroupLabel count={provinciesVisible.length}>Provincie</GroupLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {provinciesVisible.map((p) => {
                const isActive =
                  selected?.entityType === 'provincie' &&
                  selected.entityCode === p.entity_code
                return (
                  <div
                    key={p.entity_code}
                    className={isActive ? 'rounded-xl ring-2 ring-[#0E1111]/40' : undefined}
                  >
                    <GemeenteCard
                      gemeenteName={p.entity_naam}
                      gemeenteCode={p.entity_code}
                      svgData={provincieSvgByCode.get(p.entity_code) ?? null}
                      totalUnread={0}
                      onClick={() =>
                        setSelected({
                          entityType: 'provincie',
                          entityCode: p.entity_code,
                          entityNaam: p.entity_naam,
                        })
                      }
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── GEMEENTE ────────────────────────────────────────────── */}
        {geojsonQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Gemeenten laden…
          </div>
        ) : gemeentenVisible.length > 0 ? (
          <section className="space-y-3">
            <GroupLabel count={gemeentenVisible.length}>Gemeente</GroupLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {gemeentenVisible.map((g) => {
                const summary = summaryByCode.get(g.code)
                const isActive =
                  selected?.entityType === 'gemeente' &&
                  selected.entityCode === g.code
                // Monitored gemeenten (real data) get an amber ring so they pop
                // among the ~340; the selected one gets an obsidian ring.
                const ring = isActive
                  ? 'rounded-xl ring-2 ring-[#0E1111]/40'
                  : summary
                    ? 'rounded-xl ring-2 ring-[#F9A826]/50'
                    : undefined
                return (
                  <div key={g.code} className={ring}>
                    <GemeenteCard
                      gemeenteName={g.naam}
                      gemeenteCode={g.code}
                      svgData={g.svgData}
                      totalUnread={0}
                      onClick={() =>
                        setSelected({
                          entityType: 'gemeente',
                          entityCode: g.code,
                          entityNaam: g.naam,
                        })
                      }
                    />
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
