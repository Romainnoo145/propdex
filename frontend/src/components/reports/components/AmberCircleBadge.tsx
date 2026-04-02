/**
 * AmberCircleBadge — circular amber-bordered badge for displaying key stats.
 *
 * Used in S1 Locatie and other sections that need compact metric display
 * with amber theming consistent with the workspace design system.
 */

import type { ReactNode } from 'react'

export interface AmberCircleBadgeProps {
  value: ReactNode
  label: string
  size?: 'sm' | 'md'
}

const sizeConfig = {
  sm: { box: 'h-11 w-11', text: 'text-sm' },   // 44px
  md: { box: 'h-14 w-14', text: 'text-lg' },    // 56px
} as const

export function AmberCircleBadge({
  value,
  label,
  size = 'md',
}: AmberCircleBadgeProps) {
  const cfg = sizeConfig[size]

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${cfg.box} rounded-full border-2 border-aura-amber bg-aura-amber/10 flex items-center justify-center`}
      >
        <span className={`${cfg.text} font-bold text-slate-800`}>{value}</span>
      </div>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}
