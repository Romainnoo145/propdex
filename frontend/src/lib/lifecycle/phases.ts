import { Search, Mail, Handshake, FileCheck, Hammer, Key, Wrench, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PipelineStage } from '@/lib/types/portfolio'

/**
 * Propdex lifecycle phases — 8 fases reflecteren Tranche 1 + Tranche 2.
 *
 * Tranche 1 (shipping, M001-M050) — onderzoekstool:
 *   1. Onderzoek   — scoring/scan/DD (huidige Propdex core)
 *   2. Contact     — eigenaar outreach + brief-feature (M050/S04+)
 *   3. Bod         — onderhandeling + koopovereenkomst (M060)
 *   4. Vergunning  — omgevingsvergunning + Wkb (M070)
 *   5. Bouw        — uitvoering + oplevering (M080)
 *
 * Tranche 2 (roadmap, M060-M110) — actie + beheer-tool:
 *   6. Verhuur     — huurder-acquisitie, contracten, onderverhuur, mutaties (M090)
 *   7. Beheer      — MJOP, onderhoud, verduurzaming, VvE (M100)
 *   8. Exit        — verkoop OF herfinanciering (M110)
 *
 * Strategy lock 2026-05-18: zie .planning/PROJECT.md "Tranche 2 pivot" key-decision.
 */
export type LifecyclePhaseKey =
  | '1-onderzoek'
  | '2-contact'
  | '3-bod'
  | '4-vergunning'
  | '5-bouw'
  | '6-verhuur'
  | '7-beheer'
  | '8-exit'

export interface LifecyclePhase {
  key: LifecyclePhaseKey
  order: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  label: string
  shortLabel: string
  icon: LucideIcon
  /** Whether this phase has functional content in current ship. False = "Komt later (M0xx)" placeholder. */
  enabled: boolean
  /** Milestone that will deliver content for this phase — shown in placeholder copy. */
  plannedMilestone: string
}

export const LIFECYCLE_PHASES: readonly LifecyclePhase[] = [
  { key: '1-onderzoek',  order: 1, label: '1. Onderzoek',  shortLabel: 'Onderzoek',  icon: Search,      enabled: true,  plannedMilestone: 'M001-M050' },
  { key: '2-contact',    order: 2, label: '2. Contact',    shortLabel: 'Contact',    icon: Mail,        enabled: true,  plannedMilestone: 'M050/S06 cont. (Phase 8)' },
  { key: '3-bod',        order: 3, label: '3. Bod',        shortLabel: 'Bod',        icon: Handshake,   enabled: false, plannedMilestone: 'M060' },
  { key: '4-vergunning', order: 4, label: '4. Vergunning', shortLabel: 'Vergunning', icon: FileCheck,   enabled: false, plannedMilestone: 'M070' },
  { key: '5-bouw',       order: 5, label: '5. Bouw',       shortLabel: 'Bouw',       icon: Hammer,      enabled: false, plannedMilestone: 'M080' },
  { key: '6-verhuur',    order: 6, label: '6. Verhuur',    shortLabel: 'Verhuur',    icon: Key,         enabled: false, plannedMilestone: 'M090' },
  { key: '7-beheer',     order: 7, label: '7. Beheer',     shortLabel: 'Beheer',     icon: Wrench,      enabled: false, plannedMilestone: 'M100' },
  { key: '8-exit',       order: 8, label: '8. Exit',       shortLabel: 'Exit',       icon: TrendingUp,  enabled: false, plannedMilestone: 'M110' },
] as const

/**
 * Map backend pipeline_stage → S06 lifecycle phase (UI-only).
 * Backend enum heeft 5 stages, sidebar toont 8 fases — niet 1-op-1 mapping.
 * Backend pipeline_stage blijft acquisitie-only; Tranche 2 fases krijgen
 * eigen status-velden (lease_status, maintenance_status, exit_status) in
 * M090+ milestones.
 */
export function pipelineStageToLifecyclePhase(stage: PipelineStage): LifecyclePhase {
  switch (stage) {
    case 'Gesignaleerd':
    case 'Onderzoek':
      return LIFECYCLE_PHASES[0]! // 1-onderzoek
    case 'Contact':
      return LIFECYCLE_PHASES[1]! // 2-contact
    case 'Besluit':
      return LIFECYCLE_PHASES[2]! // 3-bod
    case 'Afgerond':
      return LIFECYCLE_PHASES[4]! // 5-bouw (acquisitie afgerond = bouw-fase bereikt)
  }
}

/**
 * Find phase by URL slug (used by /opgeslagen/perceel/$parcelId/$phase route).
 */
export function getLifecyclePhase(key: LifecyclePhaseKey): LifecyclePhase {
  const phase = LIFECYCLE_PHASES.find((p) => p.key === key)
  if (!phase) throw new Error(`Unknown lifecycle phase: ${key}`)
  return phase
}
