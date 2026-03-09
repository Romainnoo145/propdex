import { useEffect, useCallback } from 'react'

interface MapPanelShellProps {
  children: React.ReactNode
  onClose: () => void
}

export function MapPanelShell({ children, onClose }: MapPanelShellProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <>
      {/* Desktop: right sidebar */}
      <div
        className="fixed right-4 top-20 bottom-4 hidden md:block w-96"
        style={{ zIndex: 'calc(var(--z-map-controls) + 2)' }}
      >
        <div className="h-full overflow-y-auto rounded-lg border border-grey-800 bg-grey-900 shadow-2xl">
          {children}
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 md:hidden max-h-[72vh]"
        style={{ zIndex: 'calc(var(--z-map-controls) + 2)' }}
      >
        <div className="h-full overflow-y-auto rounded-t-lg border border-grey-800 bg-grey-900 shadow-2xl">
          {children}
        </div>
      </div>
    </>
  )
}
