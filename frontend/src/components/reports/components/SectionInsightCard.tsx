/**
 * SectionInsightCard — reusable insight card for report sections.
 *
 * Matches WorkspaceInsightCard visual pattern (kicker + title + Lucide icon
 * in a dark circle, rounded-[24px] card) without framer-motion — the parent
 * tab container already handles animation.
 */

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface SectionInsightCardProps {
  /** Small uppercase label above the title */
  kicker: string
  /** Section heading */
  title: string
  /** Lucide icon component rendered inside the dark circle */
  Icon: LucideIcon
  /** Card body content */
  children: ReactNode
  /** Additional CSS classes on the outer wrapper */
  className?: string
}

export function SectionInsightCard({
  kicker,
  title,
  Icon,
  children,
  className = '',
}: SectionInsightCardProps) {
  return (
    <section
      className={`rounded-[24px] border border-[#EAEFEF] bg-white p-5 ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
            {kicker}
          </p>
          <h3 className="mt-2 text-[18px] font-bold tracking-tight text-[#0E1111]">
            {title}
          </h3>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0E1111]">
          <Icon className="size-5 text-[#F9A826]" strokeWidth={2.2} />
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}
