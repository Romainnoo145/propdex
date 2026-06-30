/**
 * EigendomModal — BRK ownership lookup
 *
 * Two-stage flow:
 *   1. Small confirm dialog (costs credit)
 *   2. Adaptive modal showing all BRK data on one screen:
 *      - Eigenaren (ownership)
 *      - Hypotheken (mortgages) if present
 *      - Beslagen (seizures) if present — red alert
 *
 * Modal adapts height to content. Sticky action bar at bottom.
 * gcTime: 0 ensures BRK data is discarded on modal close (Kadaster Tier 3)
 *
 * DEV_MOCK: In development, skips confirm + shows mock data for UI iteration.
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
  ShieldAlert,
  Banknote,
} from 'lucide-react'
import type { ScanResultItem } from '@/lib/types/scan'
import type {
  ZakelijkGerechtigde,
  BRKOwnershipResponse,
} from '@/lib/types/brk'
import { useEigendomLookup } from '@/hooks/useEigendom'

/* ── Bank icon lookup ────────────────────────────────────────── */

const BANK_ICONS: Record<string, string> = {
  rabobank: '/images/banks/rabobank.svg',
  'abn amro': '/images/banks/abn-amro.svg',
  ing: '/images/banks/ing.svg',
  volksbank: '/images/banks/volksbank.svg',
  sns: '/images/banks/volksbank.svg',
  regiobank: '/images/banks/volksbank.svg',
  triodos: '/images/banks/triodos.svg',
}

function getBankIcon(naam: string | null): string {
  if (!naam) return '/images/banks/default.svg'
  const lower = naam.toLowerCase()
  for (const [key, path] of Object.entries(BANK_ICONS)) {
    if (lower.includes(key)) return path
  }
  return '/images/banks/default.svg'
}

/* ── Dev mock ────────────────────────────────────────────────── */

