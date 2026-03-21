import { Lightbulb } from 'lucide-react'
import type { ExplorerFilters, FacetItem } from '@/hooks/useExplorer'

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

  if (resultCount >= 3 || !hasActiveFilters) return null

  const suggestions: Suggestion[] = []

  for (const [dim, value] of Object.entries(activeFilters) as [keyof ExplorerFilters, string | undefined][]) {
    if (!value || dim === 'periode') continue

    const facetKey = dim as keyof NonNullable<typeof facets>
    const dimensionFacets = facets?.[facetKey]
    if (!dimensionFacets) continue

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

  suggestions.sort((a, b) => b.additionalResults - a.additionalResults)

  return (
    <div className="rounded-[24px] border border-[#F9A826]/20 bg-[#F9A826]/5 p-5">
      <div className="flex items-start gap-3">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-[#F9A826]" />
        <div>
          {resultCount === 0 ? (
            <p className="text-[13px] font-semibold text-[#0E1111]">
              Geen uitspraken gevonden.
            </p>
          ) : (
            <p className="text-[13px] font-semibold text-[#0E1111]">
              Slechts {resultCount} {resultCount === 1 ? 'uitspraak' : 'uitspraken'} gevonden.
            </p>
          )}

          {suggestions.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {suggestions.map((s) => (
                <li key={s.dimension}>
                  <button
                    onClick={() => onRemoveFilter(s.dimension)}
                    className="text-[13px] text-[#F9A826] underline decoration-[#F9A826]/30 underline-offset-2 transition-colors hover:text-[#E8971F] hover:decoration-[#E8971F]/50"
                  >
                    Verwijder filter &apos;{DIMENSION_LABELS[s.dimension]}: {s.filterValue}&apos;
                    {' '}voor ~{s.additionalResults} meer {s.additionalResults === 1 ? 'resultaat' : 'resultaten'}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-slate-500">
              Probeer een andere gemeente of tijdsperiode.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
