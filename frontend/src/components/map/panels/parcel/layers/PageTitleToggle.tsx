import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PageTitleToggleProps {
  pages: ReadonlyArray<{ title?: string }>
  activeIndex: number
  onSelect: (index: number) => void
  className?: string
}

/**
 * Sub-nav for paginated bron-pages inside ParcelDetailPanel. Sits below the
 * Potentie / Risico / Dossiers CategoryTabs and mirrors its segmented-pill
 * pattern — same shape language, swapped accent: amber active pill instead
 * of obsidian.
 *
 *   CategoryTabs (parent): obsidian active pill, 13px, h-12
 *   PageTitleToggle (sub): sage-mint active pill, 12px, h-9  ← visual hierarchy
 *
 * Spring layoutId on the active pill so switching pages animates the
 * background instead of cutting between cells.
 */

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase())
}

export function PageTitleToggle({ pages, activeIndex, onSelect, className }: PageTitleToggleProps) {
  const instanceId = useId()
  if (pages.length === 0) return null

  return (
    <div
      className={cn(
        'flex w-full h-9 rounded-full p-1 bg-[#F2F6F3] mt-2 mb-3',
        className,
      )}
    >
      {pages.map((page, i) => {
        const isActive = i === activeIndex
        const rawTitle = page.title ?? `Pagina ${i + 1}`
        const title = toTitleCase(rawTitle)
        return (
          <button
            key={`${rawTitle}-${i}`}
            type="button"
            onClick={() => onSelect(i)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex-1 h-full min-w-0 rounded-full flex items-center justify-center transition-colors text-[12px]',
              isActive
                ? 'text-aura-ink font-bold'
                : 'text-slate-400 font-semibold hover:text-aura-ink',
            )}
          >
            {isActive && (
              <motion.div
                layoutId={`page-toggle-${instanceId}`}
                className="absolute inset-0 rounded-full bg-aura-mint"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 truncate px-1">{title}</span>
          </button>
        )
      })}
    </div>
  )
}
