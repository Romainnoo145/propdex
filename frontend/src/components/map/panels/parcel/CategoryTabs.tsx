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
  { key: 'juridisch', label: 'Juridisch' },
]

export function CategoryTabs({ activeCategory, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex w-full h-[48px] rounded-[16px] p-1 bg-[#F2F6F3]">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={cn(
            'relative flex-1 h-full rounded-[12px] flex items-center justify-center transition-colors',
            activeCategory === key
              ? 'text-white'
              : 'hover:text-slate-600',
          )}
          style={{
            fontSize: '13px',
            fontWeight: activeCategory === key ? 600 : 500,
            color: activeCategory === key ? undefined : '#8A948D',
          }}
        >
          {activeCategory === key && (
            <motion.div
              layoutId="category-tab"
              className="absolute inset-0 rounded-[12px]"
              style={{ background: '#0E1111' }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative z-10">{label}</span>
        </button>
      ))}
    </div>
  )
}