const DEV_MOCK =
  (import.meta as unknown as { env: { DEV: boolean; VITE_BRK_MOCK?: string } }).env.DEV ||
  (import.meta as unknown as { env: { VITE_BRK_MOCK?: string } }).env.VITE_BRK_MOCK === '1'

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
      hypotheken: [
        {
          hypotheekhouder_naam: 'Rabobank N.V.',
          bedrag: 380000,
          aard: 'Eerste hypotheek',
        },
        {
          hypotheekhouder_naam: 'ABN AMRO Bank N.V.',
          bedrag: 95000,
          aard: 'Tweede hypotheek',
        },
      ],
      beslagen: [],
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
          naam: null,
          kvk_nummer: null,
          statutaire_zetel: null,
          zakelijk_recht_type: 'Erfpacht (recht van)',
          aandeel: '1/2',
          koopsom: 185000,
          koopjaar: 2021,
        },
      ],
      heeft_hypotheek: false,
      hypotheken: [],
      beslagen: [
        { aard: 'Conservatoir beslag' },
      ],
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
  const [confirmed, setConfirmed] = useState(DEV_MOCK)
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

  const effectiveData = DEV_MOCK ? MOCK_BRK_DATA : eigendomQuery.data
  const showLoading = confirmed && !DEV_MOCK && eigendomQuery.isFetching
  const showResults = confirmed && effectiveData && (DEV_MOCK || !eigendomQuery.isFetching)
  const showError = confirmed && !DEV_MOCK && eigendomQuery.isError && !eigendomQuery.isFetching

  const percelen = effectiveData?.data ?? []
  const allBeslagen = percelen.flatMap((p) =>
    p.beslagen.map((b) => ({ ...b, perceel: p.perceel_identificatie })),
  )

  /* ── Action handlers ──────────────────────────── */

  const handleCopyAll = () => {
    if (!effectiveData?.data) return
    const lines: string[] = [`${title} — ${parcel.address ?? parcel.parcel_id}`, '']
    for (const p of effectiveData.data) {
      lines.push(`Perceel: ${p.perceel_identificatie}`)
      for (const g of p.gerechtigden) {
        const tip = EIGENAAR_TIPS[g.eigenaar_type]
        lines.push(`  ${g.naam ?? tip.label} (${tip.label})`)
        if (g.kvk_nummer) lines.push(`  KvK: ${g.kvk_nummer}${g.statutaire_zetel ? ` · ${g.statutaire_zetel}` : ''}`)
        if (g.zakelijk_recht_type) lines.push(`  Recht: ${g.zakelijk_recht_type}${g.aandeel ? ` · Aandeel: ${g.aandeel}` : ''}`)
        if (g.koopsom != null) lines.push(`  Koopsom: €${g.koopsom.toLocaleString('nl-NL')}${g.koopjaar ? ` (${g.koopjaar})` : ''}`)
      }
      if (p.hypotheken.length > 0) {
        lines.push('  Hypotheken:')
        for (const h of p.hypotheken) {
          const parts = [h.aard, h.hypotheekhouder_naam, h.bedrag ? `€${h.bedrag.toLocaleString('nl-NL')}` : null].filter(Boolean)
          lines.push(`    ${parts.join(' · ')}`)
        }
      }
      if (p.beslagen.length > 0) {
        lines.push('  Beslagen:')
        for (const b of p.beslagen) lines.push(`    ${b.aard ?? 'Beslag'}`)
      }
      lines.push('')
    }
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Eigendomsdata gekopieerd')
  }

  const handleKvkLookup = (kvk: string) => {
    window.open(`https://www.kvk.nl/zoeken/handelsregister/?q=${kvk}`, '_blank')
  }

  /* ── Phase 1: Small confirm dialog ─────────────── */

  if (!confirmed) {
    return createPortal(
      <AnimatePresence>
        <motion.div
          key="eigendom-confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative bg-white rounded-[24px] shadow-xl w-full max-w-sm mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <AlertTriangle size={18} strokeWidth={1.5} className="text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-bold text-[#0E1111]">
                  Kadaster eigendomsopvraag
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B7280]">
                  Kost 1 credit. Data is eenmalig zichtbaar en wordt niet opgeslagen.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-[44px] rounded-full border border-[#EAEFEF] text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 h-[44px] rounded-full bg-[#0E1111] text-[13px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
              >
                Eigendom opvragen
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>,
      document.body,
    )
  }

  /* ── Phase 2+3: Results modal (adaptive height) ── */

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="eigendom-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-md"
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[calc(100vh-80px)] mx-4"
        >
          {/* ── Header ──────────────────────────────── */}
          <div className="flex items-start justify-between px-8 pt-7 pb-3 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                  {title}
                </h2>
                {showResults && effectiveData?.status === 'available' && (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-100 px-2.5 py-1">
                    <AlertTriangle size={11} strokeWidth={2} className="text-amber-500" />
                    <span className="text-[10px] font-semibold text-amber-700">
                      Eenmalig
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-[#6B7280]">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-[#0E1111] transition-colors ml-4 mt-0.5"
              aria-label="Sluiten"
            ><X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* ── Content (scrollable if needed) ──────── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-2">
            {/* Loading */}
            {showLoading && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 size={32} strokeWidth={1.5} className="animate-spin text-[#F9A826]" />
                <p className="mt-5 text-[13px] text-[#6B7280]">
                  Eigendom ophalen bij het Kadaster...
                </p>
              </div>
            )}

            {/* Results */}
            {showResults && effectiveData && (
              <>
                {/* Unavailable */}
                {effectiveData.status === 'unavailable' && (
                  <div className="py-10">
                    <div className="rounded-[16px] bg-[#F2F6F3] p-5">
                      <p className="text-[13px] leading-relaxed text-[#6B7280]">
                        {effectiveData.reason ?? 'Eigendomsdata is momenteel niet beschikbaar.'}
                      </p>
                    </div>
                    {effectiveData.admin_hint && (
                      <div className="mt-2 rounded-[12px] bg-slate-50 p-3 border border-slate-100">
                        <p className="text-[11px] text-slate-400">{effectiveData.admin_hint}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error */}
                {effectiveData.status === 'error' && (
                  <div className="py-10">
                    <div className="rounded-[14px] bg-red-50 p-5">
                      <p className="text-[13px] text-red-700">
                        Er is een fout opgetreden bij het Kadaster.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => eigendomQuery.refetch()}
                      className="mt-3 h-[40px] w-full rounded-full border border-[#EAEFEF] text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
                    >
                      Opnieuw proberen
                    </button>
                  </div>
                )}

                {/* Available — all data on one screen */}
                {effectiveData.status === 'available' && percelen.length > 0 && (
                  <div className="space-y-4">
                    {/* ── Beslagen alert (top, only if present) ── */}
                    {allBeslagen.length > 0 && (
                      <div className="rounded-[14px] bg-red-50 border border-red-100 p-4 flex items-start gap-3">
                        <ShieldAlert size={18} strokeWidth={1.5} className="text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[13px] font-bold text-red-900">
                            Beslag geregistreerd
                          </p>
                          <p className="mt-0.5 text-[12px] text-red-700">
                            {allBeslagen.map((b) => b.aard ?? 'Beslag').join(', ')}
                            {' — '}overleg met een notaris voordat u een bod uitbrengt.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Eigenaren per perceel ────────────── */}
                    {percelen.map((perceel) => (
                      <div key={perceel.perceel_identificatie} className="rounded-[16px] bg-[#F2F6F3] p-4">
                        {/* Perceel header */}
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
                            {perceel.perceel_identificatie}
                          </p>
                          {perceel.heeft_hypotheek && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                              <Banknote size={10} strokeWidth={2} />
                              Hypotheek
                            </span>
                          )}
                        </div>

                        {/* Gerechtigden */}
                        <div className="space-y-2">
                          {perceel.gerechtigden.map((g, idx) => (
                            <GerechtigdeCard key={idx} g={g} onKvkLookup={handleKvkLookup} />
                          ))}
                        </div>

                        {/* Inline hypotheken for this perceel */}
                        {perceel.hypotheken.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {perceel.hypotheken.map((h, idx) => (
                              <div key={idx} className="rounded-[12px] bg-white p-3 flex items-center gap-3">
                                <img
                                  src={getBankIcon(h.hypotheekhouder_naam)}
                                  alt=""
                                  className="h-7 w-7 rounded-full shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-[#0E1111]">
                                    {h.hypotheekhouder_naam ?? 'Geldverstrekker onbekend'}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {h.bedrag != null && (
                                      <span className="text-[12px] text-[#6B7280]">
                                        €{h.bedrag.toLocaleString('nl-NL')}
                                      </span>
                                    )}
                                    {h.aard && (
                                      <span className="text-[11px] text-[#94a3b8]">
                                        {h.aard}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Error (query-level) */}
            {showError && (
              <div className="py-10">
                <div className="rounded-[14px] bg-red-50 p-5">
                  <p className="text-[13px] text-red-700">
                    Er is een fout opgetreden bij het Kadaster.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => eigendomQuery.refetch()}
                  className="mt-3 h-[40px] w-full rounded-full border border-[#EAEFEF] text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
                >
                  Opnieuw proberen
                </button>
              </div>
            )}
          </div>

          {/* ── Sticky footer: actions ──────────────── */}
          {showResults && effectiveData?.status === 'available' && percelen.length > 0 && (
            <div className="shrink-0 px-8 pb-6 pt-3 border-t border-[#EAEFEF]">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="flex items-center gap-2 h-[40px] px-4 rounded-full bg-[#0E1111] text-[12px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Copy size={13} strokeWidth={2} />
                  Kopieer
                </button>
                <button
                  type="button"
                  onClick={() => window.open('https://www.kadaster.nl/zakelijk/producten/eigendom/eigendomsinformatie', '_blank')}
                  className="flex items-center gap-2 h-[40px] px-4 rounded-full border border-[#EAEFEF] text-[12px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
                >
                  <ExternalLink size={13} strokeWidth={2} />
                  Kadaster.nl
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 h-[40px] px-4 rounded-full border border-[#EAEFEF] text-[12px] font-semibold text-[#c4c4c4] cursor-not-allowed"
                >
                  <Lock size={11} strokeWidth={2} />
                  PDF
                </button>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 h-[40px] px-4 rounded-full border border-[#EAEFEF] text-[12px] font-semibold text-[#c4c4c4] cursor-not-allowed"
                >
                  <Lock size={11} strokeWidth={2} />
                  Brief
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/* ── Gerechtigde Card ─────────────────────────────────────────── */

function GerechtigdeCard({
  g,
  onKvkLookup,
}: {
  g: ZakelijkGerechtigde
  onKvkLookup: (kvk: string) => void
}) {
  const tip = EIGENAAR_TIPS[g.eigenaar_type]
  const Icon = tip.icon

  return (
    <div className="rounded-[12px] bg-white p-3.5">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F2F6F3] shrink-0">
          <Icon size={14} strokeWidth={1.5} className="text-[#0E1111]" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold text-[#0E1111]">
            {g.naam ?? tip.label}
          </span>
          {g.naam && (
            <span className="ml-1.5 text-[10px] font-medium text-[#94a3b8]">
              {tip.label}
            </span>
          )}
        </div>
        {g.kvk_nummer && (
          <button
            type="button"
            onClick={() => onKvkLookup(g.kvk_nummer!)}
            className="flex items-center gap-1 rounded-full bg-[#F2F6F3] px-2.5 py-1 text-[10px] font-semibold text-[#0E1111] transition-colors hover:bg-[#E8EDEB]"
          >
            KvK {g.kvk_nummer}
            <ExternalLink size={9} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#6B7280]">
        {g.zakelijk_recht_type && (
          <span>{g.zakelijk_recht_type}</span>
        )}
        {g.aandeel && g.aandeel !== '1/1' && (
          <span>Aandeel {g.aandeel}</span>
        )}
        {g.koopsom != null && (
          <span>
            €{g.koopsom.toLocaleString('nl-NL')}
            {g.koopjaar && <span className="text-[#94a3b8]"> ({g.koopjaar})</span>}
          </span>
        )}
        {g.statutaire_zetel && (
          <span className="text-[#94a3b8]">{g.statutaire_zetel}</span>
        )}
      </div>
    </div>
  )
}
