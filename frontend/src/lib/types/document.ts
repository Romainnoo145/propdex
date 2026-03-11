export interface ParcelDocumentMeta {
  id: string
  parcel_id: string
  document_type: string
  filename: string
  content_type: string
  file_size: number
  uploaded_at: string
  uploaded_by_user_id: string | null
}

export interface ParcelDocumentListResponse {
  documents: ParcelDocumentMeta[]
  total: number
}
