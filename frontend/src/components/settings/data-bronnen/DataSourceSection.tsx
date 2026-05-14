/**
 * DataSourceSection — M049/S03
 *
 * Wraps a list of DataSourceRow with a section header + count chip.
 * Used by the route to render 3 sections (cascade_uploads / open_apis /
 * paid_integrations). Empty section shows inline grey copy instead of a
 * full empty-state (gemeente-level emptyness is DataSourcesEmptyState).
 *
 * Title mapping locked in 03-CONTEXT.md §6.
 */
import type { ReactNode } from 'react'

interface Props {
  title: string
  count: number
  children: ReactNode
}

export function DataSourceSection({ title, count, children }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[15px] font-semibold text-[#0E1111]">{title}</h2>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 tabular-nums">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="text-[12px] text-slate-400">
          Nog geen bronnen in deze categorie
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}
