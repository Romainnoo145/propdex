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
  const colorClass =
    accent === 'green'
      ? 'text-green-600 border-green-200 bg-green-50'
      : accent === 'red'
        ? 'text-red-600 border-red-200 bg-red-50'
        : 'text-[#F9A826] border-[#F9A826]/20 bg-[#F9A826]/[0.06]'

  return (
    <div className={`flex flex-col items-center rounded-2xl border p-5 ${colorClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-2 text-4xl font-black tracking-tighter">
        {value != null ? Math.round(value) : '–'}
      </p>
      <p className="mt-0.5 text-xs font-semibold opacity-60">/ 100</p>
    </div>
  )
}

/* ─── Expandable factor row ──────────────────────────────────── */

function FactorRow({ factor, accent }: { factor: FactorResult; accent: 'green' | 'red' }) {
  const [expanded, setExpanded] = useState(false)
  const rowBg = accent === 'green' ? 'hover:bg-green-50/50' : 'hover:bg-red-50/50'
  const bijdrageColor = accent === 'green' ? 'text-green-700' : 'text-red-700'

  const formatWaarde = (v: unknown): string => {
    if (v == null) return '–'
    if (typeof v === 'number') return v.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
    if (typeof v === 'boolean') return v ? 'Ja' : 'Nee'
    return String(v)
  }

  return (
    <>
      <tr
        className={`cursor-pointer border-t border-neutral-100 transition-colors ${rowBg}`}
        onClick={() => factor.toelichting_lang && setExpanded((v) => !v)}
      >
        <td className="py-2 pl-4 pr-2">
          <div className="flex items-center gap-2">
            {factor.toelichting_lang && (
              <span className={`text-neutral-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
            )}
            <span className="text-sm text-[#1A1C1E]">{factor.naam ?? '–'}</span>
            {factor.missing && (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-500">
                MISSING
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-2 text-xs text-neutral-600">{formatWaarde(factor.waarde)}</td>
        <td className="px-2 py-2 text-center">
          <span className="text-sm font-semibold tabular-nums text-[#1A1C1E]">
            {factor.genormaliseerde_score != null ? Math.round(factor.genormaliseerde_score) : '–'}
          </span>
        </td>
        <td className="px-2 py-2 text-center text-xs text-neutral-500">
          {factor.gewicht != null ? `${(factor.gewicht * 100).toFixed(0)}%` : '–'}
        </td>
        <td className={`px-2 py-2 pr-4 text-right text-sm font-bold tabular-nums ${bijdrageColor}`}>
          {factor.bijdrage != null
            ? `${factor.bijdrage > 0 ? '+' : ''}${factor.bijdrage.toFixed(1)}`
            : '–'}
        </td>
      </tr>
      {expanded && factor.toelichting_lang && (
        <tr className="border-t border-neutral-50">
          <td colSpan={5} className="bg-neutral-50/70 px-4 pb-3 pt-2">
            <p className="text-xs text-neutral-700 leading-relaxed">{factor.toelichting_lang}</p>
            {factor.toelichting_kort && (
              <p className="mt-1 text-xs text-neutral-500">{factor.toelichting_kort}</p>
            )}
            {factor.data_bronnen && factor.data_bronnen.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {factor.data_bronnen.map((b, i) => (
                  <span key={i} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600">
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
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-neutral-600">Quickscan documenten</p>
          {existing.length > 0 && (
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {existing.length} document{existing.length !== 1 ? 'en' : ''} geupload
            </p>
          )}
        </div>
        <input ref={fileRef} type="file" onChange={handleChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-800 disabled:opacity-50"
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
      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-neutral-500">Score analyse niet beschikbaar</p>
          <p className="mt-2 text-xs text-neutral-400 max-w-sm mx-auto">
            Genereer een nieuw rapport vanuit een perceelscan voor v3.0 scores met per-factor breakdown.
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Model: {data.score_model_version ?? 'onbekend'}</p>
        </div>
        {sourceParcelId ? <UploadZone parcelId={sourceParcelId} /> : (
          <div className="border-t border-neutral-100 pt-4">
            <p className="text-[11px] text-neutral-400">Koppel een perceel om documenten te uploaden</p>
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
    <div className="space-y-5">
      {/* Score circles */}
      <div className="grid grid-cols-3 gap-4">
        <ScoreCircle label="Potentiescore" value={scores?.potentie} accent="green" />
        <ScoreCircle label="Overall score" value={scores?.overall} accent="amber" />
        <ScoreCircle label="Risicoscore" value={scores?.risico} accent="red" />
      </div>

      {data.score_model_version && (
        <p className="text-center text-[11px] text-neutral-400">
          Model: {data.score_model_version}
        </p>
      )}

      {/* Potentie factors table */}
      {potentieFactors.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-green-600">
              Potentiefactoren ({potentieFactors.length})
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="py-2 pl-4 pr-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Factor</th>
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Waarde</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Score</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Gewicht</th>
                <th className="px-2 py-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Bijdrage</th>
              </tr>
            </thead>
            <tbody>
              {potentieFactors.map((f, i) => (
                <FactorRow key={i} factor={f} accent="green" />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Risico factors table */}
      {risicoFactors.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-red-600">
              Risicofactoren ({risicoFactors.length})
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="py-2 pl-4 pr-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Factor</th>
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Waarde</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Score</th>
                <th className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Gewicht</th>
                <th className="px-2 py-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Bijdrage</th>
              </tr>
            </thead>
            <tbody>
              {risicoFactors.map((f, i) => (
                <FactorRow key={i} factor={f} accent="red" />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload zone */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Documenten</p>
        {sourceParcelId ? <UploadZone parcelId={sourceParcelId} /> : (
          <p className="text-[11px] text-neutral-400">Koppel een perceel om documenten te uploaden</p>
        )}
      </div>
    </div>
  )
}
