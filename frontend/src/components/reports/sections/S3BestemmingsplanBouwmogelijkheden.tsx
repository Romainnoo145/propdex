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

/* ─── Sub-components ─────────────────────────────────────────── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-[#EAEFEF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{title}</p>
      {children}
    </div>
  )
}

function DimCard({ label, value, unit }: { label: string; value: number | null | undefined; unit?: string }) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2 text-center">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#0E1111]">
        {value != null ? `${value}${unit ?? ''}` : '–'}
      </p>
    </div>
  )
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
    <div className="mt-4 border-t border-[#EAEFEF] pt-4">
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
    <div className="mt-4 border-t border-[#EAEFEF] pt-4">
      <p className="text-[11px] text-slate-400">Koppel een perceel om documenten te uploaden</p>
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S3BestemmingsplanBouwmogelijkheden({ data, sourceParcelId }: S3BestemmingsplanBouwmogelijkhedenProps) {
  const { zoning, buildability_delta, ai_parsing, wkb_precheck } = data

  return (
    <div className="space-y-4">
      {/* Bestemmingsplan */}
      <Card title="Bestemmingsplan">
        {!zoning ? (
          <p className="text-[13px] text-slate-500">Geen bestemmingsplangegevens beschikbaar</p>
        ) : (() => {
          const { actionablePlans, policyPlans } = splitZoningPlans(zoning.plans)
          return (
            <div className="space-y-3">
              {zoning.primary_bestemming && (
                <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Hoofdbestemming</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-[#0E1111]">{zoning.primary_bestemming}</p>
                </div>
              )}
              {zoning.building_dimensions && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <DimCard label="Max. hoogte" value={zoning.building_dimensions.max_hoogte} unit="m" />
                  <DimCard label="Max. goothoogte" value={zoning.building_dimensions.max_goothoogte} unit="m" />
                  <DimCard label="Bebouwings%" value={zoning.building_dimensions.max_bebouwingspercentage} unit="%" />
                  <DimCard label="Max. FSI" value={zoning.building_dimensions.max_floor_area_ratio} />
                </div>
              )}
              {actionablePlans.slice(0, 3).map((plan, idx) => (
                <div key={idx} className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] p-3">
                  <p className="text-[13px] font-semibold text-[#0E1111]">{plan.plan_naam}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {plan.plan_status && <span className="rounded border border-[#EAEFEF] px-1.5 py-0.5">{plan.plan_status}</span>}
                    {plan.plan_datum && <span>{new Date(plan.plan_datum).toLocaleDateString('nl-NL')}</span>}
                    {plan.plan_type && <span>{plan.plan_type}</span>}
                  </div>
                  {plan.functie_aanduidingen.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {plan.functie_aanduidingen.map((fa, fi) => (
                        <span key={fi} className="rounded-full border border-[#EAEFEF] bg-white px-2 py-0.5 text-[10px] font-medium text-[#0E1111]">
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
                <div className="rounded-[16px] border border-[#F9A826]/15 bg-[#F9A826]/[0.04] px-3 py-2">
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
      </Card>

      {/* Bouwruimte Delta */}
      <Card title="Bouwruimte Delta">
        {!buildability_delta ? (
          <p className="text-[13px] text-slate-500">Bouwruimteanalyse niet beschikbaar</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2">
                <p className="text-[11px] text-slate-400">Perceeloppervlakte</p>
                <p className="text-[13px] font-semibold text-[#0E1111]">{formatArea(buildability_delta.parcel_area_m2)}</p>
              </div>
              <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2">
                <p className="text-[11px] text-slate-400">Gebouwd</p>
                <p className="text-[13px] font-semibold text-[#0E1111]">{formatArea(buildability_delta.current_built_area_m2)}</p>
              </div>
              <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-3 py-2">
                <p className="text-[11px] text-slate-400">Resterend bebouwbaar</p>
                <p className="text-[13px] font-semibold text-[#0E1111]">
                  {buildability_delta.remaining_buildable_area_m2 != null ? formatArea(buildability_delta.remaining_buildable_area_m2) : 'Niet berekend'}
                </p>
              </div>
            </div>
            {buildability_delta.notes.slice(0, 2).map((note, i) => (
              <p key={i} className="text-[11px] text-slate-500">{note}</p>
            ))}
          </div>
        )}
      </Card>

      {/* AI Interpretatie */}
      <Card title="AI Interpretatie bestemmingsplan">
        {!ai_parsing ? (
          <p className="text-[13px] text-slate-500">AI-analyse niet beschikbaar</p>
        ) : ai_parsing.status === 'complete' && ai_parsing.parsed_plan ? (
          <div className="space-y-2">
            <p className="text-[13px] text-slate-600 leading-relaxed">{ai_parsing.parsed_plan.samenvatting}</p>
            <p className="text-[11px] text-slate-500">{ai_parsing.disclaimer_banner}</p>
          </div>
        ) : ai_parsing.upload_required ? (
          <div className="rounded-[16px] border border-dashed border-[#EAEFEF] bg-[#F8FAFA] p-4 text-center">
            <p className="text-[13px] text-slate-600">Upload een bestemmingsplan PDF voor AI-analyse</p>
            <p className="mt-1 text-[11px] text-slate-500">Status: {ai_parsing.status}</p>
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">Status: {ai_parsing.status}</p>
        )}
      </Card>

      {/* Wkb Precheck */}
      {wkb_precheck && (
        <Card title="Wkb Startdossier">
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
        </Card>
      )}
    </div>
  )
}
