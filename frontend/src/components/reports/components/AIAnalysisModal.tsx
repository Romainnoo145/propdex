/**
 * AIAnalysisModal — Full-screen modal showing AI-parsed bestemmingsplan results
 * and embedded PDF viewer for the uploaded document.
 *
 * Two tabs: "AI Interpretatie" (parsed rules + summary) and "PDF Document" (embedded viewer).
 * Pattern follows S8 ChecklistItemModal (createPortal, AnimatePresence, backdrop blur).
 */

'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, FileText, ChevronRight, Shield, Car, Leaf, AlertTriangle } from 'lucide-react'
import type { BestemmingsplanParsed, BestemmingsregelExtract } from '@/lib/types/property'
import { useAuth } from '@/lib/auth/useAuth'
import { useParcelDocuments } from '@/hooks/useDocuments'
import { getDocumentDownloadUrl } from '@/lib/api'

export interface AIAnalysisModalProps {
  parsed: BestemmingsplanParsed
  disclaimerBanner: string
  sourceParcelId?: string | null
  onClose: () => void
}

/* ─── Confidence badge ───────────────────────────────────────── */

function ConfidencePill({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cls = {
    HIGH: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
    LOW: 'border-red-200 bg-red-50 text-red-700',
  }[level]
  const label = { HIGH: 'Hoog vertrouwen', MEDIUM: 'Gemiddeld', LOW: 'Laag vertrouwen' }[level]
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

/* ─── Single rule card ───────────────────────────────────────── */

function RegelCard({ regel }: { regel: BestemmingsregelExtract }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#F8FAFA]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-[#0E1111]">{regel.bestemming}</p>
            <ConfidencePill level={regel.confidence} />
          </div>
          {regel.artikel && (
            <p className="text-[11px] text-slate-400 mt-0.5">{regel.artikel}</p>
          )}
        </div>
        <ChevronRight
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3 border-t border-[#EAEFEF] pt-3">
              {/* Toegestane gebruiken */}
              {regel.toegestane_gebruiken.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Toegestaan gebruik</p>
                  <div className="flex flex-wrap gap-1.5">
                    {regel.toegestane_gebruiken.map((g, i) => (
                      <span key={i} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-700">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Verboden gebruiken */}
              {regel.verboden_gebruiken.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Verboden gebruik</p>
                  <div className="flex flex-wrap gap-1.5">
                    {regel.verboden_gebruiken.map((g, i) => (
                      <span key={i} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] text-red-700">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Bouwregels */}
              {regel.bouwregels && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Bouwregels</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {regel.bouwregels.max_bouwhoogte != null && (
                      <div className="flex items-center justify-between py-1 border-b border-[#EAEFEF]">
                        <span className="text-[11px] text-slate-400">Max. hoogte</span>
                        <span className="text-[12px] font-semibold text-[#0E1111] tabular-nums">{regel.bouwregels.max_bouwhoogte}m</span>
                      </div>
                    )}
                    {regel.bouwregels.max_goothoogte != null && (
                      <div className="flex items-center justify-between py-1 border-b border-[#EAEFEF]">
                        <span className="text-[11px] text-slate-400">Goothoogte</span>
                        <span className="text-[12px] font-semibold text-[#0E1111] tabular-nums">{regel.bouwregels.max_goothoogte}m</span>
                      </div>
                    )}
                    {regel.bouwregels.max_bebouwingspercentage != null && (
                      <div className="flex items-center justify-between py-1 border-b border-[#EAEFEF]">
                        <span className="text-[11px] text-slate-400">Bebouwing</span>
                        <span className="text-[12px] font-semibold text-[#0E1111] tabular-nums">{regel.bouwregels.max_bebouwingspercentage}%</span>
                      </div>
                    )}
                    {regel.bouwregels.max_floor_area_ratio != null && (
                      <div className="flex items-center justify-between py-1 border-b border-[#EAEFEF]">
                        <span className="text-[11px] text-slate-400">FSI</span>
                        <span className="text-[12px] font-semibold text-[#0E1111] tabular-nums">{regel.bouwregels.max_floor_area_ratio}</span>
                      </div>
                    )}
                    {regel.bouwregels.max_oppervlakte != null && (
                      <div className="flex items-center justify-between py-1 border-b border-[#EAEFEF]">
                        <span className="text-[11px] text-slate-400">Max. opp.</span>
                        <span className="text-[12px] font-semibold text-[#0E1111] tabular-nums">{regel.bouwregels.max_oppervlakte}m²</span>
                      </div>
                    )}
                    {regel.bouwregels.max_inhoud != null && (
                      <div className="flex items-center justify-between py-1 border-b border-[#EAEFEF]">
                        <span className="text-[11px] text-slate-400">Max. inhoud</span>
                        <span className="text-[12px] font-semibold text-[#0E1111] tabular-nums">{regel.bouwregels.max_inhoud}m³</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Parkeereis */}
              {regel.parkeereis && (
                <div className="flex items-start gap-2">
                  <Car size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <p className="text-[12px] text-slate-600">{regel.parkeereis}</p>
                </div>
              )}

              {/* Milieu restricties */}
              {regel.milieu_restricties.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">
                    <Leaf size={10} className="inline mr-1" />Milieu restricties
                  </p>
                  <ul className="space-y-0.5">
                    {regel.milieu_restricties.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bijzondere voorwaarden */}
              {regel.bijzondere_voorwaarden.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">
                    <Shield size={10} className="inline mr-1" />Bijzondere voorwaarden
                  </p>
                  <ul className="space-y-0.5">
                    {regel.bijzondere_voorwaarden.map((v, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer for low-confidence items */}
              {regel.disclaimer && (
                <div className="flex items-start gap-2 rounded-[12px] border border-aura-amber/20 bg-aura-amber/[0.06] px-3 py-2">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0 text-aura-amber" />
                  <p className="text-[11px] text-aura-amber-dark">{regel.disclaimer}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── PDF Viewer Tab ─────────────────────────────────────────── */

function PDFViewerTab({ sourceParcelId }: { sourceParcelId: string }) {
  const { accessToken } = useAuth()
  const { data: docs } = useParcelDocuments(sourceParcelId)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  // Find the bestemmingsplan document
  const bestemmingsplanDoc = docs?.documents?.find(d => d.document_type === 'bestemmingsplan')

  useEffect(() => {
    if (!bestemmingsplanDoc || !accessToken) return

    // Fetch PDF blob with auth and create object URL
    const url = getDocumentDownloadUrl(sourceParcelId, bestemmingsplanDoc.id)
    const controller = new AbortController()

    fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.blob()
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      })
      .catch(() => {
        // Silently fail — will show fallback message
      })

    return () => {
      controller.abort()
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestemmingsplanDoc?.id, sourceParcelId, accessToken])

  if (!bestemmingsplanDoc) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText size={40} className="text-slate-300 mb-3" />
        <p className="text-[13px] text-slate-500">Geen bestemmingsplan PDF gevonden in het dossier.</p>
        <p className="text-[11px] text-slate-400 mt-1">Upload een PDF via de AI Analyse sectie.</p>
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-6 w-6 border-2 border-aura-amber border-t-transparent rounded-full" />
        <p className="ml-3 text-[13px] text-slate-500">PDF laden...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0">
      <iframe
        src={pdfUrl}
        className="w-full h-full rounded-[16px] border border-[#EAEFEF]"
        title="Bestemmingsplan PDF"
      />
    </div>
  )
}

/* ─── Main Modal ─────────────────────────────────────────────── */

type Tab = 'analyse' | 'pdf'

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

export function AIAnalysisModal({ parsed, disclaimerBanner, sourceParcelId, onClose }: AIAnalysisModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('analyse')

  // Close on Escape — capture phase to prevent parent panel from closing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="ai-analysis-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex w-full max-w-2xl flex-col rounded-[32px] bg-[#F8FAFA] shadow-2xl mx-4 max-h-[calc(100vh-80px)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-8 pt-7 pb-2 shrink-0">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">AI Analyse</p>
              <h2 className="text-[18px] font-bold text-[#0E1111] mt-0.5">{parsed.plan_naam}</h2>
              <div className="flex items-center gap-2 mt-1">
                <ConfidencePill level={parsed.overall_confidence} />
                <span className="text-[11px] text-slate-400">{parsed.regels.length} regels geëxtraheerd</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E1111] text-white transition-colors hover:bg-[#0E1111]/80"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 px-8 pt-3 pb-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('analyse')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                activeTab === 'analyse'
                  ? 'bg-[#0E1111] text-white'
                  : 'bg-white text-slate-500 hover:text-[#0E1111]'
              }`}
            >
              <Brain size={14} />
              AI Interpretatie
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pdf')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                activeTab === 'pdf'
                  ? 'bg-[#0E1111] text-white'
                  : 'bg-white text-slate-500 hover:text-[#0E1111]'
              }`}
            >
              <FileText size={14} />
              PDF Document
            </button>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-4 flex flex-col">
            {activeTab === 'analyse' ? (
              <div className="space-y-4">
                {/* Samenvatting */}
                <div className="rounded-[16px] border border-[#EAEFEF] bg-white px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Samenvatting</p>
                  <p className="text-[13px] text-slate-700 leading-relaxed">{parsed.samenvatting}</p>
                </div>

                {/* Regels */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Geëxtraheerde regels ({parsed.regels.length})
                  </p>
                  {parsed.regels.map((regel, i) => (
                    <RegelCard key={i} regel={regel} />
                  ))}
                </div>

                {/* Disclaimers */}
                {parsed.disclaimers.length > 0 && (
                  <div className="rounded-[16px] border border-aura-amber/20 bg-aura-amber/[0.06] px-5 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-aura-amber-dark mb-1">Let op</p>
                    {parsed.disclaimers.map((d, i) => (
                      <p key={i} className="text-[11px] text-aura-amber-dark leading-relaxed">{d}</p>
                    ))}
                  </div>
                )}

                {/* Banner disclaimer */}
                <p className="text-[11px] text-slate-400 italic pb-2">{disclaimerBanner}</p>
              </div>
            ) : (
              /* PDF Tab */
              sourceParcelId ? (
                <PDFViewerTab sourceParcelId={sourceParcelId} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText size={40} className="text-slate-300 mb-3" />
                  <p className="text-[13px] text-slate-500">Geen perceel gekoppeld — PDF niet beschikbaar.</p>
                </div>
              )
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
