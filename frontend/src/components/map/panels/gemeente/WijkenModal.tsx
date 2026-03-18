import { useMemo } from 'react'
import { MapPin, CheckCircle2, Clock } from 'lucide-react'
import { GemeenteModal } from './GemeenteModal'
import type { ScanListItem } from '@/lib/types/scan'

interface WijkenModalProps {
  gemeenteNaam: string
  gemeenteCode: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  scans: ScanListItem[]
  onClose: () => void
  onSelectWijk: (code: string, naam: string) => void
}

const dateFmt = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * Wijken modal — expanded wijk list with scan status and parcel counts.
 */
export function WijkenModal({
  gemeenteNaam,
  gemeenteCode,
  wijkGeojson,
  scans,
  onClose,
  onSelectWijk,
}: WijkenModalProps) {
  const features = wijkGeojson?.features ?? []

  // Derive scanned wijk names from completed scans
  const scannedWijkNames = useMemo(() => {
    const names = new Set<string>()
    for (const scan of scans) {
      if (scan.gemeente_code === gemeenteCode && scan.status === 'completed' && scan.wijk_naam) {
        names.add(scan.wijk_naam)
      }
    }
    return [...names]
  }, [scans, gemeenteCode])

  // Build scan info per wijk
  const wijkScanInfo = useMemo(() => {
    const map = new Map<string, { parcelCount: number; scanDate: string }>()
    for (const scan of scans) {
      if (
        scan.gemeente_code === gemeenteCode &&
        scan.status === 'completed' &&
        scan.wijk_naam
      ) {
        const existing = map.get(scan.wijk_naam)
        // Keep the most recent scan
        if (!existing || scan.scan_date > existing.scanDate) {
          map.set(scan.wijk_naam, {
            parcelCount: scan.parcel_count,
            scanDate: scan.scan_date,
          })
        }
      }
    }
    return map
  }, [scans, gemeenteCode])

  // Sort: scanned first, then alphabetical
  const sortedFeatures = useMemo(() => {
    return [...features].sort((a, b) => {
      const nameA = (a.properties?.statnaam as string) ?? ''
      const nameB = (b.properties?.statnaam as string) ?? ''
      const scannedA = scannedWijkNames.includes(nameA)
      const scannedB = scannedWijkNames.includes(nameB)
      if (scannedA && !scannedB) return -1
      if (!scannedA && scannedB) return 1
      return nameA.localeCompare(nameB, 'nl')
    })
  }, [features, scannedWijkNames])

  const handleWijkClick = (code: string, naam: string) => {
    onClose()
    onSelectWijk(code, naam)
  }

  return (
    <GemeenteModal title={`Wijken · ${gemeenteNaam}`} onClose={onClose}>
      {features.length === 0 ? (
        <div className="text-center py-12">
          <MapPin size={40} className="mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-600 text-sm">Wijken worden geladen...</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-sm text-neutral-600">
              {features.length} wijken · {scannedWijkNames.length} gescand
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sortedFeatures.map((feature) => {
              const code = (feature.properties?.statcode as string) ?? ''
              const name = (feature.properties?.statnaam as string) ?? code
              const isScanned = scannedWijkNames.includes(name)
              const scanInfo = wijkScanInfo.get(name)

              return (
                <button
                  key={code}
                  onClick={() => handleWijkClick(code, name)}
                  className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left transition-colors hover:bg-neutral-100 hover:border-neutral-300 group"
                >
                  <span className={`mt-0.5 shrink-0 ${isScanned ? 'text-emerald-500' : 'text-neutral-400'}`}>
                    {isScanned ? <CheckCircle2 size={18} /> : <MapPin size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-aura-ink truncate group-hover:text-aura-ink">
                      {name}
                    </p>
                    {isScanned && scanInfo ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-500">
                          {scanInfo.parcelCount} percelen
                        </span>
                        <span className="text-xs text-neutral-400">·</span>
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <Clock size={10} />
                          {dateFmt.format(new Date(scanInfo.scanDate))}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-400 mt-1">Nog niet gescand</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </GemeenteModal>
  )
}
