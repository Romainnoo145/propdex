/**
 * FactorExplainBody — Generic explanation body for non-cascade factors
 *
 * Renders a factor's detailed explanation in the Aura editorial language used
 * by the cascade drawers: amber intelligence eyebrow + score-opbouw keyline,
 * sage-mint source pills. Designed for display inside a drawer (always expanded).
 */

import { MapPin } from 'lucide-react'
import { type ScoreFactor, formatFactorName, isWijkBreed } from './lib/factor-detail'

export function FactorExplainBody({
  name,
  factor,
}: {
  name: string
  factor: ScoreFactor
}) {
  const score = factor.genormaliseerde_score
  const isRisico = factor.categorie === 'risico'
  const categorieLabel = isRisico ? 'Risico' : 'Potentie'
  const resultPill = isRisico
    ? 'text-red-700 bg-red-50'
    : 'text-green-700 bg-green-50'

  return (
    <div>
      {/* Meta line */}
      <p className="text-[11px] font-medium text-[#9CA3AF]">Perceelfactor</p>

      {/* Eyebrow — amber intelligence kicker */}
      <div className="mt-[18px] flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[#F9A826]" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#F9A826]">
          {categorieLabel}
        </span>
      </div>

      {/* Editorial headline */}
      <h2 className="mt-1.5 text-[38px] font-black leading-none tracking-[-0.035em] text-[#0E1111]">
        {formatFactorName(name)}
      </h2>

      {/* Lead — what this factor measures */}
      <p className="mt-4 text-[14px] leading-[1.7] text-[#374151]">
        {factor.toelichting_lang ??
          factor.toelichting_kort ??
          'Geen toelichting beschikbaar.'}
      </p>
      {factor.dev_type_ruling_count !== null &&
        factor.total_ruling_count !== null && (
          <p className="mt-2 text-[12px] italic text-slate-500">
            Gebaseerd op {factor.dev_type_ruling_count} van{' '}
            {factor.total_ruling_count} uitspraken na filtering op dev-types.
          </p>
        )}

      {/* Score-opbouw — amber keyline (the intelligence moment) */}
      <div className="mt-6 border-l-[3px] border-[#F9A826] pl-[18px]">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
          Score-opbouw
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <span className="text-[13px] text-slate-600">
            Genormaliseerd{' '}
            <b className="text-[#0E1111] tabular-nums">
              {score !== null ? Math.round(score) : '—'}
            </b>
          </span>
          {factor.gewicht !== null && (
            <>
              <span className="font-bold text-slate-300">×</span>
              <span className="text-[13px] text-slate-600">
                Gewicht <b className="text-[#0E1111] tabular-nums">{factor.gewicht}</b>
              </span>
            </>
          )}
          {factor.bijdrage !== null && (
            <>
              <span className="font-bold text-slate-300">=</span>
              <span className={`rounded-full px-3 py-1 text-[13px] font-extrabold tabular-nums ${resultPill}`}>
                {factor.bijdrage > 0
                  ? `+${factor.bijdrage.toFixed(1)}`
                  : factor.bijdrage.toFixed(1)}
              </span>
            </>
          )}
        </div>
        {factor.percentage_of_category !== null &&
          factor.percentage_of_category > 0 && (
            <p className="mt-2 text-[11px] text-slate-500">
              {Math.round(factor.percentage_of_category * 100)}% van de{' '}
              {categorieLabel.toLowerCase()}-categorie.
            </p>
          )}
      </div>

      {/* Databron — sage-mint pills */}
      {factor.data_bronnen && factor.data_bronnen.length > 0 && (
        <div className="mt-6">
          <p className="mb-2.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
            Databron
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {factor.data_bronnen.map((bron) => (
              <span
                key={bron}
                className="rounded-full bg-[#D1E2D8] px-3 py-1.5 text-[12px] font-medium text-[#374151]"
              >
                {bron}
              </span>
            ))}
            {isWijkBreed(factor.data_bronnen) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D1E2D8] px-3 py-1.5 text-[12px] font-bold text-[#2D5F4C]">
                <MapPin size={11} strokeWidth={2} /> Wijk-breed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
