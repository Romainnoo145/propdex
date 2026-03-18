import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface GemeenteModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  /** Optional footer content — rendered in sticky footer bar */
  footer?: React.ReactNode
  /** Max width class — defaults to max-w-2xl */
  maxWidth?: string
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Modal shell for gemeente intelligence drill-downs.
 * Uses createPortal(document.body) to escape all z-context stacking.
 * Design matches parcel modals: EigendomModal, ScoreBreakdownModal, BestemmingModal.
 */
export function GemeenteModal({ title, subtitle, onClose, children, footer, maxWidth = 'max-w-2xl' }: GemeenteModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="gemeente-modal-backdrop"
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
          className={`relative flex flex-col bg-white rounded-[32px] shadow-2xl w-full ${maxWidth} max-h-[calc(100vh-80px)] mx-4`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header (matches parcel modals: px-8 pt-7 pb-3) ── */}
          <div className="flex items-start justify-between px-8 pt-7 pb-3 shrink-0">
            <div className="min-w-0">
              <h2 className="text-[22px] font-black tracking-tight text-[#0E1111]">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 text-[13px] text-[#6B7280]">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2F6F3] text-[#0E1111] transition-colors hover:bg-[#E8EDEB] ml-4 mt-0.5"
              aria-label="Sluiten"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* ── Scrollable content (px-8 pb-6) ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-6">
            {children}
          </div>

          {/* ── Footer ── */}
          {footer && (
            <div className="shrink-0 px-8 pb-6 pt-3 border-t border-[#EAEFEF]">
              {footer}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
