import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import { CompactWijkCard } from './CompactWijkCard'
import { staggerContainer } from './animations'
import type { ScanListItem } from '@/lib/types/scan'

interface WijkenModalProps {
  gemeenteNaam: string
  gemeenteCode: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  scans: ScanListItem[]
  onSelectWijk: (code: string, naam: string) => void
  onClose: () => void
}

interface WijkEntry {
  name: string
  code: string
  hasData: boolean
  parcelCount?: number
}

function deriveWijken(
  wijkGeojson: GeoJSON.FeatureCollection | null,
  scans: ScanListItem[],
  gemeenteCode: string,
): WijkEntry[] {
  // Build scanned wijk map
  const scannedMap = new Map<string, number>()
  for (const s of scans) {
    if (s.gemeente_code !== gemeenteCode || s.status !== 'completed' || !s.wijk_naam) continue
    scannedMap.set(s.wijk_naam, (scannedMap.get(s.wijk_naam) ?? 0) + s.parcel_count)
  }

  const entries: WijkEntry[] = []
  for (const f of (wijkGeojson?.features ?? [])) {
    const name = (f.properties?.statnaam as string) ?? ''
    const code = (f.properties?.statcode as string) ?? ''
    const parcelCount = scannedMap.get(name)
    entries.push({ name, code, hasData: parcelCount != null, parcelCount })
  }

  return entries.sort((a, b) => {
    if (a.hasData && !b.hasData) return -1
    if (!a.hasData && b.hasData) return 1
    return a.name.localeCompare(b.name, 'nl')
  })
}

export function WijkenModal({
  gemeenteNaam,
  gemeenteCode,
  wijkGeojson,
  scans,
  onSelectWijk,
  onClose,
}: WijkenModalProps) {
  const allWijken = useMemo(
    () => deriveWijken(wijkGeojson, scans, gemeenteCode),
    [wijkGeojson, scans, gemeenteCode],
  )

  const wijkenMetData = allWijken.filter(w => w.hasData).length

  return (
    <GemeenteModal
      title={`Wijken in ${gemeenteNaam}`}
      subtitle={`${allWijken.length} wijken${wijkenMetData > 0 ? ` · ${wijkenMetData} met data` : ''}`}
      onClose={onClose}
    >
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-1.5"
      >
        {allWijken.map((wijk) => (
          <CompactWijkCard
            key={wijk.code || wijk.name}
            name={wijk.name}
            code={wijk.code}
            isScanned={wijk.hasData}
            parcelCount={wijk.parcelCount}
            onSelect={() => {
              onSelectWijk(wijk.code, wijk.name)
              onClose()
            }}
          />
        ))}
      </motion.div>

      {allWijken.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MapPin size={24} className="text-slate-300 mb-2" />
          <p className="text-[13px] text-slate-400">Geen wijken beschikbaar</p>
        </div>
      )}
    </GemeenteModal>
  )
}
