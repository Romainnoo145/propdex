import { cn } from '@/lib/utils'

interface PageTitleToggleProps {
  pages: ReadonlyArray<{ title?: string }>
  activeIndex: number
  onSelect: (index: number) => void
  className?: string
}

/**
 * Horizontal row of page titles that doubles as a section divider AND a tab toggle.
 * Replaces ghost-arrow pagination in PotentieLayer / RisicoLayer / BronnenLayer.
 *
 * Active page: text-aura-ink + amber underline.
 * Inactive: text-slate-300, clickable.
 * Separator: subtle middle-dot between items.
 *
 * Used inside the small ParcelDetailPanel — keep typography compact (10px uppercase).
 */
export function PageTitleToggle({ pages, activeIndex, onSelect, className }: PageTitleToggleProps) {
  if (pages.length === 0) return null

  return (
    <div className={cn('flex items-center gap-2 flex-wrap mb-2', className)}>
      {pages.map((page, i) => {
        const isActive = i === activeIndex
        const title = page.title ?? `Pagina ${i + 1}`
        return (
          <div key={`${title}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-200 text-[10px] select-none">·</span>}
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'text-[10px] font-black tracking-[0.15em] uppercase pb-0.5 border-b transition-colors',
                isActive
                  ? 'text-aura-ink border-aura-amber'
                  : 'text-slate-300 border-transparent hover:text-slate-500',
              )}
            >
              {title}
            </button>
          </div>
        )
      })}
    </div>
  )
}
