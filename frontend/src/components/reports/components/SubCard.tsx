/**
 * SubCard — simple wrapper div with consistent rounded/border/bg classes.
 *
 * Used throughout S1–S7 for inner content cards (e.g. stat blocks, info panels).
 */

import type { ReactNode } from 'react'

export interface SubCardProps {
  children: ReactNode
  className?: string
}

export function SubCard({ children, className = '' }: SubCardProps) {
  return (
    <div
      className={`rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 ${className}`.trim()}
    >
      {children}
    </div>
  )
}
