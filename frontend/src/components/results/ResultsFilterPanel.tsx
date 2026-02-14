import { useState, useEffect } from 'react'
import type { ScanResultsFilters } from '@/lib/types/scan'

interface ResultsFilterPanelProps {
  filters: ScanResultsFilters
  onChange: (filters: ScanResultsFilters) => void
  total: number
}

export default function ResultsFilterPanel({
  filters,
  onChange,
  total,
}: ResultsFilterPanelProps) {
  // Local state for debounced area input
  const [localMinArea, setLocalMinArea] = useState(
    filters.min_area_m2?.toString() ?? ''
  )

  // Debounce area input (500ms delay)
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

  const hasActiveFilters =
    filters.bestemming_type ||
    filters.has_pand !== undefined ||
    filters.min_area_m2 ||
    filters.score_category

  const handleClearFilters = () => {
    setLocalMinArea('')
    onChange({
      // Preserve sort and pagination
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
      offset: filters.offset,
      limit: filters.limit,
    })
  }

  return (
    <div className="bg-white/5 border-b border-white/10 px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        {/* Bestemming type dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="bestemming-filter"
            className="text-white/60 text-sm font-medium"
          >
            Bestemming
          </label>
          <select
            id="bestemming-filter"
            value={filters.bestemming_type ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                bestemming_type: e.target.value || undefined,
              })
            }
            className="bg-black/40 border border-white/15 text-white/80 text-sm rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
          </select>
        </div>

        {/* Vacant land toggle */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="vacant-filter"
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              id="vacant-filter"
              type="checkbox"
              checked={filters.has_pand === false}
              onChange={(e) =>
                onChange({
                  ...filters,
                  has_pand: e.target.checked ? false : undefined,
                })
              }
              className="w-4 h-4 rounded border-white/15 bg-black/40 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-0"
            />
            <span className="text-white/60 text-sm font-medium">
              Onbebouwd
            </span>
          </label>
        </div>

        {/* Min area input */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="area-filter"
            className="text-white/60 text-sm font-medium"
          >
            Min. opp. (m²)
          </label>
          <input
            id="area-filter"
            type="number"
            value={localMinArea}
            onChange={(e) => setLocalMinArea(e.target.value)}
            placeholder="0"
            className="w-20 bg-black/40 border border-white/15 text-white/80 text-sm rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {/* Score category dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="score-filter"
            className="text-white/60 text-sm font-medium"
          >
            Score
          </label>
          <select
            id="score-filter"
            value={filters.score_category ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                score_category: e.target.value || undefined,
              })
            }
            className="bg-black/40 border border-white/15 text-white/80 text-sm rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">Alle</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-white/50 hover:text-white/80 text-xs underline transition-colors"
          >
            Wis filters
          </button>
        )}

        {/* Results count badge (right-aligned) */}
        <div className="ml-auto">
          <span className="text-white/50 text-xs">
            {total.toLocaleString('nl-NL')} resultaten
          </span>
        </div>
      </div>
    </div>
  )
}
