import { useEffect, useCallback, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

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

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { x: '-100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { x: '-100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed left-[112px] top-6 bottom-6 w-[420px] flex flex-col overflow-hidden rounded-[32px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.04)]"
      style={{ zIndex: 'var(--z-property-panel)' }}
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
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Sticky footer */}
      {footer && (
        <div className="shrink-0 p-4">
          {footer}
        </div>
      )}
    </motion.div>
  )
}
