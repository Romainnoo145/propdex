/**
 * ScopeHub — beleid-style hero for the data-bronnen hub (M053/S05).
 *
 * Split-canvas layout: clicking any scope slides a 620px ScopeDetailPanel in on
 * the LEFT (the app's signature Dynamic Split-Canvas) while the hub content to
 * the right reflows/shrinks. One UNIFORM card design across all three levels
 * (Landelijk · Provincie · Gemeente) — solid white cards on the Morning-Mist
 * page, with only the gemeente cards carrying a status dot (groen all-live /
 * amber any-missing / rood any-broken — mirrors GemeentePicker.dotColor). No
 * silhouettes, no big icons. A top search bar live-filters all scopes by name.
 *
 * Aura tokens (DESIGN.md): Plus Jakarta Sans, Warm Amber #F9A826 as the only
 * decorative accent, Obsidian #0E1111 for text. Minimal Calm Intelligence.
 */
import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, Loader2 } from 'lucide-react'

import { useScopes, useGemeentenSummary } from '@/lib/queries/data-sources-admin'
import type {
  EntityType,
  GemeenteSummary,
} from '@/lib/types/data-sources-admin'
import { ScopeDetailPanel } from '@/components/settings/data-bronnen/ScopeDetailPanel'

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

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  )
}

/** One uniform scope card, used for landelijk · provincie · gemeente. */
function ScopeCard({
  naam,
  entityType,
  entityCode,
  active,
  dot,
  onClick,
}: {
  naam: string
  entityType: EntityType
  entityCode: string
  active: boolean
  dot?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={naam}
      className={`group flex items-center gap-2 rounded-[16px] border bg-white px-4 py-3 text-left transition-all hover:border-[#F9A826]/50 hover:shadow-sm ${
        active
          ? 'border-[#0E1111]/40 shadow-sm'
          : 'border-[#EAEFEF]'
      }`}
      data-entity-type={entityType}
      data-entity-code={entityCode}
      data-active={active ? 'true' : 'false'}
    >
      {dot && (
        <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      )}
      <span className="truncate text-[13px] font-semibold text-[#0E1111]">
        {naam}
      </span>
    </button>
  )
}

export function ScopeHub() {
  const scopesQuery = useScopes()
  const gemeentenQuery = useGemeentenSummary()

  const [selected, setSelected] = useState<SelectedScope | null>(null)
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const match = (naam: string) =>
    needle === '' || naam.toLowerCase().includes(needle)

  const scopes = scopesQuery.data ?? []
  const landelijk = scopes.find((s) => s.entity_type === 'landelijk') ?? null
  const provincies = scopes.filter((s) => s.entity_type === 'provincie')
  const gemeenten = gemeentenQuery.data

  const sortedGemeenten = useMemo(
    () =>
      [...(gemeenten ?? [])].sort((a, b) =>
        a.gemeente_naam.localeCompare(b.gemeente_naam, 'nl'),
      ),
    [gemeenten],
  )

  // Filtered groups (used both to render and to decide whether to show headers).
  const landelijkVisible = landelijk && match(landelijk.entity_naam)
  const provinciesVisible = provincies.filter((p) => match(p.entity_naam))
  const gemeentenVisible = sortedGemeenten.filter((g) =>
    match(g.gemeente_naam),
  )

  return (
    <div className="flex items-start gap-4" data-component="scope-hub">
      <AnimatePresence>
        {selected && (
          <ScopeDetailPanel
            key="scope-panel"
            open
            onClose={() => setSelected(null)}
            entityType={selected.entityType}
            entityCode={selected.entityCode}
            entityNaam={selected.entityNaam}
          />
        )}
      </AnimatePresence>

      <div className="min-w-0 flex-1 space-y-6">
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
        ) : landelijkVisible ? (
          <section className="space-y-3">
            <GroupLabel>Landelijk</GroupLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <ScopeCard
                naam={landelijk.entity_naam}
                entityType="landelijk"
                entityCode={landelijk.entity_code}
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
            <GroupLabel>Provincie</GroupLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {provinciesVisible.map((p) => (
                <ScopeCard
                  key={p.entity_code}
                  naam={p.entity_naam}
                  entityType="provincie"
                  entityCode={p.entity_code}
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
        {gemeentenQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Gemeenten laden…
          </div>
        ) : gemeentenVisible.length > 0 ? (
          <section className="space-y-3">
            <GroupLabel>Gemeente</GroupLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gemeentenVisible.map((summary) => (
                <ScopeCard
                  key={summary.gemeente_code}
                  naam={summary.gemeente_naam}
                  entityType="gemeente"
                  entityCode={summary.gemeente_code}
                  dot={dotColor(summary)}
                  active={
                    selected?.entityType === 'gemeente' &&
                    selected.entityCode === summary.gemeente_code
                  }
                  onClick={() =>
                    setSelected({
                      entityType: 'gemeente',
                      entityCode: summary.gemeente_code,
                      entityNaam: summary.gemeente_naam,
                    })
                  }
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
