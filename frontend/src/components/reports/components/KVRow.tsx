/**
 * KVRow — label / value display row with optional monospace styling.
 *
 * Used across S1–S7 for key-value detail rows inside SectionInsightCards.
 * Returns null when value is falsy to avoid empty rows.
 */

export interface KVRowProps {
  label: string
  value: string | null | undefined
  mono?: boolean
}

export function KVRow({ label, value, mono }: KVRowProps) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#EAEFEF] last:border-b-0">
      <span className="text-[12px] text-slate-400">
        {label}
      </span>
      <span
        className={`text-[13px] font-semibold text-[#0E1111] text-right ${mono ? 'font-mono text-[11px]' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
