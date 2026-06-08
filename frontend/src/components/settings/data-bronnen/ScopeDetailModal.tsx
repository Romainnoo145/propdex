/**
 * ScopeDetailModal — wraps ScopeDataSourcesView in a pop-up so a scope's
 * data-bronnen open in-place (from the ScopeHub hero) instead of navigating
 * away to the $entityType/$entityCode route.
 *
 * Shell mirrors ActionItemDetailModal:
 *  - AnimatePresence backdrop (bg-black/30 backdrop-blur-sm), backdrop-click closes.
 *  - Solid white panel (bg-white, rounded-[28px], shadow-2xl).
 *  - Plus Jakarta Sans inline style, close button top-right.
 *  - ESC-close (keydown effect, like UploadDocumentModal).
 */
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

import type { EntityType } from '@/lib/types/data-sources-admin'
import { ScopeDataSourcesView } from '@/components/settings/data-bronnen/ScopeDataSourcesView'

interface Props {
  open: boolean
  onClose: () => void
  entityType: EntityType | null
  entityCode: string | null
  entityNaam?: string
}

export function ScopeDetailModal({
  open,
  onClose,
  entityType,
  entityCode,
  entityNaam,
}: Props) {
  // Close on ESC.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isOpen = open && entityType !== null && entityCode !== null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="scope-detail-modal-backdrop"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-[720px] max-w-[calc(100vw-32px)] max-h-[85vh] overflow-y-auto mx-4 rounded-[28px] bg-white border border-[#EAEFEF] shadow-2xl p-7"
            style={{ fontFamily: 'Plus Jakarta Sans, ui-sans-serif, system-ui' }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Sluiten"
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full border border-white/60 text-slate-500 hover:text-[#0E1111] hover:border-[#0E1111] transition-colors"
            >
              <X size={14} />
            </button>

            <header className="mb-6 pr-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#F9A826]">
                Data-bronnen
              </p>
              <h2 className="mt-1 text-[20px] font-bold text-[#0E1111] leading-snug">
                {entityNaam ?? entityCode}
              </h2>
            </header>

            <ScopeDataSourcesView entityType={entityType} entityCode={entityCode} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
