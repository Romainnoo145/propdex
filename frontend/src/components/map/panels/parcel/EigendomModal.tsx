/**
 * EigendomModal — BRK ownership lookup with confirm dialog
 *
 * Three-phase flow: confirm -> loading -> results
 * Adapts framing: grondpositie (leeg perceel) vs herontwikkeling (pand in gebruik)
 * gcTime: 0 ensures BRK data is discarded on modal close (Kadaster Tier 3)
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
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
  Copy,
  ExternalLink,
  Mail,
  FileText,
} from 'lucide-react'
import type { ScanResultItem } from '@/lib/types/scan'
import type { ZakelijkGerechtigde, BRKOwnershipResponse } from '@/lib/types/brk'
import { useEigendomLookup } from '@/hooks/useEigendom'

/* ── Dev mock (remove before production) ──────────────────── */

const DEV_MOCK = import.meta.env.DEV // auto-true in dev, false in prod build

const MOCK_BRK_DATA: BRKOwnershipResponse = {
  status: 'available',
  data: [
    {
      perceel_identificatie: 'Venlo A 1234',
      gerechtigden: [
        {
          eigenaar_type: 'rechtspersoon',
          naam: 'Bouwbedrijf Janssen B.V.',
          kvk_nummer: '12345678',
          statutaire_zetel: 'Venlo',
          zakelijk_recht_type: 'Eigendom (recht van)',
          aandeel: '1/1',
          koopsom: 425000,
          koopjaar: 2019,
        },
      ],
      heeft_hypotheek: true,
    },
    {
      perceel_identificatie: 'Venlo A 5678',
      gerechtigden: [
        {
          eigenaar_type: 'overheid',
          naam: 'Gemeente Venlo',
          kvk_nummer: null,
          statutaire_zetel: null,
          zakelijk_recht_type: 'Eigendom (recht van)',
          aandeel: '1/1',
          koopsom: null,
          koopjaar: null,
        },
        {
          eigenaar_type: 'natuurlijk_persoon',
          naam: null, // AVG: never show personal names
          kvk_nummer: null,
          statutaire_zetel: null,
          zakelijk_recht_type: 'Erfpacht (recht van)',
          aandeel: '1/2',
          koopsom: 185000,
          koopjaar: 2021,
        },
      ],
      heeft_hypotheek: false,
    },
  ],
  reason: null,
  fetched_at: new Date().toISOString(),
  admin_hint: null,
}

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
  const [confirmed, setConfirmed] = useState(DEV_MOCK) // skip confirm in dev
  const eigendomQuery = useEigendomLookup(parcel.parcel_id)

  const isLeeg = !parcel.has_pand
  const title = isLeeg ? 'Grondpositie' : 'Herontwikkeling'
  const subtitle = isLeeg
    ? 'Wie is eigenaar van dit perceel?'
    : 'Wie is eigenaar van dit gebouw?'

  const handleConfirm = () => {
    setConfirmed(true)
    if (!DEV_MOCK) eigendomQuery.refetch()
  }

  // In dev mode, use mock data directly; in prod, use the real query
  const effectiveData = DEV_MOCK ? MOCK_BRK_DATA : eigendomQuery.data
  const showLoading = confirmed && !DEV_MOCK && eigendomQuery.isFetching
  const showResults = confirmed && effectiveData && (DEV_MOCK || !eigendomQuery.isFetching)
  const showError = confirmed && !DEV_MOCK && eigendomQuery.isError && !eigendomQuery.isFetching

  /* ── Action handlers ──────────────────────────── */

  const handleCopyAll = () => {
    if (!effectiveData?.data) return
    const lines: string[] = [
      `${title} — ${parcel.address ?? parcel.parcel_id}`,
      '',
    ]
    for (const perceel of effectiveData.data) {
      lines.push(`Perceel: ${perceel.perceel_identificatie}`)
      for (const g of perceel.gerechtigden) {
        const tip = EIGENAAR_TIPS[g.eigenaar_type]
        lines.push(`  ${g.naam ?? tip.label} (${tip.label})`)
        if (g.kvk_nummer) lines.push(`  KvK: ${g.kvk_nummer}${g.statutaire_zetel ? ` · ${g.statutaire_zetel}` : ''}`)
        if (g.zakelijk_recht_type) lines.push(`  Recht: ${g.zakelijk_recht_type}${g.aandeel ? ` · Aandeel: ${g.aandeel}` : ''}`)
        if (g.koopsom != null) lines.push(`  Koopsom: €${g.koopsom.toLocaleString('nl-NL')}${g.koopjaar ? ` (${g.koopjaar})` : ''}`)
      }
      if (perceel.heeft_hypotheek) lines.push('  ⚠ Hypotheek geregistreerd')
      lines.push('')
    }
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Eigendomsdata gekopieerd')
  }

  const handleKvkLookup = (kvk: string) => {
    window.open(`https://www.kvk.nl/zoeken/handelsregister/?q=${kvk}`, '_blank')
  }

  const handleKadasterLookup = (perceelId: string) => {
    window.open(`https://www.kadaster.nl/zakelijk/producten/eigendom/eigendomsinformatie`, '_blank')
  }

  return createPortal(
    <AnimatePresence>
      {/* Backdrop — NO click-to-close (data costs a credit) */}
      <motion.div
        key="eigendom-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
      >
        {/* Near full-screen modal */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-[calc(100vw-80px)] max-w-3xl h-[calc(100vh-80px)] mx-4"
        >
          {/* ── Sticky header ──────────────────────── */}
          <div className="flex items-center justify-between px-10 pt-8 pb-4">
            <div>
              <h2 className="text-[26px] font-black tracking-tight text-[#0E1111]">
                {title}
              </h2>
              <p className="mt-0.5 text-[14px] text-[#6B7280]">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB]"
              aria-label="Sluiten"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* ── Scrollable content ─────────────────── */}
          <div className="flex-1 overflow-y-auto px-10 pb-10">
            {/* ── Phase 1: Confirmation ──────────────── */}
            {!confirmed && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex items-start gap-3 rounded-[16px] bg-amber-50 p-5 max-w-md">
                  <AlertTriangle
                    size={22}
                    strokeWidth={1.5}
                    className="mt-0.5 shrink-0 text-amber-500"
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-amber-900">
                      Kadaster eigendomsopvraag
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-amber-800">
                      Kost 1 credit. Data wordt niet opgeslagen en is eenmalig
                      zichtbaar. Kopieer of exporteer de gegevens voordat u dit
                      scherm sluit.
                    </p>
                  </div>
                </div>

                <div className="mt-10 flex gap-3 w-full max-w-md">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 h-[52px] rounded-full border border-[#EAEFEF] text-[14px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="flex-1 h-[52px] rounded-full bg-[#0E1111] text-[14px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
                  >
                    Eigendom opvragen
                  </button>
                </div>
              </div>
            )}

            {/* ── Phase 2: Loading ───────────────────── */}
            {showLoading && (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader2
                  size={36}
                  strokeWidth={1.5}
                  className="animate-spin text-[#F9A826]"
                />
                <p className="mt-6 text-[14px] text-[#6B7280]">
                  Eigendom ophalen bij het Kadaster...
                </p>
              </div>
            )}

            {/* ── Phase 3: Results ───────────────────── */}
            {showResults && effectiveData && (
              <div>
                {/* Unavailable state */}
                {effectiveData.status === 'unavailable' && (
                  <div className="py-12">
                    <div className="rounded-[16px] bg-[#F2F6F3] p-6">
                      <p className="text-[14px] leading-relaxed text-[#6B7280]">
                        {effectiveData.reason ??
                          'Eigendomsdata is momenteel niet beschikbaar.'}
                      </p>
                    </div>
                    {effectiveData.admin_hint && (
                      <div className="mt-3 rounded-[12px] bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[12px] text-slate-400">
                          {effectiveData.admin_hint}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error state */}
                {effectiveData.status === 'error' && (
                  <div className="py-12">
                    <div className="rounded-[16px] bg-red-50 p-6">
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
                {effectiveData.status === 'available' &&
                  effectiveData.data && (
                    <div>
                      {/* Context line */}
                      <p className="text-[13px] leading-relaxed text-[#6B7280]">
                        {isLeeg
                          ? 'Dit perceel is onbebouwd. Neem contact op met de afdeling Grondzaken van de gemeente voor verwervingsmogelijkheden.'
                          : 'Bekijk de eigendomsverhoudingen en bepaal de beste benadering.'}
                      </p>

                      {/* Per-perceel ownership data */}
                      <div className="mt-6 space-y-4">
                        {effectiveData.data!.map((perceel) => (
                          <div
                            key={perceel.perceel_identificatie}
                            className="rounded-[20px] bg-[#F2F6F3] p-5"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
                                {perceel.perceel_identificatie}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleKadasterLookup(perceel.perceel_identificatie)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-[#6B7280] transition-colors hover:text-[#0E1111]"
                              >
                                Kadaster
                                <ExternalLink size={11} strokeWidth={2} />
                              </button>
                            </div>

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
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[14px] font-bold text-[#0E1111]">
                                          {g.naam ?? tip.label}
                                        </span>
                                        {g.naam && (
                                          <span className="ml-2 text-[11px] font-medium text-[#94a3b8]">
                                            {tip.label}
                                          </span>
                                        )}
                                      </div>
                                      {/* KvK link for rechtspersonen */}
                                      {g.kvk_nummer && (
                                        <button
                                          type="button"
                                          onClick={() => handleKvkLookup(g.kvk_nummer!)}
                                          className="flex items-center gap-1 rounded-full bg-[#F2F6F3] px-3 py-1.5 text-[11px] font-semibold text-[#0E1111] transition-colors hover:bg-[#E8EDEB]"
                                        >
                                          KvK {g.kvk_nummer}
                                          <ExternalLink size={10} strokeWidth={2} />
                                        </button>
                                      )}
                                    </div>

                                    {/* Zetel for rechtspersonen (when kvk shown in button) */}
                                    {g.statutaire_zetel && (
                                      <p className="mt-2 text-[12px] text-[#94a3b8]">
                                        Zetel: {g.statutaire_zetel}
                                      </p>
                                    )}

                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                      {g.zakelijk_recht_type && (
                                        <p className="text-[13px] text-[#6B7280]">
                                          <span className="font-semibold text-[#0E1111]">
                                            Recht:
                                          </span>{' '}
                                          {g.zakelijk_recht_type}
                                        </p>
                                      )}

                                      {g.aandeel && (
                                        <p className="text-[13px] text-[#6B7280]">
                                          <span className="font-semibold text-[#0E1111]">
                                            Aandeel:
                                          </span>{' '}
                                          {g.aandeel}
                                        </p>
                                      )}
                                    </div>

                                    {/* Koopsom + koopjaar */}
                                    {g.koopsom != null && (
                                      <p className="mt-2 text-[13px] text-[#6B7280]">
                                        <span className="font-semibold text-[#0E1111]">
                                          Koopsom:
                                        </span>{' '}
                                        €{g.koopsom.toLocaleString('nl-NL')}
                                        {g.koopjaar && (
                                          <span className="ml-1 text-[#94a3b8]">
                                            ({g.koopjaar})
                                          </span>
                                        )}
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

                      {/* ── Action bar ────────────────────── */}
                      <div className="mt-8">
                        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#94a3b8] mb-3">
                          Acties
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <ActionButton
                            icon={Copy}
                            label="Kopieer gegevens"
                            description="Plak in e-mail of notitie"
                            onClick={handleCopyAll}
                          />
                          <ActionButton
                            icon={FileText}
                            label="Exporteer PDF"
                            description="Binnenkort beschikbaar"
                            disabled
                          />
                          <ActionButton
                            icon={Mail}
                            label="Stuur brief"
                            description="Binnenkort beschikbaar"
                            disabled
                          />
                          <ActionButton
                            icon={ExternalLink}
                            label="Kadaster.nl"
                            description="Volledige akte opvragen"
                            onClick={() => window.open('https://www.kadaster.nl/zakelijk/producten/eigendom/eigendomsinformatie', '_blank')}
                          />
                        </div>
                      </div>

                      {/* ── Ephemeral data notice ─────────── */}
                      <div className="mt-6 flex items-center gap-2 rounded-[12px] bg-amber-50 px-4 py-3">
                        <AlertTriangle size={14} strokeWidth={1.5} className="shrink-0 text-amber-500" />
                        <p className="text-[11px] text-amber-700">
                          Kadaster data is eenmalig — kopieer of exporteer voordat u dit scherm sluit.
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* ── Error state (query-level) ──────────── */}
            {showError && (
              <div className="py-12">
                <div className="rounded-[16px] bg-red-50 p-6">
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

/* ── Action Button ───────────────────────────────────────────── */

function ActionButton({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
}: {
  icon: typeof Copy
  label: string
  description: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-start gap-3 rounded-[16px] p-4 text-left transition-colors ${
        disabled
          ? 'bg-[#F2F6F3]/60 cursor-not-allowed'
          : 'bg-[#F2F6F3] hover:bg-[#E8EDEB] active:scale-[0.98]'
      }`}
    >
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        disabled ? 'bg-white/50' : 'bg-white'
      }`}>
        {disabled ? (
          <Lock size={14} strokeWidth={2} className="text-[#94a3b8]" />
        ) : (
          <Icon size={16} strokeWidth={1.5} className="text-[#0E1111]" />
        )}
      </div>
      <div>
        <p className={`text-[13px] font-bold ${disabled ? 'text-[#94a3b8]' : 'text-[#0E1111]'}`}>
          {label}
        </p>
        <p className={`text-[11px] ${disabled ? 'text-[#c4c4c4]' : 'text-[#6B7280]'}`}>
          {description}
        </p>
      </div>
    </button>
  )
}
