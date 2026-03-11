/**
 * EigendomModal — BRK ownership lookup with confirm dialog
 *
 * Three-phase flow: confirm -> loading -> results
 * Adapts framing: grondpositie (leeg perceel) vs herontwikkeling (pand in gebruik)
 * gcTime: 0 ensures BRK data is discarded on modal close (Kadaster Tier 3)
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  X,
  AlertTriangle,
  Loader2,
  Lock,
  User,
  Building2,
  Landmark,
  HelpCircle,
} from 'lucide-react'
import type { ScanResultItem } from '@/lib/types/scan'
import type { ZakelijkGerechtigde } from '@/lib/types/brk'
import { useEigendomLookup } from '@/hooks/useEigendom'
import { useGenerateReportFromParcel } from '@/hooks/useReports'

/* ── Eigenaar type metadata ──────────────────────────────────── */

const EIGENAAR_TIPS: Record<
  ZakelijkGerechtigde['eigenaar_type'],
  { label: string; tip: string; icon: typeof User }
> = {
  natuurlijk_persoon: {
    label: 'Particulier',
    tip: 'Directe benadering of via makelaar',
    icon: User,
  },
  rechtspersoon: {
    label: 'Rechtspersoon',
    tip: 'Portfolio-niveau contact of asset manager',
    icon: Building2,
  },
  overheid: {
    label: 'Overheid / Gemeente',
    tip: 'Grondzaken afdeling benaderen',
    icon: Landmark,
  },
  onbekend: {
    label: 'Onbekend',
    tip: 'Type eigenaar niet beschikbaar',
    icon: HelpCircle,
  },
}

/* ── Props ────────────────────────────────────────────────────── */

interface EigendomModalProps {
  parcel: ScanResultItem
  onClose: () => void
}

/* ── Reduced motion ──────────────────────────────────────────── */

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── Component ────────────────────────────────────────────────── */

