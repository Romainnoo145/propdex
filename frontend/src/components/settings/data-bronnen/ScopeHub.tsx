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

/** One uniform scope card — landelijk · provincie · gemeente. */
function ScopeCard({
  naam,
  entityType,
  entityCode,
  active,
  hasData,
  statusDot,
  onClick,
}: {
  naam: string
  entityType: EntityType
  entityCode: string
  active: boolean
  hasData: boolean
  statusDot?: string
  onClick: () => void
}) {
  const initial = naam.trim().charAt(0).toUpperCase()
  return (
    <button
      type="button"
      onClick={onClick}
      title={naam}
      data-entity-type={entityType}
      data-entity-code={entityCode}
      data-active={active ? 'true' : 'false'}
      className={[
        'group relative flex items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md hover:border-[#F9A826]/60',
        active
          ? 'border-[#0E1111]/40 shadow-sm ring-2 ring-[#0E1111]/5'
          : hasData
            ? 'border-[#F9A826]/40 bg-gradient-to-br from-[#FFF8EE] to-white'
            : 'border-[#EAEFEF] bg-white',
      ].join(' ')}
    >
      {/* Monogram chip */}
      <span
        className={[
          'grid size-9 shrink-0 place-items-center rounded-[11px] text-[14px] font-bold',
          hasData ? 'bg-[#F9A826]/15 text-[#B45309]' : 'bg-[#F2F6F3] text-slate-400',
        ].join(' ')}
      >
        {initial}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-[#0E1111]">
            {naam}
          </span>
          {statusDot && (
            <span className={`size-1.5 shrink-0 rounded-full ${statusDot}`} aria-hidden />
          )}
        </span>
        <span className="block text-[11px] text-slate-400">
          {hasData ? 'Bronnen beschikbaar' : 'Geen bronnen'}
        </span>
      </span>
    </button>
  )
}

export function ScopeHub() {
  const scopesQuery = useScopes()
  const gemeentenQuery = useGemeentenSummary()
  const geojsonQuery = useGemeenteGeoJSON()

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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <ScopeCard
                naam={landelijk.entity_naam}
                entityType="landelijk"
                entityCode={landelijk.entity_code}
                hasData={false}
                active={
                  selected?.entityType === 'landelijk' &&
                  selected.entityCode === landelijk.entity_code
                }
                onClick={() =>
                  setSelected({
                    entityType: 'landelijk',
                    entityCode: landelijk.entity_code,
                    entityNaam: landelijk.entity_naam,
                  })
                }
              />
            </div>
          </section>
        ) : null}

        {/* ── PROVINCIE ───────────────────────────────────────────── */}
        {!scopesQuery.isLoading && provinciesVisible.length > 0 && (
          <section className="space-y-3">
            <GroupLabel count={provinciesVisible.length}>Provincie</GroupLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {provinciesVisible.map((p) => (
                <ScopeCard
                  key={p.entity_code}
                  naam={p.entity_naam}
                  entityType="provincie"
                  entityCode={p.entity_code}
                  hasData={false}
                  active={
                    selected?.entityType === 'provincie' &&
                    selected.entityCode === p.entity_code
                  }
                  onClick={() =>
                    setSelected({
                      entityType: 'provincie',
                      entityCode: p.entity_code,
                      entityNaam: p.entity_naam,
                    })
                  }
                />
              ))}
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
