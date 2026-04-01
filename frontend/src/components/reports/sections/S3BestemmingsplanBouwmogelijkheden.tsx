/**
 * S3 Bestemmingsplan & Bouwmogelijkheden — Due Diligence Dashboard section 3
 */

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { FileText, Ruler, Brain, ShieldCheck, Lightbulb, Upload } from 'lucide-react'
import type { PropertyReportResponse } from '@/lib/types/property'
import { splitZoningPlans } from '@/lib/zoningPlans'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SectionNotes, formatArea } from '../components'
import { useUploadDocument } from '@/hooks/useDocuments'

export interface S3BestemmingsplanBouwmogelijkhedenProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
}

/* ─── Semantic pill ──────────────────────────────────────────── */

function SemanticPill({ children, tone }: { children: React.ReactNode; tone: 'green' | 'amber' | 'red' | 'slate' }) {
  const cls = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[tone]
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  )
}

/* ─── Buildability bar ───────────────────────────────────────── */

function BuildabilityBar({ parcelArea, builtArea, remainingArea }: { parcelArea: number; builtArea: number; remainingArea: number }) {
  const total = parcelArea || 1
  const builtPct = Math.min((builtArea / total) * 100, 100)
  const remainPct = Math.min((remainingArea / total) * 100, 100 - builtPct)

  return (
    <div className="space-y-3">
      <div className="relative h-7 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-l-full bg-[#0E1111]"
          initial={{ width: 0 }}
          animate={{ width: `${builtPct}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
        <motion.div
          className="absolute inset-y-0 rounded-r-full border border-[#0E1111] bg-amber-300"
          style={{ left: `${builtPct}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${remainPct}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#0E1111]" />
          <span className="text-slate-500">Bebouwd {formatArea(builtArea)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-[#0E1111] bg-amber-300" />
          <span className="text-slate-500">Bebouwbaar {formatArea(remainingArea)}</span>
        </span>
        <span className="ml-auto text-[12px] font-semibold text-slate-600">
          Totaal {formatArea(parcelArea)}
        </span>
      </div>
    </div>
  )
}

/* ─── Section ────────────────────────────────────────────────── */

export function S3BestemmingsplanBouwmogelijkheden({ data, sourceParcelId }: S3BestemmingsplanBouwmogelijkhedenProps) {
  const { zoning, buildability_delta, ai_parsing, wkb_precheck } = data
  const uploadDocument = useUploadDocument()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !sourceParcelId) return
    uploadDocument.mutate({ parcelId: sourceParcelId, documentType: 'bestemmingsplan', file })
  }

  return (
    <div className="space-y-6">

      {/* ── Bestemmingsplan ────────────────────────────────────── */}
      <SectionInsightCard kicker="Bestemmingsplan" title="Bestemmingsplan" Icon={FileText}>
        {!zoning ? (
          <p className="text-[13px] text-slate-500">Geen bestemmingsplangegevens beschikbaar</p>
        ) : (() => {
          const { actionablePlans, policyPlans } = splitZoningPlans(zoning.plans)
          return (
            <div className="space-y-3">
              {zoning.primary_bestemming && (
                <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
                  <span className="text-[12px] text-slate-400">Hoofdbestemming</span>
                  <span className="text-[13px] font-semibold text-[#0E1111]">{zoning.primary_bestemming}</span>
                </div>
              )}

              {zoning.building_dimensions && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-0 sm:grid-cols-4">
                  {([
                    ['Max. hoogte', zoning.building_dimensions.max_hoogte, 'm'],
                    ['Goothoogte', zoning.building_dimensions.max_goothoogte, 'm'],
                    ['Bebouwing', zoning.building_dimensions.max_bebouwingspercentage, '%'],
                    ['FSI', zoning.building_dimensions.max_floor_area_ratio, undefined],
                  ] as const).map(([label, value, unit]) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#EAEFEF]">
                      <span className="text-[11px] text-slate-400">{label}</span>
                      <span className="text-[12px] font-semibold text-[#0E1111] tabular-nums">
                        {value != null ? `${value}${unit ?? ''}` : '–'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {actionablePlans.slice(0, 3).map((plan, idx) => (
                <div key={idx} className="py-2 border-b border-[#EAEFEF] last:border-b-0">
                  <p className="text-[12px] text-slate-700">{plan.plan_naam}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {plan.plan_status && (
                      <span className="rounded-full border border-[#EAEFEF] bg-[#F8FAFA] px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {plan.plan_status.toLowerCase()}
                      </span>
                    )}
                    {plan.plan_datum && (
                      <span className="text-[11px] text-slate-400">{new Date(plan.plan_datum).toLocaleDateString('nl-NL')}</span>
                    )}
                    {plan.plan_type && (
                      <span className="text-[11px] text-slate-400">{plan.plan_type}</span>
                    )}
                  </div>
                </div>
              ))}

              {policyPlans.length > 0 && actionablePlans.length === 0 && (
                <p className="text-[11px] text-slate-400">Alleen bovenlokale beleidskaders ({policyPlans.length})</p>
              )}

              {zoning.data_gaps.length > 0 && (
                <div className="rounded-[16px] border border-amber-200/50 bg-amber-50/30 px-4 py-3">
                  <p className="text-[11px] font-semibold text-amber-600">Onvolledige gegevens</p>
                  <p className="text-[11px] text-slate-500">{zoning.data_gaps.join(', ')}</p>
                </div>
              )}
            </div>
          )
        })()}
      </SectionInsightCard>

      {/* ── Bouwruimte Delta ──────────────────────────────────── */}
      <SectionInsightCard kicker="Bouwruimte" title="Bouwruimte Delta" Icon={Ruler}>
        {!buildability_delta ? (
          <p className="text-[13px] text-slate-500">Bouwruimteanalyse niet beschikbaar</p>
        ) : (() => {
          const parcel = buildability_delta.parcel_area_m2 ?? 0
          const built = buildability_delta.current_built_area_m2 ?? 0
          const remaining = buildability_delta.remaining_buildable_area_m2 ?? Math.max(parcel - built, 0)
          return (
            <div className="space-y-3">
              <BuildabilityBar parcelArea={parcel} builtArea={built} remainingArea={remaining} />
              {buildability_delta.notes.slice(0, 2).map((note, i) => (
                <p key={i} className="text-[11px] text-slate-400 italic">{note}</p>
              ))}
            </div>
          )
        })()}
      </SectionInsightCard>

      {/* ── AI Interpretatie ───────────────────────────────────── */}
      <SectionInsightCard kicker="AI Analyse" title="AI Interpretatie" Icon={Brain}>
        {!ai_parsing ? (
          <p className="text-[13px] text-slate-500">AI-analyse niet beschikbaar</p>
        ) : ai_parsing.status === 'complete' && ai_parsing.parsed_plan ? (
          <div className="space-y-2">
            <SemanticPill tone="green">Voltooid</SemanticPill>
            <p className="text-[13px] text-slate-600 leading-relaxed">{ai_parsing.parsed_plan.samenvatting}</p>
            <p className="text-[11px] text-slate-400 italic">{ai_parsing.disclaimer_banner}</p>
          </div>
        ) : ai_parsing.upload_required || ai_parsing.status === 'pdf_not_found' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-500">Upload een bestemmingsplan PDF om de AI-analyse te starten.</p>
            {sourceParcelId && (
              <>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadDocument.isPending}
                  className="inline-flex items-center gap-2 rounded-full border border-[#0E1111] bg-amber-300 px-4 py-2 text-[12px] font-semibold text-[#0E1111] transition-colors hover:bg-amber-400 disabled:opacity-50"
                >
                  <Upload size={14} />
                  {uploadDocument.isPending ? 'Uploaden...' : 'Upload PDF'}
                </button>
              </>
            )}
          </div>
        ) : ai_parsing.status === 'opt_in_required' ? (
          <div className="space-y-2">
            <SemanticPill tone="amber">Beschikbaar</SemanticPill>
            <p className="text-[13px] text-slate-500">Start de AI-analyse vanuit het bestemmingsplan.</p>
          </div>
        ) : (
          <SemanticPill tone="slate">{ai_parsing.status === 'in_progress' ? 'Bezig...' : ai_parsing.status}</SemanticPill>
        )}
      </SectionInsightCard>

      {/* ── Wkb Precheck ──────────────────────────────────────── */}
      {wkb_precheck && (
        <SectionInsightCard kicker="Wkb" title="Kwaliteitsborging" Icon={ShieldCheck}>
          <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF]">
            <span className="text-[12px] text-slate-400">Status</span>
            <SemanticPill tone={wkb_precheck.status === 'likely_required' ? 'amber' : 'green'}>
              {wkb_precheck.status === 'likely_required'
                ? 'Waarschijnlijk vereist'
                : wkb_precheck.status === 'likely_not_required'
                  ? 'Niet vereist'
                  : 'Onzeker'}
            </SemanticPill>
          </div>
          {wkb_precheck.triggered_rules.length > 0 && (
            <ul className="mt-2 space-y-1">
              {wkb_precheck.triggered_rules.slice(0, 3).map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  {rule.title}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-slate-400 italic">{wkb_precheck.disclaimer}</p>
        </SectionInsightCard>
      )}

      {/* ── Notities ──────────────────────────────────────────── */}
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes parcelId={sourceParcelId} documentTypes={['bestemmingsplan']} />
      </SectionInsightCard>
    </div>
  )
}
