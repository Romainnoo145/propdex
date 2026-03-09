import { X } from 'lucide-react'
import type { ExplorerFilters, FacetItem } from '@/hooks/useExplorer'

/** Dutch display labels for rechtsgrond keys */
const RECHTSGROND_LABELS: Record<string, string> = {
  procedurefout: 'Procedurefout',
  motiveringsgebrek: 'Motiveringsgebrek',
  gelijkheidsbeginsel: 'Gelijkheidsbeginsel',
  disproportioneel: 'Disproportioneel',
  etfal_ruimtelijke_ordening: 'ETFAL / Ruimtelijke ordening',
}

/** Periode options with display labels */
const PERIODE_OPTIONS = [
  { value: '1jaar', label: 'Afgelopen jaar' },
  { value: '3jaar', label: 'Afgelopen 3 jaar' },
  { value: '5jaar', label: 'Afgelopen 5 jaar' },
  { value: 'alles', label: 'Alles' },
] as const

interface ExplorerFilterSidebarProps {
  facets: {
    gemeente: FacetItem[]
    vergunningstype: FacetItem[]
    uitkomst: FacetItem[]
    rechtsgrond: FacetItem[]
    rechtbank_niveau: FacetItem[]
  } | null
  activeFilters: ExplorerFilters
  onFilterChange: (dimension: keyof ExplorerFilters, value: string | undefined) => void
  className?: string
}

export default function ExplorerFilterSidebar({
  facets,
  activeFilters,
  onFilterChange,
  className = '',
}: ExplorerFilterSidebarProps) {
  const hasAnyFilter = Object.values(activeFilters).some(Boolean)

  return (
    <aside className={`w-72 shrink-0 overflow-y-auto border-r border-grey-800 bg-grey-900 p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-grey-100">Filters</h2>
        {hasAnyFilter && (
          <button
            onClick={() => {
              for (const key of Object.keys(activeFilters) as (keyof ExplorerFilters)[]) {
                onFilterChange(key, undefined)
              }
            }}
            className="flex items-center gap-1 text-xs text-grey-400 transition-colors hover:text-grey-100"
          >
            <X size={12} />
            Wis filters
          </button>
        )}
      </div>

      {/* Gemeente dropdown */}
      <FilterSection label="Gemeente">
        <select
          value={activeFilters.gemeente ?? ''}
          onChange={(e) => onFilterChange('gemeente', e.target.value || undefined)}
          className="w-full rounded-md border border-grey-700 bg-grey-850 px-2 py-1.5 text-sm text-grey-100 focus:border-amber-accent focus:outline-none"
        >
          <option value="">Alle gemeenten</option>
          {facets?.gemeente.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value} ({f.count})
            </option>
          ))}
        </select>
      </FilterSection>

      {/* Vergunningstype checkboxes */}
      <FilterSection label="Vergunningstype">
        <CheckboxList
          items={facets?.vergunningstype ?? []}
          selected={activeFilters.vergunningstype}
          onSelect={(v) => onFilterChange('vergunningstype', v)}
        />
      </FilterSection>

      {/* Uitkomst checkboxes */}
      <FilterSection label="Uitkomst">
        <CheckboxList
          items={facets?.uitkomst ?? []}
          selected={activeFilters.uitkomst}
          onSelect={(v) => onFilterChange('uitkomst', v)}
        />
      </FilterSection>

      {/* Rechtsgrond checkboxes */}
      <FilterSection label="Rechtsgrond">
        <CheckboxList
          items={facets?.rechtsgrond ?? []}
          selected={activeFilters.rechtsgrond}
          onSelect={(v) => onFilterChange('rechtsgrond', v)}
          labelFn={(val) => RECHTSGROND_LABELS[val] ?? val}
        />
      </FilterSection>

      {/* Rechtbank-niveau checkboxes */}
      <FilterSection label="Rechtbank-niveau">
        <CheckboxList
          items={facets?.rechtbank_niveau ?? []}
          selected={activeFilters.rechtbank_niveau}
          onSelect={(v) => onFilterChange('rechtbank_niveau', v)}
        />
      </FilterSection>

      {/* Tijdsperiode radio buttons */}
      <FilterSection label="Tijdsperiode">
        <div className="flex flex-col gap-1.5">
          {PERIODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-sm text-grey-300 hover:text-grey-100"
            >
              <input
                type="radio"
                name="periode"
                checked={
                  opt.value === 'alles'
                    ? !activeFilters.periode || activeFilters.periode === 'alles'
                    : activeFilters.periode === opt.value
                }
                onChange={() =>
                  onFilterChange('periode', opt.value === 'alles' ? undefined : opt.value)
                }
                className="accent-amber-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </FilterSection>
    </aside>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-grey-400">
        {label}
      </h3>
      {children}
    </div>
  )
}

function CheckboxList({
  items,
  selected,
  onSelect,
  labelFn,
}: {
  items: FacetItem[]
  selected: string | undefined
  onSelect: (value: string | undefined) => void
  labelFn?: (value: string) => string
}) {
  if (items.length === 0) {
    return <p className="text-xs text-grey-500">Geen opties</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <label
          key={item.value}
          className="flex cursor-pointer items-center gap-2 text-sm text-grey-300 hover:text-grey-100"
        >
          <input
            type="checkbox"
            checked={selected === item.value}
            onChange={() =>
              onSelect(selected === item.value ? undefined : item.value)
            }
            className="accent-amber-500"
          />
          <span className="flex-1 truncate">
            {labelFn ? labelFn(item.value) : item.value}
          </span>
          <span className="shrink-0 text-xs text-grey-500">({item.count})</span>
        </label>
      ))}
    </div>
  )
}
