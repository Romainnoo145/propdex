/**
 * Checklist progress types for the vergunning workflow tracker.
 */

export interface ChecklistItem {
  id: string
  category: string
  phase: string
  title: string
  description: string
  required: boolean
  estimated_cost: string | null
  cta_text: string | null
  cta_type: 'generate_document' | 'request_quote' | 'external_link' | null
  detail: string | null
  why_needed: string | null
  provider_type: string | null
}

export interface ChecklistResponse {
  use_case: string
  items: ChecklistItem[]
  phases: string[]
  total: number
  error?: string
}

export interface ChecklistProgressResponse {
  checked_items: string[]
  uploaded_documents: Record<string, string>
}

// M045/S04 — org-aggregated checklist view types (mirror backend Pydantic)

export interface ChecklistCheck {
  user_id: string
  user_name: string
  updated_at: string
}

export interface ChecklistLinkedDocument {
  document_id: string
  user_id: string
  user_name: string
  updated_at: string
}

export interface ChecklistItemLinks {
  checked_by: ChecklistCheck[]
  linked_documents: ChecklistLinkedDocument[]
}

export interface ChecklistLinksBundle {
  optoppen: Record<string, ChecklistItemLinks>
  splitsen: Record<string, ChecklistItemLinks>
  transformatie: Record<string, ChecklistItemLinks>
  nieuwbouw: Record<string, ChecklistItemLinks>
}
