import { cn } from '@/lib/utils'

interface ResultsShellProps {
  children: React.ReactNode
  className?: string
}

/**
 * Scrollable data content shell for non-map authenticated routes.
 *
 * Uses solid bg-grey-950 background (NOT glassmorphism) per DS-04:
 * data content areas use solid backgrounds for readability.
 *
 * Routes using this: /projecten, /instellingen, /rapport/:id
 */
export default function ResultsShell({ children, className }: ResultsShellProps) {
  return (
    <div className={cn('w-full h-full overflow-y-auto bg-grey-950', className)}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  )
}
