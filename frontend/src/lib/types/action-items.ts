/**
 * TS-mirror of backend/app/services/action_items_catalog.py types.
 * Manual twin — keep field names + casing in sync.
 *
 * M049/S06 Plan 06-02.
 */

export type ActionItemCategory =
  | 'api-config'
  | 'extern-contact'
  | 'roadmap'
  | 'bugfix'

export type ActionItemPriority = 'hoog' | 'middel' | 'laag'

export interface ActionItemEntry {
  id: string
  title: string
  description: string
  category: ActionItemCategory
  priority: ActionItemPriority
  contact?: string
  url?: string
  done?: boolean
}