export function EigendomModal({ parcel, onClose }: EigendomModalProps) {
  const [confirmed, setConfirmed] = useState(false)
  const eigendomQuery = useEigendomLookup(parcel.parcel_id)
  const navigate = useNavigate()
  const generateReport = useGenerateReportFromParcel()

  const isLeeg = !parcel.has_pand
  const title = isLeeg ? 'Grondpositie' : 'Herontwikkeling'
  const subtitle = isLeeg
    ? 'Wie is eigenaar van dit perceel?'
    : 'Wie is eigenaar van dit gebouw?'

  const handleConfirm = () => {
    setConfirmed(true)
    eigendomQuery.refetch()
  }

  const handleGenerateReport = () => {
    if (parcel.has_report) {
      navigate({ to: '/rapporten', search: { project_id: undefined, q: undefined } })
      onClose()
      return
    }
    generateReport.mutate(parcel.parcel_id, {
      onSuccess: () => {
        toast.success('Rapport wordt gegenereerd')
        onClose()
      },
      onError: () => {
        toast.error('Rapport genereren mislukt')
      },
    })
  }

  const showLoading = confirmed && eigendomQuery.isFetching
  const showResults = confirmed && eigendomQuery.data && !eigendomQuery.isFetching
  const showError = confirmed && eigendomQuery.isError && !eigendomQuery.isFetching

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="eigendom-backdrop"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative bg-white rounded-[32px] shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto mx-4"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB]"
            aria-label="Sluiten"
          >
            <X size={16} strokeWidth={2} />
          </button>

          <div className="p-8">
            {/* ── Phase 1: Confirmation ──────────────── */}
            {!confirmed && (
              <div>
                <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                  {title}
                </h2>
                <p className="mt-1 text-[15px] text-[#6B7280]">{subtitle}</p>

                <div className="mt-6 flex items-start gap-3 rounded-[16px] bg-amber-50 p-4">
                  <AlertTriangle
                    size={20}
                    strokeWidth={1.5}
                    className="mt-0.5 shrink-0 text-amber-500"
                  />
                  <p className="text-[13px] leading-relaxed text-amber-800">
                    Kost 1 credit. Data wordt niet opgeslagen en is eenmalig
                    zichtbaar.
                  </p>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 h-[48px] rounded-full border border-[#EAEFEF] text-[14px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="flex-1 h-[48px] rounded-full bg-[#0E1111] text-[14px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
                  >
                    Eigendom opvragen
                  </button>
                </div>
              </div>
            )}

            {/* ── Phase 2: Loading ───────────────────── */}
            {showLoading && (
              <div className="flex flex-col items-center py-12">
                <Loader2
                  size={32}
                  strokeWidth={1.5}
                  className="animate-spin text-[#F9A826]"
                />
                <h2 className="mt-6 text-[18px] font-bold tracking-tight text-[#0E1111]">
                  {title}
                </h2>
                <p className="mt-2 text-[13px] text-[#6B7280]">
                  Eigendom ophalen bij het Kadaster...
                </p>
              </div>
            )}

            {/* ── Phase 3: Results ───────────────────── */}
            {showResults && eigendomQuery.data && (
              <div>
                {/* Unavailable state */}
                {eigendomQuery.data.status === 'unavailable' && (
                  <div>
                    <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                      {title}
                    </h2>
                    <div className="mt-4 rounded-[16px] bg-[#F2F6F3] p-5">
                      <p className="text-[14px] leading-relaxed text-[#6B7280]">
                        {eigendomQuery.data.reason ??
                          'Eigendomsdata is momenteel niet beschikbaar.'}
                      </p>
                    </div>
                    {eigendomQuery.data.admin_hint && (
                      <div className="mt-3 rounded-[12px] bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[12px] text-slate-400">
                          {eigendomQuery.data.admin_hint}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error state */}
                {eigendomQuery.data.status === 'error' && (
                  <div>
                    <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                      {title}
                    </h2>
                    <div className="mt-4 rounded-[16px] bg-red-50 p-5">
                      <p className="text-[14px] text-red-700">
                        Er is een fout opgetreden bij het Kadaster.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => eigendomQuery.refetch()}
                      className="mt-4 h-[44px] w-full rounded-full border border-[#EAEFEF] text-[14px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
                    >
                      Opnieuw proberen
                    </button>
                  </div>
                )}

                {/* Available state — BRK data */}
                {eigendomQuery.data.status === 'available' &&
                  eigendomQuery.data.data && (
                    <div>
                      {/* Adaptive context header */}
                      <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                        {title}
                      </h2>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
                        {isLeeg
                          ? 'Dit perceel is onbebouwd. Neem contact op met de afdeling Grondzaken van de gemeente voor verwervingsmogelijkheden.'
                          : 'Bekijk de eigendomsverhoudingen en bepaal de beste benadering.'}
                      </p>

                      {/* Per-perceel ownership data */}
                      <div className="mt-6 space-y-4">
                        {eigendomQuery.data.data.map((perceel) => (
                          <div
                            key={perceel.perceel_identificatie}
                            className="rounded-[20px] bg-[#F2F6F3] p-5"
                          >
                            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
                              {perceel.perceel_identificatie}
                            </p>

                            <div className="mt-3 space-y-3">
                              {perceel.gerechtigden.map((g, idx) => {
                                const tip = EIGENAAR_TIPS[g.eigenaar_type]
                                const Icon = tip.icon
                                return (
                                  <div
                                    key={idx}
                                    className="rounded-[14px] bg-white p-4"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F6F3]">
                                        <Icon
                                          size={16}
                                          strokeWidth={1.5}
                                          className="text-[#0E1111]"
                                        />
                                      </div>
                                      <span className="text-[14px] font-bold text-[#0E1111]">
                                        {tip.label}
                                      </span>
                                    </div>

                                    {g.zakelijk_recht_type && (
                                      <p className="mt-2 text-[13px] text-[#6B7280]">
                                        <span className="font-semibold text-[#0E1111]">
                                          Recht:
                                        </span>{' '}
                                        {g.zakelijk_recht_type}
                                      </p>
                                    )}

                                    {g.aandeel && (
                                      <p className="mt-1 text-[13px] text-[#6B7280]">
                                        <span className="font-semibold text-[#0E1111]">
                                          Aandeel:
                                        </span>{' '}
                                        {g.aandeel}
                                      </p>
                                    )}

                                    <p className="mt-2 text-[12px] italic text-[#94a3b8]">
                                      {tip.tip}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>

                            {perceel.heeft_hypotheek && (
                              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1">
                                <span className="text-[12px] font-semibold text-amber-700">
                                  Hypotheek
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Teaser sections */}
                      <div className="mt-6 space-y-3">
                        <TeaserSection label="Bodemrisico" />
                        <TeaserSection label="Bouwpotentieel" />
                      </div>

                      {/* Genereer Rapport CTA */}
                      <button
                        type="button"
                        onClick={handleGenerateReport}
                        disabled={generateReport.isPending}
                        className="mt-6 h-[56px] w-full rounded-full bg-[#0E1111] text-[15px] font-bold tracking-tight text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60"
                      >
                        {generateReport.isPending
                          ? 'Bezig...'
                          : parcel.has_report
                            ? 'Bekijk Rapport'
                            : 'Genereer Rapport'}
                      </button>
                    </div>
                  )}
              </div>
            )}

            {/* ── Error state (query-level) ──────────── */}
            {showError && (
              <div>
                <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                  {title}
                </h2>
                <div className="mt-4 rounded-[16px] bg-red-50 p-5">
                  <p className="text-[14px] text-red-700">
                    Er is een fout opgetreden bij het Kadaster.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => eigendomQuery.refetch()}
                  className="mt-4 h-[44px] w-full rounded-full border border-[#EAEFEF] text-[14px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
                >
                  Opnieuw proberen
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* ── Teaser Section (blurred/locked) ──────────────────────────── */

function TeaserSection({ label }: { label: string }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] bg-[#F2F6F3] p-4">
      {/* Blurred placeholder content */}
      <div className="select-none blur-[6px]">
        <div className="h-3 w-3/4 rounded bg-[#d1d5db]" />
        <div className="mt-2 h-3 w-1/2 rounded bg-[#d1d5db]" />
        <div className="mt-2 h-3 w-2/3 rounded bg-[#d1d5db]" />
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm backdrop-blur-sm">
          <Lock size={14} strokeWidth={2} className="text-[#94a3b8]" />
          <span className="text-[12px] font-semibold text-[#6B7280]">{label}</span>
        </div>
      </div>
    </div>
  )
}
