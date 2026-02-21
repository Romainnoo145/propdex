import type { ReactNode } from 'react'

interface GemeenteCardGridProps {
  children: ReactNode
}

/**
 * Responsive grid wrapper for GemeenteCard components.
 * Breakpoints: 1 column (mobile) → 2 columns (sm/640px+) → 3 columns (lg/1024px+)
 */
export function GemeenteCardGrid({ children }: GemeenteCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}

/**
 * Loading skeleton that mimics the GemeenteCard layout.
 * Renders pulse-animated placeholders for the SVG area and text.
 * Use while GeoJSON data is loading on the Projecten page.
 */
export function GemeenteCardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-grey-800 bg-grey-900">
          {/* SVG silhouette placeholder — matches aspect-[5/3] of GemeenteCard */}
          <div className="aspect-[5/3] bg-grey-950/50 animate-pulse" />
          {/* Text area placeholder */}
          <div className="px-4 py-3 space-y-2">
            <div className="h-5 w-2/3 rounded bg-grey-800 animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-grey-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
