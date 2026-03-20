import { motion } from 'framer-motion'

export type GemeenteLayer = 'klimaat' | 'bestuurlijk' | 'activiteit'

interface GemeenteCategoryTabsProps {
  activeLayer: GemeenteLayer | null
  onSelect: (layer: GemeenteLayer) => void
}

const TABS: { key: GemeenteLayer; label: string }[] = [
  { key: 'klimaat', label: 'Klimaat' },
  { key: 'bestuurlijk', label: 'Bestuurlijk' },
  { key: 'activiteit', label: 'Activiteit' },
]

/**
 * Pill tab switcher — matches ParcelDetailPanel's CategoryTabs exactly.
 * 3 layers: Klimaat (regulatory) / Bestuurlijk (political) / Activiteit (my work).
 * Unlike old GemeenteTabBar, clicking active tab does NOT deselect (layers are one-way like parcel panel).
 */
export function GemeenteCategoryTabs({ activeLayer, onSelect }: GemeenteCategoryTabsProps) {
  return (
    <div className="flex w-full h-[48px] rounded-full p-1 bg-[#F2F6F3]">
      {TABS.map(({ key, label }) => {
        const isActive = activeLayer === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
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
                layoutId="gemeente-layer-tab"
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
