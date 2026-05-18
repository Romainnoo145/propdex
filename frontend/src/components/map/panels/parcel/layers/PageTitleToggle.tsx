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
 *  - Active chip: warm amber wash (bg-aura-amber/15 + text-aura-amber). Soft,
 *    not heavy. Reads as "selected" without dominating the panel.
 *  - Inactive chip: slate ghost text (medium weight), becomes a white/60 pill
 *    on hover so the affordance is obvious.
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
                ? 'bg-aura-amber/15 text-aura-amber'
                : 'text-slate-400 font-medium hover:bg-white/60 hover:text-aura-ink',
            )}
          >
            {title}
          </button>
        )
      })}
    </div>
  )
}
