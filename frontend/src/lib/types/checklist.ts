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
}
