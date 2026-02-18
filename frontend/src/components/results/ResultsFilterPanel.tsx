import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronRight,
  Maximize2,
  MapPin,
  TrendingUp,
} from 'lucide-react'
import { Select } from '@/components/primitives'
import type { ScanResultsFilters } from '@/lib/types/scan'

interface ResultsFilterPanelProps {
  filters: ScanResultsFilters
  onChange: (filters: Partial<ScanResultsFilters>) => void
  total: number
}

const FILTER_GROUPS = [
  {
    id: 'area',
    label: 'Oppervlak',
    icon: Maximize2,
  },
  {
    id: 'zoning',
    label: 'Bestemming',
    icon: MapPin,
  },
  {
    id: 'score',
    label: 'Score',
    icon: TrendingUp,
  },
] as const

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

  // Track which category groups are open (all open by default)
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(['area', 'zoning', 'score'])
  )

  // Sync local min area state when URL-derived filter changes (e.g. clear all)
  useEffect(() => {
    setLocalMinArea(filters.min_area_m2?.toString() ?? '')
  }, [filters.min_area_m2])

  // Sync local max area state when URL-derived filter changes (e.g. clear all)
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
    toast.info('Filters toegepast', { duration: 2000 })
  }

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  function renderAreaFilters() {
    return (
      <>
        <div className="flex items-center gap-2">
          <label
            htmlFor="area-min-filter"
            className="text-grey-400 text-sm font-medium"
          >
            Min (m²)
          </label>
          <input
            id="area-min-filter"
            type="number"
            value={localMinArea}
            onChange={(e) => setLocalMinArea(e.target.value)}
            placeholder="0"
            className="w-20 bg-grey-950 border border-grey-800 text-grey-100 text-sm rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-accent focus:border-teal-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="area-max-filter"
            className="text-grey-400 text-sm font-medium"
          >
            Max (m²)
          </label>
          <input
            id="area-max-filter"
            type="number"
            value={localMaxArea}
            onChange={(e) => setLocalMaxArea(e.target.value)}
            placeholder="--"
            className="w-20 bg-grey-950 border border-grey-800 text-grey-100 text-sm rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-accent focus:border-teal-accent"
          />
        </div>
      </>
    )
  }

  function renderZoningFilters() {
    return (
      <>
        {/* Bestemming type dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="bestemming-filter"
            className="text-grey-400 text-sm font-medium"
          >
            Type
          </label>
          <Select
            id="bestemming-filter"
            value={filters.bestemming_type ?? ''}
            onChange={(e) => {
              onChange({
                ...filters,
                bestemming_type: e.target.value || undefined,
              })
              toast.info('Filters toegepast', { duration: 2000 })
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
            onChange={(e) => {
              onChange({
                ...filters,
                pand_status: e.target.value || undefined,
              })
              toast.info('Filters toegepast', { duration: 2000 })
            }}
          >
            <option value="">Alle</option>
            <option value="niet in gebruik">Niet in gebruik</option>
            <option value="sloop">Sloopvergunning</option>
            <option value="buiten gebruik">Buiten gebruik</option>
            <option value="bouwvergunning">Bouwvergunning</option>
          </Select>
        </div>
      </>
    )
  }

  function renderScoreFilters() {
    return (
      <div className="flex items-center gap-2">
        <label
          htmlFor="score-filter"
          className="text-grey-400 text-sm font-medium"
        >
          Categorie
        </label>
        <Select
          id="score-filter"
          value={filters.score_category ?? ''}
          onChange={(e) => {
            onChange({
              ...filters,
              score_category: e.target.value || undefined,
            })
            toast.info('Filters toegepast', { duration: 2000 })
          }}
        >
          <option value="">Alle</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </Select>
      </div>
    )
  }

  return (
    <div className="bg-grey-850 border-b border-grey-800 px-4 py-3">
      {/* Header row: title + results count + clear button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-grey-300 uppercase tracking-wider">
          Filters
        </span>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-grey-400 hover:text-grey-100 text-xs underline transition-colors"
            >
              Wis filters
            </button>
          )}
          <span className="text-grey-400 text-xs">
            {total.toLocaleString('nl-NL')} resultaten
          </span>
        </div>
      </div>

      {/* Category groups */}
      <div className="space-y-2">
        {FILTER_GROUPS.map((group) => {
          const isOpen = openGroups.has(group.id)
          const Icon = group.icon
          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="flex items-center gap-2 w-full text-left py-1"
              >
                {isOpen ? (
                  <ChevronDown size={14} className="text-grey-400" />
                ) : (
                  <ChevronRight size={14} className="text-grey-400" />
                )}
                <Icon size={14} className="text-grey-400" />
                <span className="text-xs font-medium text-grey-300">
                  {group.label}
                </span>
              </button>
              {isOpen && (
                <div className="pl-7 pt-1 flex flex-wrap items-center gap-3">
                  {group.id === 'area' && renderAreaFilters()}
                  {group.id === 'zoning' && renderZoningFilters()}
                  {group.id === 'score' && renderScoreFilters()}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
