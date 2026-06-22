/**
 * FactorExplainBody — Generic explanation body for non-cascade factors
 *
 * Renders a factor's detailed explanation with score composition, data sources,
 * and ruling counts. Designed for display inside a drawer (always expanded).
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

  return (
    <div className="space-y-5">
      {/* Header: Factor title */}
      <header>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
          Factor
        </p>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#0E1111]">
          {formatFactorName(name)}
        </h2>
      </header>

      {/* Section: What this factor measures */}
      <section className="space-y-1.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
          Wat meet deze factor
        </p>
        <p className="text-sm leading-relaxed text-slate-600">
          {factor.toelichting_lang ??
            factor.toelichting_kort ??
            'Geen toelichting beschikbaar.'}
        </p>
        {factor.dev_type_ruling_count !== null &&
          factor.total_ruling_count !== null && (
            <p className="text-xs italic text-slate-500">
              Gebaseerd op {factor.dev_type_ruling_count} van{' '}
              {factor.total_ruling_count} uitspraken na filtering op dev-types.
            </p>
          )}
      </section>

      {/* Section: Score composition */}
      <section className="space-y-1.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
          Score-opbouw
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">
            Genormaliseerd:{' '}
            <b className="text-[#0E1111] tabular-nums">
              {score !== null ? Math.round(score) : '—'}
            </b>
          </span>
          {factor.gewicht !== null && (
            <span className="text-slate-600">
              Gewicht:{' '}
              <b className="text-[#0E1111] tabular-nums">
                {factor.gewicht}
              </b>
            </span>
          )}
          {factor.bijdrage !== null && (
            <span className="text-slate-600">
              Bijdrage:{' '}
              <b className="text-[#0E1111] tabular-nums">
                {factor.bijdrage > 0 ? `+${factor.bijdrage}` : factor.bijdrage}
              </b>
            </span>
          )}
        </div>
        {factor.percentage_of_category !== null && (
          <p className="text-xs text-slate-500">
            {Math.round(factor.percentage_of_category * 100)}% van deze
            categorie.
          </p>
        )}
      </section>

      {/* Section: Data sources */}
      {factor.data_bronnen && factor.data_bronnen.length > 0 && (
        <section className="space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
            Databron
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {factor.data_bronnen.map((bron) => (
              <span
                key={bron}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
              >
                {bron}
              </span>
            ))}
            {isWijkBreed(factor.data_bronnen) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#D1E2D8] px-2.5 py-1 text-xs font-semibold text-[#2D5F4C]">
                <MapPin size={11} strokeWidth={2} /> Wijk-breed
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
