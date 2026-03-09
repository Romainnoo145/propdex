import { Lightbulb } from 'lucide-react'
import type { ExplorerFilters, FacetItem } from '@/hooks/useExplorer'

/** Dutch display labels for filter dimension names */
const DIMENSION_LABELS: Record<keyof ExplorerFilters, string> = {
  gemeente: 'Gemeente',
  vergunningstype: 'Vergunningstype',
  uitkomst: 'Uitkomst',
  rechtsgrond: 'Rechtsgrond',
  rechtbank_niveau: 'Rechtbank-niveau',
  periode: 'Tijdsperiode',
}

interface BroadenSuggestionProps {
  activeFilters: ExplorerFilters
  facets: {
    gemeente: FacetItem[]
    vergunningstype: FacetItem[]
    uitkomst: FacetItem[]
    rechtsgrond: FacetItem[]
    rechtbank_niveau: FacetItem[]
  } | null
  resultCount: number
  onRemoveFilter: (dimension: keyof ExplorerFilters) => void
}

interface Suggestion {
  dimension: keyof ExplorerFilters
  filterValue: string
  additionalResults: number
}

export default function BroadenSuggestion({
  activeFilters,
  facets,
  resultCount,
  onRemoveFilter,
}: BroadenSuggestionProps) {
  const hasActiveFilters = Object.values(activeFilters).some(Boolean)

  // Only render when < 3 results AND at least one filter is active
  if (resultCount >= 3 || !hasActiveFilters) return null

  // Compute suggestions: for each active filter, estimate how many more results
  // by looking at the total of that dimension's facet counts
  const suggestions: Suggestion[] = []

  for (const [dim, value] of Object.entries(activeFilters) as [keyof ExplorerFilters, string | undefined][]) {
    if (!value || dim === 'periode') continue // periode doesn't have facet counts

    const facetKey = dim as keyof NonNullable<typeof facets>
    const dimensionFacets = facets?.[facetKey]
    if (!dimensionFacets) continue

    // Total results across all values in this dimension (with other filters applied)
    const totalInDimension = dimensionFacets.reduce((sum, f) => sum + f.count, 0)
    const additional = Math.max(0, totalInDimension - resultCount)

    if (additional > 0) {
      suggestions.push({
        dimension: dim,
        filterValue: value,
        additionalResults: additional,
      })
    }
  }

  // Sort by most additional results first
  suggestions.sort((a, b) => b.additionalResults - a.additionalResults)

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-400" />
        <div>
          {resultCount === 0 ? (
            <p className="text-sm text-grey-300">
              Geen uitspraken gevonden.
            </p>
          ) : (
            <p className="text-sm text-grey-300">
              Slechts {resultCount} {resultCount === 1 ? 'uitspraak' : 'uitspraken'} gevonden.
            </p>
          )}

          {suggestions.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {suggestions.map((s) => (
                <li key={s.dimension}>
                  <button
                    onClick={() => onRemoveFilter(s.dimension)}
                    className="text-sm text-amber-400 underline decoration-amber-400/30 underline-offset-2 transition-colors hover:text-amber-300 hover:decoration-amber-300/50"
                  >
                    Verwijder filter &apos;{DIMENSION_LABELS[s.dimension]}: {s.filterValue}&apos;
                    {' '}voor ~{s.additionalResults} meer {s.additionalResults === 1 ? 'resultaat' : 'resultaten'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-grey-400">
              Probeer een andere gemeente of tijdsperiode.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
