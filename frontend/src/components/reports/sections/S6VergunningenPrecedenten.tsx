/**
 * S6 Vergunningen & Precedenten — Due Diligence Dashboard section 6
 *
 * Displays: SRU bekendmakingen (vergunningen_data), permit precedent benchmark
 * Includes upload zone for vergunninghistorie documents when sourceParcelId is available.
 *
 * Visual system: SectionInsightCard (S01–S04 pattern). Animation-free.
 */

import { FileText, Scale } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SectionNotes, SubCard } from '../components'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S6VergunningenPrecedentenProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Outcome badge ──────────────────────────────────────────── */

const OUTCOME_LABELS: Record<string, string> = {
  granted: 'Verleend',
  requested: 'Aangevraagd',
  rejected: 'Geweigerd',
  withdrawn: 'Ingetrokken',
  other: 'Overig',
}

function outcomeClass(outcome: string): string {
  if (outcome === 'granted') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (outcome === 'requested') return 'border-[#F9A826]/25 bg-[#F9A826]/10 text-[#F9A826]'
  if (outcome === 'rejected' || outcome === 'withdrawn') return 'border-slate-200 bg-slate-50 text-slate-600'
  return 'border-[#EAEFEF] bg-[#F8FAFA] text-slate-600'
}

/* ─── Section ────────────────────────────────────────────────── */

export function S6VergunningenPrecedenten({ data, sourceParcelId }: S6VergunningenPrecedentenProps) {
  const vergunningen = data.vergunningen_data
  const benchmark = data.permit_precedents

  const hasData = (vergunningen && vergunningen.length > 0) || !!benchmark

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-[13px] font-semibold text-[#0E1111]">Geen vergunningendata beschikbaar</p>
          <p className="mx-auto mt-2 max-w-sm text-[12px] text-slate-400">
            Vergunningsprecedenten worden opgehaald bij het genereren van een scan op dit adres.
          </p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">Documenten</p>
          {sourceParcelId ? <SectionNotes parcelId={sourceParcelId} documentTypes={['vergunninghistorie']} label="Vergunninghistorie documenten" /> : <SectionNotes parcelId={null} />}
        </div>
      </div>
    )
  }

  const orderedOutcomeKeys = ['granted', 'requested', 'rejected', 'withdrawn', 'other']

  return (
    <div className="space-y-6">
      {/* ── Vergunningen & Bekendmakingen ─────────────────────── */}
      {vergunningen && vergunningen.length > 0 && (
        <SectionInsightCard kicker="Vergunningen" title={`Bekendmakingen (${vergunningen.length})`} Icon={FileText}>
          <div>
            {vergunningen.slice(0, 10).map((v, idx) => {
              const vg = v as Record<string, unknown>
              return (
                <div key={idx} className="py-3 border-b border-[#EAEFEF] last:border-b-0">
                  <p className="text-[13px] font-semibold text-[#0E1111]">
                    {(vg.title as string | undefined) ?? (vg.onderwerp as string | undefined) ?? 'Onbekend'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {(vg.date as string | undefined) && (
                      <span>{new Date(vg.date as string).toLocaleDateString('nl-NL')}</span>
                    )}
                    {(vg.type as string | undefined) && (
                      <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5">
                        {vg.type as string}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {vergunningen.length > 10 && (
            <p className="mt-2 text-right text-[11px] text-slate-400">
              + {vergunningen.length - 10} meer bekendmakingen
            </p>
          )}
        </SectionInsightCard>
      )}

      {/* ── Precedent Benchmark ───────────────────────────────── */}
      {benchmark && (
        <SectionInsightCard kicker="Precedenten" title="Benchmark" Icon={Scale}>
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-[#EAEFEF] sm:grid-cols-3">
                <div className="px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Gemeente</p>
                  <p className="mt-1 text-[15px] font-semibold text-[#0E1111]">{benchmark.gemeente_scope}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Type</p>
                  <p className="mt-1 text-[13px] font-semibold text-[#0E1111]">{benchmark.comparable_type}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Steekproef</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#0E1111]">{benchmark.sample_size}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-[#EAEFEF] divide-x divide-[#EAEFEF]">
                <div className="px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Venster</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#0E1111]">{benchmark.lookback_days} dagen</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Median</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#0E1111]">
                    {benchmark.median_processing_days != null ? `${benchmark.median_processing_days} d` : '–'}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">P75</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#0E1111]">
                    {benchmark.p75_processing_days != null ? `${benchmark.p75_processing_days} d` : '–'}
                  </p>
                </div>
              </div>
            </div>

            {/* Outcome distribution */}
            {Object.keys(benchmark.outcome_distribution).length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold text-slate-400">Uitkomstverdeling</p>
                <div className="flex flex-wrap gap-1.5">
                  {orderedOutcomeKeys
                    .filter((key) => benchmark.outcome_distribution[key] != null)
                    .map((key) => (
                      <span
                        key={key}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${outcomeClass(key)}`}
                      >
                        {OUTCOME_LABELS[key] ?? key}: {benchmark.outcome_distribution[key]}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Low sample warning */}
            {benchmark.low_sample_warning && (
              <div className="rounded-[16px] border border-[#F9A826]/20 bg-[#F9A826]/[0.06] px-4 py-3">
                <p className="text-[11px] text-[#F9A826]">{benchmark.low_sample_warning}</p>
              </div>
            )}

            {/* Reference list */}
            {benchmark.references.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold text-slate-400">
                  Recente referenties ({benchmark.references.length})
                </p>
                <div>
                  {benchmark.references.map((ref) => (
                    <div key={ref.change_record_id} className="py-3 border-b border-[#EAEFEF] last:border-b-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${outcomeClass(ref.outcome)}`}>
                          {OUTCOME_LABELS[ref.outcome] ?? ref.outcome}
                        </span>
                        <p className="text-[13px] font-semibold text-[#0E1111]">{ref.title}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{new Date(ref.change_date).toLocaleDateString('nl-NL')}</span>
                        {ref.source_url && (
                          <a
                            href={ref.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-500 transition-colors hover:text-[#0E1111]"
                          >
                            Officiële publicatie ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionInsightCard>
      )}

      {/* ── Upload zone ───────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">Documenten</p>
        <SectionNotes parcelId={sourceParcelId} documentTypes={['vergunninghistorie']} label="Vergunninghistorie documenten" />
      </div>
    </div>
  )
}
