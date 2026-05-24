/**
 * Pure helpers for project type chip rendering on Opgeslagen cards.
 *
 * No React dependency — testable in vitest node env.
 * Chip is shown only for a concrete chosen type, never for null/undefined/'onbepaald'.
 */
import { PROJECT_TYPE_LABELS } from '@/lib/types/projectType'
import type { ProjectType } from '@/lib/types/projectType'

/** Chip is shown only for a concrete chosen type — never for null/undefined/'onbepaald'. */
export function shouldShowProjectTypeChip(type: string | null | undefined): boolean {
  return type != null && type !== 'onbepaald'
}

/** Display label for the chip; reuses the canonical labels, falls back to raw string. */
export function projectTypeChipLabel(type: string): string {
  return PROJECT_TYPE_LABELS[type as ProjectType] ?? type
}
