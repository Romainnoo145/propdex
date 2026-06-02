/**
 * ScopePicker — scope-consolidation (M049 follow-up).
 *
 * Top-level scope switcher for the data-bronnen hub. Two rows:
 *   1. Landelijk + each Provincie (from useScopes) — type-A document scopes.
 *   2. Gemeente — full A/B/C catalog, reuses the existing GemeentePicker.
 *
 * Active scope is highlighted (obsidian pill). Glass surface per DESIGN.md.
 * Navigation targets the generalized $entityType/$entityCode route.
 */
import { Loader2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useScopes, useGemeentenSummary } from '@/lib/queries/data-sources-admin'
import type { EntityType } from '@/lib/types/data-sources-admin'
import { GemeentePicker } from '@/components/settings/data-bronnen/GemeentePicker'

interface Props {
  /** Currently-active scope, if a scope route is mounted. */
  activeEntityType?: EntityType
  activeEntityCode?: string
}

function pillClass(isActive: boolean): string {
  return [
    'shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors',
    isActive
      ? 'bg-[#0E1111] text-white'
      : 'bg-white/60 text-slate-600 hover:bg-white/80',
  ].join(' ')
}

export function ScopePicker({ activeEntityType, activeEntityCode }: Props) {
  const scopesQuery = useScopes()
  const gemeentenQuery = useGemeentenSummary()

  const scopes = scopesQuery.data ?? []
  const landelijk = scopes.filter((s) => s.entity_type === 'landelijk')
  const provincies = scopes.filter((s) => s.entity_type === 'provincie')

  return (
    <div
      className="space-y-3 rounded-2xl bg-white/60 backdrop-blur-[24px] border border-white/20 p-3"
      data-component="scope-picker"
    >
      {/* Row 1 — Landelijk + Provincies */}
      <div className="space-y-2">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Landelijk &amp; Provincie
        </span>
        {scopesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Scopes laden…
          </div>
        ) : (
          <nav
            className="flex flex-wrap gap-1.5"
            aria-label="Landelijk en provincie scope"
          >
            {[...landelijk, ...provincies].map((s) => {
              const isActive =
                activeEntityType === s.entity_type &&
                activeEntityCode === s.entity_code
              return (
                <Link
                  key={`${s.entity_type}-${s.entity_code}`}
                  to="/instellingen/data-bronnen/$entityType/$entityCode"
                  params={{ entityType: s.entity_type, entityCode: s.entity_code }}
                  className={pillClass(isActive)}
                  data-entity-type={s.entity_type}
                  data-entity-code={s.entity_code}
                  data-active={isActive ? 'true' : 'false'}
                >
                  {s.entity_naam}
                </Link>
              )
            })}
          </nav>
        )}
      </div>

      {/* Row 2 — Gemeente */}
      {gemeentenQuery.data && gemeentenQuery.data.length > 0 && (
        <div className="space-y-2">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Gemeente
          </span>
          <GemeentePicker
            gemeenten={gemeentenQuery.data}
            activeGemeenteCode={
              activeEntityType === 'gemeente' ? (activeEntityCode ?? '') : ''
            }
          />
        </div>
      )}
    </div>
  )
}
