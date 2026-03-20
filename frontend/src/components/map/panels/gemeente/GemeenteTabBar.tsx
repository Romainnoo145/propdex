import { motion } from 'framer-motion'

export type GemeenteTab = 'demografie' | 'juridisch' | 'bestuurlijk' | 'wijken'

interface GemeenteTabBarProps {
  activeTab: GemeenteTab | null
  onSelect: (tab: GemeenteTab | null) => void
}

const TABS: { key: GemeenteTab; label: string }[] = [
  { key: 'demografie', label: 'Demografie' },
  { key: 'juridisch', label: 'Juridisch' },
  { key: 'bestuurlijk', label: 'Bestuurlijk' },
  { key: 'wijken', label: 'Wijken' },
]

/**
 * Pill tab switcher for GemeenteContextPanel.
 * Matches CategoryTabs pattern from ParcelDetailPanel.
 * Click active tab → deselects (returns to default landing).
 */
export function GemeenteTabBar({ activeTab, onSelect }: GemeenteTabBarProps) {
  return (
    <div className="flex w-full h-[44px] rounded-full p-1 bg-[#F2F6F3] mt-5">
      {TABS.map(({ key, label }) => {
        const isActive = activeTab === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isActive ? null : key)}
            className="relative flex-1 h-full rounded-full flex items-center justify-center transition-colors"
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
                layoutId="gemeente-tab"
                className="absolute inset-0 rounded-full"
                style={{ background: '#0E1111' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={`relative z-10 ${isActive ? 'text-white' : ''}`}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
