/**
 * S3 Bestemmingsplan & Bouwmogelijkheden — Due Diligence Dashboard section 3
 *
 * Displays: zoning plans, building dimensions, buildability delta, AI parsing, Wkb precheck
 * Each sub-section wrapped in SectionInsightCard with icon + kicker.
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { FileText, Ruler, Brain, ShieldCheck, Lightbulb } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { splitZoningPlans } from '@/lib/zoningPlans'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SectionNotes, SubCard, formatArea } from '../components'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S3BestemmingsplanBouwmogelijkhedenProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Badge helpers ──────────────────────────────────────────── */

function PlanStatusBadge({ status }: { status: string }) {
  const colors =
    status === 'Vastgesteld'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : status === 'Ontwerp'
        ? 'border-[#F9A826]/30 bg-[#F9A826]/10 text-[#F9A826]'
        : 'border-[#EAEFEF] bg-[#F8FAFA] text-[#0E1111]'
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${colors}`}>
      {status}
    </span>
  )
}

function AIStatusBadge({ status }: { status: string }) {
  const colors =
    status === 'complete'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : status === 'in_progress'
        ? 'border-[#F9A826]/30 bg-[#F9A826]/10 text-[#F9A826]'
        : status === 'failed'
          ? 'border-slate-200 bg-slate-50 text-slate-600'
          : status === 'opt_in_required'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-[#EAEFEF] bg-[#F8FAFA] text-[#0E1111]'
  const labels: Record<string, string> = {
    complete: 'Voltooid',
    in_progress: 'Bezig...',
    failed: 'Mislukt',
    pending: 'Wachtend',
    opt_in_required: 'Beschikbaar',
  }
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${colors}`}>
      {labels[status] ?? status}
    </span>
  )
}

