/**
 * S6 Vergunningen & Precedenten — Due Diligence Dashboard section 6
 *
 * Displays: SRU bekendmakingen (vergunningen_data), permit precedent benchmark
 * Includes upload zone for vergunninghistorie documents when sourceParcelId is available.
 */

import { useRef } from 'react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'

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
  if (outcome === 'granted') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (outcome === 'requested') return 'border-[#F9A826]/25 bg-[#F9A826]/10 text-[#F9A826]'
  if (outcome === 'rejected' || outcome === 'withdrawn') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-[#EAEFEF] bg-[#F8FAFA] text-slate-600'
}

/* ─── Sub-components ─────────────────────────────────────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{title}</p>
      {children}
    </div>
  )
}

/* ─── Upload Zone ────────────────────────────────────────────── */

function UploadZone({ parcelId }: { parcelId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: docs } = useParcelDocuments(parcelId)
  const upload = useUploadDocument()
  const existing = docs?.documents?.filter((d) => d.document_type === 'vergunninghistorie') ?? []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    upload.mutate({ parcelId, documentType: 'vergunninghistorie', file })
    e.target.value = ''
  }

  return (
    <div className="mt-4 border-t border-[#EAEFEF] pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-600">Vergunninghistorie documenten</p>
          {existing.length > 0 && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {existing.length} document{existing.length !== 1 ? 'en' : ''} geupload
            </p>
          )}
        </div>
        <input ref={fileRef} type="file" onChange={handleChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-[#0E1111] disabled:opacity-50"
        >
          {upload.isPending ? 'Uploaden...' : '+ Document toevoegen'}
        </button>
      </div>
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S6VergunningenPrecedenten({ data, sourceParcelId }: S6VergunningenPrecedentenProps) {
  const vergunningen = data.vergunningen_data
  const benchmark = data.permit_precedents

  const hasData = (vergunningen && vergunningen.length > 0) || !!benchmark

  if (!hasData) {
    return (
      <div className="space-y-4">
        <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[13px] font-semibold text-slate-500">Geen vergunningendata beschikbaar</p>
          <p className="mt-2 text-[11px] text-slate-400 max-w-sm mx-auto">
            Vergunningsprecedenten worden opgehaald bij het genereren van een scan op dit adres.
          </p>
        </div>
        {sourceParcelId ? <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"><UploadZone parcelId={sourceParcelId} /></div> : null}
      </div>
    )
  }

  const orderedOutcomeKeys = ['granted', 'requested', 'rejected', 'withdrawn', 'other']

  return (
    <div className="space-y-4">
      {/* SRU Bekendmakingen */}
      {vergunningen && vergunningen.length > 0 && (
        <Card title={`Vergunningen & Bekendmakingen (${vergunningen.length})`}>
          <div className="divide-y divide-[#EAEFEF] rounded-[16px] border border-[#EAEFEF]">
            {vergunningen.slice(0, 10).map((v, idx) => {
              const vg = v as Record<string, unknown>
              return (
                <div key={idx} className="px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-[#0E1111]">
                    {(vg.title as string | undefined) ?? (vg.onderwerp as string | undefined) ?? 'Onbekend'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
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
            <p className="mt-2 text-[11px] text-slate-500 text-right">
              + {vergunningen.length - 10} meer bekendmakingen
            </p>
          )}
        </Card>
      )}

      {/* Precedent Benchmark */}
      {benchmark && (
        <Card title="Precedent Benchmark">
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="rounded-[16px] border border-[#EAEFEF] overflow-hidden">
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
                <p className="mb-2 text-[11px] font-semibold text-slate-500">Uitkomstverdeling</p>
                <div className="flex flex-wrap gap-1.5">
                  {orderedOutcomeKeys
                    .filter((key) => benchmark.outcome_distribution[key] != null)
                    .map((key) => (
                      <span
                        key={key}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${outcomeClass(key)}`}
                      >
                        {OUTCOME_LABELS[key] ?? key}: {benchmark.outcome_distribution[key]}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Low sample warning */}
            {benchmark.low_sample_warning && (
              <div className="rounded-[16px] border border-[#F9A826]/20 bg-[#F9A826]/[0.06] px-3 py-2">
                <p className="text-[11px] text-[#F9A826]">{benchmark.low_sample_warning}</p>
              </div>
            )}

            {/* Reference list */}
            {benchmark.references.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold text-slate-500">
                  Recente referenties ({benchmark.references.length})
                </p>
                <div className="divide-y divide-[#EAEFEF] rounded-[16px] border border-[#EAEFEF]">
                  {benchmark.references.map((ref) => (
                    <div key={ref.change_record_id} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${outcomeClass(ref.outcome)}`}>
                          {OUTCOME_LABELS[ref.outcome] ?? ref.outcome}
                        </span>
                        <p className="text-[13px] font-semibold text-[#0E1111]">{ref.title}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{new Date(ref.change_date).toLocaleDateString('nl-NL')}</span>
                        {ref.source_url && (
                          <a
                            href={ref.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 transition-colors hover:text-[#0E1111]"
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
        </Card>
      )}

      {/* Upload zone */}
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Documenten</p>
        {sourceParcelId ? <UploadZone parcelId={sourceParcelId} /> : (
          <p className="text-[11px] text-slate-400">Koppel een perceel om documenten te uploaden</p>
        )}
      </div>
    </div>
  )
}
