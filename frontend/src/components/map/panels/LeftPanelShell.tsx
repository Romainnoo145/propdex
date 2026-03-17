import { useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

interface LeftPanelShellProps {
  children: React.ReactNode
  onClose: () => void
}

/**
 * Left-side panel shell for map overlays (GemeenteContextPanel).
 * Desktop: fixed to the left of the side rail (112px = 80px rail + 32px gap).
 * Mobile: bottom sheet.
 */
export function LeftPanelShell({ children, onClose }: LeftPanelShellProps) {
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
    <>
      {/* Desktop: left panel */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-[112px] top-4 bottom-4 hidden md:flex w-[400px] flex-col"
        style={{ zIndex: 'calc(var(--z-map-controls) + 2)' }}
      >
        <div className="h-full overflow-y-auto rounded-[24px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          {children}
        </div>
      </motion.div>

      {/* Mobile: bottom sheet */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-x-0 bottom-0 md:hidden max-h-[72vh]"
        style={{ zIndex: 'calc(var(--z-map-controls) + 2)' }}
      >
        <div className="h-full overflow-y-auto rounded-t-[24px] bg-white/60 backdrop-blur-[24px] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
          {children}
        </div>
      </motion.div>
    </>
  )
}
