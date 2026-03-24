/**
 * S5 Potentie & Risico Analyse — Due Diligence Dashboard section 5
 *
 * Displays: v3.0 score circles, per-factor breakdown table with expandable narratives
 * Includes upload zone for quickscan documents when sourceParcelId is available.
 */

import { useState, useRef } from 'react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S5PotentieRisicoAnalyseProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Types for v3.0 score breakdown ────────────────────────── */

interface FactorResult {
  naam?: string
  waarde?: unknown
  genormaliseerde_score?: number
  gewicht?: number
  bijdrage?: number
  categorie?: 'potentie' | 'risico'
  toelichting_kort?: string
  toelichting_lang?: string
  data_bronnen?: string[]
  missing?: boolean
}

interface ScoresV3 {
  overall?: number
  potentie?: number
  risico?: number
}

/* ─── Helpers ────────────────────────────────────────────────── */

function parseScores(raw: Record<string, unknown> | null | undefined): ScoresV3 | null {
  if (!raw) return null
  return {
    overall: typeof raw.overall === 'number' ? raw.overall : undefined,
    potentie: typeof raw.potentie === 'number' ? raw.potentie : undefined,
    risico: typeof raw.risico === 'number' ? raw.risico : undefined,
  }
}

function parseFactors(
  breakdown: Record<string, unknown> | null | undefined,
): FactorResult[] {
  if (!breakdown) return []
  return Object.entries(breakdown).map(([key, val]) => {
    const f = (val ?? {}) as Record<string, unknown>
    return {
      naam: key,
      waarde: f.waarde,
      genormaliseerde_score: typeof f.genormaliseerde_score === 'number' ? f.genormaliseerde_score : undefined,
      gewicht: typeof f.gewicht === 'number' ? f.gewicht : undefined,
      bijdrage: typeof f.bijdrage === 'number' ? f.bijdrage : undefined,
      categorie: (f.categorie as 'potentie' | 'risico' | undefined) ?? 'potentie',
      toelichting_kort: typeof f.toelichting_kort === 'string' ? f.toelichting_kort : undefined,
      toelichting_lang: typeof f.toelichting_lang === 'string' ? f.toelichting_lang : undefined,
      data_bronnen: Array.isArray(f.data_bronnen) ? (f.data_bronnen as string[]) : undefined,
      missing: typeof f.missing === 'boolean' ? f.missing : false,
    }
  })
}

/* ─── Sub-components ─────────────────────────────────────────── */

function ScoreCircle({
  label,
  value,
  accent,
}: {
  label: string
  value: number | null | undefined
  accent: 'green' | 'red' | 'amber'
}) {
  const ringColor =
    accent === 'green'
      ? 'border-emerald-200'
      : accent === 'red'
        ? 'border-red-200'
        : 'border-[#F9A826]/30'

  return (
    <div className={`flex flex-col items-center gap-1 rounded-[20px] border bg-white p-5 ${ringColor}`}>
      <p className="text-[48px] font-black text-[#0E1111] tabular-nums leading-none">
        {value != null ? Math.round(value) : '–'}
      </p>
      <p className="text-[12px] text-slate-400">{label}</p>
    </div>
  )
}

/* ─── Expandable factor row ──────────────────────────────────── */

