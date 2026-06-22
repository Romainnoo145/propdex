/**
 * FactorDetailDrawer — shared right-side slide-in drawer chrome (M054/S03).
 *
 * Extracts the portal + AnimatePresence + panel chrome that was duplicated across
 * cascade popups (OmgevingsvisiePopup, WoonvisiePopup, HuisvestingsverordeningPopup,
 * ParkeernormenPopup). Single source of truth for the drawer chrome.
 *
 * Adds Esc-to-close keyboard handler not present in the original per-popup chrome.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface FactorDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function FactorDetailDrawer({ isOpen, onClose, children }: FactorDetailDrawerProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="factor-drawer-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-stretch justify-end bg-black/30 backdrop-blur-md"
        onClick={onClose}
        role="dialog" aria-modal="true"
      >
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative flex h-full w-full max-w-[680px] flex-col rounded-l-[32px] bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button" onClick={onClose} aria-label="Sluiten"
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#F2F6F3] hover:text-[#0E1111]"
          >
            <X size={14} strokeWidth={2} />
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto px-12 py-12">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
