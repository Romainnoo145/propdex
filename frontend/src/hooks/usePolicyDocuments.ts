/**
 * React Query hooks for policy document CRUD operations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type { Randvoorwaarde } from '@/components/map/panels/parcel/OmgevingsvisiePopup'

/* ─── Types ─────────────────────────────────────────────────── */

export interface Extraction {
  randvoorwaarden?: Randvoorwaarde[]
  algemeen_citaat?: string
  [k: string]: unknown
}

export interface PolicyDocument {
  id: string
  entity_type: string
  entity_code: string
  source_key: string
  filename: string
  content_type: string
  file_size: number
  status: string
  extraction_status: string
  extraction: Extraction | null
  version_number: number
  ai_summary: string | null
  created_at: string
  updated_at: string
}

export interface DocumentSummary {
  summary: string
  key_facts: string[]
  extracted_values: Record<string, string>
}

export function parseAiSummary(raw: string | null): DocumentSummary | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data.error) return null
    return data as DocumentSummary
  } catch {
    return null
  }
}

interface PolicyDocumentListResponse {
  documents: PolicyDocument[]
  total: number
}

/* ─── Query key ─────────────────────────────────────────────── */

function policyDocsKey(entityType: string, entityCode: string, sourceKey?: string) {
  const base = ['policy-documents', entityType, entityCode] as const
  return sourceKey ? [...base, sourceKey] : base
}

/* ─── List hook ─────────────────────────────────────────────── */

export function usePolicyDocuments(
  entityType: string,
  entityCode: string,
  sourceKey?: string,
  enabled = true,
  refetchInterval?: number | false,
) {
  const { accessToken } = useAuth()
  return useQuery<PolicyDocumentListResponse>({
    queryKey: policyDocsKey(entityType, entityCode, sourceKey),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (sourceKey) params.set('source_key', sourceKey)
      const qs = params.toString()
      const url = `/api/policy-documents/${entityType}/${entityCode}${qs ? `?${qs}` : ''}`
      return apiFetch<PolicyDocumentListResponse>(url, { method: 'GET', accessToken })
    },
    enabled: enabled && !!accessToken,
    staleTime: 30_000,
    refetchInterval,
    // Empty policy slots legitimately return 404 on some deployments (older
    // backend behaviour + per-slot enumeration on the Beleid page). Skip the
    // default 3-retry storm so one 404 means one roundtrip, not four.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false
      return failureCount < 3
    },
  })
}

/* ─── Upload mutation ───────────────────────────────────────── */

interface UploadParams {
  entityType: string
  entityCode: string
  sourceKey: string
  file: File
}

export function useUploadPolicyDocument() {
  const qc = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation<PolicyDocument, Error, UploadParams>({
    mutationFn: async ({ entityType, entityCode, sourceKey, file }) => {
      const formData = new FormData()
      formData.append('file', file)

      const url = `/api/policy-documents/${entityType}/${entityCode}?source_key=${encodeURIComponent(sourceKey)}`

      const headers: HeadersInit = {}
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

      const res = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers,
      })

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(detail.detail || `Upload failed: ${res.status}`)
      }

      return res.json()
    },
    onSuccess: (_data, { entityType, entityCode }) => {
      qc.invalidateQueries({ queryKey: policyDocsKey(entityType, entityCode) })
    },
  })
}

/* ─── Delete mutation ───────────────────────────────────────── */

interface DeleteParams {
  entityType: string
  entityCode: string
  documentId: string
}

export function useDeletePolicyDocument() {
  const qc = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation<void, Error, DeleteParams>({
    mutationFn: async ({ entityType, entityCode, documentId }) => {
      const url = `/api/policy-documents/${entityType}/${entityCode}/${documentId}`
      const headers: HeadersInit = {}
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      const res = await fetch(url, { method: 'DELETE', credentials: 'include', headers })
      if (!res.ok && res.status !== 204) {
        throw new Error(`Delete failed: ${res.status}`)
      }
    },
    onSuccess: (_data, { entityType, entityCode }) => {
      qc.invalidateQueries({ queryKey: policyDocsKey(entityType, entityCode) })
    },
  })
}
