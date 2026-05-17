import { Search, Mail, Phone, Handshake, Hammer, Building2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PipelineStage } from '@/lib/types/portfolio'

export type LifecyclePhaseKey =
  | '1-onderzoek'
  | '2-eerste-contact'
  | '3-kwalificatie'
  | '4-bod'
  | '5-bouw'
  | '6-exploitatie'

export interface LifecyclePhase {
  key: LifecyclePhaseKey
  order: 1 | 2 | 3 | 4 | 5 | 6
  label: string
  shortLabel: string
  icon: LucideIcon
  /** Whether this phase has functional content in v1 of S06. */
  enabled: boolean
}

export const LIFECYCLE_PHASES: readonly LifecyclePhase[] = [
  { key: '1-onderzoek',      order: 1, label: '1. Onderzoek',            shortLabel: 'Onderzoek', icon: Search,    enabled: true  },
  { key: '2-eerste-contact', order: 2, label: '2. Eerste contact',       shortLabel: 'Contact',   icon: Mail,      enabled: false },
  { key: '3-kwalificatie',   order: 3, label: '3. Kwalificatie',         shortLabel: 'Kwal.',     icon: Phone,     enabled: false },
  { key: '4-bod',            order: 4, label: '4. Bod / Onderhandeling',  shortLabel: 'Bod',       icon: Handshake, enabled: false },
  { key: '5-bouw',           order: 5, label: '5. Bouw / Vergunning',     shortLabel: 'Bouw',      icon: Hammer,    enabled: false },
  { key: '6-exploitatie',    order: 6, label: '6. Exploitatie',           shortLabel: 'Live',      icon: Building2, enabled: false },
] as const

/**
 * Map backend pipeline_stage → S06 lifecycle phase (UI-only).
 * Decision rationale documented in 06-CONTEXT.md — no schema change.
 */
export function pipelineStageToLifecyclePhase(stage: PipelineStage): LifecyclePhase {
  switch (stage) {
    case 'Gesignaleerd':
    case 'Onderzoek':
      return LIFECYCLE_PHASES[0]! // 1-onderzoek
    case 'Contact':
      return LIFECYCLE_PHASES[1]! // 2-eerste-contact
    case 'Besluit':
      return LIFECYCLE_PHASES[3]! // 4-bod
    case 'Afgerond':
      return LIFECYCLE_PHASES[5]! // 6-exploitatie
  }
}

/**
 * Find phase by URL slug (used by /opgeslagen/perceel/$parcelId nested route).
 */
export function getLifecyclePhase(key: LifecyclePhaseKey): LifecyclePhase {
  const phase = LIFECYCLE_PHASES.find((p) => p.key === key)
  if (!phase) throw new Error(`Unknown lifecycle phase: ${key}`)
  return phase
}
