import { memo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { CategoryKey } from './ParcelBentoOverview'

interface CategoryTabsProps {
  activeCategory: CategoryKey | null
  onSelect: (cat: CategoryKey) => void
}

const TABS: { key: CategoryKey; label: string }[] = [
  { key: 'potentie', label: 'Potentie' },
  { key: 'risico', label: 'Risico' },
  { key: 'dossiers', label: 'Dossiers' },
]

export const CategoryTabs = memo(function CategoryTabs({ activeCategory, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex w-full h-[48px] rounded-full p-1 bg-[#F2F6F3]">
      {TABS.map(({ key, label }) => {
        const isActive = activeCategory === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'relative flex-1 h-full rounded-full flex items-center justify-center transition-colors',
              isActive ? 'text-white' : 'hover:text-slate-600',
            )}
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '13px',
              fontWeight: isActive ? 700 : 600,
              letterSpacing: isActive ? '-0.01em' : '0',
              color: isActive ? undefined : '#94a3b8',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="category-tab"
                className="absolute inset-0 rounded-full"
                style={{ background: '#0E1111' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        )
      })}
    </div>
  )
})
