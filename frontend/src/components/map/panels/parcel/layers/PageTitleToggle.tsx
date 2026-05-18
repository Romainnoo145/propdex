import { cn } from '@/lib/utils'

interface PageTitleToggleProps {
  pages: ReadonlyArray<{ title?: string }>
  activeIndex: number
  onSelect: (index: number) => void
  className?: string
}

/**
 * Horizontal pill-chip toggle for paginated sections inside ParcelDetailPanel.
 * Used by PotentieLayer / RisicoLayer / BronnenLayer to switch between bron-pages.
 *
 * Visual:
 *  - Active chip: solid obsidian background + white text (matches lifecycle-sidebar
 *    active-pill aesthetic).
 *  - Inactive chip: slate ghost text, becomes a white pill on hover.
 *  - Generous vertical margin (my-4) so toggles don't crowd the cards above/below.
 *  - Centered as a strip, wraps if the parent is narrow.
 */
export function PageTitleToggle({ pages, activeIndex, onSelect, className }: PageTitleToggleProps) {
  if (pages.length === 0) return null

  return (
    <div className={cn('flex items-center justify-center gap-1 flex-wrap my-4', className)}>
      {pages.map((page, i) => {
        const isActive = i === activeIndex
        const title = page.title ?? `Pagina ${i + 1}`
        return (
          <button
            key={`${title}-${i}`}
            type="button"
            onClick={() => onSelect(i)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'px-3 py-1.5 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase transition-all',
              isActive
                ? 'bg-aura-obsidian text-white shadow-sm'
                : 'text-slate-400 hover:bg-white/60 hover:text-aura-ink',
            )}
          >
            {title}
          </button>
        )
      })}
    </div>
  )
}
