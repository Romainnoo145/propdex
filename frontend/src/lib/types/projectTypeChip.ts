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

/**
 * Checklist use_case keys — authoritative in backend/app/services/checklists.py
 * (optoppen / splitsen / transformatie / nieuwbouw). Pure-frontend type so the
 * HaalbaarheidPhaseView can derive the checklist to load from the parcel's
 * projecttype, instead of from the report's use_case_scores.
 */
export type ChecklistUseCase = 'optoppen' | 'splitsen' | 'transformatie' | 'nieuwbouw'

/**
 * Map a parcel's projecttype → checklist use_case (M052/S02, FUND-03/HAAL-01).
 *
 * Mirrors the backend mapping in `backend/app/services/brief_context.py`:
 *   optoppen                → optoppen
 *   splitsen                → splitsen
 *   transformatie_wonen     → transformatie
 *   commercieel_naar_wonen  → transformatie  (commercial→residential is a transformation —
 *                                              confirmed UAT 2026-05-29, no dedicated checklist)
 *   nieuwbouw_wonen         → nieuwbouw
 *   onbepaald / null / unset → null           (empty state → prompt ProjectTypePickerModal)
 *
 * projecttype is the single source of truth — no default-checklist fallback.
 */
export function projectTypeToUseCase(type: string | null | undefined): ChecklistUseCase | null {
  switch (type) {
    case 'optoppen':
      return 'optoppen'
    case 'splitsen':
      return 'splitsen'
    case 'transformatie_wonen':
    case 'commercieel_naar_wonen':
      return 'transformatie'
    case 'nieuwbouw_wonen':
      return 'nieuwbouw'
    case 'onbepaald':
    case null:
    case undefined:
    default:
      return null
  }
}
