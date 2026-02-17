import { useState, useEffect } from 'react'
import { Select } from '@/components/primitives'
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
    filters.pand_status ||
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
    <div className="bg-grey-850 border-b border-grey-800 px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        {/* Bestemming type dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="bestemming-filter"
            className="text-grey-400 text-sm font-medium"
          >
            Bestemming
          </label>
          <Select
            id="bestemming-filter"
            value={filters.bestemming_type ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                bestemming_type: e.target.value || undefined,
              })
            }
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
          </Select>
        </div>

        {/* Pand status dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="status-filter"
            className="text-grey-400 text-sm font-medium"
          >
            Status
          </label>
          <Select
            id="status-filter"
            value={filters.pand_status ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                pand_status: e.target.value || undefined,
              })
            }
          >
            <option value="">Alle</option>
            <option value="niet in gebruik">Niet in gebruik</option>
            <option value="sloop">Sloopvergunning</option>
            <option value="buiten gebruik">Buiten gebruik</option>
            <option value="bouwvergunning">Bouwvergunning</option>
          </Select>
        </div>

        {/* Min area input */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="area-filter"
            className="text-grey-400 text-sm font-medium"
          >
            Min. opp. (m²)
          </label>
          <input
            id="area-filter"
            type="number"
            value={localMinArea}
            onChange={(e) => setLocalMinArea(e.target.value)}
            placeholder="0"
            className="w-20 bg-grey-950 border border-grey-800 text-grey-100 text-sm rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-accent focus:border-teal-accent"
          />
        </div>

        {/* Score category dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="score-filter"
            className="text-grey-400 text-sm font-medium"
          >
            Score
          </label>
          <Select
            id="score-filter"
            value={filters.score_category ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                score_category: e.target.value || undefined,
              })
            }
          >
            <option value="">Alle</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </Select>
        </div>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-grey-400 hover:text-grey-100 text-xs underline transition-colors"
          >
            Wis filters
          </button>
        )}

        {/* Results count badge (right-aligned) */}
        <div className="ml-auto">
          <span className="text-grey-400 text-xs">
            {total.toLocaleString('nl-NL')} resultaten
          </span>
        </div>
      </div>
    </div>
  )
}
