import { cn } from '@/lib/utils'

interface ResultsShellProps {
  children: React.ReactNode
  className?: string
  fullWidth?: boolean // bypass inner max-w-5xl container for full-width data views
  contentClassName?: string
}

/**
 * Scrollable data content shell for non-map authenticated routes.
 *
 * Uses solid bg-aura-canvas background (NOT glassmorphism) per DS-04:
 * data content areas use solid backgrounds for readability.
 *
 * pb-14 md:pb-0 clears the fixed bottom tab bar on mobile. Added here (not on
 * <main>) so the MapView on /map fills the full viewport without a 56px gap.
 *
 * Routes using this: /projecten, /instellingen, /rapport/:id, /resultaten (fullWidth)
 */
export default function ResultsShell({
  children,
  className,
  fullWidth,
  contentClassName,
}: ResultsShellProps) {
  return (
    <div className={cn('w-full h-full overflow-y-auto bg-aura-canvas pb-14 md:pb-0 md:pl-[112px]', className)}>
      {fullWidth ? children : (
        <div className={cn('mx-auto max-w-5xl px-6 py-8', contentClassName)}>
          {children}
        </div>
      )}
    </div>
  )
}
