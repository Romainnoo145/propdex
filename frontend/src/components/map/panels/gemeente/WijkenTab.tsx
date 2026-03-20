import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { CompactWijkCard } from './CompactWijkCard'
import { staggerContainer, fadeUp } from './animations'
import type { ScanListItem } from '@/lib/types/scan'

interface WijkenTabProps {
  wijkGeojson: GeoJSON.FeatureCollection | null
  scans: ScanListItem[]
  gemeenteCode: string
  onSelectWijk: (code: string, naam: string) => void
  onOpenModal: () => void
}

const MAX_VISIBLE = 10

/**
 * Wijken tab — 2-column grid of CompactWijkCards with stagger entrance.
 * Truncates at 10 wijken with a "meer wijken" button.
 */
export function WijkenTab({ wijkGeojson, scans, gemeenteCode, onSelectWijk, onOpenModal }: WijkenTabProps) {
  const features = wijkGeojson?.features ?? []

  // Build scan info per wijk name
  const scanMap = useMemo(() => {
    const map = new Map<string, { parcelCount: number }>()
    for (const scan of scans) {
      if (scan.gemeente_code === gemeenteCode && scan.status === 'completed' && scan.wijk_naam) {
        const existing = map.get(scan.wijk_naam)
        if (!existing || scan.parcel_count > existing.parcelCount) {
          map.set(scan.wijk_naam, { parcelCount: scan.parcel_count })
        }
      }
    }
    return map
  }, [scans, gemeenteCode])

  if (features.length === 0) {
    return (
      <div className="px-8 pt-5 pb-6">
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-[13px] text-slate-400">Geen wijken gevonden</p>
        </div>
      </div>
    )
  }

  const visible = features.slice(0, MAX_VISIBLE)
  const remaining = features.length - MAX_VISIBLE

  return (
    <motion.div
      className="px-8 pt-5 pb-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <div className="grid grid-cols-2 gap-1.5">
        {visible.map((feature) => {
          const featureCode = (feature.properties?.statcode as string) ?? ''
          const name = (feature.properties?.statnaam as string) ?? featureCode
          const scanInfo = scanMap.get(name)

          return (
            <CompactWijkCard
              key={featureCode}
              name={name}
              code={featureCode}
              isScanned={!!scanInfo}
              parcelCount={scanInfo?.parcelCount}
              onSelect={() => onSelectWijk(featureCode, name)}
            />
          )
        })}
      </div>

      {remaining > 0 && (
        <motion.button
          variants={fadeUp}
          onClick={onOpenModal}
          className="w-full mt-2 h-[36px] rounded-[14px] bg-[#F2F6F3] text-[12px] font-semibold text-[#0E1111] hover:bg-[#E8EDEB] transition-colors flex items-center justify-center gap-1"
        >
          + {remaining} meer wijken
          <ChevronRight size={12} className="text-slate-400" />
        </motion.button>
      )}
    </motion.div>
  )
}
