import { Fragment } from 'react'
import { cn } from '@/lib/utils'

interface PageTitleToggleProps {
  pages: ReadonlyArray<{ title?: string }>
  activeIndex: number
  onSelect: (index: number) => void
  className?: string
}

/**
 * Sub-nav for paginated bron-pages inside ParcelDetailPanel — sits below the
 * Potentie / Risico / Dossiers CategoryTabs and uses the SAME typographic
 * family (Plus Jakarta Sans, title-case, body-size) so the panel reads as one
 * coherent navigation system instead of mixing newspaper-headline labels with
 * the warm CategoryTabs aesthetic.
 *
 * Hierarchy:
 *   CategoryTabs (parent)    → obsidian pill, 13px, bold
 *   PageTitleToggle (sub)    → amber underline, 12px, bold-on-baseline
 *   Card titles (content)    → uppercase tracked label, the "content register"
 *
 * Three registers, no collisions.
 */

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase())
}

export function PageTitleToggle({ pages, activeIndex, onSelect, className }: PageTitleToggleProps) {
  if (pages.length === 0) return null

  return (
    <div
      className={cn(
        'flex items-end gap-3 flex-wrap border-b border-slate-200 mt-2 mb-3',
        className,
      )}
    >
      {pages.map((page, i) => {
        const isActive = i === activeIndex
        const rawTitle = page.title ?? `Pagina ${i + 1}`
        const title = toTitleCase(rawTitle)
        return (
          <Fragment key={`${rawTitle}-${i}`}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className="w-px h-3 bg-slate-200 mb-2 shrink-0"
              />
            )}
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'pb-2 -mb-px text-[12px] transition-all border-b-2',
                isActive
                  ? 'text-aura-ink font-bold border-aura-amber'
                  : 'text-slate-400 font-semibold border-transparent hover:text-aura-ink',
              )}
            >
              {title}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
