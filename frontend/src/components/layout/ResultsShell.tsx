import { cn } from '@/lib/utils'

interface ResultsShellProps {
  children: React.ReactNode
  className?: string
  fullWidth?: boolean // bypass inner max-w-5xl container for full-width data views
}

/**
 * Scrollable data content shell for non-map authenticated routes.
 *
 * Uses solid bg-grey-950 background (NOT glassmorphism) per DS-04:
 * data content areas use solid backgrounds for readability.
 *
 * pb-14 md:pb-0 clears the fixed bottom tab bar on mobile. Added here (not on
 * <main>) so the MapView on /map fills the full viewport without a 56px gap.
 *
 * Routes using this: /projecten, /instellingen, /rapport/:id, /resultaten (fullWidth)
 */
export default function ResultsShell({ children, className, fullWidth }: ResultsShellProps) {
  return (
    <div className={cn('w-full h-full overflow-y-auto bg-grey-950 pb-14 md:pb-0', className)}>
      {fullWidth ? children : (
        <div className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </div>
      )}
    </div>
  )
}
