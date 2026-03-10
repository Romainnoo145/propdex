import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useMapContext } from '@/lib/MapContext'

interface ParcelPanelShellProps {
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ParcelPanelShell({
  children,
  onClose,
  footer,
}: ParcelPanelShellProps) {
  const { panelPortalRef, setPanelOpen } = useMapContext()
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null)

  // Capture portal target after mount (avoids ref access during render)
  useEffect(() => {
    setPortalTarget(panelPortalRef.current)
  }, [panelPortalRef])

  // Signal layout that panel is open
  useEffect(() => {
    setPanelOpen(true)
    return () => setPanelOpen(false)
  }, [setPanelOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
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
      {/* Close button — overlays hero */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        aria-label="Sluiten"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Sticky footer */}
      {footer && (
        <div className="shrink-0 p-6">
          {footer}
        </div>
      )}
    </motion.div>
  )

  // Render into the portal target in _authenticated layout
  if (portalTarget) {
    return createPortal(panelContent, portalTarget)
  }

  // Fallback: render in place (shouldn't happen after mount)
  return panelContent
}
