/**
 * Hook to fetch AI summaries for all policy documents of a gemeente.
 * Returns a map of source_key → ai_summary text.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import { useGemeenteGeoJSON } from '@/hooks/useGemeenteGeoJSON'

interface PolicySummariesResponse {
  summaries: Record<string, string>
}

/**
 * Resolve woonplaats (city name) → GM code using cached gemeente geojson.
 * Returns undefined if no match found.
 */
function useGemeenteCodeFromWoonplaats(woonplaats: string | undefined) {
  const { data: geojson } = useGemeenteGeoJSON()

  return useMemo(() => {
    if (!woonplaats || !geojson?.features) return undefined
    const needle = woonplaats.toLowerCase()
    for (const feature of geojson.features) {
      const naam = String(feature.properties?.statnaam ?? '').toLowerCase()
      if (naam === needle) {
        return String(feature.properties?.statcode ?? '')
      }
    }
    return undefined
  }, [woonplaats, geojson])
}

/**
 * Fetch policy document AI summaries for a gemeente.
 * @param gemeenteCode - GM code (e.g. "GM0363"). Pass undefined to disable.
 */
export function usePolicySummaries(gemeenteCode: string | undefined) {
  const { accessToken } = useAuth()

  return useQuery<PolicySummariesResponse>({
    queryKey: ['policy-summaries', 'gemeente', gemeenteCode],
    queryFn: () =>
      apiFetch<PolicySummariesResponse>(
        `/api/policy-documents/summaries/gemeente/${gemeenteCode}`,
        { method: 'GET', accessToken },
      ),
    enabled: !!gemeenteCode && !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 min — summaries don't change often
  })
}

/**
 * Convenience hook: resolve woonplaats → GM code → policy summaries.
 * Use in rapport context where only woonplaats (city name) is available.
 */
export function usePolicySummariesByWoonplaats(woonplaats: string | undefined) {
  const gemeenteCode = useGemeenteCodeFromWoonplaats(woonplaats)
  return usePolicySummaries(gemeenteCode)
}

/**
 * Maps policy document source_key → rapport section key.
 * Multiple source_keys can map to the same section.
 */
export const SOURCE_KEY_TO_SECTION: Record<string, string> = {
  welstandsnota: 'bestemmingsplan',
  omgevingsvisie: 'bestemmingsplan',
  parkeerbeleid: 'bestemmingsplan',
  woonvisie: 'analyse',
  grondprijsbeleid: 'analyse',
  leegstandsverordening: 'analyse',
  duurzaamheidsbeleid: 'risicoprofiel',
  erfgoedverordening: 'kadaster',
}

/** Human-readable Dutch labels for source keys. */
export const SOURCE_KEY_LABELS: Record<string, string> = {
  welstandsnota: 'Welstandsnota',
  omgevingsvisie: 'Omgevingsvisie',
  parkeerbeleid: 'Parkeerbeleid',
  woonvisie: 'Woonvisie',
  grondprijsbeleid: 'Grondprijsbeleid',
  leegstandsverordening: 'Leegstandsverordening',
  duurzaamheidsbeleid: 'Duurzaamheidsbeleid',
  erfgoedverordening: 'Erfgoedverordening',
}

/**
 * Given all summaries, return only those relevant to a specific rapport section.
 */
export function getSummariesForSection(
  summaries: Record<string, string> | undefined,
  sectionKey: string,
): { sourceKey: string; label: string; summary: string }[] {
  if (!summaries) return []
  return Object.entries(SOURCE_KEY_TO_SECTION)
    .filter(([, section]) => section === sectionKey)
    .map(([sourceKey]) => ({
      sourceKey,
      label: SOURCE_KEY_LABELS[sourceKey] ?? sourceKey,
      summary: summaries[sourceKey],
    }))
    .filter((item) => !!item.summary)
}
