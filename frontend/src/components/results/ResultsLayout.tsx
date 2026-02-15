import { useState, useEffect, useRef } from 'react'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels'
import type maplibregl from 'maplibre-gl'
import ResultsTable from './ResultsTable'
import ResultsFilterPanel from './ResultsFilterPanel'
import { ParcelDetailModal } from './ParcelDetailModal'
import { setupParcelScoreClickHandler, setParcelScoreSelection } from '@/components/map/ParcelScoreLayer'
import type { ScanResultItem, ScanResultsFilters } from '@/lib/types/scan'

interface ResultsLayoutProps {
  scanId: string | null
  children: React.ReactNode
  collapsed: boolean
  mapRef: React.RefObject<maplibregl.Map | null>
  onClose?: () => void
}

export default function ResultsLayout({ scanId, children, collapsed, mapRef, onClose }: ResultsLayoutProps) {
  const [filters, setFilters] = useState<ScanResultsFilters>({})
  const [total, setTotal] = useState(0)
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)
  const selectionSourceRef = useRef<'table' | 'map' | null>(null)
  const [modalParcel, setModalParcel] = useState<ScanResultItem | null>(null)
  const leftPanelRef = useRef<ImperativePanelHandle>(null)

  // Collapse/expand left panel based on collapsed prop
  // This keeps the VDOM tree stable so MapView never re-mounts
  useEffect(() => {
    if (collapsed) {
      leftPanelRef.current?.collapse()
    } else {
      leftPanelRef.current?.expand()
    }
  }, [collapsed])

  // Setup map click handler for parcel selection
  useEffect(() => {
    if (collapsed || !mapRef.current) return
    const map = mapRef.current

    // Only setup if score layer exists
    if (!map.getSource('parcel-scores')) return

    const cleanup = setupParcelScoreClickHandler(map, (parcelId, featureId) => {
      selectionSourceRef.current = 'map'
      setSelectedParcelId(parcelId)
      // Highlight on map
      setParcelScoreSelection(map, featureId ?? null, 'parcel_scores')
    })

    return cleanup
  }, [collapsed, mapRef])

  // When selectedParcelId changes FROM TABLE (not map), fly to parcel and highlight
  useEffect(() => {
    if (!selectedParcelId || selectionSourceRef.current !== 'table') return
    if (!mapRef.current) return

    const map = mapRef.current
    const features = map.querySourceFeatures('parcel-scores', {
      sourceLayer: 'parcel_scores',
      filter: ['==', ['get', 'parcel_id'], selectedParcelId],
    })

    if (features.length > 0 && features[0]?.geometry) {
      // Get centroid of the first feature
      const geom = features[0].geometry
      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        // Calculate simple centroid from first ring
        const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0]?.[0]
        if (coords && coords.length > 0) {
          const sumLng = coords.reduce((s, c) => s + (c[0] ?? 0), 0)
          const sumLat = coords.reduce((s, c) => s + (c[1] ?? 0), 0)
          map.flyTo({
            center: [sumLng / coords.length, sumLat / coords.length],
            zoom: Math.max(map.getZoom(), 16),
            duration: 800,
          })
        }
      }

      // Highlight on map
      setParcelScoreSelection(map, features[0].id ?? null, 'parcel_scores')
    }
  }, [selectedParcelId, mapRef])

  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal" autoSaveId="propdex-results">
        {/* Left panel: Results table — collapsible to avoid VDOM tree change */}
        <Panel
          ref={leftPanelRef}
          defaultSize={collapsed ? 0 : 45}
          minSize={0}
          maxSize={70}
          collapsible
          collapsedSize={0}
        >
          <div className="h-full w-full bg-black/40 backdrop-blur-xl flex flex-col overflow-hidden">
            {/* Sticky header with title and close button */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-white">Scanresultaten</h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
                aria-label="Resultaten sluiten"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filter panel */}
            {scanId && (
              <ResultsFilterPanel
                filters={filters}
                onChange={setFilters}
                total={total}
              />
            )}

            {/* Table scrolls within remaining space */}
            <div className="flex-1 overflow-hidden">
              {scanId && (
                <ResultsTable
                  scanId={scanId}
                  filters={filters}
                  selectedParcelId={selectedParcelId}
                  onRowClick={(parcelId) => {
                    selectionSourceRef.current = 'table'
                    setSelectedParcelId(parcelId)
                  }}
                  onRowDoubleClick={(parcel) => {
                    setModalParcel(parcel)
                  }}
                  onTotalChange={setTotal}
                />
              )}
            </div>
          </div>
        </Panel>

        {/* Resize handle — hidden when collapsed */}
        <PanelResizeHandle className={`w-1.5 transition-colors cursor-col-resize relative group ${collapsed ? 'hidden' : 'bg-white/10 hover:bg-white/30'}`}>
          {/* Grip indicator (3 vertical dots) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-1 rounded-full bg-white"></div>
            <div className="w-1 h-1 rounded-full bg-white"></div>
            <div className="w-1 h-1 rounded-full bg-white"></div>
          </div>
        </PanelResizeHandle>

        {/* Right panel: Map — always rendered in same VDOM position */}
        <Panel defaultSize={collapsed ? 100 : 55} minSize={30}>
          <div className="h-full w-full">
            {children}
          </div>
        </Panel>
      </PanelGroup>

      {/* Parcel detail modal */}
      <ParcelDetailModal
        parcel={modalParcel}
        isOpen={!!modalParcel}
        onClose={() => setModalParcel(null)}
      />
    </div>
  )
}
