/**
 * PillBadgeRow — horizontal row of pill-shaped badges.
 *
 * Renders a flex-wrap row of rounded-full pills with amber or slate variants.
 */

export interface PillBadgeItem {
  label: string
  value: string
  variant?: 'amber' | 'slate'
}

export interface PillBadgeRowProps {
  items: PillBadgeItem[]
}

const variantClasses = {
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
} as const

export function PillBadgeRow({ items }: PillBadgeRowProps) {
  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => {
        const variant = item.variant ?? 'amber'
        return (
          <span
            key={`${item.label}-${idx}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${variantClasses[variant]}`}
          >
            <span className="opacity-70">{item.label}</span>
            <span className="font-semibold">{item.value}</span>
          </span>
        )
      })}
    </div>
  )
}
