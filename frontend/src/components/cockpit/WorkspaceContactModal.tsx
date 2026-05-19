/**
 * WorkspaceContactModal — one-off contact modal triggered from AanpakCard.
 * Extracted from FavoriteParcelWorkspaceView.tsx 2026-05-19 (Plan 08-06 split,
 * M050/S06 cont.). Kept separate from OnderzoekPhaseView to enforce the
 * ≤300-LOC CLAUDE.md rule on the shell.
 */
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, ExternalLink, Phone, X } from 'lucide-react'
import { toast } from 'sonner'
import type { FavoriteResponse } from '@/lib/types/portfolio'

const CONTACT_PREFERSREDUCEDMOTION =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface WorkspaceContactModalProps {
  favorite: FavoriteResponse
  contactFollowUp: { title: string; detail: string }
  hasEigendom: boolean
  onClose: () => void
  onOpenMap: () => void
}

export function WorkspaceContactModal({
  favorite,
  contactFollowUp,
  hasEigendom,
  onClose,
  onOpenMap,
}: WorkspaceContactModalProps) {
  const title = favorite.address ?? favorite.parcel_id
  const address = favorite.address ?? favorite.parcel_id

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address)
    toast.success('Adres gekopieerd')
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="contact-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={CONTACT_PREFERSREDUCEDMOTION ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={CONTACT_PREFERSREDUCEDMOTION ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex flex-col bg-white rounded-[28px] shadow-2xl w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between px-6 pt-6 pb-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                Contact opnemen
              </p>
              <h3 className="mt-1 text-[18px] font-bold tracking-tight text-[#0E1111] leading-tight">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB] ml-3"
              aria-label="Sluiten"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
          <div className="px-6 pb-2">
            <div className="rounded-[16px] border border-[#F1E1B0] bg-[#FFF8E8] px-4 py-3 mt-2">
              <p className="text-[14px] font-bold text-[#0E1111]">{contactFollowUp.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                {contactFollowUp.detail}
              </p>
            </div>
            <div className="mt-3 rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
                  Eigendomsinfo
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    hasEigendom
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}
                >
                  {hasEigendom ? 'Beschikbaar' : 'Nog niet opgehaald'}
                </span>
              </div>
              {!hasEigendom && (
                <p className="mt-2 text-[12px] text-slate-500">
                  Open dit perceel op de kaart en vraag BRK eigendom op om naam en contactgegevens
                  van de eigenaar te zien.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleCopyAddress}
                className="flex w-full items-center gap-3 rounded-[14px] border border-[#EAEFEF] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F8FAFA]"
              >
                <Copy size={15} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#0E1111]">Kopieer adres</p>
                  <p className="truncate text-[11px] text-slate-500">{address}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
                    '_blank',
                  )
                }}
                className="flex w-full items-center gap-3 rounded-[14px] border border-[#EAEFEF] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F8FAFA]"
              >
                <ExternalLink size={15} className="shrink-0 text-slate-400" />
                <div>
                  <p className="text-[13px] font-semibold text-[#0E1111]">Bekijk op Google Maps</p>
                  <p className="text-[11px] text-slate-500">Street View & omgeving</p>
                </div>
              </button>
              {!hasEigendom && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenMap()
                  }}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-[#EAEFEF] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F8FAFA]"
                >
                  <Phone size={15} className="shrink-0 text-slate-400" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#0E1111]">
                      Eigendom opvragen op kaart
                    </p>
                    <p className="text-[11px] text-slate-500">BRK eigenaar + hypotheekinfo</p>
                  </div>
                </button>
              )}
            </div>
          </div>
          <div className="px-6 pb-6 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-[44px] rounded-full border border-[#EAEFEF] text-[13px] font-semibold text-[#0E1111] transition-colors hover:bg-[#F2F6F3]"
            >
              Sluiten
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
