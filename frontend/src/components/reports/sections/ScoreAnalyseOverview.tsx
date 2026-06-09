/**
 * ScoreAnalyseOverview — the shared "Analyse" visual: three score rings
 * (Potentie / Overall / Risico) + per-factor breakdown tables.
 *
 * Extracted from S5PotentieRisicoAnalyse so the report tab and the off-market
 * "Bekijk scores" panel render one identical overview. Callers pass already-
 * parsed data (see scoreAnalyse.ts: parseScores/parseFactors/analyseFromScanItem).
 */
import { useState } from 'react'
import { TrendingUp, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'
import { SectionInsightCard } from '../components/SectionInsightCard'
import type { FactorResult, ScoresV3 } from './scoreAnalyse'

function ScoreRing({
  value,
  color,
  label,
  labelClass,
  size,
  delay,
}: {
  value: number | undefined
  color: string
  label: string
  labelClass: string
  size: number
  delay: number
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={40} fill="none" stroke="#f1f5f9" strokeWidth={7} />
        <motion.circle
          cx={50} cy={50} r={40} fill="none" stroke={color} strokeWidth={7}
          strokeLinecap="round" strokeDasharray={251.3}
          initial={{ strokeDashoffset: 251.3 }}
          animate={{ strokeDashoffset: 251.3 * (1 - (value ?? 0) / 100) }}
          transition={{ duration: 1, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          transform="rotate(-90 50 50)"
        />
        <text x={50} y={50} textAnchor="middle" dominantBaseline="central"
          className="fill-[#0E1111] font-bold" fontSize={size >= 96 ? 28 : 24}>
          {value != null ? Math.round(value) : '–'}
        </text>
      </svg>
      <span className={labelClass}>{label}</span>
    </div>
  )
}

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
          factor.categorie === 'potentie' && factor.bijdrage != null && factor.bijdrage > 0 ? 'text-emerald-600'
            : factor.categorie === 'risico' && factor.bijdrage != null && factor.bijdrage > 0 ? 'text-red-500'
              : 'text-slate-400'
        }`}>
          {factor.bijdrage != null
            ? factor.bijdrage > 0 ? factor.bijdrage.toFixed(1) : '–'
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

export function FactorsTable({ factors, title }: { factors: FactorResult[]; title: string }) {
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

/**
 * Score rings + potentie/risico factor tables. Notes/uploads stay with the
 * report section (S5) and are intentionally not part of this shared overview.
 */
export function ScoreAnalyseOverview({
  scores,
  potentieFactors,
  risicoFactors,
}: {
  scores: ScoresV3 | null
  potentieFactors: FactorResult[]
  risicoFactors: FactorResult[]
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-[#EAEFEF] bg-white p-6">
        <div className="flex items-center justify-center gap-8 py-2">
          <ScoreRing value={scores?.potentie} color="#22c55e" label="Potentie"
            labelClass="text-[11px] font-semibold text-emerald-600" size={80} delay={0} />
          <ScoreRing value={scores?.overall} color="#F9A826" label="Overall"
            labelClass="text-[12px] font-bold text-aura-amber-dark" size={96} delay={0.15} />
          <ScoreRing value={scores?.risico} color="#ef4444" label="Risico"
            labelClass="text-[11px] font-semibold text-red-500" size={80} delay={0.3} />
        </div>
      </section>

      {potentieFactors.length > 0 && (
        <SectionInsightCard kicker="Potentie" title="Potentiefactoren" Icon={TrendingUp}>
          <FactorsTable factors={potentieFactors} title="Potentiefactoren" />
        </SectionInsightCard>
      )}

      {risicoFactors.length > 0 && (
        <SectionInsightCard kicker="Risico" title="Risicofactoren" Icon={ShieldAlert}>
          <FactorsTable factors={risicoFactors} title="Risicofactoren" />
        </SectionInsightCard>
      )}
    </div>
  )
}
