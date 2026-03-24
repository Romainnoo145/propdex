/**
 * S3 Bestemmingsplan & Bouwmogelijkheden — Due Diligence Dashboard section 3
 *
 * Displays: zoning plans, building dimensions, buildability delta, AI parsing, Wkb precheck
 * Includes per-section document upload zone when sourceParcelId is available.
 */

import { useRef } from 'react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { splitZoningPlans } from '@/lib/zoningPlans'
import { useParcelDocuments, useUploadDocument } from '@/hooks/useDocuments'

/* ─── Props ─────────────────────────────────────────────────── */

export interface S3BestemmingsplanBouwmogelijkhedenProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Helpers ────────────────────────────────────────────────── */

function formatArea(value: number | null | undefined): string {
  if (value == null) return '–'
  return `${Math.round(value).toLocaleString('nl-NL')} m²`
}

/* ─── Upload Zone ────────────────────────────────────────────── */

function UploadZone({ parcelId, documentTypes, label }: { parcelId: string; documentTypes: string[]; label: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: docs } = useParcelDocuments(parcelId)
  const upload = useUploadDocument()
  const existing = docs?.documents?.filter((d) => documentTypes.includes(d.document_type)) ?? []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    upload.mutate({ parcelId, documentType: documentTypes[0] ?? 'overig', file })
    e.target.value = ''
  }

  return (
    <div className="mt-4 rounded-[16px] border border-dashed border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-600">{label}</p>
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

function DisabledUploadZone() {
  return (
    <div className="mt-4 rounded-[16px] border border-dashed border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
      <p className="text-[11px] text-slate-400">Koppel een perceel om documenten te uploaden</p>
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S3BestemmingsplanBouwmogelijkheden({ data, sourceParcelId }: S3BestemmingsplanBouwmogelijkhedenProps) {
  const { zoning, buildability_delta, ai_parsing, wkb_precheck } = data

  return (
    <div className="space-y-6">
      {/* Bestemmingsplan */}
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Bestemmingsplan</p>
        {!zoning ? (
          <p className="text-[13px] font-semibold text-[#0E1111]">Geen bestemmingsplangegevens beschikbaar</p>
        ) : (() => {
          const { actionablePlans, policyPlans } = splitZoningPlans(zoning.plans)
          return (
            <div className="space-y-3">
              {zoning.primary_bestemming && (
                <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Hoofdbestemming</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[#0E1111]">{zoning.primary_bestemming}</p>
                </div>
              )}
              {zoning.building_dimensions && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ['Max. hoogte', zoning.building_dimensions.max_hoogte, 'm'],
                    ['Max. goothoogte', zoning.building_dimensions.max_goothoogte, 'm'],
                    ['Bebouwings%', zoning.building_dimensions.max_bebouwingspercentage, '%'],
                    ['Max. FSI', zoning.building_dimensions.max_floor_area_ratio, undefined],
                  ] as const).map(([label, value, unit]) => (
                    <div key={label} className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                      <p className="mt-0.5 text-[13px] font-semibold text-[#0E1111]">
                        {value != null ? `${value}${unit ?? ''}` : '–'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {actionablePlans.slice(0, 3).map((plan, idx) => (
                <div key={idx} className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
                  <p className="text-[13px] font-semibold text-[#0E1111]">{plan.plan_naam}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {plan.plan_status && (
                      <span className="rounded-full border border-[#EAEFEF] px-2 py-0.5 text-[11px] font-semibold">{plan.plan_status}</span>
                    )}
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
                </div>
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
        {sourceParcelId ? (
          <UploadZone parcelId={sourceParcelId} documentTypes={['bestemmingsplan', 'bestemmingscheck', 'milieuzones']} label="Bestemmingsplan / Bestemmingscheck" />
        ) : (
          <DisabledUploadZone />
        )}
      </div>

      {/* Bouwruimte Delta */}
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Bouwruimte Delta</p>
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
                <div key={label} className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[#0E1111]">{display}</p>
                </div>
              ))}
            </div>
            {buildability_delta.notes.slice(0, 2).map((note, i) => (
              <p key={i} className="text-[11px] text-slate-500">{note}</p>
            ))}
          </div>
        )}
      </div>

      {/* AI Interpretatie */}
      <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">AI Interpretatie bestemmingsplan</p>
        {!ai_parsing ? (
          <p className="text-[13px] font-semibold text-[#0E1111]">AI-analyse niet beschikbaar</p>
        ) : ai_parsing.status === 'complete' && ai_parsing.parsed_plan ? (
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-[#0E1111] leading-relaxed">{ai_parsing.parsed_plan.samenvatting}</p>
            <p className="text-[11px] text-slate-500">{ai_parsing.disclaimer_banner}</p>
          </div>
        ) : ai_parsing.upload_required ? (
          <div className="rounded-[16px] border border-dashed border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
            <p className="text-[13px] font-semibold text-[#0E1111]">Upload een bestemmingsplan PDF voor AI-analyse</p>
            <p className="mt-1 text-[11px] text-slate-500">Status: {ai_parsing.status}</p>
          </div>
        ) : (
          <p className="text-[13px] font-semibold text-[#0E1111]">Status: {ai_parsing.status}</p>
        )}
      </div>

      {/* Wkb Precheck */}
      {wkb_precheck && (
        <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Wkb Startdossier</p>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                wkb_precheck.status === 'likely_required'
                  ? 'border-[#F9A826]/30 bg-[#F9A826]/10 text-[#F9A826]'
                  : wkb_precheck.status === 'likely_not_required'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-[#EAEFEF] bg-[#F8FAFA] text-[#0E1111]'
              }`}>
                {wkb_precheck.status === 'likely_required' ? 'Waarschijnlijk vereist'
                  : wkb_precheck.status === 'likely_not_required' ? 'Waarschijnlijk niet vereist'
                  : wkb_precheck.status === 'not_applicable' ? 'Niet toepasbaar'
                  : 'Onzeker'}
              </span>
            </div>
            {wkb_precheck.triggered_rules.length > 0 && (
              <div className="space-y-1">
                {wkb_precheck.triggered_rules.slice(0, 3).map((rule, i) => (
                  <p key={i} className="text-[11px] text-slate-600">• {rule.title}</p>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-500">{wkb_precheck.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  )
}