function FactorRow({ factor }: { factor: FactorResult }) {
  const [expanded, setExpanded] = useState(false)

  const formatWaarde = (v: unknown): string => {
    if (v == null) return '–'
    if (typeof v === 'number') return v.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
    if (typeof v === 'boolean') return v ? 'Ja' : 'Nee'
    return String(v)
  }

  return (
    <>
      <tr
        className={`border-b border-[#EAEFEF] transition-colors hover:bg-[#F8FAFA] ${factor.toelichting_lang ? 'cursor-pointer' : ''}`}
        onClick={() => factor.toelichting_lang && setExpanded((v) => !v)}
      >
        <td className="py-2.5 pr-2">
          <div className="flex items-center gap-2">
            {factor.toelichting_lang && (
              <span className={`text-[10px] text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
            )}
            <span className="text-[13px] font-semibold text-[#0E1111]">{factor.naam ?? '–'}</span>
            {factor.missing && (
              <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                MISSING
              </span>
            )}
          </div>
        </td>
        <td className="py-2.5 text-[12px] text-slate-400">{formatWaarde(factor.waarde)}</td>
        <td className="py-2.5 text-center text-[13px] font-semibold text-[#0E1111] tabular-nums">
          {factor.genormaliseerde_score != null ? Math.round(factor.genormaliseerde_score) : '–'}
        </td>
        <td className="py-2.5 text-center text-[12px] text-slate-400">
          {factor.gewicht != null ? `${(factor.gewicht * 100).toFixed(0)}%` : '–'}
        </td>
        <td className="py-2.5 text-right text-[13px] font-semibold text-[#0E1111] tabular-nums">
          {factor.bijdrage != null
            ? `${factor.bijdrage > 0 ? '+' : ''}${factor.bijdrage.toFixed(1)}`
            : '–'}
        </td>
      </tr>
      {expanded && factor.toelichting_lang && (
        <tr className="border-b border-[#EAEFEF]/50">
          <td colSpan={5} className="pb-3 pt-1">
            <p className="text-[12px] text-slate-400 leading-relaxed">{factor.toelichting_lang}</p>
            {factor.toelichting_kort && (
              <p className="mt-1 text-[12px] text-slate-400">{factor.toelichting_kort}</p>
            )}
            {factor.data_bronnen && factor.data_bronnen.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {factor.data_bronnen.map((b, i) => (
                  <span key={i} className="rounded-full border border-[#EAEFEF] bg-white px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

/* ─── Factors table ─────────────────────────────────────────── */

function FactorsTable({ factors, title }: { factors: FactorResult[]; title: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">
        {title} ({factors.length})
      </p>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#EAEFEF]">
            {['Factor', 'Waarde', 'Score', 'Gewicht', 'Bijdrage'].map((h, i) => (
              <th
                key={h}
                className={`pb-2 text-[12px] text-slate-400 font-normal ${
                  i === 0
                    ? 'text-left pr-2'
                    : i === 4
                      ? 'text-right'
                      : ['Score', 'Gewicht'].includes(h)
                        ? 'text-center'
                        : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {factors.map((f, i) => (
            <FactorRow key={i} factor={f} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── Upload Zone ────────────────────────────────────────────── */

function UploadZone({ parcelId }: { parcelId: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: docs } = useParcelDocuments(parcelId)
  const upload = useUploadDocument()
  const existing = docs?.documents?.filter((d) => d.document_type === 'quickscan') ?? []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    upload.mutate({ parcelId, documentType: 'quickscan', file })
    e.target.value = ''
  }

  return (
    <div className="border-t border-[#EAEFEF] pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-slate-400">Quickscan documenten</p>
          {existing.length > 0 && (
            <p className="mt-0.5 text-[12px] text-slate-400">
              {existing.length} document{existing.length !== 1 ? 'en' : ''} geupload
            </p>
          )}
        </div>
        <input ref={fileRef} type="file" onChange={handleChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 rounded-full border border-[#EAEFEF] px-3 py-1.5 text-[12px] text-slate-400 transition-colors hover:border-slate-300 hover:text-[#0E1111] disabled:opacity-50"
        >
          {upload.isPending ? 'Uploaden...' : '+ Document toevoegen'}
        </button>
      </div>
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S5PotentieRisicoAnalyse({ data, sourceParcelId }: S5PotentieRisicoAnalyseProps) {
  const scores = parseScores(data.scores_v3)
  const allFactors = parseFactors(data.score_breakdown_v3)

  if (!scores && allFactors.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-[13px] font-semibold text-[#0E1111]">Score analyse niet beschikbaar</p>
          <p className="mt-2 text-[12px] text-slate-400 max-w-sm mx-auto">
            Genereer een nieuw rapport vanuit een perceelscan voor v3.0 scores met per-factor breakdown.
          </p>
          <p className="mt-1 text-[12px] text-slate-400">Model: {data.score_model_version ?? 'onbekend'}</p>
        </div>
        {sourceParcelId ? <UploadZone parcelId={sourceParcelId} /> : (
          <div className="border-t border-[#EAEFEF] pt-4">
            <p className="text-[12px] text-slate-400">Koppel een perceel om documenten te uploaden</p>
          </div>
        )}
      </div>
    )
  }

  const potentieFactors = allFactors
    .filter((f) => f.categorie === 'potentie')
    .sort((a, b) => (b.bijdrage ?? 0) - (a.bijdrage ?? 0))

  const risicoFactors = allFactors
    .filter((f) => f.categorie === 'risico')
    .sort((a, b) => (b.bijdrage ?? 0) - (a.bijdrage ?? 0))

  return (
    <div className="space-y-6">
      {/* Score circles */}
      <div className="flex gap-6 justify-center">
        <ScoreCircle label="Potentiescore" value={scores?.potentie} accent="green" />
        <ScoreCircle label="Overall score" value={scores?.overall} accent="amber" />
        <ScoreCircle label="Risicoscore" value={scores?.risico} accent="red" />
      </div>

      {data.score_model_version && (
        <p className="text-center text-[12px] text-slate-400">
          Model: {data.score_model_version}
        </p>
      )}

      {/* Potentie factors table */}
      {potentieFactors.length > 0 && (
        <FactorsTable factors={potentieFactors} title="Potentiefactoren" />
      )}

      {/* Risico factors table */}
      {risicoFactors.length > 0 && (
        <FactorsTable factors={risicoFactors} title="Risicofactoren" />
      )}

      {/* Upload zone */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3">Documenten</p>
        {sourceParcelId ? <UploadZone parcelId={sourceParcelId} /> : (
          <p className="text-[12px] text-slate-400">Koppel een perceel om documenten te uploaden</p>
        )}
      </div>
    </div>
  )
}
