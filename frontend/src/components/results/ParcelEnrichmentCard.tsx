import type { ParcelEnrichmentResponse } from '@/lib/types/scan'

interface ParcelEnrichmentCardProps {
  data: ParcelEnrichmentResponse | undefined
  isLoading: boolean
}

/**
 * Expandable vergunningen enrichment card
 *
 * Uses native <details>/<summary> for expandable section.
 * Shows loading skeleton when fetching, expandable list when loaded.
 */
export function ParcelEnrichmentCard({
  data,
  isLoading,
}: ParcelEnrichmentCardProps) {
  // Loading state - show animated skeleton
  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-lg border border-white/10 p-4 space-y-3">
        <div className="h-4 bg-white/10 rounded animate-pulse" />
        <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-white/10 rounded animate-pulse w-1/2" />
      </div>
    )
  }

  // No data yet
  if (!data) return null

  // Error in enrichment
  if (data.enrichment_data?.error) {
    return (
      <div className="bg-white/5 rounded-lg border border-white/10 p-4">
        <p className="text-sm text-orange-400">{data.enrichment_data.error}</p>
      </div>
    )
  }

  // No vergunningen found
  if (!data.enrichment_data?.vergunningen || data.enrichment_data.vergunningen.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg border border-white/10 p-4">
        <p className="text-sm text-white/50">Geen vergunningen gevonden</p>
      </div>
    )
  }

  const vergunningen = data.enrichment_data.vergunningen

  // Expandable vergunningen list
  return (
    <details className="bg-white/5 rounded-lg border border-white/10">
      <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-white/90 hover:text-white flex items-center justify-between">
        <span>Vergunningen ({vergunningen.length})</span>
        <span className="text-white/40 text-xs">
          {data.is_cached ? 'Gecached' : 'Vers opgehaald'}
        </span>
      </summary>
      <ul className="px-4 pb-3 space-y-3">
        {vergunningen.map((v) => (
          <li key={v.identifier} className="border-t border-white/5 pt-3">
            <p className="text-sm text-white/80 font-medium">{v.title}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-white/50">{v.type}</span>
              <span className="text-xs text-white/50">{v.date}</span>
            </div>
            {v.url && (
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
              >
                Bekijk publicatie →
              </a>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
