import { motion } from 'framer-motion'

export type GemeenteLayer = 'vergunningen' | 'regelgeving' | 'beleid' | 'activiteit'

interface GemeenteCategoryTabsProps {
  activeLayer: GemeenteLayer | null
  onSelect: (layer: GemeenteLayer) => void
}

const TABS: { key: GemeenteLayer; label: string }[] = [
  { key: 'vergunningen', label: 'Vergunningen' },
  { key: 'regelgeving', label: 'Regelgeving' },
  { key: 'beleid', label: 'Beleid & Nieuws' },
  { key: 'activiteit', label: 'Mijn Activiteit' },
]

/**
 * Pill tab switcher for gemeente panel — 4 layers.
 * Overview is shown when activeLayer is null (no tab selected).
 */
export function GemeenteCategoryTabs({ activeLayer, onSelect }: GemeenteCategoryTabsProps) {
  return (
    <div className="flex w-full h-[44px] rounded-full p-1 bg-[#F2F6F3]">
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
              fontSize: '12px',
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
