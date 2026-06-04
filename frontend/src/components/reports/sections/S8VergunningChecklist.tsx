/**
 * S8 Vergunning Checklist — Due Diligence Dashboard section 8 (report mount point).
 *
 * Thin wrapper around the shared `ChecklistCore` (M052/S02, HAAL-01/HAAL-03).
 * The report path derives the offered use_cases from `report_data.use_case_scores`
 * (sorted by score), offering a strategy toggle between them. Progress/upload/
 * doc-status logic lives in `ChecklistCore` — same component, two mount points
 * (this report section + `HaalbaarheidPhaseView`).
 *
 * Visual system: Monochrome amber/slate — no circus colors.
 */

import { ClipboardCheck } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { ChecklistCore, type ChecklistUseCaseOption } from '@/components/checklist/ChecklistCore'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S8VergunningChecklistProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Helpers ────────────────────────────────────────────────── */

function getUseCasesSorted(data: PropertyReportResponse): ChecklistUseCaseOption[] {
  const scores = data.use_case_scores
  if (!scores || Object.keys(scores).length === 0) return []

  return Object.entries(scores)
    .map(([id, entry]) => ({ id, label: entry.label, score: entry.score }))
    .sort((a, b) => b.score - a.score)
    .map(({ id, label }) => ({ id, label }))
}

/* ─── Section ────────────────────────────────────────────────── */

export function S8VergunningChecklist({ data, sourceParcelId }: S8VergunningChecklistProps) {
  const useCases = getUseCasesSorted(data)

  // No use_case_scores available — report has no derived development options.
  if (useCases.length === 0) {
    return (
      <SectionInsightCard kicker="Voorbereiding" title="Vergunning Checklist" Icon={ClipboardCheck}>
        <p className="text-[12px] text-slate-400">
          Geen use-case scores beschikbaar voor dit pand. Voer eerst een gebiedsscan uit om
          de ontwikkelingsmogelijkheden te berekenen.
        </p>
      </SectionInsightCard>
    )
  }

  return <ChecklistCore useCases={useCases} parcelId={sourceParcelId} />
}
