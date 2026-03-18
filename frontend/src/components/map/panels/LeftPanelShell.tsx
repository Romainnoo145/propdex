import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMapContext } from '@/lib/MapContext'

interface LeftPanelShellProps {
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  /** Optional action buttons rendered to the left of the close button */
  headerActions?: ReactNode
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Left-side panel shell for map context overlays (gemeente, wijk).
 * Mirror of ParcelPanelShell — portal-based, same glass card, same close button.
 */
export function LeftPanelShell({ children, onClose, footer, headerActions }: LeftPanelShellProps) {
  const { leftPanelPortalRef, setLeftPanelOpen } = useMapContext()
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    setPortalTarget(leftPanelPortalRef.current)
  }, [leftPanelPortalRef])

  useEffect(() => {
    setLeftPanelOpen(true)
    return () => setLeftPanelOpen(false)
  }, [setLeftPanelOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const panelContent = (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-[620px] h-full flex flex-col overflow-hidden rounded-[40px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.04)]"
    >
      {/* Header action buttons — absolute, matching ParcelPanelShell */}
      <div className="absolute top-8 right-8 z-10 flex items-center gap-2">
        {headerActions}
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center text-aura-obsidian transition-colors hover:text-aura-obsidian/60"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Sticky footer */}
      {footer && (
        <div className="shrink-0 px-8 pb-8 pt-4">
          {footer}
        </div>
      )}
    </motion.div>
  )

  if (portalTarget) {
    return createPortal(panelContent, portalTarget)
  }

  return panelContent
}
