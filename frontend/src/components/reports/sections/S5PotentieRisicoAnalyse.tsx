/**
 * S5 Potentie & Risico Analyse — Due Diligence Dashboard section 5
 *
 * Score hero with three RingProgress circles, per-factor breakdown tables
 * with expandable narratives, and section notes.
 */

import { useState } from 'react'
import { TrendingUp, ShieldAlert, Lightbulb } from 'lucide-react'
import { motion } from 'framer-motion'
import type { PropertyReportResponse } from '@/lib/types/property'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SectionNotes } from '../components'

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



/* ─── Expandable factor row ──────────────────────────────────── */

function FactorRow({ factor, totalWeight }: { factor: FactorResult; totalWeight: number }) {
  const [expanded, setExpanded] = useState(false)

  const formatWaarde = (v: unknown): string => {
    if (v == null) return '–'
    if (typeof v === 'number') return v.toLocaleString('nl-NL', { maximumFractionDigits: 2 })
    if (typeof v === 'boolean') return v ? 'Ja' : 'Nee'
    if (typeof v === 'object' && v !== null) {
      return Object.entries(v as Record<string, unknown>)
        .map(([k, val]) => `${k}: ${val}`)
        .join(', ')
    }
    return `${v}`
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
          {factor.gewicht != null && totalWeight > 0
            ? `${((factor.gewicht / totalWeight) * 100).toFixed(0)}%`
            : '–'}
        </td>
        <td className={`py-2.5 text-right text-[13px] font-semibold tabular-nums ${
          factor.bijdrage != null && factor.bijdrage > 0 ? 'text-emerald-600'
            : factor.bijdrage != null && factor.bijdrage < 0 ? 'text-red-500'
              : 'text-[#0E1111]'
        }`}>
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
  const totalWeight = factors.reduce((s, f) => s + (f.gewicht ?? 0), 0)

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
            <FactorRow key={i} factor={f} totalWeight={totalWeight} />
          ))}
        </tbody>
      </table>
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
            Genereer een nieuw rapport vanuit een perceelscan voor scores met per-factor breakdown.
          </p>
        </div>
        <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
          <SectionNotes parcelId={sourceParcelId ?? null} documentTypes={['quickscan']} />
        </SectionInsightCard>
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
      {/* ── Score hero — standalone, no card header ─────────── */}
      <section className="rounded-[24px] border border-[#EAEFEF] bg-white p-6">
        <div className="flex items-center justify-center gap-8 py-2">
          {/* Potentie ring — emerald */}
          <div className="flex flex-col items-center gap-2">
            <svg width={80} height={80} viewBox="0 0 100 100">
              <circle cx={50} cy={50} r={40} fill="none" stroke="#f1f5f9" strokeWidth={7} />
              <motion.circle
                cx={50} cy={50} r={40} fill="none" stroke="#22c55e" strokeWidth={7}
                strokeLinecap="round" strokeDasharray={251.3}
                initial={{ strokeDashoffset: 251.3 }}
                animate={{ strokeDashoffset: 251.3 * (1 - (scores?.potentie ?? 0) / 100) }}
                transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
                transform="rotate(-90 50 50)"
              />
              <text x={50} y={50} textAnchor="middle" dominantBaseline="central"
                className="fill-[#0E1111] font-bold" fontSize={24}>
                {scores?.potentie != null ? Math.round(scores.potentie) : '–'}
              </text>
            </svg>
            <span className="text-[11px] font-semibold text-emerald-600">Potentie</span>
          </div>

          {/* Overall ring — amber */}
          <div className="flex flex-col items-center gap-2">
            <svg width={96} height={96} viewBox="0 0 100 100">
              <circle cx={50} cy={50} r={40} fill="none" stroke="#f1f5f9" strokeWidth={7} />
              <motion.circle
                cx={50} cy={50} r={40} fill="none" stroke="#F9A826" strokeWidth={7}
                strokeLinecap="round" strokeDasharray={251.3}
                initial={{ strokeDashoffset: 251.3 }}
                animate={{ strokeDashoffset: 251.3 * (1 - (scores?.overall ?? 0) / 100) }}
                transition={{ duration: 1, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                transform="rotate(-90 50 50)"
              />
              <text x={50} y={50} textAnchor="middle" dominantBaseline="central"
                className="fill-[#0E1111] font-bold" fontSize={28}>
                {scores?.overall != null ? Math.round(scores.overall) : '–'}
              </text>
            </svg>
            <span className="text-[12px] font-bold text-aura-amber-dark">Overall</span>
          </div>

          {/* Risico ring — red */}
          <div className="flex flex-col items-center gap-2">
            <svg width={80} height={80} viewBox="0 0 100 100">
              <circle cx={50} cy={50} r={40} fill="none" stroke="#f1f5f9" strokeWidth={7} />
              <motion.circle
                cx={50} cy={50} r={40} fill="none" stroke="#ef4444" strokeWidth={7}
                strokeLinecap="round" strokeDasharray={251.3}
                initial={{ strokeDashoffset: 251.3 }}
                animate={{ strokeDashoffset: 251.3 * (1 - (scores?.risico ?? 0) / 100) }}
                transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                transform="rotate(-90 50 50)"
              />
              <text x={50} y={50} textAnchor="middle" dominantBaseline="central"
                className="fill-[#0E1111] font-bold" fontSize={24}>
                {scores?.risico != null ? Math.round(scores.risico) : '–'}
              </text>
            </svg>
            <span className="text-[11px] font-semibold text-red-500">Risico</span>
          </div>
        </div>
      </section>

      {/* ── Potentie factors ──────────────────────────────────── */}
      {potentieFactors.length > 0 && (
        <SectionInsightCard kicker="Potentie" title="Potentiefactoren" Icon={TrendingUp}>
          <FactorsTable factors={potentieFactors} title={`Potentiefactoren`} />
        </SectionInsightCard>
      )}

      {/* ── Risico factors ────────────────────────────────────── */}
      {risicoFactors.length > 0 && (
        <SectionInsightCard kicker="Risico" title="Risicofactoren" Icon={ShieldAlert}>
          <FactorsTable factors={risicoFactors} title={`Risicofactoren`} />
        </SectionInsightCard>
      )}

      {/* ── Notes / uploads ───────────────────────────────────── */}
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes parcelId={sourceParcelId ?? null} documentTypes={['quickscan']} />
      </SectionInsightCard>
    </div>
  )
}
