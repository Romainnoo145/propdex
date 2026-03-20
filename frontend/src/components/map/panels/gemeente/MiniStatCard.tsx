import type { ReactNode } from 'react'

interface MiniStatCardProps {
  icon: ReactNode
  label: string
  value: string | null | undefined
  subtitle?: string
  valueColor?: string
}

/**
 * Stat card for gemeente/wijk panel KPIs and demographic grids.
 * Matches ParcelDetailPanel card styling: rounded-[24px], white bg, border-[#EAEFEF], p-5.
 * Icons always slate — no semantic coloring.
 */
export function MiniStatCard({ icon, label, value, subtitle, valueColor }: MiniStatCardProps) {
  const displayValue = value ?? '—'
  const isEmpty = !value

  return (
    <div className="flex flex-col justify-between rounded-[24px] bg-white border border-[#EAEFEF] p-5">
      {/* Top: icon + label */}
      <div className="flex items-center gap-1.5">
        <span className="text-[#94a3b8]">{icon}</span>
        <span
          className="text-[11px] font-extrabold uppercase"
          style={{ letterSpacing: '0.15em', color: '#94a3b8' }}
        >
          {label}
        </span>
      </div>

      {/* Hero value — big and bold like parcel panel */}
      <div className="mt-3">
        <span
          className="text-[32px] font-black tracking-tighter tabular-nums leading-none"
          style={{ color: valueColor ?? (isEmpty ? '#cbd5e1' : '#0E1111') }}
        >
          {displayValue}
        </span>
      </div>

      {/* Optional "so what?" subtitle */}
      {subtitle && (
        <span
          className="text-[11px] mt-1.5 leading-tight"
          style={{ color: '#94a3b8' }}
        >
          {subtitle}
        </span>
      )}
    </div>
  )
}
