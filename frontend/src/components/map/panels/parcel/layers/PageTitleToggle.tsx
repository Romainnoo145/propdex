import { cn } from '@/lib/utils'

interface PageTitleToggleProps {
  pages: ReadonlyArray<{ title?: string }>
  activeIndex: number
  onSelect: (index: number) => void
  className?: string
}

/**
 * Section-divider tab strip. The labels ARE the divider between the hero
 * above and the card grid below — they sit on a slate baseline; the active
 * label breaks that baseline with a thicker amber stroke (magazine pattern).
 *
 * Left-aligned (not centered) — first label sits flush with the panel inset
 * so it visually anchors to the surrounding content instead of floating.
 *
 * Used by PotentieLayer / RisicoLayer / BronnenLayer to switch bron-pages.
 */
export function PageTitleToggle({ pages, activeIndex, onSelect, className }: PageTitleToggleProps) {
  if (pages.length === 0) return null

  return (
    <div
      className={cn(
        'flex items-end gap-4 flex-wrap border-b border-slate-200 mt-4 mb-3',
        className,
      )}
    >
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
              'pb-2 -mb-px text-[10px] tracking-[0.15em] uppercase transition-all border-b-2',
              isActive
                ? 'text-aura-ink font-bold border-aura-amber'
                : 'text-slate-400 font-medium border-transparent hover:text-aura-ink',
            )}
          >
            {title}
          </button>
        )
      })}
    </div>
  )
}
