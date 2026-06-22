/**
 * TanStack Query hook for fetching the full cascade policy documents for a gemeente.
 *
 * Returns vendor-global (is_global=true) policy documents cascading down from
 * landelijk (NL) → provincie → gemeente based on the gemeente_code input.
 * Accessible to any authenticated user — the cascade endpoint does not filter
 * by calling organization.
 *
 * M045/S03: primary data source for the gemeente card's new Beleidsdocumenten
 * section.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import { apiFetch } from '@/lib/api'
import type { Extraction } from '@/hooks/usePolicyDocuments'

/**
 * Individual cascade policy document. Shape matches backend PolicyDocumentRead
 * from app/documents/bundle_schemas.py — extraction contains randvoorwaarden
 * produced by the cascade extraction pipeline.
 */
export interface CascadePolicyDocRead {
  id: string
  entity_type: 'landelijk' | 'provincie' | 'gemeente'
  entity_code: string
  source_key: string
  filename: string
  content_type: string
  file_size: number
  uploaded_at: string
  version_number: number
  ai_summary: string | null
  extraction_status: string
  extraction: Extraction | null
}

/**
 * Grouped cascade response. Each list is always present (possibly empty) —
 * matches backend CascadePolicyDocs with defaulted empty lists.
 */
export interface CascadePolicyBundleResponse {
  landelijk: CascadePolicyDocRead[]
  provincie: CascadePolicyDocRead[]
  gemeente: CascadePolicyDocRead[]
}

/**
 * Fetch cascade policy documents for a gemeente.
 *
 * @param gemeenteCode - GM-prefixed code (e.g. "GM0983"). Pass undefined to disable.
 */
export function useGemeenteCascadeDocuments(gemeenteCode: string | undefined) {
  const { accessToken } = useAuth()

  return useQuery<CascadePolicyBundleResponse>({
    queryKey: ['gemeente-cascade', gemeenteCode],
    queryFn: () =>
      apiFetch<CascadePolicyBundleResponse>(
        `/api/policy-documents/cascade/${gemeenteCode}`,
        { method: 'GET', accessToken },
      ),
    enabled: !!gemeenteCode && !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 min — cascade documents change infrequently
  })
}
