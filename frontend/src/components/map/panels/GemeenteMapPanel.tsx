import { MapPanelShell } from './MapPanelShell'

interface GemeenteMapPanelProps {
  naam: string
  wijkGeojson: GeoJSON.FeatureCollection | null
  scannedWijkNames: string[]
  onClose: () => void
  onSelectWijk: (wijkCode: string, wijkNaam: string) => void
}

export function GemeenteMapPanel({
  naam,
  wijkGeojson,
  scannedWijkNames,
  onClose,
  onSelectWijk,
}: GemeenteMapPanelProps) {
  const features = wijkGeojson?.features ?? []
  const wijkCount = features.length
  const scannedCount = scannedWijkNames.length

  return (
    <MapPanelShell onClose={onClose}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-grey-100">{naam}</h2>
            <p className="text-xs text-grey-400 mt-0.5">Gemeente</p>
          </div>
          <button
            onClick={onClose}
            className="text-grey-400 hover:text-grey-100 transition-colors p-1"
            aria-label="Sluiten"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-grey-800 text-grey-300">
            {wijkCount} wijken
          </span>
          {scannedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-900/40 text-emerald-400">
              {scannedCount} gescand
            </span>
          )}
        </div>

        {/* Wijk list */}
        <div className="space-y-0.5">
          <h3 className="text-xs font-semibold text-grey-400 uppercase tracking-wider mb-2">
            Wijken
          </h3>
          {features.length === 0 ? (
            <p className="text-sm text-grey-500 py-2">Wijken laden...</p>
          ) : (
            <ul className="space-y-0.5">
              {features.map((feature) => {
                const code = (feature.properties?.statcode as string) ?? ''
                const name = (feature.properties?.statnaam as string) ?? code
                const isScanned = scannedWijkNames.includes(name)
                return (
                  <li key={code}>
                    <button
                      onClick={() => onSelectWijk(code, name)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm text-grey-200 hover:bg-grey-800 hover:text-grey-100 transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{name}</span>
                      {isScanned && (
                        <span className="text-xs text-emerald-400 opacity-70 group-hover:opacity-100">
                          gescand
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </MapPanelShell>
  )
}
