/**
 * S3 Bestemmingsplan & Bouwmogelijkheden — Due Diligence Dashboard section 3
 *
 * AI Interpretatie section flow:
 *   1. No data → "niet beschikbaar"
 *   2. complete → show samenvatting + regels
 *   3. pdf_not_found / upload_required / opt_in_required → upload button
 *   4. After upload → POST /api/properties/upload-pdf → polls job status
 *   5. queued / in_progress → spinner + progress
 *   6. complete → invalidates report, shows parsed result
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FileText, Ruler, Brain, ShieldCheck, Lightbulb, Upload, Loader2, CheckCircle2, AlertTriangle, Eye } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { PropertyReportResponse } from '@/lib/types/property'
import { splitZoningPlans } from '@/lib/zoningPlans'
import { uploadBestemmingsplanPDF, fetchAIParsingJobStatus } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import { useUploadDocument } from '@/hooks/useDocuments'
import { SectionInsightCard } from '../components/SectionInsightCard'
import { SectionNotes, formatArea, SubCard, KVRow } from '../components'
import { AIAnalysisModal } from '../components/AIAnalysisModal'

export interface S3BestemmingsplanBouwmogelijkhedenProps {
  data: PropertyReportResponse
  sourceParcelId?: string | null
  reportId?: string | null
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
          className="absolute inset-y-0 rounded-r-full border border-[#0E1111] bg-aura-amber"
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
          <span className="h-2 w-2 rounded-full border border-[#0E1111] bg-aura-amber" />
          <span className="text-slate-500">Bebouwbaar {formatArea(remainingArea)}</span>
        </span>
        <span className="ml-auto text-[12px] font-semibold text-slate-600">
          Totaal {formatArea(parcelArea)}
        </span>
      </div>
    </div>
  )
}

/* ─── AI Parsing upload + poll hook ──────────────────────────── */

type AIUploadState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'polling'; jobId: string; progress: number; message: string }
  | { phase: 'complete' }
  | { phase: 'error'; message: string }

function useAIParsing(planIdn: string | null, reportId: string | null) {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [state, setState] = useState<AIUploadState>({ phase: 'idle' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling])

  const startPolling = useCallback((jobId: string) => {
    stopPolling()
    setState({ phase: 'polling', jobId, progress: 10, message: 'Analyse wordt gestart...' })

    let pollCount = 0
    const MAX_POLLS = 60 // 60 × 3s = 3 minutes timeout

    pollRef.current = setInterval(async () => {
      pollCount++

      // Timeout after 3 minutes of polling
      if (pollCount > MAX_POLLS) {
        stopPolling()
        setState({ phase: 'error', message: 'Analyse duurt te lang — de achtergrondverwerking is mogelijk niet actief. Probeer het later opnieuw.' })
        return
      }

      try {
        const result = await fetchAIParsingJobStatus(jobId, accessToken)

        if (result.status === 'complete') {
          stopPolling()
          // Invalidate report data to pick up the new AI parsing result
          if (reportId) {
            await queryClient.invalidateQueries({ queryKey: ['report', reportId] })
          }
          await queryClient.invalidateQueries({ queryKey: ['property'] })
          // Reset to idle so server data (ai_parsing.status=complete) takes over rendering
          setState({ phase: 'idle' })
        } else if (result.status === 'failed') {
          stopPolling()
          setState({ phase: 'error', message: result.error ?? 'AI-analyse mislukt' })
        } else {
          // queued or in_progress
          setState({
            phase: 'polling',
            jobId,
            progress: result.progress_pct ?? 20,
            message: result.message ?? 'Bestemmingsplan wordt geanalyseerd...',
          })
        }
      } catch (err) {
        stopPolling()
        const msg = err instanceof Error ? err.message : 'Verbinding met server verloren'
        setState({ phase: 'error', message: msg })
      }
    }, 3000) // Poll every 3 seconds
  }, [accessToken, reportId, queryClient, stopPolling])

  const upload = useCallback(async (file: File) => {
    if (!planIdn) {
      setState({ phase: 'error', message: 'Geen bestemmingsplan gevonden — kan AI-analyse niet starten.' })
      return
    }
    setState({ phase: 'uploading' })
    try {
      const result = await uploadBestemmingsplanPDF(planIdn, file, accessToken)
      if (result.job_id) {
        startPolling(result.job_id)
      } else {
        setState({ phase: 'error', message: 'Geen job ID ontvangen' })
      }
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Upload mislukt' })
    }
  }, [planIdn, accessToken, startPolling])

  return { state, upload }
}

