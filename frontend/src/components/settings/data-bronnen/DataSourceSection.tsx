/**
 * DataSourceSection — M049/S03
 *
 * Section header + completion progress + row list.
 *
 * Header: "<title>  ·  X van Y voltooid" with a thin Aura-amber → green
 * progress bar. Surfaces completion-at-a-glance for admins triaging
 * which gemeente still has gaps.
 *
 * Title mapping locked in 03-CONTEXT.md §6.
 */
import type { ReactNode } from 'react'

interface Props {
  title: string
  count: number
  completed: number
  children: ReactNode
}

export function DataSourceSection({ title, count, completed, children }: Props) {
  const ratio = count > 0 ? completed / count : 0
  const percent = Math.round(ratio * 100)

  return (
    <section className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#0E1111]">{title}</h2>
          <span className="text-[11px] font-medium text-slate-500 tabular-nums">
            {completed} van {count} voltooid
          </span>
        </div>
        {count > 0 && (
          <div
            className="h-1 w-full rounded-full bg-slate-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${title}: ${percent}% voltooid`}
          >
            <div
              className="h-full rounded-full bg-[#22C55E] transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
      {count === 0 ? (
        <p className="text-[12px] text-slate-400">
          Nog geen bronnen in deze categorie
        </p>
      ) : (
        <div>{children}</div>
      )}
    </section>
  )
}
