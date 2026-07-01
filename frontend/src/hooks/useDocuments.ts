/**
 * TanStack Query hooks for per-parcel document operations
 *
 * Provides hooks for:
 * - Listing documents for a parcel
 * - Uploading a document to a dossier category
 * - Deleting an uploaded document
 *
 * All hooks require authentication via useAuth().
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'
import {
  fetchParcelDocuments,
  uploadParcelDocument,
  deleteParcelDocument,
} from '@/lib/api'
import type { ParcelDocumentListResponse, ParcelDocumentMeta } from '@/lib/types/document'

/**
 * Fetch all documents for a parcel
 *
 * Query key: ['parcel-documents', parcelId]
 * Stale time: 30 seconds
 *
 * When `poll` is true the list refetches every few seconds — used right after a
 * parcel is saved/analysed so the dossier documents surface as they're built.
 */
export function useParcelDocuments(
  parcelId: string | undefined,
  options?: { poll?: boolean },
) {
  const { accessToken } = useAuth()

  return useQuery<ParcelDocumentListResponse, Error>({
    queryKey: ['parcel-documents', parcelId],
    queryFn: () => fetchParcelDocuments(parcelId!, accessToken),
    enabled: !!parcelId && !!accessToken,
    staleTime: 30 * 1000,
    refetchInterval: options?.poll ? 4000 : false,
  })
}

/**
 * Upload a document to a dossier category for a parcel
 *
 * On success: invalidates ['parcel-documents', parcelId] to refresh list.
 */
export function useUploadDocument() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    ParcelDocumentMeta,
    Error,
    { parcelId: string; documentType: string; file: File }
  >({
    mutationFn: (vars) =>
      uploadParcelDocument(vars.parcelId, vars.documentType, vars.file, accessToken),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['parcel-documents', vars.parcelId] })
    },
  })
}

/**
 * Delete a document from a parcel
 *
 * On success: invalidates ['parcel-documents', parcelId] to refresh list.
 */
export function useDeleteDocument() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, { parcelId: string; documentId: string }>({
    mutationFn: (vars) =>
      deleteParcelDocument(vars.parcelId, vars.documentId, accessToken),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['parcel-documents', vars.parcelId] })
    },
  })
}
