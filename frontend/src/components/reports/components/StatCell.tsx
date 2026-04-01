/**
 * StatCell — hero stat grid cell with label, value, and optional children.
 *
 * Used in S1, S4, S5 for the hero stat rows at the top of sections.
 * Renders a centered rounded card with an uppercase label and bold value.
 */

import type { ReactNode } from 'react'

export interface StatCellProps {
  label: string
  value?: ReactNode
  children?: ReactNode
}

export function StatCell({ label, value, children }: StatCellProps) {
  return (
    <div className="rounded-[16px] border border-[#EAEFEF] bg-[#F8FAFA] px-4 py-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      {value !== undefined ? (
        <p className="text-[18px] font-bold text-[#0E1111] tracking-tight mt-1">
          {value}
        </p>
      ) : null}
      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}
