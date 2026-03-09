import { useEffect, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { GlassPanel } from '@/components/primitives/GlassPanel'

interface ParcelPanelShellProps {
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  parcelId: string
}

export function ParcelPanelShell({
  children,
  onClose,
  footer,
  parcelId,
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
    <div
      className="fixed top-4 right-4 bottom-4 w-[380px] animate-fly-in-right"
      style={{ zIndex: 'var(--z-property-panel)' }}
    >
      <GlassPanel
        blur="active"
        className="relative flex h-full flex-col overflow-hidden rounded-3xl"
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

        {/* Scrollable content area keyed by parcelId for cross-fade */}
        <div key={parcelId} className="flex-1 overflow-hidden animate-fade-in">
          {children}
        </div>

        {/* Sticky footer */}
        {footer && (
          <div className="shrink-0 border-t border-white/20 bg-aura-glass-white/60 p-3 backdrop-blur-sm">
            {footer}
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