/* ─── Section ────────────────────────────────────────────────── */

export function S3BestemmingsplanBouwmogelijkheden({ data, sourceParcelId, reportId }: S3BestemmingsplanBouwmogelijkhedenProps) {
  const { zoning, buildability_delta, ai_parsing, wkb_precheck } = data
  const uploadDocument = useUploadDocument()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const aiFileRef = useRef<HTMLInputElement>(null)
  const [showAIModal, setShowAIModal] = useState(false)

  // Get primary plan_idn for AI parsing upload
  const planIdn = zoning?.plans?.[0]?.plan_id ?? null

  // Extract bestemming for header badge
  const bestemming = zoning?.primary_bestemming
    ?? zoning?.plans?.[0]?.rules?.[0]?.bestemming
    ?? null

  const { state: aiState, upload: aiUpload } = useAIParsing(planIdn, reportId ?? null)

  const handleAIFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Also store in document system for dossier
    if (sourceParcelId) {
      uploadDocument.mutate({ parcelId: sourceParcelId, documentType: 'bestemmingsplan', file })
    }
    // Trigger AI parsing
    aiUpload(file)
    e.target.value = ''
  }

  // Should show upload: when backend says upload needed, or opt_in, AND we're not already processing
  const showUpload = aiState.phase === 'idle' && (
    ai_parsing?.upload_required ||
    ai_parsing?.status === 'pdf_not_found' ||
    ai_parsing?.status === 'opt_in_required'
  )

  // Backend already polling (e.g. from a previous session's upload)
  const backendPolling = aiState.phase === 'idle' && (
    ai_parsing?.status === 'queued' ||
    ai_parsing?.status === 'in_progress'
  )

  return (
    <div className="space-y-6">

      {/* ── Bestemmingsplan ────────────────────────────────────── */}
      <SectionInsightCard kicker="Bestemmingsplan" title="Bestemmingsplan" Icon={FileText} badge={bestemming}>
        {!zoning ? (
          <p className="text-[13px] text-slate-500">Geen bestemmingsplangegevens beschikbaar</p>
        ) : (() => {
          const { actionablePlans, policyPlans } = splitZoningPlans(zoning.plans)
          return (
            <div className="space-y-3">

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
                <div className="rounded-[16px] border border-aura-amber/30 bg-aura-amber/[0.08] px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={12} className="text-aura-amber-dark" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-aura-amber-dark">Onvolledige gegevens</p>
                  </div>
                  <p className="text-[11px] text-[#0E1111]">{zoning.data_gaps.join(', ')}</p>
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
          const currentFar = (buildability_delta as Record<string, unknown>).current_far as number | null | undefined
          const maxFar = (buildability_delta as Record<string, unknown>).max_far as number | null | undefined
          const currentRatio = (buildability_delta as Record<string, unknown>).current_built_ratio_pct as number | null | undefined
          const maxBebPct = (buildability_delta as Record<string, unknown>).max_bebouwingspercentage_pct as number | null | undefined
          const confidence = (buildability_delta as Record<string, unknown>).confidence as string | null | undefined
          const missingFields = (buildability_delta as Record<string, unknown>).missing_fields as string[] | null | undefined
          return (
            <div className="space-y-3">
              <BuildabilityBar parcelArea={parcel} builtArea={built} remainingArea={remaining} />

              {/* KV details */}
              <SubCard className="space-y-0">
                <KVRow label="Perceeloppervlakte" value={formatArea(parcel)} />
                <KVRow label="Bebouwd oppervlak" value={formatArea(built)} />
                {currentRatio != null && <KVRow label="Bebouwingsgraad" value={`${currentRatio.toFixed(1)}%`} />}
                {currentFar != null && <KVRow label="Huidige FAR" value={currentFar.toFixed(3)} />}
                {maxBebPct != null && <KVRow label="Max. bebouwing" value={`${maxBebPct}%`} />}
                {maxFar != null && <KVRow label="Max. FAR" value={`${maxFar}`} />}
                {remaining > 0 && <KVRow label="Resterende bouwruimte" value={formatArea(remaining)} />}
              </SubCard>

              {/* Confidence + missing data warning */}
              {confidence === 'low' && missingFields && missingFields.length > 0 && (
                <div className="rounded-[16px] border border-aura-amber/30 bg-aura-amber/[0.08] px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={12} className="text-aura-amber-dark" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-aura-amber-dark">Lage betrouwbaarheid</p>
                  </div>
                  <p className="text-[13px] text-[#0E1111]">
                    Ontbrekende gegevens: {missingFields.map(f => f.replace(/_/g, ' ')).join(', ')}
                  </p>
                </div>
              )}

              {buildability_delta.notes.slice(0, 3).map((note, i) => (
                <p key={i} className="text-[11px] text-slate-400 italic">{note}</p>
              ))}
            </div>
          )
        })()}
      </SectionInsightCard>

      {/* ── AI Interpretatie ───────────────────────────────────── */}
      <SectionInsightCard kicker="AI Analyse" title="AI Interpretatie" Icon={Brain}>
        <input ref={aiFileRef} type="file" accept=".pdf" className="hidden" onChange={handleAIFileSelect} />

        {/* ── State: complete (from server data) ── */}
        {ai_parsing?.status === 'complete' && ai_parsing.parsed_plan && aiState.phase !== 'complete' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <SemanticPill tone="green">Voltooid</SemanticPill>
              {ai_parsing.parsed_plan.overall_confidence && (
                <SemanticPill tone={
                  ai_parsing.parsed_plan.overall_confidence === 'HIGH' ? 'green'
                    : ai_parsing.parsed_plan.overall_confidence === 'MEDIUM' ? 'amber'
                      : 'red'
                }>
                  {ai_parsing.parsed_plan.overall_confidence === 'HIGH' ? 'Hoog vertrouwen'
                    : ai_parsing.parsed_plan.overall_confidence === 'MEDIUM' ? 'Gemiddeld vertrouwen'
                      : 'Laag vertrouwen'}
                </SemanticPill>
              )}
            </div>

            {/* Compact summary */}
            <p className="text-[13px] text-slate-600 leading-relaxed line-clamp-3">
              {ai_parsing.parsed_plan.samenvatting}
            </p>

            {/* Quick stats row */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span>{ai_parsing.parsed_plan.regels.length} regels geëxtraheerd</span>
              <span>·</span>
              <span>{ai_parsing.parsed_plan.plan_naam}</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[#0E1111] bg-[#0E1111] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#0E1111]/80"
              >
                <Eye size={14} />
                Bekijk analyse
              </button>
              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                className="inline-flex items-center gap-2 rounded-full border border-[#EAEFEF] bg-white px-4 py-2 text-[12px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F8FAFA]"
              >
                <FileText size={14} />
                Bekijk PDF
              </button>
            </div>

            <p className="text-[11px] text-slate-400 italic">{ai_parsing.disclaimer_banner}</p>

            {/* AI Analysis Modal */}
            {showAIModal && ai_parsing.parsed_plan && (
              <AIAnalysisModal
                parsed={ai_parsing.parsed_plan}
                disclaimerBanner={ai_parsing.disclaimer_banner}
                sourceParcelId={sourceParcelId}
                onClose={() => setShowAIModal(false)}
              />
            )}
          </div>

        /* ── State: just completed (local, waiting for report refresh) ── */
        ) : aiState.phase === 'complete' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-aura-amber" />
              <SemanticPill tone="green">Analyse voltooid</SemanticPill>
            </div>
            <p className="text-[13px] text-slate-500">Rapport wordt vernieuwd met AI resultaten...</p>
          </div>

        /* ── State: uploading ── */
        ) : aiState.phase === 'uploading' ? (
          <div className="flex items-center gap-3 py-2">
            <Loader2 size={16} className="animate-spin text-aura-amber" />
            <p className="text-[13px] text-slate-500">PDF wordt geüpload...</p>
          </div>

        /* ── State: polling (AI analysis in progress) ── */
        ) : aiState.phase === 'polling' || backendPolling ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-aura-amber" />
              <p className="text-[13px] text-slate-600 font-medium">AI-analyse bezig...</p>
            </div>
            <div className="space-y-1.5">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-aura-amber"
                  initial={{ width: '5%' }}
                  animate={{ width: `${aiState.phase === 'polling' ? aiState.progress : 30}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {aiState.phase === 'polling' ? aiState.message : 'Bestemmingsplan wordt geanalyseerd door Claude AI...'}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 italic">
              Dit kan 30–60 seconden duren afhankelijk van de documentgrootte.
            </p>
          </div>

        /* ── State: error ── */
        ) : aiState.phase === 'error' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500" />
              <p className="text-[13px] text-red-600 font-medium">Analyse mislukt</p>
            </div>
            <p className="text-[11px] text-slate-500">{aiState.message}</p>
            {planIdn && (
              <button
                type="button"
                onClick={() => aiFileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-[#0E1111] bg-aura-amber px-4 py-2 text-[12px] font-semibold text-[#0E1111] transition-colors hover:bg-aura-amber-hover"
              >
                <Upload size={14} />
                Opnieuw proberen
              </button>
            )}
          </div>

        /* ── State: no AI data at all ── */
        ) : !ai_parsing ? (
          <p className="text-[13px] text-slate-500">AI-analyse niet beschikbaar</p>

        /* ── State: upload required / opt-in ── */
        ) : showUpload ? (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-500">
              {ai_parsing.status === 'opt_in_required'
                ? 'Upload een bestemmingsplan PDF om de AI-analyse te starten.'
                : 'Bestemmingsplan PDF niet automatisch beschikbaar. Upload het document handmatig.'}
            </p>
            {planIdn ? (
              <button
                type="button"
                onClick={() => aiFileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-[#0E1111] bg-aura-amber px-4 py-2 text-[12px] font-semibold text-[#0E1111] transition-colors hover:bg-aura-amber-hover"
              >
                <Upload size={14} />
                Upload PDF
              </button>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Geen bestemmingsplan gevonden — upload niet mogelijk.
              </p>
            )}
          </div>

        /* ── State: failed (from server) ── */
        ) : ai_parsing.status === 'failed' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500" />
              <SemanticPill tone="red">Mislukt</SemanticPill>
            </div>
            <p className="text-[11px] text-slate-500">{ai_parsing.error_message ?? 'AI-analyse is mislukt.'}</p>
            {planIdn && (
              <button
                type="button"
                onClick={() => aiFileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-[#0E1111] bg-aura-amber px-4 py-2 text-[12px] font-semibold text-[#0E1111] transition-colors hover:bg-aura-amber-hover"
              >
                <Upload size={14} />
                Opnieuw uploaden
              </button>
            )}
          </div>

        /* ── Fallback ── */
        ) : (
          <SemanticPill tone="slate">{ai_parsing.status === 'in_progress' ? 'Bezig...' : ai_parsing.status}</SemanticPill>
        )}
      </SectionInsightCard>

      {/* ── Wkb Precheck ──────────────────────────────────────── */}
      {wkb_precheck && (
        <SectionInsightCard kicker="Wkb" title="Kwaliteitsborging" Icon={ShieldCheck}>
          <div className="space-y-3">
            <SubCard className="space-y-0">
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
              {(data.wkb_classification as Record<string, unknown> | null | undefined)?.gevolgklasse && (
                <KVRow label="Gevolgklasse" value={(data.wkb_classification as Record<string, unknown>).gevolgklasse as string} />
              )}
              <KVRow label="Betrouwbaarheid" value={wkb_precheck.confidence === 'low' ? 'Laag' : wkb_precheck.confidence === 'high' ? 'Hoog' : 'Gemiddeld'} />
            </SubCard>

            {wkb_precheck.triggered_rules.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">Getriggerde regels</p>
                <ul className="space-y-1">
                  {wkb_precheck.triggered_rules.map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-aura-amber" />
                      <span><strong className="text-slate-600">{rule.title}</strong>{rule.reason ? ` — ${rule.reason}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {wkb_precheck.required_documents && wkb_precheck.required_documents.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5">Vereiste documenten</p>
                <ul className="space-y-1">
                  {wkb_precheck.required_documents.map((doc: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {wkb_precheck.missing_inputs && wkb_precheck.missing_inputs.length > 0 && (
              <div className="rounded-[16px] border border-aura-amber/30 bg-aura-amber/[0.08] px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={12} className="text-aura-amber-dark" />
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-aura-amber-dark">Aanvullende gegevens nodig</p>
                </div>
                <p className="text-[11px] text-[#0E1111]">
                  Vul aan voor nauwkeuriger resultaat: {wkb_precheck.missing_inputs.map((m: string) => m.replace(/_/g, ' ')).join(', ')}
                </p>
              </div>
            )}

            <p className="text-[11px] text-slate-400 italic">{wkb_precheck.disclaimer}</p>
          </div>
        </SectionInsightCard>
      )}

      {/* ── Notities ──────────────────────────────────────────── */}
      <SectionInsightCard kicker="Notities" title="Sectienotities" Icon={Lightbulb}>
        <SectionNotes parcelId={sourceParcelId} documentTypes={['bestemmingsplan']} />
      </SectionInsightCard>
    </div>
  )
}
