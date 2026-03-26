/**
 * S8 Vergunning Checklist — Due Diligence Dashboard section 8
 *
 * Displays: per-strategy preparation checklist (documents, onderzoek,
 * vergunning, overig) keyed to the parcel's top use-case score.
 * Fetches checklist items from GET /api/gemeente/checklists/{useCase}.
 *
 * Visual system: SectionInsightCard (S01–S07 pattern). Animation-free.
 */

import { ClipboardCheck, Loader2, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { PropertyReportResponse } from '@/lib/types/property'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import { SectionInsightCard } from '../components/SectionInsightCard'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S8VergunningChecklistProps {
  data: PropertyReportResponse
}

/* ─── Types ─────────────────────────────────────────────────── */

interface ChecklistItem {
  id: string
  category: 'document' | 'onderzoek' | 'vergunning' | 'overig'
  title: string
  description: string
  required: boolean
  estimated_cost: string | null
}

interface ChecklistResponse {
  use_case: string
  items: ChecklistItem[]
  total: number
  error?: string
}

/* ─── Constants ──────────────────────────────────────────────── */

const CATEGORY_ORDER: ChecklistItem['category'][] = ['document', 'onderzoek', 'vergunning', 'overig']

const CATEGORY_LABELS: Record<string, string> = {
  document: 'Documenten',
  onderzoek: 'Onderzoeken',
  vergunning: 'Vergunningen',
  overig: 'Overig',
}

const CATEGORY_CLS: Record<string, string> = {
  document: 'border-blue-200 bg-blue-50 text-blue-700',
  onderzoek: 'border-purple-200 bg-purple-50 text-purple-700',
  vergunning: 'border-amber-200 bg-amber-50 text-amber-700',
  overig: 'border-slate-200 bg-slate-50 text-slate-600',
}

/* ─── Helpers ────────────────────────────────────────────────── */

function getTopUseCase(data: PropertyReportResponse): { id: string; label: string } | null {
  const scores = data.use_case_scores
  if (!scores || Object.keys(scores).length === 0) return null

  let topId: string | null = null
  let topScore = -1

  for (const [id, entry] of Object.entries(scores)) {
    if (entry.score > topScore) {
      topScore = entry.score
      topId = id
    }
  }

  if (!topId) return null
  return { id: topId, label: scores[topId].label }
}

function groupByCategory(items: ChecklistItem[]): Map<string, ChecklistItem[]> {
  const groups = new Map<string, ChecklistItem[]>()
  for (const cat of CATEGORY_ORDER) {
    const filtered = items.filter((i) => i.category === cat)
    if (filtered.length > 0) groups.set(cat, filtered)
  }
  return groups
}

/* ─── Hook ───────────────────────────────────────────────────── */

function useChecklist(useCase: string | null) {
  const { accessToken } = useAuth()

  return useQuery<ChecklistResponse, Error>({
    queryKey: ['vergunning-checklist', useCase],
    queryFn: () =>
      apiFetch<ChecklistResponse>(`/api/gemeente/checklists/${useCase}`, {
        method: 'GET',
        accessToken,
      }),
    enabled: !!useCase && !!accessToken,
    staleTime: 1000 * 60 * 60, // 1 hour — static data
  })
}

/* ─── Section ────────────────────────────────────────────────── */

export function S8VergunningChecklist({ data }: S8VergunningChecklistProps) {
  const topUseCase = getTopUseCase(data)
  const { data: checklist, isLoading, error } = useChecklist(topUseCase?.id ?? null)

  // No use_case_scores available — show empty state
  if (!topUseCase) {
    return (
      <SectionInsightCard kicker="Voorbereiding" title="Vergunning Checklist" Icon={ClipboardCheck}>
        <p className="text-[12px] text-slate-400">
          Geen use-case scores beschikbaar voor dit pand. Voer eerst een gebiedsscan uit om
          de ontwikkelingsmogelijkheden te berekenen.
        </p>
      </SectionInsightCard>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <SectionInsightCard kicker="Voorbereiding" title="Vergunning Checklist" Icon={ClipboardCheck}>
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="size-4 animate-spin text-slate-400" />
          <p className="text-[12px] text-slate-400">Checklist laden…</p>
        </div>
      </SectionInsightCard>
    )
  }

  // Error state
  if (error || !checklist || checklist.items.length === 0) {
    return (
      <SectionInsightCard kicker="Voorbereiding" title="Vergunning Checklist" Icon={ClipboardCheck}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p className="text-[12px] text-slate-500">
            {error
              ? `Kon checklist niet laden: ${error.message}`
              : `Geen checklist beschikbaar voor "${topUseCase.label}".`}
          </p>
        </div>
      </SectionInsightCard>
    )
  }

  const groups = groupByCategory(checklist.items)
  const requiredCount = checklist.items.filter((i) => i.required).length

  return (
    <div className="space-y-6">
      {/* ── Strategy badge ────────────────────────────────────── */}
      <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
          Top strategie
        </p>
        <p className="mt-1 text-[20px] font-bold text-[#0E1111]">{topUseCase.label}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {requiredCount} verplichte stappen · {checklist.total} totaal
        </p>
      </div>

      {/* ── Checklist grouped by category ─────────────────────── */}
      <SectionInsightCard kicker="Voorbereiding" title="Vergunning Checklist" Icon={ClipboardCheck}>
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="space-y-0">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 border-b border-[#EAEFEF] py-2.5 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-semibold text-[#0E1111]">{item.title}</p>
                        {item.required ? (
                          <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-1.5 py-0 text-[10px] font-medium text-red-700">
                            Verplicht
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0 text-[10px] font-medium text-slate-500">
                            Aanbevolen
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] text-slate-500 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_CLS[item.category] ?? CATEGORY_CLS.overig}`}
                      >
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                      {item.estimated_cost && (
                        <span className="text-[11px] font-medium tabular-nums text-slate-500">
                          {item.estimated_cost}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionInsightCard>
    </div>
  )
}
