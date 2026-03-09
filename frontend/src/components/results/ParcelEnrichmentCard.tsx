import type { ParcelEnrichmentResponse } from '@/lib/types/scan'

interface ParcelEnrichmentCardProps {
  data: ParcelEnrichmentResponse | undefined
  isLoading: boolean
  error?: string | null
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
  error,
}: ParcelEnrichmentCardProps) {
  const formatEnrichmentError = (message: string): { text: string; tone: 'error' | 'muted' } => {
    if (message.toLowerCase().includes('postcode niet gevonden in adres')) {
      return {
        text: 'Adres mist postcode; vergunningen kunnen nog niet gekoppeld worden voor dit perceel.',
        tone: 'muted',
      }
    }
    return { text: message, tone: 'error' }
  }

  // Loading state - show animated skeleton
  if (isLoading) {
    return (
      <div className="bg-aura-glass-white/40 rounded-lg border border-neutral-200 p-4 space-y-3">
        <div className="h-4 bg-neutral-200 rounded animate-pulse" />
        <div className="h-4 bg-neutral-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-neutral-200 rounded animate-pulse w-1/2" />
      </div>
    )
  }

  // No data yet
  if (!data) {
    if (error) {
      const formatted = formatEnrichmentError(error)
      return (
        <div className="bg-aura-glass-white/40 rounded-lg border border-neutral-200 p-4">
          <p className={`text-sm ${formatted.tone === 'error' ? 'text-error' : 'text-neutral-600'}`}>
            {formatted.text}
          </p>
        </div>
      )
    }
    return null
  }

  // Error in enrichment
  if (data.enrichment_data?.error) {
    const formatted = formatEnrichmentError(data.enrichment_data.error)
    return (
      <div className="bg-aura-glass-white/40 rounded-lg border border-neutral-200 p-4">
        <p className={`text-sm ${formatted.tone === 'error' ? 'text-error' : 'text-neutral-600'}`}>
          {formatted.text}
        </p>
      </div>
    )
  }

  // No vergunningen found
  if (!data.enrichment_data?.vergunningen || data.enrichment_data.vergunningen.length === 0) {
    return (
      <div className="bg-aura-glass-white/40 rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-600">Geen vergunningen gevonden</p>
      </div>
    )
  }

  const vergunningen = data.enrichment_data.vergunningen

  // Expandable vergunningen list
  return (
    <details className="bg-aura-glass-white/40 rounded-lg border border-neutral-200">
      <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-aura-ink hover:text-aura-ink flex items-center justify-between">
        <span>Vergunningen ({vergunningen.length})</span>
        <span className="text-neutral-500 text-xs">
          {data.is_cached ? 'Gecached' : 'Vers opgehaald'}
        </span>
      </summary>
      <ul className="px-4 pb-3 space-y-3">
        {vergunningen.map((v) => (
          <li key={v.identifier} className="border-t border-neutral-200 pt-3">
            <p className="text-sm text-neutral-700 font-medium">{v.title}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-neutral-600">{v.type}</span>
              <span className="text-xs text-neutral-600">{v.date}</span>
            </div>
            {v.url && (
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-info hover:text-info/80 mt-1 inline-block"
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
