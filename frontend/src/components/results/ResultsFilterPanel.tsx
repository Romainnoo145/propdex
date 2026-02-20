import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import type { ScanResultsFilters } from '@/lib/types/scan'

interface ResultsFilterPanelProps {
  filters: ScanResultsFilters
  onChange: (filters: Partial<ScanResultsFilters>) => void
  total: number
}

// Pill button for discrete filter options
function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
        active
          ? 'border-amber-accent/40 bg-amber-accent/10 text-amber-accent'
          : 'border-white/5 bg-grey-900 text-grey-400 hover:border-white/10 hover:text-grey-300'
      }`}
    >
      {label}
    </button>
  )
}

// Compact inline select for filter dropdowns
function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  const hasValue = value !== ''
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-xs text-grey-500 whitespace-nowrap">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-full text-xs font-medium px-3 py-1.5 pr-6 border transition-colors bg-no-repeat cursor-pointer ${
          hasValue
            ? 'border-amber-accent/40 bg-amber-accent/10 text-amber-accent'
            : 'border-white/5 bg-grey-900 text-grey-400 hover:border-white/10'
        }`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.35rem center',
          backgroundSize: '1rem 1rem',
        }}
      >
        {children}
      </select>
    </div>
  )
}

export default function ResultsFilterPanel({
  filters,
  onChange,
  total,
}: ResultsFilterPanelProps) {
  // Local state for debounced area inputs
  const [localMinArea, setLocalMinArea] = useState(
    filters.min_area_m2?.toString() ?? ''
  )
  const [localMaxArea, setLocalMaxArea] = useState(
    filters.max_area_m2?.toString() ?? ''
  )

  // Sync local area state when URL-derived filter changes (e.g. clear all)
  useEffect(() => {
    setLocalMinArea(filters.min_area_m2?.toString() ?? '')
  }, [filters.min_area_m2])

  useEffect(() => {
    setLocalMaxArea(filters.max_area_m2?.toString() ?? '')
  }, [filters.max_area_m2])

  // Debounce min area input (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = localMinArea ? Number(localMinArea) : undefined
      if (value !== filters.min_area_m2) {
        onChange({ ...filters, min_area_m2: value })
      }
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMinArea])

  // Debounce max area input (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = localMaxArea ? Number(localMaxArea) : undefined
      if (value !== filters.max_area_m2) {
        onChange({ ...filters, max_area_m2: value })
      }
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMaxArea])

  const hasActiveFilters =
    filters.bestemming_type ||
    filters.pand_status ||
    filters.min_area_m2 ||
    filters.max_area_m2 ||
    filters.score_category

  const handleClearFilters = () => {
    setLocalMinArea('')
    setLocalMaxArea('')
    onChange({
      bestemming_type: undefined,
      pand_status: undefined,
      min_area_m2: undefined,
      max_area_m2: undefined,
      score_category: undefined,
    })
    toast.info('Filters gewist', { duration: 2000 })
  }

  const handleScoreToggle = (cat: string) => {
    onChange({
      ...filters,
      score_category: filters.score_category === cat ? undefined : cat,
    })
  }

  return (
    <div className="border-b border-white/5 bg-grey-900 px-5 py-3">
      {/* Single horizontal row of filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Score pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-grey-500 mr-0.5">Score</span>
          <FilterPill
            label="Hoog"
            active={filters.score_category === 'High'}
            onClick={() => handleScoreToggle('High')}
          />
          <FilterPill
            label="Midden"
            active={filters.score_category === 'Medium'}
            onClick={() => handleScoreToggle('Medium')}
          />
          <FilterPill
            label="Laag"
            active={filters.score_category === 'Low'}
            onClick={() => handleScoreToggle('Low')}
          />
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/5 hidden md:block" />

        {/* Bestemming dropdown */}
        <FilterSelect
          id="bestemming-filter"
          label="Bestemming"
          value={filters.bestemming_type ?? ''}
          onChange={(v) => {
            onChange({ ...filters, bestemming_type: v || undefined })
          }}
        >
          <option value="">Alle</option>
          <option value="Wonen">Wonen</option>
          <option value="Bedrijven">Bedrijven</option>
          <option value="Gemengd">Gemengd</option>
          <option value="Maatschappelijk">Maatschappelijk</option>
          <option value="Agrarisch">Agrarisch</option>
          <option value="Groen">Groen</option>
          <option value="Verkeer">Verkeer</option>
          <option value="Water">Water</option>
        </FilterSelect>

        {/* Status dropdown */}
        <FilterSelect
          id="status-filter"
          label="Status"
          value={filters.pand_status ?? ''}
          onChange={(v) => {
            onChange({ ...filters, pand_status: v || undefined })
          }}
        >
          <option value="">Alle</option>
          <option value="niet in gebruik">Niet in gebruik</option>
          <option value="sloop">Sloopvergunning</option>
          <option value="buiten gebruik">Buiten gebruik</option>
          <option value="bouwvergunning">Bouwvergunning</option>
        </FilterSelect>

        {/* Divider */}
        <div className="h-5 w-px bg-white/5 hidden md:block" />

        {/* Area range — compact inline inputs */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-grey-500">m²</span>
          <input
            id="area-min-filter"
            type="number"
            value={localMinArea}
            onChange={(e) => setLocalMinArea(e.target.value)}
            placeholder="min"
            className={`w-16 rounded-full text-xs font-medium px-3 py-1.5 border transition-colors tabular-nums text-center ${
              localMinArea
                ? 'border-amber-accent/40 bg-amber-accent/10 text-amber-accent'
                : 'border-white/5 bg-grey-900 text-grey-400 placeholder:text-grey-600'
            } focus:outline-none focus:border-amber-accent/50`}
          />
          <span className="text-grey-600 text-xs">–</span>
          <input
            id="area-max-filter"
            type="number"
            value={localMaxArea}
            onChange={(e) => setLocalMaxArea(e.target.value)}
            placeholder="max"
            className={`w-16 rounded-full text-xs font-medium px-3 py-1.5 border transition-colors tabular-nums text-center ${
              localMaxArea
                ? 'border-amber-accent/40 bg-amber-accent/10 text-amber-accent'
                : 'border-white/5 bg-grey-900 text-grey-400 placeholder:text-grey-600'
            } focus:outline-none focus:border-amber-accent/50`}
          />
        </div>

        {/* Spacer + right-aligned meta */}
        <div className="ml-auto flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-xs text-grey-500 hover:text-grey-300 transition-colors"
            >
              <X size={12} />
              Wis
            </button>
          )}
          <span className="text-xs text-grey-600 tabular-nums">
            {total.toLocaleString('nl-NL')} resultaten
          </span>
        </div>
      </div>
    </div>
  )
}
