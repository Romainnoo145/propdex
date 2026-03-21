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
 * Uses solid #FAFCFA (a half-step lighter than aura-canvas #F2F6F3) so the
 * rounded-[40px] container visually separates from the canvas background
 * behind the sidebar. NOT glassmorphism per DS-04.
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
    <div className={cn('w-full h-full overflow-y-auto bg-[#FAFCFA] rounded-[40px] pb-14 md:pb-0', className)}>
      {fullWidth ? children : (
        <div className={cn('mx-auto max-w-5xl px-6 py-8', contentClassName)}>
          {children}
        </div>
      )}
    </div>
  )
}
