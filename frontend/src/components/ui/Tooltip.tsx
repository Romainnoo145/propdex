/**
 * Tooltip — minimal hover tooltip using CSS group/group-hover pattern.
 *
 * This is NOT shadcn/Radix — the project uses its own tooltip pattern
 * (see TeamAttributionBadge.tsx for precedent). This component wraps the
 * pattern for reuse in data-bronnen components.
 *
 * Usage:
 *   <Tooltip content="Error detail here">
 *     <span>hover me</span>
 *   </Tooltip>
 */
import type { ReactNode } from 'react'

interface Props {
  content: ReactNode
  side?: 'top' | 'bottom'
  className?: string
  children: ReactNode
}

export function Tooltip({ content, side = 'top', className, children }: Props) {
  const positionClass = side === 'top' ? 'bottom-full left-0 mb-1.5' : 'top-full left-0 mt-1.5'

  return (
    <div className={`group relative inline-flex${className ? ` ${className}` : ''}`}>
      {children}
      <div
        className={`absolute ${positionClass} hidden group-hover:block z-50 pointer-events-none`}
      >
        <div className="bg-slate-800 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg max-w-[240px] leading-snug whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  )
}