function WkbStatusBadge({ status }: { status: string }) {
  const colors =
    status === 'likely_required'
      ? 'border-[#F9A826]/30 bg-[#F9A826]/10 text-[#F9A826]'
      : status === 'likely_not_required'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-[#EAEFEF] bg-[#F8FAFA] text-[#0E1111]'
  const labels: Record<string, string> = {
    likely_required: 'Waarschijnlijk vereist',
    likely_not_required: 'Waarschijnlijk niet vereist',
    not_applicable: 'Niet toepasbaar',
  }
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${colors}`}>
      {labels[status] ?? 'Onzeker'}
    </span>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S3BestemmingsplanBouwmogelijkheden({ data, sourceParcelId }: S3BestemmingsplanBouwmogelijkhedenProps) {
  const { zoning, buildability_delta, ai_parsing, wkb_precheck } = data

  return (
    <div className="space-y-6">
      {/* Bestemmingsplan */}
      <SectionInsightCard kicker="Bestemmingsplan" title="Bestemmingsplan" Icon={FileText}>
        {!zoning ? (
          <p className="text-[13px] font-semibold text-[#0E1111]">Geen bestemmingsplangegevens beschikbaar</p>
        ) : (() => {
          const { actionablePlans, policyPlans } = splitZoningPlans(zoning.plans)
          return (
            <div className="space-y-3">
              {zoning.primary_bestemming && (
                <SubCard>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Hoofdbestemming</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[#0E1111]">{zoning.primary_bestemming}</p>
                </SubCard>
              )}
              {zoning.building_dimensions && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ['Max. hoogte', zoning.building_dimensions.max_hoogte, 'm'],
                    ['Max. goothoogte', zoning.building_dimensions.max_goothoogte, 'm'],
                    ['Bebouwings%', zoning.building_dimensions.max_bebouwingspercentage, '%'],
                    ['Max. FSI', zoning.building_dimensions.max_floor_area_ratio, undefined],
                  ] as const).map(([label, value, unit]) => (
                    <SubCard key={label} className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                      <p className="mt-0.5 text-[13px] font-semibold text-[#0E1111]">
                        {value != null ? `${value}${unit ?? ''}` : '–'}
                      </p>
                    </SubCard>
                  ))}
                </div>
              )}
              {actionablePlans.slice(0, 3).map((plan, idx) => (
                <SubCard key={idx}>
                  <p className="text-[13px] font-semibold text-[#0E1111]">{plan.plan_naam}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {plan.plan_status && <PlanStatusBadge status={plan.plan_status} />}
                    {plan.plan_datum && <span>{new Date(plan.plan_datum).toLocaleDateString('nl-NL')}</span>}
                    {plan.plan_type && <span>{plan.plan_type}</span>}
                  </div>
                  {plan.functie_aanduidingen.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {plan.functie_aanduidingen.map((fa, fi) => (
                        <span key={fi} className="rounded-full border border-[#EAEFEF] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0E1111]">
                          {fa.naam}
                        </span>
                      ))}
                    </div>
                  )}
                </SubCard>
              ))}
              {policyPlans.length > 0 && actionablePlans.length === 0 && (
                <p className="text-[11px] text-slate-500">Geen perceelsspecifieke plannen — alleen bovenlokale beleidskaders beschikbaar ({policyPlans.length})</p>
              )}
              {zoning.data_gaps.length > 0 && (
                <div className="rounded-[16px] border border-[#F9A826]/15 bg-[#F9A826]/[0.04] px-4 py-3">
                  <p className="text-[11px] font-semibold text-[#F9A826]/80">Onvolledige gegevens</p>
                  <p className="text-[11px] text-slate-600">{zoning.data_gaps.join(', ')}</p>
                </div>
              )}
            </div>
          )
        })()}
      </SectionInsightCard>

      {/* Bouwruimte Delta */}
      <SectionInsightCard kicker="Bouwruimte" title="Bouwruimte Delta" Icon={Ruler}>
        {!buildability_delta ? (
          <p className="text-[13px] font-semibold text-[#0E1111]">Bouwruimteanalyse niet beschikbaar</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {([
                ['Perceeloppervlakte', formatArea(buildability_delta.parcel_area_m2)],
                ['Gebouwd', formatArea(buildability_delta.current_built_area_m2)],
                ['Resterend bebouwbaar', buildability_delta.remaining_buildable_area_m2 != null ? formatArea(buildability_delta.remaining_buildable_area_m2) : 'Niet berekend'],
              ] as const).map(([label, display]) => (
                <SubCard key={label}>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[#0E1111]">{display}</p>
                </SubCard>
              ))}
            </div>
            {buildability_delta.notes.slice(0, 2).map((note, i) => (
              <p key={i} className="text-[11px] text-slate-500">{note}</p>
            ))}
          </div>
        )}
      </SectionInsightCard>

      {/* AI Interpretatie */}
      <SectionInsightCard kicker="AI Analyse" title="AI Interpretatie" Icon={Brain}>
        {!ai_parsing ? (
          <p className="text-[13px] font-semibold text-[#0E1111]">AI-analyse niet beschikbaar</p>
        ) : ai_parsing.status === 'complete' && ai_parsing.parsed_plan ? (
          <div className="space-y-2">
            <AIStatusBadge status={ai_parsing.status} />
            <p className="text-[13px] font-semibold text-[#0E1111] leading-relaxed">{ai_parsing.parsed_plan.samenvatting}</p>
            <p className="text-[11px] text-slate-500">{ai_parsing.disclaimer_banner}</p>
          </div>
        ) : ai_parsing.status === 'opt_in_required' ? (
          <div className="space-y-2">
            <AIStatusBadge status={ai_parsing.status} />
            <div className="rounded-[16px] border border-dashed border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
              <p className="text-[13px] font-semibold text-[#0E1111]">AI-analyse beschikbaar</p>
              <p className="text-[11px] text-slate-500 mt-1">Klik op 'Analyseer' in het bestemmingsplan om de AI-analyse te starten</p>
            </div>
          </div>
        ) : ai_parsing.upload_required ? (
          <div className="space-y-2">
            <AIStatusBadge status={ai_parsing.status} />
            <div className="rounded-[16px] border border-dashed border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
              <p className="text-[13px] font-semibold text-[#0E1111]">Upload een bestemmingsplan PDF voor AI-analyse</p>
            </div>
          </div>
        ) : (
          <AIStatusBadge status={ai_parsing.status} />
        )}
      </SectionInsightCard>

      {/* Wkb Precheck */}
      {wkb_precheck && (
        <SectionInsightCard kicker="Wkb Precheck" title="Wkb Startdossier" Icon={ShieldCheck}>
          <div className="space-y-2">
            <WkbStatusBadge status={wkb_precheck.status} />
            {wkb_precheck.triggered_rules.length > 0 && (
              <div className="space-y-1">
                {wkb_precheck.triggered_rules.slice(0, 3).map((rule, i) => (
                  <p key={i} className="text-[11px] text-slate-600">• {rule.title}</p>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-500">{wkb_precheck.disclaimer}</p>
          </div>
        </SectionInsightCard>
      )}

      {/* ── Section Notes ─────────────────────────────────────── */}
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes parcelId={sourceParcelId} documentTypes={['bestemmingsplan', 'bestemmingscheck', 'milieuzones']} />
      </SectionInsightCard>
    </div>
  )
}
