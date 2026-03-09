import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Select } from '@/components/primitives/Select'
import type { ScanResultsFilters } from '@/lib/types/scan'

interface ResultsFilterPanelProps {
  filters: ScanResultsFilters
  onChange: (filters: Partial<ScanResultsFilters>) => void
  total: number
  totalUnfiltered: number
  showOnlyTop: boolean
  onShowOnlyTopChange: (value: boolean) => void
  scanStatus?: string
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
          ? 'border-aura-amber/40 bg-aura-amber/10 text-aura-amber'
          : 'border-neutral-200 bg-aura-glass-white/60 text-neutral-600 hover:border-neutral-200 hover:text-neutral-700'
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
      <label htmlFor={id} className="text-xs text-neutral-500 whitespace-nowrap">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 w-auto rounded-full px-3 pr-8 text-xs font-medium border cursor-pointer ${
          hasValue
            ? 'border-aura-amber/40 bg-aura-amber/10 text-aura-amber'
            : 'border-neutral-200 bg-aura-glass-white/60 text-neutral-600 hover:border-neutral-200'
        }`}
        iconClassName={hasValue ? 'text-aura-amber/80' : 'text-neutral-500'}
      >
        {children}
      </Select>
    </div>
  )
}

export default function ResultsFilterPanel({
  filters,
  onChange,
  total,
  totalUnfiltered,
  showOnlyTop,
  onShowOnlyTopChange,
  scanStatus,
}: ResultsFilterPanelProps) {
  // Local state for debounced area inputs
  const [localMinArea, setLocalMinArea] = useState(
    filters.min_area_m2?.toString() ?? ''
  )
  const [localMaxArea, setLocalMaxArea] = useState(
    filters.max_area_m2?.toString() ?? ''
  )

  // Auto-disable toggle when filter would result in 0 visible rows
  useEffect(() => {
    if (showOnlyTop && total === 0 && totalUnfiltered > 0) {
      onShowOnlyTopChange(false)
      toast.info('Filter uitgeschakeld — geen percelen boven drempel', {
        duration: 3000,
      })
    }
  }, [total, totalUnfiltered, showOnlyTop, onShowOnlyTopChange])

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

  const hiddenCount = totalUnfiltered - total
  const isToggleDisabled = scanStatus !== undefined && scanStatus !== 'completed'

  return (
    <div className="border-b border-neutral-200 bg-aura-glass-white/60 px-5 py-3">
      {/* Top kansen toggle */}
      <div className="flex items-center justify-between mb-2.5">
        <button
          onClick={() => !isToggleDisabled && onShowOnlyTopChange(!showOnlyTop)}
          disabled={isToggleDisabled}
          className={`flex items-center gap-2 text-xs font-medium transition-colors ${
            isToggleDisabled
              ? 'opacity-40 cursor-not-allowed text-neutral-500'
              : 'cursor-pointer'
          }`}
          aria-pressed={showOnlyTop}
        >
          {/* Toggle track */}
          <span
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors ${
              showOnlyTop
                ? 'bg-aura-amber/20 border-aura-amber/40'
                : 'bg-neutral-200 border-neutral-200'
            }`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full transition-transform ${
                showOnlyTop
                  ? 'translate-x-3.5 bg-aura-amber'
                  : 'translate-x-0.5 bg-neutral-400'
              }`}
            />
          </span>
          {showOnlyTop ? (
            <span className="text-aura-amber">
              Top kansen{hiddenCount > 0 ? ` (${hiddenCount} verborgen)` : ''}
            </span>
          ) : (
            <span className="text-neutral-600">Alle percelen</span>
          )}
        </button>

        {/* Count display */}
        <span className="text-xs text-neutral-500 tabular-nums">
          {showOnlyTop && totalUnfiltered > total
            ? `${total.toLocaleString('nl-NL')} van ${totalUnfiltered.toLocaleString('nl-NL')} percelen`
            : `${total.toLocaleString('nl-NL')} percelen`}
        </span>
      </div>

      {/* Single horizontal row of filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Score pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500 mr-0.5">Score</span>
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
        <div className="h-5 w-px bg-neutral-100/5 hidden md:block" />

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
        <div className="h-5 w-px bg-neutral-100/5 hidden md:block" />

        {/* Area range — compact inline inputs */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">m²</span>
          <input
            id="area-min-filter"
            type="number"
            value={localMinArea}
            onChange={(e) => setLocalMinArea(e.target.value)}
            placeholder="min"
            className={`w-16 rounded-full text-xs font-medium px-3 py-1.5 border transition-colors tabular-nums text-center ${
              localMinArea
                ? 'border-aura-amber/40 bg-aura-amber/10 text-aura-amber'
                : 'border-neutral-200 bg-aura-glass-white/60 text-neutral-600 placeholder:text-neutral-500'
            } focus:outline-none focus:border-aura-amber/50`}
          />
          <span className="text-neutral-500 text-xs">–</span>
          <input
            id="area-max-filter"
            type="number"
            value={localMaxArea}
            onChange={(e) => setLocalMaxArea(e.target.value)}
            placeholder="max"
            className={`w-16 rounded-full text-xs font-medium px-3 py-1.5 border transition-colors tabular-nums text-center ${
              localMaxArea
                ? 'border-aura-amber/40 bg-aura-amber/10 text-aura-amber'
                : 'border-neutral-200 bg-aura-glass-white/60 text-neutral-600 placeholder:text-neutral-500'
            } focus:outline-none focus:border-aura-amber/50`}
          />
        </div>

        {/* Spacer + right-aligned meta */}
        <div className="ml-auto flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <X size={12} />
              Wis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
